export const PUBLIC_SITE_ORIGIN = 'https://membership.ashlartechnologies.com'

const UNUSABLE_HOSTS = new Set(['0.0.0.0', '::', '[::]', '[::1]'])

function hostnameOf(host: string) {
  return host.replace(/^\[/, '').replace(/\]:\d+$/, '').replace(/:\d+$/, '').replace(/\]$/, '').toLowerCase()
}

function originFrom(value: string) {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    if (UNUSABLE_HOSTS.has(url.hostname.toLowerCase())) return ''
    return `${url.protocol}//${url.host}`
  } catch {
    return ''
  }
}

function usableHost(value: string | null) {
  const host = value?.split(',')[0]?.trim() || ''
  if (!host) return ''
  if (UNUSABLE_HOSTS.has(hostnameOf(host))) return ''
  return host
}

function hostingStack() {
  const host = (process.env.HOSTNAME || '').toLowerCase()
  return host === '0.0.0.0' || host === '::' || process.env.NODE_ENV === 'production'
}

/**
 * Public origin for links, QR codes, emails, and payment returns.
 * Never returns the Docker bind address 0.0.0.0 — use the live domain on UAT/hosting.
 * Laptop `npm run dev` still uses NEXT_PUBLIC_BASE_URL (127.0.0.1).
 */
export function publicAppBaseUrl() {
  const configured = originFrom(process.env.NEXT_PUBLIC_BASE_URL || '')
  if (configured) return configured
  if (hostingStack()) return PUBLIC_SITE_ORIGIN
  return 'http://127.0.0.1:3000'
}

export function publicOrigin(request?: Request) {
  if (request) {
    const host =
      usableHost(request.headers.get('x-forwarded-host')) || usableHost(request.headers.get('host'))
    if (host) {
      const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
      const proto =
        forwardedProto ||
        (host.includes('localhost') || hostnameOf(host).startsWith('127.') ? 'http' : 'https')
      const origin = originFrom(`${proto}://${host}`)
      if (origin) return origin
    }
  }

  return publicAppBaseUrl()
}

export function absolutePublicUrl(request: Request, pathOrUrl: string) {
  const origin = publicOrigin(request)
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const parsed = new URL(pathOrUrl)
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  }
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${origin}${path}`
}

export function publicUrlIsHttps() {
  return publicAppBaseUrl().startsWith('https://')
}
