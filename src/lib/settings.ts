import { systemConfigCollection, tenantsCollection } from './db'

export const APP_SETTINGS_KEY = 'appSettings'

export const SECRET_SETTING_KEYS = [
  'hopeMacyAppSecret',
  'bankAccountNumber',
  'smtpPass',
  'passCertificatePassword',
  'googleWalletServiceAccountJson',
  'twilioAuthToken',
] as const

export type SecretSettingKey = (typeof SECRET_SETTING_KEYS)[number]

export type AppSettings = {
  hopeMacyBaseUrl: string
  hopeMacyAppId: string
  hopeMacyAppSecret: string
  hopeMacyMaxAmount: string
  bankAccountName: string
  bankSortCode: string
  bankAccountNumber: string
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
  twilioAccountSid: string
  twilioAuthToken: string
  twilioFromNumber: string
  twilioLogFallback: string
  creditsPerSms: string
  smsWelcomeEnabled: string
  smsRenewalEnabled: string
  smsDigitalCardEnabled: string
  smsWelcomeTemplate: string
  smsRenewalTemplate: string
  smsDigitalCardTemplate: string
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  hopeMacyBaseUrl: 'https://pis.hopemacy.com/api/v1',
  hopeMacyAppId: '',
  hopeMacyAppSecret: '',
  hopeMacyMaxAmount: '1000',
  bankAccountName: 'Ashlar Technologies',
  bankSortCode: '',
  bankAccountNumber: '',
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
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioFromNumber: '',
  twilioLogFallback: 'true',
  creditsPerSms: '0.25',
  smsWelcomeEnabled: 'true',
  smsRenewalEnabled: 'true',
  smsDigitalCardEnabled: 'true',
  smsWelcomeTemplate:
    'Hi {{member_name}}, your membership is active. Card {{card_number}}, {{plan}}, valid until {{expiry}}. {{card_url}}',
  smsRenewalTemplate:
    'Hi {{member_name}}, your membership (card {{card_number}}) expires in {{days}} days ({{expiry}}). Renew: {{renewal_url}}',
  smsDigitalCardTemplate:
    '{{tenant_name}} has issued you a digital membership card, click here to download to your smartphone. {{card_url}}',
}

const SETTING_KEYS = Object.keys(APP_SETTINGS_DEFAULTS) as (keyof AppSettings)[]
const SECRET_SET = new Set<string>(SECRET_SETTING_KEYS)

function envOverrides(): Partial<AppSettings> {
  const env: Partial<AppSettings> = {
    hopeMacyBaseUrl: process.env.HOPEMACY_BASE_URL,
    hopeMacyAppId: process.env.HOPEMACY_APP_ID,
    hopeMacyAppSecret: process.env.HOPEMACY_APP_SECRET,
    hopeMacyMaxAmount: process.env.HOPEMACY_MAX_AMOUNT,
    bankAccountName: process.env.BANK_ACCOUNT_NAME,
    bankSortCode: process.env.BANK_SORT_CODE,
    bankAccountNumber: process.env.BANK_ACCOUNT_NUMBER,
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
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
    twilioLogFallback: process.env.TWILIO_LOG_FALLBACK,
    creditsPerSms: process.env.CREDITS_PER_SMS,
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

  if (
    value.smsDigitalCardTemplate ===
    'Hi {{member_name}}, your digital membership card #{{card_number}} is ready: {{card_url}}'
  ) {
    value.smsDigitalCardTemplate = APP_SETTINGS_DEFAULTS.smsDigitalCardTemplate
  }

  cache = { value, at: Date.now() }
  return value
}

export const DEFAULT_MAGSTRIPE_PREFIX = ';9998'

export async function getMagstripePrefix(tenantId?: string): Promise<string> {
  if (tenantId) {
    const tenant = await tenantsCollection.findById(tenantId)
    if (tenant?.magstripePrefix) return tenant.magstripePrefix
  }
  return DEFAULT_MAGSTRIPE_PREFIX
}

export async function formatMagstripeData(cardNumber: number, tenantId?: string): Promise<string> {
  return `${await getMagstripePrefix(tenantId)}${cardNumber}`
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

export function toPublicSettings(settings: AppSettings, platformAdmin = false) {
  const shared = {
    hopeMacyConfigured: Boolean(settings.hopeMacyAppId && settings.hopeMacyAppSecret),
    emailConfigured: Boolean(settings.smtpHost),
    walletConfigured: Boolean(
      settings.passTypeIdentifier &&
        settings.teamIdentifier &&
        settings.passCertificatePath
    ),
    googleWalletConfigured: Boolean(
      settings.googleWalletIssuerId &&
        (settings.googleWalletServiceAccountJson || settings.googleWalletServiceAccountPath)
    ),
    smsConfigured: Boolean(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber),
    smsCreditCost: settings.creditsPerSms || '0.25',
    canManagePlatformIntegrations: platformAdmin,
  }

  if (!platformAdmin) return shared

  return {
    ...shared,
    hopeMacyBaseUrl: settings.hopeMacyBaseUrl,
    hopeMacyAppId: settings.hopeMacyAppId,
    hopeMacyAppSecretSet: Boolean(settings.hopeMacyAppSecret),
    hopeMacyMaxAmount: settings.hopeMacyMaxAmount,
    bankAccountName: settings.bankAccountName,
    bankSortCode: settings.bankSortCode,
    bankAccountNumberSet: Boolean(settings.bankAccountNumber),
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
    twilioAccountSid: settings.twilioAccountSid,
    twilioAuthTokenSet: Boolean(settings.twilioAuthToken),
    twilioFromNumber: settings.twilioFromNumber,
    twilioLogFallback: settings.twilioLogFallback === 'true',
    creditsPerSms: settings.creditsPerSms,
    smsWelcomeEnabled: settings.smsWelcomeEnabled !== 'false',
    smsRenewalEnabled: settings.smsRenewalEnabled !== 'false',
    smsDigitalCardEnabled: settings.smsDigitalCardEnabled !== 'false',
    smsWelcomeTemplate: settings.smsWelcomeTemplate,
    smsRenewalTemplate: settings.smsRenewalTemplate,
    smsDigitalCardTemplate: settings.smsDigitalCardTemplate,
  }
}

export type PublicAppSettings = ReturnType<typeof toPublicSettings>
