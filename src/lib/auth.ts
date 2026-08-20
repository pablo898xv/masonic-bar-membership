import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from './db'
import {
  tokenFromRequest,
  verifyToken,
} from './auth-token'

export {
  AUTH_COOKIE,
  AUTH_MAX_AGE,
  authCookie,
  clearAuthCookie,
  generateToken,
  hasValidSession,
  tokenFromRequest,
  verifyToken,
} from './auth-token'
export type { JWTPayload } from './auth-token'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function getAuthenticatedUser(request: NextRequest) {
  const token = tokenFromRequest(request)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await adminUsersCollection.findById(payload.userId)
  if (!user || !user.isActive) return null

  const { passwordHash: _, ...userWithoutPassword } = user
  return userWithoutPassword
}

export function isSuperAdmin(user: { isPlatformAdmin?: boolean } | null | undefined) {
  return Boolean(user?.isPlatformAdmin)
}

export async function requireAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Sign in required' }, { status: 401 }),
    }
  }
  return { user, error: null as NextResponse | null }
}

export async function requirePlatformAdmin(request: NextRequest) {
  const { user, error } = await requireAdmin(request)
  if (error || !user) return { user: null, error: error! }
  if (!isSuperAdmin(user)) {
    return {
      user,
      error: NextResponse.json(
        { error: 'Only a super admin can create or delete venues' },
        { status: 403 }
      ),
    }
  }
  return { user, error: null as NextResponse | null }
}

export async function requireCronOrAdmin(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { user: null, error: null as NextResponse | null }
  }
  return requireAdmin(request)
}

export function requireAuth(roles?: string[]) {
  return async (request: NextRequest) => {
    const user = await getAuthenticatedUser(request)

    if (!user) {
      return { error: 'Unauthorized', status: 401 }
    }

    if (roles && !roles.includes(user.role)) {
      return { error: 'Forbidden', status: 403 }
    }

    return { user }
  }
}
