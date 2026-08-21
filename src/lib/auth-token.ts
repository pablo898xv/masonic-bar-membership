import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { publicUrlIsHttps } from '@/lib/public-url'

export const AUTH_COOKIE = 'mbm_admin'
export const AUTH_MAX_AGE = 60 * 60 * 24
const DEV_FALLBACK_SECRET = 'fallback-secret-change-in-production'

export interface JWTPayload {
  userId: string
  email: string
  role: string
  purpose?: 'session' | '2fa'
  pwdv?: number
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (process.env.NODE_ENV === 'production' && (!secret || secret === DEV_FALLBACK_SECRET)) {
    throw new Error('JWT_SECRET must be set to a strong value in production')
  }
  return secret || DEV_FALLBACK_SECRET
}

export function generateToken(payload: JWTPayload, expiresIn: jwt.SignOptions['expiresIn'] = '24h'): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as JWTPayload
  } catch {
    return null
  }
}

export function tokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7)
  return request.cookies.get(AUTH_COOKIE)?.value || null
}

export function hasValidSession(request: NextRequest) {
  const token = tokenFromRequest(request)
  const payload = token ? verifyToken(token) : null
  return Boolean(payload && payload.purpose !== '2fa')
}

export function authCookie(response: NextResponse, token: string) {
  const https =
    process.env.NODE_ENV === 'production' || publicUrlIsHttps()
  response.cookies.set(AUTH_COOKIE, token, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    maxAge: AUTH_MAX_AGE,
    secure: https,
  })
  return response
}

export function clearAuthCookie(response: NextResponse) {
  const https =
    process.env.NODE_ENV === 'production' || publicUrlIsHttps()
  response.cookies.set(AUTH_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: https,
  })
  return response
}
