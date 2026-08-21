import QRCode from 'qrcode'
import { membershipsCollection, tenantsCollection } from './db'
import { membershipQrGatewayUrl } from './card-link'
import { getMagstripePrefix } from './settings'
import { buildMembershipQrPayload, isTillQrPayload, qrCodeModeOf } from './qr-payload'

export interface QRCodeOptions {
  width?: number
  margin?: number
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  color?: {
    dark?: string
    light?: string
  }
}

function byteSegment(data: string) {
  return [{ data: Buffer.from(data, 'latin1'), mode: 'byte' as const }]
}

function qrInput(data: string) {
  return isTillQrPayload(data) ? byteSegment(data) : data
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

  return QRCode.toDataURL(qrInput(data), defaultOptions)
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

  return QRCode.toBuffer(qrInput(data), defaultOptions)
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

  return QRCode.toString(qrInput(data), { ...defaultOptions, type: 'svg' })
}

/**
 * Format membership card number for QR encoding.
 * Till mode uses ISO Track 2 sentinels: ;payload?
 * URL mode encodes a stable gateway URL on this platform (/q/{tenant}/{cardNumber}),
 * which redirects to the venue's current destination.
 */
export async function formatMembershipQRData(
  cardNumber: number,
  tenantId?: string,
  context?: { membershipId?: string; shortCode?: string }
): Promise<string> {
  const tenant = tenantId ? await tenantsCollection.findById(tenantId) : null
  const prefix = tenant?.magstripePrefix || (await getMagstripePrefix(tenantId))
  let shortCode = context?.shortCode
  if (!shortCode && context?.membershipId) {
    const membership = await membershipsCollection.findById(context.membershipId)
    shortCode = membership?.shortCode
  }
  const gatewayUrl =
    qrCodeModeOf(tenant?.qrCodeMode) === 'URL' && (tenant?.slug || shortCode)
      ? membershipQrGatewayUrl({
          tenantSlug: tenant?.slug,
          cardNumber,
          shortCode,
        })
      : undefined
  return buildMembershipQrPayload({
    cardNumber,
    magstripePrefix: prefix,
    qrCodeMode: tenant?.qrCodeMode,
    qrRedirectUrl: tenant?.qrRedirectUrl,
    membershipId: context?.membershipId,
    shortCode,
    tenantSlug: tenant?.slug,
    gatewayUrl,
  })
}
