import { parseSmsCreditCost } from '@/lib/credits'
import { InvalidPhoneError, toE164 } from '@/lib/phone'
import { AppSettings, getAppSettings } from '@/lib/settings'
import { assertCreditsAvailable, consumeSmsCredit } from '@/lib/tenancy'

export const DEFAULT_SMS_TEMPLATES = {
  welcome:
    'Hi {{member_name}}, your membership is active. Card {{card_number}}, {{plan}}, valid until {{expiry}}. {{card_url}}',
  renewal:
    'Hi {{member_name}}, your membership (card {{card_number}}) expires in {{days}} days ({{expiry}}). Renew: {{renewal_url}}',
  digitalCard:
    '{{tenant_name}} has issued you a digital membership card, click here to download to your smartphone. {{card_url}}',
}

export const LEGACY_DIGITAL_CARD_SMS_TEMPLATE =
  'Hi {{member_name}}, your digital membership card #{{card_number}} is ready: {{card_url}}'

export type SmsKind = 'welcome' | 'renewal' | 'digitalCard' | 'test'

export type SmsMergeFields = {
  tenant_name?: string
  member_name?: string
  card_number?: string | number
  plan?: string
  expiry?: string
  days?: string | number
  renewal_url?: string
  card_url?: string
}

function flag(value: string | undefined, fallback = true) {
  if (value == null || value === '') return fallback
  return value === 'true'
}

export function isTwilioConfigured(settings: AppSettings) {
  return Boolean(settings.twilioAccountSid && settings.twilioAuthToken && settings.twilioFromNumber)
}

export function mergeSmsTemplate(template: string, fields: SmsMergeFields) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const value = fields[key as keyof SmsMergeFields]
    return value == null ? '' : String(value)
  }).replace(/[ \t]{2,}/g, ' ').trim()
}

function digitalCardTemplate(stored?: string) {
  if (!stored || stored === LEGACY_DIGITAL_CARD_SMS_TEMPLATE) {
    return DEFAULT_SMS_TEMPLATES.digitalCard
  }
  return stored
}

async function twilioCreateMessage(settings: AppSettings, to: string, body: string) {
  const sid = settings.twilioAccountSid
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`
  const params = new URLSearchParams({
    To: to,
    From: settings.twilioFromNumber,
    Body: body.slice(0, 1600),
  })
  const auth = Buffer.from(`${sid}:${settings.twilioAuthToken}`).toString('base64')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })
  const payload = (await response.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number }
  if (!response.ok) {
    throw new Error(payload.message || `Twilio rejected the SMS (${response.status})`)
  }
  if (!payload.sid) throw new Error('Twilio did not return a message SID')
  return payload.sid
}

export async function sendMembershipSms(options: {
  tenantId: string
  to?: string | null
  kind: SmsKind
  fields?: SmsMergeFields
  body?: string
  membershipId?: string
  charge?: boolean
}) {
  const settings = await getAppSettings()
  const enabled =
    options.kind === 'test'
      ? true
      : options.kind === 'welcome'
        ? flag(settings.smsWelcomeEnabled)
        : options.kind === 'renewal'
          ? flag(settings.smsRenewalEnabled)
          : flag(settings.smsDigitalCardEnabled)

  if (!enabled) {
    return { ok: false as const, skipped: 'disabled' as const }
  }

  let to: string | null
  try {
    to = toE164(options.to)
  } catch (error) {
    if (error instanceof InvalidPhoneError) {
      return { ok: false as const, skipped: 'invalid_phone' as const }
    }
    throw error
  }
  if (!to) return { ok: false as const, skipped: 'no_phone' as const }

  const template =
    options.body ||
    (options.kind === 'welcome'
      ? settings.smsWelcomeTemplate || DEFAULT_SMS_TEMPLATES.welcome
      : options.kind === 'renewal'
        ? settings.smsRenewalTemplate || DEFAULT_SMS_TEMPLATES.renewal
        : options.kind === 'digitalCard'
          ? digitalCardTemplate(settings.smsDigitalCardTemplate)
          : options.body) ||
    ''
  const body = mergeSmsTemplate(template, options.fields || {})
  if (!body) return { ok: false as const, skipped: 'empty_body' as const }

  const twilioReady = isTwilioConfigured(settings)
  const logFallback = flag(settings.twilioLogFallback)
  if (!twilioReady && !logFallback) {
    return { ok: false as const, skipped: 'not_configured' as const }
  }

  const cost = parseSmsCreditCost(settings.creditsPerSms)
  const shouldCharge = options.charge !== false && options.kind !== 'test' && cost > 0
  if (shouldCharge) {
    const credits = await assertCreditsAvailable(options.tenantId, cost)
    if (!credits.ok) {
      return {
        ok: false as const,
        skipped: 'no_credits' as const,
        error: `Not enough credits to send SMS. Each SMS uses ${cost} credits.`,
      }
    }
  }

  let messageSid: string
  if (twilioReady) {
    messageSid = await twilioCreateMessage(settings, to, body)
  } else {
    messageSid = `LOG${Date.now()}`
    console.log('SMS (log driver)', { to, from: settings.twilioFromNumber || 'LOG-FROM', body, sid: messageSid })
  }

  if (shouldCharge && twilioReady) {
    const charged = await consumeSmsCredit(
      options.tenantId,
      `SMS ${options.kind} to ${to} (${cost} credits)`,
      undefined,
      options.membershipId
    )
    if (!charged.ok) {
      console.error('SMS delivered but credit charge failed', charged)
    }
  }

  return { ok: true as const, to, sid: messageSid, charged: Boolean(shouldCharge && twilioReady) }
}
