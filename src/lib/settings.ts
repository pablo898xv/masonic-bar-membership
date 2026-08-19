import { systemConfigCollection } from './db'

export const APP_SETTINGS_KEY = 'appSettings'

export const SECRET_SETTING_KEYS = [
  'pixlPayApiKey',
  'pixlPayWebhookSecret',
  'tillSystemApiKey',
  'smtpPass',
  'passCertificatePassword',
  'googleWalletServiceAccountJson',
] as const

export type SecretSettingKey = (typeof SECRET_SETTING_KEYS)[number]

export type AppSettings = {
  magstripePrefix: string
  pixlPayApiUrl: string
  pixlPayApiKey: string
  pixlPayMerchantId: string
  pixlPayWebhookSecret: string
  tillSystemApiUrl: string
  tillSystemApiKey: string
  smtpHost: string
  smtpPort: string
  smtpSecure: string
  smtpUser: string
  smtpPass: string
  emailFrom: string
  passTypeIdentifier: string
  teamIdentifier: string
  passCertificatePath: string
  passCertificatePassword: string
  googleWalletIssuerId: string
  googleWalletClassSuffix: string
  googleWalletServiceAccountPath: string
  googleWalletServiceAccountJson: string
  googleWalletLogoUrl: string
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  magstripePrefix: ';9998',
  pixlPayApiUrl: '',
  pixlPayApiKey: '',
  pixlPayMerchantId: '',
  pixlPayWebhookSecret: '',
  tillSystemApiUrl: '',
  tillSystemApiKey: '',
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: 'false',
  smtpUser: '',
  smtpPass: '',
  emailFrom: 'Membership Manager <noreply@masonichall.bar>',
  passTypeIdentifier: '',
  teamIdentifier: '',
  passCertificatePath: '',
  passCertificatePassword: '',
  googleWalletIssuerId: '',
  googleWalletClassSuffix: 'membership',
  googleWalletServiceAccountPath: '',
  googleWalletServiceAccountJson: '',
  googleWalletLogoUrl: '',
}

const SETTING_KEYS = Object.keys(APP_SETTINGS_DEFAULTS) as (keyof AppSettings)[]
const SECRET_SET = new Set<string>(SECRET_SETTING_KEYS)

function envOverrides(): Partial<AppSettings> {
  const env: Partial<AppSettings> = {
    magstripePrefix: process.env.MAGSTRIPE_PREFIX,
    pixlPayApiUrl: process.env.PIXL_PAY_API_URL,
    pixlPayApiKey: process.env.PIXL_PAY_API_KEY,
    pixlPayMerchantId: process.env.PIXL_PAY_MERCHANT_ID,
    pixlPayWebhookSecret: process.env.PIXL_PAY_WEBHOOK_SECRET,
    tillSystemApiUrl: process.env.TILL_SYSTEM_API_URL,
    tillSystemApiKey: process.env.TILL_SYSTEM_API_KEY,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpSecure: process.env.SMTP_SECURE,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    emailFrom: process.env.EMAIL_FROM,
    passTypeIdentifier: process.env.PASS_TYPE_IDENTIFIER || process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.TEAM_IDENTIFIER,
    passCertificatePath: process.env.PASS_CERTIFICATE_PATH,
    passCertificatePassword: process.env.PASS_CERTIFICATE_PASSWORD,
    googleWalletIssuerId: process.env.GOOGLE_WALLET_ISSUER_ID,
    googleWalletClassSuffix: process.env.GOOGLE_WALLET_CLASS_SUFFIX,
    googleWalletServiceAccountPath: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_PATH,
    googleWalletServiceAccountJson: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON,
    googleWalletLogoUrl: process.env.GOOGLE_WALLET_LOGO_URL,
  }

  const result: Partial<AppSettings> = {}
  for (const key of SETTING_KEYS) {
    const value = env[key]
    if (value) result[key] = value
  }
  return result
}

function parseStored(raw: string | null): Partial<AppSettings> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

let cache: { value: AppSettings; at: number } | null = null
const CACHE_MS = 5_000

export function invalidateSettingsCache() {
  cache = null
}

export async function getStoredSettings(): Promise<Partial<AppSettings>> {
  return parseStored(await systemConfigCollection.get(APP_SETTINGS_KEY))
}

export async function getAppSettings(): Promise<AppSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value

  const stored = await getStoredSettings()
  const env = envOverrides()
  const value = { ...APP_SETTINGS_DEFAULTS }

  for (const key of SETTING_KEYS) {
    if (env[key]) value[key] = env[key] as string
    if (key in stored && stored[key] !== undefined) value[key] = stored[key] as string
  }

  cache = { value, at: Date.now() }
  return value
}

export async function getMagstripePrefix(): Promise<string> {
  const settings = await getAppSettings()
  return settings.magstripePrefix || APP_SETTINGS_DEFAULTS.magstripePrefix
}

export async function formatMagstripeData(cardNumber: number): Promise<string> {
  return `${await getMagstripePrefix()}${cardNumber}`
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const stored = await getStoredSettings()
  const next: Partial<AppSettings> = { ...stored }

  for (const key of SETTING_KEYS) {
    if (!(key in patch) || patch[key] === undefined) continue
    if (SECRET_SET.has(key) && !patch[key]) continue
    next[key] = patch[key]
  }

  await systemConfigCollection.set(APP_SETTINGS_KEY, JSON.stringify(next))
  invalidateSettingsCache()
  return getAppSettings()
}

export function toPublicSettings(settings: AppSettings) {
  return {
    magstripePrefix: settings.magstripePrefix,
    pixlPayApiUrl: settings.pixlPayApiUrl,
    pixlPayApiKeySet: Boolean(settings.pixlPayApiKey),
    pixlPayMerchantId: settings.pixlPayMerchantId,
    pixlPayWebhookSecretSet: Boolean(settings.pixlPayWebhookSecret),
    tillSystemApiUrl: settings.tillSystemApiUrl,
    tillSystemApiKeySet: Boolean(settings.tillSystemApiKey),
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure === 'true',
    smtpUser: settings.smtpUser,
    smtpPassSet: Boolean(settings.smtpPass),
    emailFrom: settings.emailFrom,
    passTypeIdentifier: settings.passTypeIdentifier,
    teamIdentifier: settings.teamIdentifier,
    passCertificatePath: settings.passCertificatePath,
    passCertificatePasswordSet: Boolean(settings.passCertificatePassword),
    googleWalletIssuerId: settings.googleWalletIssuerId,
    googleWalletClassSuffix: settings.googleWalletClassSuffix,
    googleWalletServiceAccountPath: settings.googleWalletServiceAccountPath,
    googleWalletServiceAccountJsonSet: Boolean(settings.googleWalletServiceAccountJson),
    googleWalletLogoUrl: settings.googleWalletLogoUrl,
    pixlPayConfigured: Boolean(settings.pixlPayApiUrl && settings.pixlPayApiKey),
    tillConfigured: Boolean(settings.tillSystemApiUrl && settings.tillSystemApiKey),
    emailConfigured: Boolean(settings.smtpHost),
    walletConfigured: Boolean(
      settings.passTypeIdentifier &&
        settings.teamIdentifier &&
        settings.passCertificatePath &&
        settings.passCertificatePassword
    ),
    googleWalletConfigured: Boolean(
      settings.googleWalletIssuerId &&
        (settings.googleWalletServiceAccountJson || settings.googleWalletServiceAccountPath)
    ),
  }
}

export type PublicAppSettings = ReturnType<typeof toPublicSettings>
