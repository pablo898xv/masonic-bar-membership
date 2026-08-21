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
