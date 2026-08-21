/** MSR206 / MSR605 / MSRx6 ISO command protocol. */

export const ESC = 0x1b
export const FS = 0x1c

export type Coercivity = 'hico' | 'loco'

export type DeviceStatus =
  | 'ok'
  | 'writeError'
  | 'commandError'
  | 'invalidCommand'
  | 'swipeError'
  | 'commOk'
  | 'unknown'

export interface IsoTracks {
  track1: string
  track2: string
  track3: string
}

export type MagstripeTrack = 1 | 2 | 3

export function parseMagstripeTracks(value?: unknown): MagstripeTrack[] {
  const source = Array.isArray(value) ? value : []
  return [
    ...new Set(
      source
        .map((item) => (typeof item === 'string' ? Number(item) : item))
        .filter((item): item is MagstripeTrack => item === 1 || item === 2 || item === 3)
    ),
  ].sort() as MagstripeTrack[]
}

export function normalizeMagstripeTracks(value?: unknown): MagstripeTrack[] {
  const tracks = parseMagstripeTracks(value)
  return tracks.length ? tracks : [2]
}

export function formatMagstripeTrackList(tracks?: unknown) {
  const selected = normalizeMagstripeTracks(tracks)
  if (selected.length === 1) return `Track ${selected[0]}`
  if (selected.length === 2) return `Tracks ${selected[0]} and ${selected[1]}`
  return `Tracks ${selected.slice(0, -1).join(', ')} and ${selected[selected.length - 1]}`
}

const STATUS_MAP: Record<number, DeviceStatus> = {
  0x30: 'ok', // '0'
  0x31: 'writeError', // '1'
  0x32: 'commandError', // '2'
  0x34: 'invalidCommand', // '4'
  0x39: 'swipeError', // '9'
  0x41: 'writeError', // 'A'
  0x79: 'commOk', // 'y'
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

export function ascii(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

export const commands = {
  reset: cmd(ESC, 0x61), // ESC a
  commTest: cmd(ESC, 0x65), // ESC e
  readIso: cmd(ESC, 0x72), // ESC r
  writeIso: cmd(ESC, 0x77), // ESC w
  setHico: cmd(ESC, 0x78), // ESC x
  setLoco: cmd(ESC, 0x79), // ESC y
  firmware: cmd(ESC, 0x76), // ESC v
}

export function stripSentinels(value: string): string {
  return value.trim().replace(/^[%;+]/, '').replace(/\?+$/, '')
}

/** ISO start sentinel + payload + end sentinel `?`, as written on the card and returned by a swipe. */
export function withMagstripeSentinels(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const start = /^[%;+]/.test(trimmed) ? trimmed[0] : ';'
  const body = stripSentinels(trimmed)
  return body ? `${start}${body}?` : `${start}?`
}

export function magstripePrefixIsNumeric(prefix: string) {
  return /^\d*$/.test(stripSentinels(prefix))
}

export function primaryTrack(tracks: IsoTracks): string {
  return tracks.track2 || tracks.track1 || tracks.track3
}

export function cardNumberFromMagstripe(raw: string, prefix = ';9998'): number | null {
  const stripped = stripSentinels(raw)
  if (!stripped || !/^\d+$/.test(stripped)) return null

  const prefixBody = stripSentinels(prefix)
  let payload = stripped

  // Track 2 is prefix + printed card number. Peel a prefix-sized head even when
  // the digits do not match, so a card written with an old prefix still looks
  // up as e.g. 1500 rather than 99981500 (which then gets the new prefix glued
  // on again in Expected Track 2).
  if (prefixBody && stripped.length > prefixBody.length) {
    payload = stripped.slice(prefixBody.length)
  }

  if (!payload || !/^\d+$/.test(payload)) return null
  return Number(payload)
}

export function cardNumberFromQuery(query: string, prefix = ';9998'): number | null {
  const trimmed = query.trim()
  if (!trimmed) return null
  if (/^\d{1,6}$/.test(trimmed)) return Number(trimmed)
  return cardNumberFromMagstripe(trimmed, prefix)
}

export function inferredMagstripeTracks(magstripeData: string): MagstripeTrack[] {
  const trimmed = magstripeData.trim()
  const stripped = stripSentinels(trimmed)
  if (trimmed.startsWith('%') || /[A-Za-z^]/.test(stripped)) return [1]
  return [2]
}

export function tracksFromMagstripe(magstripeData: string, tracks?: MagstripeTrack[]): IsoTracks {
  const stripped = stripSentinels(magstripeData.trim())
  const selected = tracks?.length ? normalizeMagstripeTracks(tracks) : inferredMagstripeTracks(magstripeData)
  return {
    track1: selected.includes(1) ? stripped : '',
    track2: selected.includes(2) ? stripped : '',
    track3: selected.includes(3) ? stripped : '',
  }
}

export function summarizeIsoTracks(tracks: IsoTracks) {
  const parts = [
    tracks.track1 ? `T1:${tracks.track1}` : '',
    tracks.track2 ? `T2:${tracks.track2}` : '',
    tracks.track3 ? `T3:${tracks.track3}` : '',
  ].filter(Boolean)
  return parts.join(' ') || '(empty)'
}

export function buildIsoWrite(tracks: IsoTracks): Uint8Array {
  return concatBytes(
    commands.writeIso,
    cmd(ESC, 0x73), // ESC s
    cmd(ESC, 0x01),
    ascii(tracks.track1),
    cmd(ESC, 0x02),
    ascii(tracks.track2),
    cmd(ESC, 0x03),
    ascii(tracks.track3),
    cmd(0x3f, FS) // ? FS
  )
}

export function findDeviceStatus(buffer: Uint8Array): DeviceStatus | null {
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] !== ESC) continue
    const mapped = STATUS_MAP[buffer[i + 1]]
    if (mapped) return mapped
  }
  return null
}

function sliceUntilEsc(buffer: Uint8Array, start: number, end: number): string {
  const bytes = buffer.slice(start, end)
  const text = new TextDecoder().decode(bytes)
  return stripSentinels(text.replace(/\0/g, ''))
}

export function parseIsoRead(buffer: Uint8Array): IsoTracks | null {
  const start = indexOfPair(buffer, ESC, 0x73)
  const t1 = indexOfPair(buffer, ESC, 0x01)
  const t2 = indexOfPair(buffer, ESC, 0x02)
  const t3 = indexOfPair(buffer, ESC, 0x03)
  if (start < 0 || t1 < 0 || t2 < 0 || t3 < 0) return null

  const end = buffer.indexOf(FS, t3)
  const t3End = end >= 0 ? end : buffer.length

  return {
    track1: sliceUntilEsc(buffer, t1 + 2, t2),
    track2: sliceUntilEsc(buffer, t2 + 2, t3),
    track3: sliceUntilEsc(buffer, t3 + 2, t3End),
  }
}

function indexOfPair(buffer: Uint8Array, a: number, b: number): number {
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === a && buffer[i + 1] === b) return i
  }
  return -1
}

export function tracksMatch(expected: IsoTracks, actual: IsoTracks): boolean {
  const keys = ['track1', 'track2', 'track3'] as const
  let wrote = false
  for (const key of keys) {
    if (!expected[key]) continue
    wrote = true
    if (stripSentinels(expected[key]) !== stripSentinels(actual[key] || '')) return false
  }
  return wrote
}

export function statusLabel(status: DeviceStatus): string {
  switch (status) {
    case 'ok':
      return 'Write succeeded'
    case 'commOk':
      return 'Device responded'
    case 'writeError':
      return 'Write failed — swipe again at a steady speed'
    case 'swipeError':
      return 'Swipe too fast or too slow'
    case 'commandError':
    case 'invalidCommand':
      return 'Writer rejected the command'
    default:
      return 'Unexpected response from writer'
  }
}

/** MSR605X-style 64-byte HID frames wrapping the serial protocol. */
export function wrapHidPackets(payload: Uint8Array, reportId = 0): Uint8Array[] {
  const packets: Uint8Array[] = []
  const first = new Uint8Array(1 + 62)
  first[0] = 0x00
  first.set(payload.slice(0, 62), 1)

  const rest: Uint8Array[] = [first]
  for (let i = 62; i < payload.length; i += 63) {
    rest.push(payload.slice(i, i + 63))
  }

  for (const chunk of rest) {
    const packet = new Uint8Array(64)
    packet[0] = reportId
    packet.set(chunk.length > 63 ? chunk.slice(0, 63) : chunk, 1)
    packets.push(packet)
  }

  return packets
}
