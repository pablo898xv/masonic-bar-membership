import { existsSync, readFileSync, statSync } from 'fs'
import path from 'path'
import { PKPass } from 'passkit-generator'
import { v4 as uuid } from 'uuid'
import { format } from 'date-fns'
import { generateQRCodeBuffer, formatMembershipQRData } from './qrcode'
import { AppSettings, getAppSettings } from './settings'

const LOCAL_CERT_DIR = path.join(process.cwd(), 'certs', 'apple-wallet')
const LOCAL_PASS_TYPE_ID = 'pass.com.ashlartechnologies.membership'
const LOCAL_TEAM_ID = 'XVM6L7837J'
const WALLET_ASSETS_DIR = path.join(process.cwd(), 'src', 'lib', 'wallet-assets')

export interface WalletPassData {
  passTypeId: string
  serialNumber: string
  authToken: string
  teamIdentifier: string
  organizationName: string
  description: string
  logoText: string
  foregroundColor: string
  backgroundColor: string
  labelColor: string
  barcode: {
    message: string
    format: 'PKBarcodeFormatQR'
    messageEncoding: string
  }
  primaryFields: Array<{
    key: string
    label: string
    value: string
  }>
  secondaryFields: Array<{
    key: string
    label: string
    value: string
  }>
  auxiliaryFields: Array<{
    key: string
    label: string
    value: string
  }>
  backFields: Array<{
    key: string
    label: string
    value: string
  }>
  expirationDate?: string
  relevantDate?: string
}

export interface GeneratedPass {
  serialNumber: string
  authToken: string
  qrCodeData: string
  qrCodeImage: string
  passData: WalletPassData
  passUrl?: string
}

function certDirectory(settings: AppSettings) {
  const configured = settings.passCertificatePath.trim()
  const resolved = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.join(process.cwd(), configured)
    : LOCAL_CERT_DIR
  if (existsSync(resolved) && !statSync(resolved).isDirectory()) {
    return path.dirname(resolved)
  }
  return resolved
}

function loadWalletCertificates(settings: AppSettings) {
  const dir = certDirectory(settings)
  const signerCertPath = path.join(dir, 'pass.pem')
  const signerKeyPath = path.join(dir, 'pass.key')
  const wwdrPath = path.join(dir, 'wwdr.pem')
  if (![signerCertPath, signerKeyPath, wwdrPath].every((file) => existsSync(file))) {
    return null
  }

  return {
    wwdr: readFileSync(wwdrPath),
    signerCert: readFileSync(signerCertPath),
    signerKey: readFileSync(signerKeyPath),
    signerKeyPassphrase: settings.passCertificatePassword || undefined,
  }
}

function passIdentity(settings: AppSettings) {
  const hasLocalCerts = Boolean(loadWalletCertificates(settings))
  return {
    passTypeId: settings.passTypeIdentifier.trim() || (hasLocalCerts ? LOCAL_PASS_TYPE_ID : ''),
    teamIdentifier: settings.teamIdentifier.trim() || (hasLocalCerts ? LOCAL_TEAM_ID : ''),
  }
}

function passImages() {
  const files = ['icon.png', 'icon@2x.png', 'icon@3x.png', 'logo.png', 'logo@2x.png']
  const buffers: Record<string, Buffer> = {}
  for (const name of files) {
    const file = path.join(WALLET_ASSETS_DIR, name)
    if (existsSync(file)) buffers[name] = readFileSync(file)
  }
  return buffers
}

export async function generateWalletPass(options: {
  cardNumber: number
  memberName: string
  memberEmail: string
  subscriptionName: string
  expiryDate: Date
  tenantId?: string
  serialNumber?: string
  authToken?: string
}): Promise<GeneratedPass> {
  const { cardNumber, memberName, memberEmail, subscriptionName, expiryDate, tenantId } = options

  const settings = await getAppSettings()
  const { passTypeId, teamIdentifier } = passIdentity(settings)

  const serialNumber = options.serialNumber || uuid()
  const authToken = options.authToken || uuid().replace(/-/g, '')
  const qrCodeData = await formatMembershipQRData(cardNumber, tenantId)

  const passData: WalletPassData = {
    passTypeId,
    serialNumber,
    authToken,
    teamIdentifier,
    organizationName: 'Ashlar Technologies',
    description: 'Membership Card',
    logoText: 'Membership Manager',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(25, 55, 95)',
    labelColor: 'rgb(200, 200, 200)',
    barcode: {
      message: qrCodeData,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    },
    primaryFields: [
      {
        key: 'memberName',
        label: 'MEMBER',
        value: memberName,
      },
    ],
    secondaryFields: [
      {
        key: 'memberNumber',
        label: 'CARD NUMBER',
        value: cardNumber.toString().padStart(6, '0'),
      },
      {
        key: 'membership',
        label: 'MEMBERSHIP',
        value: subscriptionName,
      },
    ],
    auxiliaryFields: [
      {
        key: 'expiry',
        label: 'VALID UNTIL',
        value: format(expiryDate, 'dd MMM yyyy'),
      },
    ],
    backFields: [
      {
        key: 'email',
        label: 'Email',
        value: memberEmail,
      },
      {
        key: 'terms',
        label: 'Terms & Conditions',
        value: 'This membership card is non-transferable. Present this card at the bar to receive member benefits.',
      },
      {
        key: 'contact',
        label: 'Contact',
        value: 'For enquiries, please contact the bar manager.',
      },
    ],
    expirationDate: expiryDate.toISOString(),
  }

  const qrCodeBuffer = await generateQRCodeBuffer(qrCodeData, { width: 300 })
  const qrCodeImage = `data:image/png;base64,${qrCodeBuffer.toString('base64')}`

  return {
    serialNumber,
    authToken,
    qrCodeData,
    qrCodeImage,
    passData,
  }
}

export async function isWalletPassConfigured(): Promise<boolean> {
  const settings = await getAppSettings()
  const { passTypeId, teamIdentifier } = passIdentity(settings)
  return Boolean(passTypeId && teamIdentifier && loadWalletCertificates(settings))
}

export async function generatePkpassFile(passData: WalletPassData): Promise<Buffer | null> {
  const settings = await getAppSettings()
  const certificates = loadWalletCertificates(settings)
  if (!certificates || !passData.passTypeId || !passData.teamIdentifier) {
    console.warn('Apple Wallet pass generation not configured')
    return null
  }

  const images = passImages()
  if (!images['icon.png']) {
    throw new Error('Apple Wallet icon.png is missing from src/lib/wallet-assets')
  }

  const pass = new PKPass(
    {
      ...images,
      'pass.json': Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          passTypeIdentifier: passData.passTypeId,
          teamIdentifier: passData.teamIdentifier,
          serialNumber: passData.serialNumber,
          organizationName: passData.organizationName,
          description: passData.description,
          logoText: passData.logoText,
          foregroundColor: passData.foregroundColor,
          backgroundColor: passData.backgroundColor,
          labelColor: passData.labelColor,
          generic: {
            primaryFields: passData.primaryFields,
            secondaryFields: passData.secondaryFields,
            auxiliaryFields: passData.auxiliaryFields,
            backFields: passData.backFields,
          },
        })
      ),
    },
    certificates,
    {
      serialNumber: passData.serialNumber,
    }
  )

  pass.setBarcodes({
    message: passData.barcode.message,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  })
  if (passData.expirationDate) {
    pass.setExpirationDate(new Date(passData.expirationDate))
  }

  return pass.getAsBuffer()
}
