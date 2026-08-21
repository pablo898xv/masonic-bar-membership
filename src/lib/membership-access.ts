import { NextRequest, NextResponse } from 'next/server'
import { hasValidSession } from '@/lib/auth-token'

export function membershipAccessToken(request: NextRequest, body?: { token?: unknown }) {
  const fromQuery = request.nextUrl.searchParams.get('token') || ''
  const fromBody = typeof body?.token === 'string' ? body.token : ''
  return fromQuery || fromBody
}

export function canAccessMembership(
  request: NextRequest,
  membership: { accessToken?: string | null } | null,
  token?: string
) {
  if (!membership) return false
  if (hasValidSession(request)) return true
  const value = token ?? membershipAccessToken(request)
  return Boolean(membership.accessToken && value && membership.accessToken === value)
}

export function membershipNotFound() {
  return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
}
