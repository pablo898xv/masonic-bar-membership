import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { verifyPassword, generateToken, authCookie } from '@/lib/auth'
import { adminLoginSchema } from '@/lib/validation'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const DUMMY_HASH = '$2b$12$9b7ZfI3dEo5mkTyCr3g0aO1pfLftiqWzjb3I/mLaiZM7.7.P1JlE6'

const attempts = new Map<string, { count: number; resetAt: number }>()

function clientKey(request: NextRequest, email: string) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local'
  return `${ip}:${email.toLowerCase()}`
}

function isLocked(key: string) {
  const row = attempts.get(key)
  if (!row) return false
  if (Date.now() > row.resetAt) {
    attempts.delete(key)
    return false
  }
  return row.count >= MAX_ATTEMPTS
}

function recordFailure(key: string) {
  const now = Date.now()
  const row = attempts.get(key)
  if (!row || now > row.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return
  }
  row.count += 1
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = adminLoginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const { email, password } = validation.data
    const key = clientKey(request, email)
    if (isLocked(key)) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }

    const user = await adminUsersCollection.findByEmail(email)
    const passwordHash = user?.passwordHash || DUMMY_HASH
    const passwordOk = await verifyPassword(password, passwordHash)

    if (!user || !user.isActive || !passwordOk) {
      recordFailure(key)
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    attempts.delete(key)

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    const { passwordHash: _, ...userWithoutPassword } = user
    return authCookie(NextResponse.json({ user: userWithoutPassword }), token)
  } catch (error) {
    console.error('Error during login:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
