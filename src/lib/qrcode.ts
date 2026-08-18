import QRCode from 'qrcode'

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
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

  return QRCode.toDataURL(data, defaultOptions)
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

  return QRCode.toBuffer(data, defaultOptions)
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

  return QRCode.toString(data, { ...defaultOptions, type: 'svg' })
}

/**
 * Format membership card number for QR encoding
 * Uses the same prefix as magstripe for consistency
 */
export function formatMembershipQRData(cardNumber: number): string {
  const prefix = process.env.MAGSTRIPE_PREFIX || ';9998'
  return `${prefix}${cardNumber}`
}
