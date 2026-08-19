import QRCode from 'qrcode'
import { getMagstripePrefix } from './settings'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
}

function byteSegment(data: string) {
  return [{ data: Buffer.from(data, 'latin1'), mode: 'byte' as const }]
}

/**
 * Generate QR code as data URL (base64 PNG)
 */
export async function generateQRCodeDataURL(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    ...options,
  }

  return QRCode.toDataURL(byteSegment(data), defaultOptions)
}

/**
 * Generate QR code as Buffer (PNG)
 */
export async function generateQRCodeBuffer(
  data: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    ...options,
  }

  return QRCode.toBuffer(byteSegment(data), defaultOptions)
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    ...options,
  }

  return QRCode.toString(byteSegment(data), { ...defaultOptions, type: 'svg' })
}

/**
 * Format membership card number for QR encoding.
 * Till scanners expect ISO Track 2 sentinels: ;payload?
 */
export async function formatMembershipQRData(cardNumber: number): Promise<string> {
  const prefix = await getMagstripePrefix()
  const payload = `${prefix}${cardNumber}`.trim().replace(/^[%;+]/, '').replace(/\?+$/, '')
  return `;${payload}?`
}
