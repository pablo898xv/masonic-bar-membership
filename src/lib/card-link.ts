export function publicAppUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export function membershipCardUrl(membershipId: string, accessToken: string) {
  return `${publicAppUrl()}/membership/card/${membershipId}?token=${encodeURIComponent(accessToken)}`
}

export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, '')
}

export function phonesMatch(a: string, b: string) {
  const left = phoneDigits(a)
  const right = phoneDigits(b)
  if (!left || !right) return false
  if (left === right) return true
  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left
  return longer.endsWith(shorter) && shorter.length >= 10
}
