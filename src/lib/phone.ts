export const UK_MOBILE_SMS_MESSAGE =
  'SMS is only sent to UK mobiles beginning 07 or +44 7'

export class InvalidPhoneError extends Error {
  constructor(message = 'Enter a valid phone number (e.g. 07xxx or +447xxx).') {
    super(message)
    this.name = 'InvalidPhoneError'
  }
}

/**
 * Normalise UK / E.164 numbers for Twilio, matching Pixl Pay.
 */
export function toE164(phone?: string | null, defaultCountryCode = '44'): string | null {
  if (phone == null || !phone.trim()) return null

  const digits = phone.trim().replace(/[^\d+]/g, '')

  let e164: string
  if (digits.startsWith('+')) {
    e164 = `+${digits.slice(1).replace(/\D/g, '')}`
  } else if (digits.startsWith('00')) {
    e164 = `+${digits.replace(/\D/g, '').slice(2)}`
  } else if (digits.startsWith('0')) {
    e164 = `+${defaultCountryCode}${digits.replace(/\D/g, '').slice(1)}`
  } else {
    const only = digits.replace(/\D/g, '')
    e164 = only.startsWith(defaultCountryCode) ? `+${only}` : `+${defaultCountryCode}${only}`
  }

  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    throw new InvalidPhoneError()
  }

  return e164
}

/** +44 7xxxxxxxxx — national 07, or +44 07 with a leftover trunk zero. */
export function toUkMobileE164(phone?: string | null): string | null {
  const e164 = toE164(phone)
  if (!e164) return null
  const normalised = e164.startsWith('+440') ? `+44${e164.slice(4)}` : e164
  if (!/^\+447\d{9}$/.test(normalised)) return null
  return normalised
}
