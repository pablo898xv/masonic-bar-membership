'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { getMsrx6BrowserSupport, isMsrx6Cancelled, Msrx6Session, type Msrx6Transport } from './device'
import { tracksFromMagstripe, tracksMatch, summarizeIsoTracks, normalizeMagstripeTracks, type Coercivity, type IsoTracks, type MagstripeTrack } from './protocol'

export type WriterPhase = 'idle' | 'connecting' | 'ready' | 'writing' | 'verifying' | 'reading'
export type ConnectMethod = Msrx6Transport | 'bluetooth-all' | 'remembered'

type RememberedDevice = {
  transport: Msrx6Transport
  deviceId?: string
  name?: string
  coercivity: Coercivity
}

const REMEMBER_KEY = 'msrx6.remembered'
const OPT_OUT_KEY = 'msrx6.optOut'

function loadRemembered(): RememberedDevice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY)
    return raw ? (JSON.parse(raw) as RememberedDevice) : null
  } catch {
    return null
  }
}

function saveRemembered(value: RememberedDevice) {
  window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value))
  window.sessionStorage.removeItem(OPT_OUT_KEY)
}

function optedOut() {
  return window.sessionStorage.getItem(OPT_OUT_KEY) === '1'
}

export type Msrx6Writer = {
  support: ReturnType<typeof getMsrx6BrowserSupport>
  phase: WriterPhase
  error: string | null
  deviceName: string | null
  transport: Msrx6Transport | null
  coercivity: Coercivity
  connected: boolean
  setError: (error: string | null) => void
  connect: (method: ConnectMethod) => Promise<void>
  disconnect: () => Promise<void>
  applyCoercivity: (mode: Coercivity) => Promise<void>
  encodeCard: (magstripeData: string, tracks?: MagstripeTrack[]) => Promise<IsoTracks>
  readCard: () => Promise<IsoTracks>
  cancelOperation: () => Promise<void>
  previewTracks: (magstripeData: string, tracks?: MagstripeTrack[]) => IsoTracks
}

const Msrx6Context = createContext<Msrx6Writer | null>(null)

function useMsrx6Controller(): Msrx6Writer {
  const sessionRef = useRef<Msrx6Session | null>(null)
  const connectingRef = useRef(false)
  const phaseRef = useRef<WriterPhase>('idle')
  const [phase, setPhaseState] = useState<WriterPhase>('idle')
  const setPhase = useCallback((value: WriterPhase | ((current: WriterPhase) => WriterPhase)) => {
    setPhaseState((current) => {
      const next = typeof value === 'function' ? value(current) : value
      phaseRef.current = next
      return next
    })
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [transport, setTransport] = useState<Msrx6Transport | null>(null)
  const [coercivity, setCoercivity] = useState<Coercivity>('hico')
  const magstripeTracksRef = useRef<MagstripeTrack[] | null>(null)
  const [support, setSupport] = useState({
    bluetooth: false,
    serial: false,
    hid: false,
    secureContext: false,
  })

  useEffect(() => {
    setSupport(getMsrx6BrowserSupport())
    const remembered = loadRemembered()
    if (remembered?.coercivity) setCoercivity(remembered.coercivity)
  }, [])

  const attachSession = useCallback((session: Msrx6Session) => {
    session.onDrop = () => {
      sessionRef.current = null
      setDeviceName(null)
      setTransport(null)
      setPhase('idle')
      setError('MSRx6 disconnected. Reconnect from the bar at the top of the page.')
    }
    sessionRef.current = session
    setDeviceName(session.name)
    setTransport(session.transport)
    setPhase('ready')
    saveRemembered({
      transport: session.transport,
      deviceId: session.deviceId || undefined,
      name: session.name,
      coercivity,
    })
  }, [coercivity])

  const connect = useCallback(async (method: ConnectMethod) => {
    if (method === 'remembered' && (sessionRef.current || connectingRef.current)) return
    connectingRef.current = true
    setError(null)
    setPhase('connecting')
    const previous = sessionRef.current
    if (previous) {
      previous.onDrop = null
      await previous.disconnect().catch(() => undefined)
      sessionRef.current = null
    }

    const session = new Msrx6Session()
    try {
      if (method === 'remembered') {
        const remembered = loadRemembered()
        if (!remembered) throw new Error('No paired MSRx6 yet. Connect Bluetooth or USB once.')
        if (remembered.transport === 'bluetooth') await session.reconnectBluetooth(remembered.deviceId)
        else if (remembered.transport === 'serial') await session.reconnectSerial()
        else await session.reconnectHid()
      } else if (method === 'bluetooth') await session.connectBluetooth(false)
      else if (method === 'bluetooth-all') await session.connectBluetooth(true)
      else if (method === 'serial') await session.connectSerial()
      else await session.connectHid()

      try {
        await session.setCoercivity(coercivity)
      } catch {
        // Some MSRx6 Bluetooth firmware ignores coercivity; writing can still work.
      }
      attachSession(session)
    } catch (err) {
      await session.disconnect().catch(() => undefined)
      sessionRef.current = null
      setDeviceName(null)
      setTransport(null)
      setPhase('idle')
      const message = err instanceof Error ? err.message : 'Could not connect to the MSRx6'
      if (method !== 'remembered' && !/cancelled|canceled|chooser/i.test(message)) {
        setError(message)
      }
    } finally {
      connectingRef.current = false
    }
  }, [attachSession, coercivity])

  useEffect(() => {
    if (!support.bluetooth && !support.serial && !support.hid) return
    if (optedOut()) return
    if (!loadRemembered()) return
    void connect('remembered')
  }, [connect, support.bluetooth, support.serial, support.hid])

  const disconnect = useCallback(async () => {
    window.sessionStorage.setItem(OPT_OUT_KEY, '1')
    const session = sessionRef.current
    if (session) session.onDrop = null
    sessionRef.current = null
    magstripeTracksRef.current = null
    setDeviceName(null)
    setTransport(null)
    setPhase('idle')
    if (session) await session.disconnect().catch(() => undefined)
  }, [])

  const applyCoercivity = useCallback(async (mode: Coercivity) => {
    setCoercivity(mode)
    const remembered = loadRemembered()
    if (remembered) saveRemembered({ ...remembered, coercivity: mode })
    const session = sessionRef.current
    if (!session) return
    try {
      await session.setCoercivity(mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set coercivity')
    }
  }, [])

  const loadMagstripeTracks = useCallback(async (override?: MagstripeTrack[]) => {
    if (override?.length) return normalizeMagstripeTracks(override)
    try {
      const res = await fetch('/api/tenants/current')
      const data = await res.json()
      const tracks = normalizeMagstripeTracks(res.ok ? data.tenant?.magstripeTracks : undefined)
      magstripeTracksRef.current = tracks
      return tracks
    } catch {
      return magstripeTracksRef.current || normalizeMagstripeTracks()
    }
  }, [])

  const encodeCard = useCallback(async (magstripeData: string, tracks?: MagstripeTrack[]) => {
    const session = sessionRef.current
    if (!session) {
      throw new Error('Connect the MSRx6 first from the bar at the top of the page.')
    }

    session.beginOperation()
    const selected = await loadMagstripeTracks(tracks)
    const expected = tracksFromMagstripe(magstripeData, selected)
    setError(null)
    setPhase('writing')
    try {
      await session.writeIso(expected)
      setPhase('verifying')
      const actual = await session.readIso()
      if (!tracksMatch(expected, actual)) {
        throw new Error(
          `Verify mismatch. Wrote ${summarizeIsoTracks(expected)}, read ${summarizeIsoTracks(actual)}.`
        )
      }
      return expected
    } catch (err) {
      if (isMsrx6Cancelled(err)) {
        setError(null)
      }
      throw err
    } finally {
      setPhase((current) => (current === 'writing' || current === 'verifying' ? 'ready' : current))
    }
  }, [loadMagstripeTracks])

  const readCard = useCallback(async () => {
    const session = sessionRef.current
    if (!session) {
      throw new Error('Connect the MSRx6 first from the bar at the top of the page.')
    }
    session.beginOperation()
    setError(null)
    setPhase('reading')
    try {
      const tracks = await session.readIso()
      setPhase('ready')
      return tracks
    } catch (err) {
      setPhase('ready')
      throw err
    }
  }, [])

  const cancelOperation = useCallback(async () => {
    const session = sessionRef.current
    if (session) await session.cancelPending()
    setError(null)
    setPhase((current) =>
      current === 'writing' || current === 'verifying' || current === 'reading' ? 'ready' : current
    )
  }, [setPhase])

  const previewTracks = useCallback((magstripeData: string, tracks?: MagstripeTrack[]): IsoTracks => {
    return tracksFromMagstripe(magstripeData, tracks || magstripeTracksRef.current || undefined)
  }, [])

  return {
    support,
    phase,
    error,
    deviceName,
    transport,
    coercivity,
    connected: phase === 'ready' || phase === 'writing' || phase === 'verifying' || phase === 'reading',
    setError,
    connect,
    disconnect,
    applyCoercivity,
    encodeCard,
    readCard,
    cancelOperation,
    previewTracks,
  }
}

export function Msrx6Provider({ children }: { children: ReactNode }) {
  const value = useMsrx6Controller()
  return <Msrx6Context.Provider value={value}>{children}</Msrx6Context.Provider>
}

export function useMsrx6(): Msrx6Writer {
  const context = useContext(Msrx6Context)
  if (!context) {
    throw new Error('useMsrx6 must be used within Msrx6Provider')
  }
  return context
}
