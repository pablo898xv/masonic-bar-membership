export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function maskSortCode(value: string) {
  return digitsOnly(value).slice(0, 6)
}

export function maskAccountNumber(value: string) {
  return digitsOnly(value).slice(0, 8)
}
