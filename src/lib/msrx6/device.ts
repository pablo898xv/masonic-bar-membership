'use client'

import {
  buildIsoWrite,
  commands,
  concatBytes,
  findDeviceStatus,
  parseIsoRead,
  statusLabel,
  unwrapHidReport,
  wrapHidPackets,
  wrapMagneticFoxFrames,
  type Coercivity,
  type DeviceStatus,
  type IsoTracks,
} from './protocol'

export type Msrx6Transport = 'bluetooth' | 'serial' | 'hid'

/** Deftun MSRx6 / MSR605X enumerates as MagTek HID (0801:0003), not a COM port. */
const MAGTEK_VENDOR_ID = 0x0801
const MAGTEK_PRODUCT_ID = 0x0003

const HID_FILTERS = [
  { vendorId: MAGTEK_VENDOR_ID, productId: MAGTEK_PRODUCT_ID },
  { vendorId: MAGTEK_VENDOR_ID },
  { vendorId: 0x0dd4 },
  { vendorId: 0x0c2e },
  { vendorId: 0x0acd },
  { vendorId: 0x0bca },
  { vendorId: 0x0483 },
  { vendorId: 0x1a86 },
  { vendorId: 0x0403 },
  { vendorId: 0x067b },
  { vendorId: 0x10c4 },
  { vendorId: 0x0810 },
  { usagePage: 0xff00 },
  { usagePage: 0xffa0 },
]

const HID_CHOOSER_HINT =
  'Chrome lists the MSRx6 as Unknown device (0801:0003) or MagTek Magstripe Insert Reader. Pick that one. Close EasyMSR if it is open.'

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
  getInfo?(): { usbVendorId?: number; usbProductId?: number }
  forget?(): Promise<void>
}

type SerialLike = {
  requestPort(): Promise<SerialPortLike>
  getPorts?(): Promise<SerialPortLike[]>
}

type HidReportInfoLike = {
  reportId?: number
}

type HidCollectionLike = {
  outputReports?: HidReportInfoLike[]
  children?: HidCollectionLike[]
}

type HidDeviceLike = {
  vendorId?: number
  productId?: number
  productName?: string
  collections?: HidCollectionLike[]
  opened: boolean
  open(): Promise<void>
  close(): Promise<void>
  sendReport(reportId: number, data: BufferSource): Promise<void>
  sendFeatureReport?(reportId: number, data: BufferSource): Promise<void>
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

function isChooserCancel(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message = error instanceof Error ? error.message : ''
  return name === 'NotFoundError' || /cancelled|canceled|No device selected|chooser/i.test(message)
}

function isMagtekHid(vendorId?: number, productId?: number) {
  return vendorId === MAGTEK_VENDOR_ID && (productId == null || productId === MAGTEK_PRODUCT_ID)
}

function hidDeviceName(device: HidDeviceLike) {
  const named = device.productName?.trim()
  if (named && !/^unknown(\s+device)?$/i.test(named)) return named
  if (isMagtekHid(device.vendorId, device.productId)) return 'MSRx6 USB'
  const vid = device.vendorId
  const pid = device.productId
  if (vid != null && pid != null) {
    return `MSRx6 USB (${vid.toString(16).padStart(4, '0')}:${pid.toString(16).padStart(4, '0')})`
  }
  return 'MSRx6 USB'
}

function hidOutputReportIds(device: HidDeviceLike): number[] {
  const ids: number[] = []
  const walk = (collections?: HidCollectionLike[]) => {
    for (const collection of collections || []) {
      for (const report of collection.outputReports || []) {
        if (typeof report.reportId === 'number') ids.push(report.reportId)
      }
      walk(collection.children)
    }
  }
  walk(device.collections)
  return [...new Set(ids)]
}

function asReport(bytes: Uint8Array) {
  const report = new Uint8Array(bytes.byteLength)
  report.set(bytes)
  return report
}

function preferredHidReportId(device: HidDeviceLike) {
  const ids = hidOutputReportIds(device)
  if (isMagtekHid(device.vendorId, device.productId)) {
    if (ids.includes(0xff)) return 0xff
    return 0xff
  }
  if (ids.length) return ids[0]
  return 0
}

async function sendHidFrames(
  send: (reportId: number, data: BufferSource) => Promise<void>,
  reportId: number,
  frames: Uint8Array[]
) {
  for (const frame of frames) {
    const report = asReport(frame)
    try {
      await send(reportId, report)
    } catch (error) {
      if (report.length <= 63) throw error
      await send(reportId, asReport(report.subarray(0, 63)))
    }
    await delay(8)
  }
}

function hidSenders(device: HidDeviceLike): Array<(data: Uint8Array) => Promise<void>> {
  const interrupt = (reportId: number, frames: (data: Uint8Array) => Uint8Array[]) => {
    return (data: Uint8Array) => sendHidFrames((id, payload) => device.sendReport(id, payload), reportId, frames(data))
  }
  const feature = (reportId: number, frames: (data: Uint8Array) => Uint8Array[]) => {
    return async (data: Uint8Array) => {
      if (!device.sendFeatureReport) {
        throw new Error('Feature reports are not available')
      }
      await sendHidFrames((id, payload) => device.sendFeatureReport!(id, payload), reportId, frames(data))
    }
  }

  if (isMagtekHid(device.vendorId, device.productId)) {
    return [
      interrupt(0xff, (data) => wrapMagneticFoxFrames(data, 63)),
      feature(0, wrapHidPackets),
      feature(0xff, wrapHidPackets),
      interrupt(0xff, wrapHidPackets),
      interrupt(0, wrapHidPackets),
      interrupt(0xff, (data) => wrapMagneticFoxFrames(data, 64)),
      interrupt(0xff, (data) => [data]),
      interrupt(0, (data) => [data]),
    ]
  }

  const reportId = preferredHidReportId(device)
  return [
    interrupt(reportId, wrapHidPackets),
    interrupt(0xff, wrapHidPackets),
    interrupt(0, wrapHidPackets),
    feature(0, wrapHidPackets),
    interrupt(reportId, (data) => [data]),
  ]
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
          const swipeHint = /swipe|card|verify/i.test(label)
          waiter.reject(
            new Error(
              swipeHint
                ? `${label} timed out. Swipe the card through the writer and try again.`
                : `${label} timed out. Close EasyMSR if it is open, unplug the writer, plug it back in, then Connect USB again.`
            )
          )
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
  private hidReportId = 0
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

  async connectUsb() {
    const nav = hardwareNavigator()
    if (!nav.hid && !nav.serial) {
      throw new Error('USB writers need Chrome or Edge on this computer, with the MSRx6 plugged in.')
    }
    if (nav.hid) {
      try {
        await this.connectHid()
        return
      } catch (error) {
        if (!isChooserCancel(error) || !nav.serial) throw error
      }
    }
    await this.connectSerial()
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
    const remembered = await nav.hid.getDevices?.()
    const magtek = remembered?.find((item) => isMagtekHid(item.vendorId, item.productId))
    if (magtek) {
      await this.bindHidDevice(magtek)
      return
    }
    const [device] = await nav.hid.requestDevice({ filters: HID_FILTERS })
    if (!device) {
      throw new Error(HID_CHOOSER_HINT)
    }
    await this.bindHidDevice(device)
  }

  async reconnectHid() {
    const nav = hardwareNavigator()
    const devices = await nav.hid?.getDevices?.()
    if (!devices?.length) {
      throw new Error('No remembered USB HID writer. Click USB HID once to grant access.')
    }
    const magtek = devices.find((item) => isMagtekHid(item.vendorId, item.productId))
    await this.bindHidDevice(magtek || devices[0])
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
    const info = port.getInfo?.()
    if (isMagtekHid(info?.usbVendorId, info?.usbProductId)) {
      try {
        await port.forget?.()
      } catch {
        // Chrome may not support forget on this port
      }
      await this.connectHid()
      return
    }

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
    await delay(250)

    const onInput = (event: Event) => {
      const report = event as Event & { data?: DataView; reportId?: number }
      if (!report.data) return
      const view = report.data
      const raw = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
      this.pump.push(unwrapHidReport(raw))
    }
    device.addEventListener('inputreport', onInput)

    this.name = hidDeviceName(device)
    this.deviceId = null
    this.transport = 'hid'
    this.hidWrap = true
    this.cleanup = async () => {
      device.removeEventListener('inputreport', onInput)
      if (device.opened) await device.close()
    }

    let lastError: unknown
    for (const send of hidSenders(device)) {
      this.sendBytes = send
      try {
        await this.probe(800)
        return
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(
          'Connected over USB, but the writer did not answer. Close EasyMSR, unplug the MSRx6, plug it back in, then Connect USB again.'
        )
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

  private async probe(timeoutMs = 2500) {
    this.pump.clear()
    await this.send(commands.commTest)
    const status = await this.waitForStatus(timeoutMs, 'Writer handshake')
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
