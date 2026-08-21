import { systemConfigCollection, tenantsCollection } from './db'
import { formatMagstripeTrackList, normalizeMagstripeTracks, withMagstripeSentinels } from './msrx6/protocol'
import { maskAccountNumber, maskSortCode } from './bank-account'

export const APP_SETTINGS_KEY = 'appSettings'

export const SECRET_SETTING_KEYS = [
  'hopeMacyAppSecret',
  'bankAccountNumber',
  'smtpPass',
  'passCertificatePassword',
  'googleWalletServiceAccountJson',
  'twilioAuthToken',
  'stripeSecretKey',
  'stripeWebhookSecret',
] as const

export type SecretSettingKey = (typeof SECRET_SETTING_KEYS)[number]

export type AppSettings = {
  hopeMacyBaseUrl: string
  hopeMacyAppId: string
  hopeMacyAppSecret: string
  hopeMacyMaxAmount: string
  stripePublishableKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
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
  emailWelcomeSubject: string
  emailWelcomeTemplate: string
  emailRenewalSubject: string
  emailRenewalTemplate: string
  emailRenewalConfirmSubject: string
  emailRenewalConfirmTemplate: string
  emailDigitalCardSubject: string
  emailDigitalCardTemplate: string
}

export const APP_SETTINGS_DEFAULTS: AppSettings = {
  hopeMacyBaseUrl: 'https://pis.hopemacy.com/api/v1',
  hopeMacyAppId: '',
  hopeMacyAppSecret: '',
  hopeMacyMaxAmount: '1000',
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeWebhookSecret: '',
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
  emailWelcomeSubject: 'Welcome to Membership Manager - Your membership is active!',
  emailWelcomeTemplate: `Dear {{member_name}},

Thank you for becoming a member! {{card_type_text}}

Card Number: {{card_number}}
Membership Plan: {{plan}}
Valid Until: {{expiry}}
Card Type: {{card_type}}

{{card_url}}

Simply present your membership card at the bar to receive your member discounts.

We look forward to seeing you at the bar!`,
  emailRenewalSubject: 'Your Membership Manager membership expires in {{days}} days',
  emailRenewalTemplate: `Dear {{member_name}},

Your membership will expire soon.

Card Number: {{card_number}}
Current Plan: {{plan}}
Expiry Date: {{expiry}}
Days remaining: {{days}}

You keep the same card number, and the extra year is added from your current expiry date — not from the day you pay.

Renew here: {{renewal_url}}

If you have any questions, please speak to the bar manager.`,
  emailRenewalConfirmSubject: 'Your membership is renewed until {{expiry}}',
  emailRenewalConfirmTemplate: `Dear {{member_name}},

Your membership has been renewed. You keep the same card number.

Card Number: {{card_number}}
Plan: {{plan}}
Valid until: {{expiry}}

If you have any questions, please speak to the bar manager.`,
  emailDigitalCardSubject: 'Your Membership Manager digital card',
  emailDigitalCardTemplate: `Hi {{member_name}},

{{tenant_name}} has issued you a digital membership card. Click here to download it to your smartphone:

{{card_url}}`,
}

const SETTING_KEYS = Object.keys(APP_SETTINGS_DEFAULTS) as (keyof AppSettings)[]
const SECRET_SET = new Set<string>(SECRET_SETTING_KEYS)

function envOverrides(): Partial<AppSettings> {
  const env: Partial<AppSettings> = {
    hopeMacyBaseUrl: process.env.HOPEMACY_BASE_URL,
    hopeMacyAppId: process.env.HOPEMACY_APP_ID,
    hopeMacyAppSecret: process.env.HOPEMACY_APP_SECRET,
    hopeMacyMaxAmount: process.env.HOPEMACY_MAX_AMOUNT,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    bankAccountName: process.env.BANK_ACCOUNT_NAME,
    bankSortCode: maskSortCode(process.env.BANK_SORT_CODE || ''),
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

export async function getMagstripeTracks(tenantId?: string) {
  if (tenantId) {
    const tenant = await tenantsCollection.findById(tenantId)
    if (tenant?.magstripeTracks?.length) return normalizeMagstripeTracks(tenant.magstripeTracks)
  }
  return normalizeMagstripeTracks()
}

export async function formatMagstripeData(cardNumber: number, tenantId?: string): Promise<string> {
  return withMagstripeSentinels(`${await getMagstripePrefix(tenantId)}${cardNumber}`)
}

export function magstripeEncodingCopy(prefix: string, tracks?: unknown) {
  const selected = normalizeMagstripeTracks(tracks)
  const label = formatMagstripeTrackList(selected)
  return {
    prefix,
    tracks: selected,
    format: `${prefix}{CARD_NUMBER}? written to ${label}`,
    example: withMagstripeSentinels(`${prefix}1500`),
    note: `Encode ${label} exactly as shown, including the ? at the end. That character is written onto the card and comes back when the card is swiped. The number printed on the back of the physical card must match.`,
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const stored = await getStoredSettings()
  const next: Partial<AppSettings> = { ...stored }

  for (const key of SETTING_KEYS) {
    if (!(key in patch) || patch[key] === undefined) continue
    if (SECRET_SET.has(key) && !patch[key]) continue
    if (key === 'bankSortCode') {
      next[key] = maskSortCode(String(patch[key] || ''))
      continue
    }
    if (key === 'bankAccountNumber') {
      const digits = maskAccountNumber(String(patch[key] || ''))
      if (!digits) continue
      next[key] = digits
      continue
    }
    next[key] = patch[key]
  }

  await systemConfigCollection.set(APP_SETTINGS_KEY, JSON.stringify(next))
  invalidateSettingsCache()
  return getAppSettings()
}

export function toPublicSettings(settings: AppSettings, platformAdmin = false) {
  const shared = {
    hopeMacyConfigured: Boolean(settings.hopeMacyAppId && settings.hopeMacyAppSecret),
    stripeConfigured: Boolean(settings.stripeSecretKey),
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
    stripePublishableKey: settings.stripePublishableKey,
    stripeSecretKeySet: Boolean(settings.stripeSecretKey),
    stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret),
    bankAccountName: settings.bankAccountName,
    bankSortCode: maskSortCode(settings.bankSortCode),
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
    emailWelcomeSubject: settings.emailWelcomeSubject,
    emailWelcomeTemplate: settings.emailWelcomeTemplate,
    emailRenewalSubject: settings.emailRenewalSubject,
    emailRenewalTemplate: settings.emailRenewalTemplate,
    emailRenewalConfirmSubject: settings.emailRenewalConfirmSubject,
    emailRenewalConfirmTemplate: settings.emailRenewalConfirmTemplate,
    emailDigitalCardSubject: settings.emailDigitalCardSubject,
    emailDigitalCardTemplate: settings.emailDigitalCardTemplate,
  }
}

export type PublicAppSettings = ReturnType<typeof toPublicSettings>
