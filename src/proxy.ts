import { NextRequest, NextResponse } from 'next/server'
import { hasValidSession } from '@/lib/auth-token'
import { absolutePublicUrl } from '@/lib/public-url'

const PUBLIC_EXACT: Record<string, ReadonlySet<string>> = {
  '/api/auth/login': new Set(['POST']),
  '/api/auth/login/totp': new Set(['POST']),
  '/api/auth/register': new Set(['POST']),
  '/api/auth/logout': new Set(['POST']),
  '/api/auth/setup': new Set(['GET']),
  '/api/auth/me': new Set(['GET']),
  '/api/subscription-plans': new Set(['GET']),
  '/api/members': new Set(['POST']),
  '/api/members/availability': new Set(['POST']),
  '/api/memberships': new Set(['POST']),
  '/api/memberships/lookup': new Set(['POST']),
  '/api/payments/initiate': new Set(['GET', 'POST']),
  '/api/payments/return': new Set(['GET']),
  '/api/payments/webhook': new Set(['POST']),
  '/api/payments/mock-checkout': new Set(['GET']),
  '/api/payments/mock-complete': new Set(['POST']),
}

function isPublicApi(request: NextRequest) {
  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  if (pathname.startsWith('/api/v1/')) return true

  if (PUBLIC_EXACT[pathname]?.has(method)) return true

  if (pathname === '/api/tenants' && method === 'GET' && request.nextUrl.searchParams.get('public') === '1') {
    return true
  }

  if (method === 'POST' && /^\/api\/payments\/stripe\/webhook(?:\/[^/]+)?$/.test(pathname)) {
    return true
  }

  if (method === 'GET' && pathname === '/api/branding') return true
  if (method === 'GET' && /^\/api\/branding\/[^/]+\/(logo|icon)$/.test(pathname)) return true

  if (method === 'GET' && /^\/api\/memberships\/[^/]+\/(card|wallet-pass|google-wallet)$/.test(pathname)) {
    return true
  }

  if (method === 'GET' && /^\/api\/memberships\/[^/]+$/.test(pathname)) {
    const segment = pathname.slice('/api/memberships/'.length)
    if (segment !== 'lookup' && segment !== 'expiring') return true
  }

  if (method === 'POST' && /^\/api\/memberships\/[^/]+\/renew$/.test(pathname)) {
    return true
  }

  if (pathname.startsWith('/api/cron/')) {
    const cronSecret = process.env.CRON_SECRET
    const auth = request.headers.get('authorization')
    if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  }

  return false
}

function tenantRewrite(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/t\/([^/]+)(\/.*)?$/)
  if (!match) return null

  const slug = match[1]
  const rest = match[2] && match[2] !== '/' ? match[2] : '/'
  const url = request.nextUrl.clone()
  url.pathname = rest

  const response = NextResponse.rewrite(url)
  response.headers.set('x-tenant-slug', slug)
  response.cookies.set('mbm_tenant_slug', slug, {
    path: '/',
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  })
  return response
}

export function proxy(request: NextRequest) {
  const tenantResponse = tenantRewrite(request)
  if (tenantResponse) return tenantResponse

  const { pathname, search } = request.nextUrl

  if (pathname === '/admin/login' || pathname === '/admin/logout') {
    return NextResponse.next()
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (hasValidSession(request)) return NextResponse.next()
    const login = new URL(absolutePublicUrl(request, '/admin/login'))
    login.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(login)
  }

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(request)) return NextResponse.next()
    if (hasValidSession(request)) return NextResponse.next()
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/t/:path*', '/admin', '/admin/:path*', '/api/:path*'],
}
