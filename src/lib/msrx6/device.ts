'use client'

import {
  buildIsoWrite,
  commands,
  concatBytes,
  findDeviceStatus,
  parseIsoRead,
  statusLabel,
  wrapHidPackets,
  type Coercivity,
  type DeviceStatus,
  type IsoTracks,
} from './protocol'

export type Msrx6Transport = 'bluetooth' | 'serial' | 'hid'

const BLE_OPTIONAL_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000ffe5-0000-1000-8000-00805f9b34fb',
  '0000fff0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
]

const NORDIC_UART_RX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
const NORDIC_UART_TX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'

type BluetoothLike = {
  requestDevice(options: Record<string, unknown>): Promise<BluetoothDeviceLike>
  getDevices?(): Promise<BluetoothDeviceLike[]>
}

type BluetoothDeviceLike = {
  id?: string
  name?: string
  gatt?: {
    connected: boolean
    connect(): Promise<BluetoothRemoteGattServerLike>
    disconnect(): void
  }
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

type BluetoothRemoteGattServerLike = {
  getPrimaryServices(): Promise<BluetoothRemoteGattServiceLike[]>
}

type BluetoothRemoteGattServiceLike = {
  getCharacteristics(): Promise<BluetoothRemoteGattCharacteristicLike[]>
}

type BluetoothRemoteGattCharacteristicLike = {
  uuid: string
  properties: {
    write?: boolean
    writeWithoutResponse?: boolean
    notify?: boolean
    indicate?: boolean
  }
  startNotifications(): Promise<unknown>
  stopNotifications(): Promise<unknown>
  writeValue(data: BufferSource): Promise<void>
  writeValueWithoutResponse?(data: BufferSource): Promise<void>
  writeValueWithResponse?(data: BufferSource): Promise<void>
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
  value?: DataView
}

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>
  close(): Promise<void>
}

type SerialLike = {
  requestPort(): Promise<SerialPortLike>
  getPorts?(): Promise<SerialPortLike[]>
}

type HidDeviceLike = {
  productName?: string
  opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
  addEventListener(type: string, listener: (event: Event) => void): void
  removeEventListener(type: string, listener: (event: Event) => void): void
}

type HidLike = {
  requestDevice(options: { filters: unknown[] }): Promise<HidDeviceLike[]>
  getDevices?(): Promise<HidDeviceLike[]>
}

function hardwareNavigator() {
  return navigator as Navigator & {
    bluetooth?: BluetoothLike
    serial?: SerialLike
    hid?: HidLike
  }
}

export function getMsrx6BrowserSupport() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { bluetooth: false, serial: false, hid: false, secureContext: false }
  }
  const nav = hardwareNavigator()
  return {
    bluetooth: Boolean(nav.bluetooth),
    serial: Boolean(nav.serial),
    hid: Boolean(nav.hid),
    secureContext: window.isSecureContext,
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export class Msrx6CancelledError extends Error {
  constructor() {
    super('Writer operation cancelled')
    this.name = 'Msrx6CancelledError'
  }
}

export function isMsrx6Cancelled(error: unknown) {
  return error instanceof Msrx6CancelledError || (error instanceof Error && error.name === 'Msrx6CancelledError')
}

class BytePump {
  private buffer = new Uint8Array(0)
  private waiters: Array<{
    test: (buffer: Uint8Array) => boolean
    resolve: (buffer: Uint8Array) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  push(chunk: Uint8Array) {
    const copy = new Uint8Array(chunk.length)
    copy.set(chunk)
    this.buffer = concatBytes(this.buffer, copy)
    this.flush()
  }

  clear() {
    this.buffer = new Uint8Array(0)
  }

  rejectAll(error: Error) {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    this.waiters = []
  }

  wait(test: (buffer: Uint8Array) => boolean, timeoutMs: number, label: string): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      if (test(this.buffer)) {
        resolve(this.buffer)
        return
      }

      const waiter = {
        test,
        resolve: (buffer: Uint8Array) => {
          this.waiters = this.waiters.filter((item) => item !== waiter)
          resolve(buffer)
        },
        reject: (error: Error) => {
          this.waiters = this.waiters.filter((item) => item !== waiter)
          reject(error)
        },
        timer: setTimeout(() => {
          waiter.reject(new Error(`${label} timed out. Swipe the card through the writer and try again.`))
        }, timeoutMs),
      }

      this.waiters.push(waiter)
    })
  }

  private flush() {
    for (const waiter of [...this.waiters]) {
      if (waiter.test(this.buffer)) {
        clearTimeout(waiter.timer)
        waiter.resolve(this.buffer)
      }
    }
  }
}

export class Msrx6Session {
  name = 'MSRx6'
  transport: Msrx6Transport = 'bluetooth'
  deviceId: string | null = null
  onDrop: (() => void) | null = null
  private pump = new BytePump()
  private sendBytes: ((data: Uint8Array) => Promise<void>) | null = null
  private cleanup: (() => Promise<void>) | null = null
  private hidWrap = false
  private cancelled = false

  get connected() {
    return this.sendBytes !== null
  }

  async connectBluetooth(acceptAll = false) {
    const nav = hardwareNavigator()
    if (!nav.bluetooth) {
      throw new Error('Web Bluetooth is not available. Use Chrome or Edge on this computer, not Safari.')
    }

    const device = await nav.bluetooth.requestDevice(
      acceptAll
        ? { acceptAllDevices: true, optionalServices: BLE_OPTIONAL_SERVICES }
        : {
            filters: [
              { namePrefix: 'MSR' },
              { namePrefix: 'BT' },
              { namePrefix: 'X6' },
              { namePrefix: 'Deftun' },
              { namePrefix: 'Easy' },
              { namePrefix: 'MINI' },
            ],
            optionalServices: BLE_OPTIONAL_SERVICES,
          }
    )
    await this.bindBluetoothDevice(device)
  }

  async reconnectBluetooth(preferredId?: string) {
    const nav = hardwareNavigator()
    if (!nav.bluetooth?.getDevices) {
      throw new Error('This browser cannot reconnect to a paired writer automatically. Connect Bluetooth once.')
    }
    const devices = await nav.bluetooth.getDevices()
    if (!devices.length) {
      throw new Error('No paired MSRx6 yet. Click Connect Bluetooth once to pair it.')
    }
    const device =
      (preferredId ? devices.find((item) => item.id === preferredId) : undefined) ||
      devices.find((item) => /msr|x6|deftun|mini/i.test(item.name || '')) ||
      devices[0]
    await this.bindBluetoothDevice(device)
  }

  async connectSerial() {
    const nav = hardwareNavigator()
    if (!nav.serial) {
      throw new Error('Web Serial is not available. Use Chrome or Edge, then plug the MSRx6 in over USB.')
    }
    const port = await nav.serial.requestPort()
    await this.bindSerialPort(port)
  }

  async reconnectSerial() {
    const nav = hardwareNavigator()
    const ports = await nav.serial?.getPorts?.()
    if (!ports?.length) {
      throw new Error('No remembered USB serial writer. Click Connect USB once to grant access.')
    }
    await this.bindSerialPort(ports[0])
  }

  async connectHid() {
    const nav = hardwareNavigator()
    if (!nav.hid) {
      throw new Error('WebHID is not available. Use Chrome or Edge, then plug the MSRx6 in over USB.')
    }
    const [device] = await nav.hid.requestDevice({ filters: [] })
    if (!device) {
      throw new Error('No USB HID device selected.')
    }
    await this.bindHidDevice(device)
  }

  async reconnectHid() {
    const nav = hardwareNavigator()
    const devices = await nav.hid?.getDevices?.()
    if (!devices?.length) {
      throw new Error('No remembered USB HID writer. Click USB HID once to grant access.')
    }
    await this.bindHidDevice(devices[0])
  }

  private async bindBluetoothDevice(device: BluetoothDeviceLike) {
    if (!device.gatt) {
      throw new Error('That Bluetooth device does not expose GATT. Plug it in over USB instead.')
    }

    const server = await device.gatt.connect()
    const services = await server.getPrimaryServices()
    const characteristics: BluetoothRemoteGattCharacteristicLike[] = []
    for (const service of services) {
      characteristics.push(...(await service.getCharacteristics()))
    }

    const rx =
      characteristics.find((item) => item.uuid === NORDIC_UART_RX) ||
      characteristics.find((item) => item.properties.notify || item.properties.indicate)
    const tx =
      characteristics.find((item) => item.uuid === NORDIC_UART_TX) ||
      characteristics.find(
        (item) => item.properties.writeWithoutResponse || item.properties.write
      )

    if (!tx) {
      throw new Error(
        'Connected over Bluetooth but could not find a writable characteristic. This unit may be Classic SPP, not BLE — plug in USB and use Connect USB.'
      )
    }

    const onValue = (event: Event) => {
      const target = event.target as unknown as BluetoothRemoteGattCharacteristicLike
      if (target.value) {
        this.pump.push(new Uint8Array(target.value.buffer, target.value.byteOffset, target.value.byteLength))
      }
    }

    if (rx) {
      await rx.startNotifications()
      rx.addEventListener('characteristicvaluechanged', onValue)
    }

    const onDisconnected = () => {
      this.sendBytes = null
      this.pump.rejectAll(new Error('MSRx6 disconnected'))
      this.onDrop?.()
    }
    device.addEventListener('gattserverdisconnected', onDisconnected)

    this.name = device.name || 'MSRx6 Bluetooth'
    this.deviceId = device.id || null
    this.transport = 'bluetooth'
    this.hidWrap = false
    this.sendBytes = async (data) => {
      const chunkSize = 20
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize)
        if (tx.properties.writeWithoutResponse && tx.writeValueWithoutResponse) {
          await tx.writeValueWithoutResponse(chunk)
        } else if (tx.writeValueWithResponse) {
          await tx.writeValueWithResponse(chunk)
        } else {
          await tx.writeValue(chunk)
        }
        await delay(12)
      }
    }
    this.cleanup = async () => {
      device.removeEventListener('gattserverdisconnected', onDisconnected)
      if (rx) {
        rx.removeEventListener('characteristicvaluechanged', onValue)
        try {
          await rx.stopNotifications()
        } catch {
          // already gone
        }
      }
      try {
        device.gatt?.disconnect()
      } catch {
        // already gone
      }
    }

    await this.probe()
  }

  private async bindSerialPort(port: SerialPortLike) {
    if (!port.readable) {
      await port.open({ baudRate: 9600, bufferSize: 255 })
    }
    if (!port.readable || !port.writable) {
      throw new Error('Could not open the USB serial port.')
    }

    const reader = port.readable.getReader()
    const writer = port.writable.getWriter()
    let reading = true

    const readLoop = (async () => {
      try {
        while (reading) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) this.pump.push(value)
        }
      } catch {
        this.sendBytes = null
        this.pump.rejectAll(new Error('USB serial connection closed'))
        this.onDrop?.()
      }
    })()

    this.name = 'MSRx6 USB Serial'
    this.deviceId = null
    this.transport = 'serial'
    this.hidWrap = false
    this.sendBytes = async (data) => {
      await writer.write(data)
    }
    this.cleanup = async () => {
      reading = false
      try {
        await reader.cancel()
      } catch {
        // already closed
      }
      reader.releaseLock()
      writer.releaseLock()
      await readLoop
      try {
        await port.close()
      } catch {
        // already closed
      }
    }

    await this.probe()
  }

  private async bindHidDevice(device: HidDeviceLike) {
    if (!device.opened) {
      await device.open()
    }

    const onInput = (event: Event) => {
      const report = event as Event & { data?: DataView }
      if (!report.data) return
      const view = report.data
      this.pump.push(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    }
    device.addEventListener('inputreport', onInput)

    this.name = device.productName || 'MSRx6 USB HID'
    this.deviceId = null
    this.transport = 'hid'
    this.hidWrap = true
    this.sendBytes = async (data) => {
      const packets = wrapHidPackets(data)
      for (const packet of packets) {
        const body = new Uint8Array(packet.length - 1)
        body.set(packet.subarray(1))
        await device.sendReport(packet[0], body)
        await delay(8)
      }
    }
    this.cleanup = async () => {
      device.removeEventListener('inputreport', onInput)
      if (device.opened) await device.close()
    }

    try {
      await this.probe()
    } catch {
      this.hidWrap = false
      this.sendBytes = async (data) => {
        const copy = new Uint8Array(data.length)
        copy.set(data)
        await device.sendReport(0, copy)
      }
      await this.probe()
    }
  }

  async disconnect() {
    this.pump.rejectAll(new Error('Disconnected'))
    this.pump.clear()
    const cleanup = this.cleanup
    this.sendBytes = null
    this.cleanup = null
    if (cleanup) await cleanup()
  }

  async setCoercivity(mode: Coercivity) {
    const status = await this.sendAndWaitStatus(
      mode === 'hico' ? commands.setHico : commands.setLoco,
      3000,
      'Coercivity command'
    )
    if (status !== 'ok' && status !== 'commOk') {
      throw new Error(`Could not set ${mode === 'hico' ? 'HiCo' : 'LoCo'}: ${statusLabel(status)}`)
    }
  }

  async cancelPending() {
    this.cancelled = true
    this.pump.rejectAll(new Msrx6CancelledError())
    this.pump.clear()
    try {
      await this.send(commands.reset)
    } catch {
      // Device already gone; the pending swipe wait is still cancelled above.
    }
    await delay(80)
    this.pump.clear()
  }

  beginOperation() {
    this.cancelled = false
  }

  async writeIso(tracks: IsoTracks, timeoutMs = 45000): Promise<DeviceStatus> {
    if (!tracks.track1 && !tracks.track2 && !tracks.track3) {
      throw new Error('No magstripe data to write.')
    }
    if (this.cancelled) throw new Msrx6CancelledError()
    this.pump.clear()
    await this.send(buildIsoWrite(tracks))
    if (this.cancelled) throw new Msrx6CancelledError()
    const status = await this.waitForStatus(timeoutMs, 'Waiting for card swipe')
    if (this.cancelled) throw new Msrx6CancelledError()
    if (status !== 'ok') {
      throw new Error(statusLabel(status))
    }
    return status
  }

  async readIso(timeoutMs = 30000): Promise<IsoTracks> {
    if (this.cancelled) throw new Msrx6CancelledError()
    this.pump.clear()
    await this.send(commands.readIso)
    if (this.cancelled) throw new Msrx6CancelledError()
    const buffer = await this.pump.wait(
      (current) => parseIsoRead(current) !== null || findDeviceStatus(current) === 'writeError',
      timeoutMs,
      'Waiting for verify swipe'
    )
    if (this.cancelled) throw new Msrx6CancelledError()
    const tracks = parseIsoRead(buffer)
    if (!tracks) {
      throw new Error('Could not read the card back. Swipe it again at a steady speed.')
    }
    return tracks
  }

  private async probe() {
    this.pump.clear()
    await this.send(commands.reset)
    await delay(150)
    this.pump.clear()
    await this.send(commands.commTest)
    const status = await this.waitForStatus(2500, 'Writer handshake')
    if (status !== 'commOk' && status !== 'ok') {
      throw new Error('Connected, but the device did not speak the MSRx6/MSR605 protocol.')
    }
  }

  private async sendAndWaitStatus(data: Uint8Array, timeoutMs: number, label: string) {
    this.pump.clear()
    await this.send(data)
    return this.waitForStatus(timeoutMs, label)
  }

  private async waitForStatus(timeoutMs: number, label: string): Promise<DeviceStatus> {
    const buffer = await this.pump.wait((current) => findDeviceStatus(current) !== null, timeoutMs, label)
    return findDeviceStatus(buffer) ?? 'unknown'
  }

  private async send(data: Uint8Array) {
    if (!this.sendBytes) {
      throw new Error('MSRx6 is not connected.')
    }
    await this.sendBytes(data)
  }
}
