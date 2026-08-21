import { readFile } from 'fs/promises'
import jwt from 'jsonwebtoken'
import { format } from 'date-fns'
import { getAppSettings } from '@/lib/settings'
import { publicAppUrl } from '@/lib/card-link'
import { formatMembershipQRData } from '@/lib/qrcode'
import { tenantsCollection } from '@/lib/db'
import { publicTenantLogoUrl } from '@/lib/branding'

type ServiceAccount = {
  client_email: string
  private_key: string
}

export type GoogleWalletPassInput = {
  membershipId: string
  memberName: string
  cardNumber: number
  planName: string
  expiryDate?: Date
  origins?: string[]
  tenantId?: string
}

function parseServiceAccountJson(raw: string): ServiceAccount | null {
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string }
    if (!parsed.client_email || !parsed.private_key) return null
    return { client_email: parsed.client_email, private_key: parsed.private_key }
  } catch {
    return null
  }
}

async function loadServiceAccount(): Promise<ServiceAccount | null> {
  const settings = await getAppSettings()
  const pasted = settings.googleWalletServiceAccountJson.trim()
  if (pasted) return parseServiceAccountJson(pasted)

  const filePath = settings.googleWalletServiceAccountPath.trim()
  if (!filePath) return null
  try {
    return parseServiceAccountJson(await readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

export async function isGoogleWalletConfigured(): Promise<boolean> {
  const settings = await getAppSettings()
  if (!settings.googleWalletIssuerId.trim()) return false
  return Boolean(await loadServiceAccount())
}

function classId(issuerId: string, classSuffix: string) {
  return `${issuerId}.${classSuffix || 'membership'}`
}

function objectId(issuerId: string, membershipId: string) {
  const suffix = `m-${membershipId}`.replace(/[^A-Za-z0-9._-]/g, '-')
  return `${issuerId}.${suffix}`
}

function walletOrigins(extra: string[] = []) {
  const origins = new Set<string>()
  for (const value of [publicAppUrl(), ...extra]) {
    try {
      origins.add(new URL(value).origin)
    } catch {
      // ignore invalid origins
    }
  }
  return [...origins]
}

export async function createGoogleWalletSaveUrl(input: GoogleWalletPassInput): Promise<string> {
  const settings = await getAppSettings()
  const issuerId = settings.googleWalletIssuerId.trim()
  const account = await loadServiceAccount()
  if (!issuerId || !account) {
    throw new Error('Google Wallet is not configured')
  }

  const genericClassId = classId(issuerId, settings.googleWalletClassSuffix.trim())
  const genericObjectId = objectId(issuerId, input.membershipId)
  const tenant = input.tenantId ? await tenantsCollection.findById(input.tenantId) : null
  const venueName = tenant?.name?.trim() || 'Membership Manager'
  const barcodeValue = await formatMembershipQRData(input.cardNumber, input.tenantId)
  const expiryLabel = input.expiryDate ? format(input.expiryDate, 'dd MMM yyyy') : '—'
  const logoUrl = (tenant ? publicTenantLogoUrl(tenant) : '') || settings.googleWalletLogoUrl.trim()

  const genericClass = {
    id: genericClassId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['card_number']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['valid_until']" }],
                },
              },
            },
          },
        ],
      },
    },
  }

  const genericObject: Record<string, unknown> = {
    id: genericObjectId,
    classId: genericClassId,
    genericType: 'GENERIC_TYPE_UNSPECIFIED',
    hexBackgroundColor: '#19375f',
    cardTitle: {
      defaultValue: { language: 'en-GB', value: venueName },
    },
    header: {
      defaultValue: { language: 'en-GB', value: input.memberName },
    },
    subheader: {
      defaultValue: { language: 'en-GB', value: input.planName },
    },
    barcode: {
      type: 'QR_CODE',
      value: barcodeValue,
      alternateText: String(input.cardNumber),
    },
    textModulesData: [
      { id: 'card_number', header: 'CARD NUMBER', body: String(input.cardNumber) },
      { id: 'valid_until', header: 'VALID UNTIL', body: expiryLabel },
    ],
  }

  if (logoUrl) {
    genericObject.logo = { sourceUri: { uri: logoUrl } }
  }

  if (input.expiryDate) {
    genericObject.validTimeInterval = {
      end: { date: input.expiryDate.toISOString() },
    }
  }

  const token = jwt.sign(
    {
      iss: account.client_email,
      aud: 'google',
      origins: walletOrigins(input.origins),
      typ: 'savetowallet',
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject],
      },
    },
    account.private_key,
    { algorithm: 'RS256' }
  )

  return `https://pay.google.com/gp/v/save/${token}`
}
