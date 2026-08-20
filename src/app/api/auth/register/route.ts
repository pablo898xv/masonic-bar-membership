import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { hashPassword, generateToken, authCookie } from '@/lib/auth'
import { adminCreateSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = adminCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Check your name, email, and password.' }, { status: 400 })
    }

    const { email, password, name, role } = validation.data
    const userCount = await adminUsersCollection.count()
    if (userCount > 0) {
      return NextResponse.json(
        { error: 'Registration is closed. Please contact an existing admin.' },
        { status: 403 }
      )
    }

    const existingUser = await adminUsersCollection.findByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 409 }
      )
    }

    const user = await adminUsersCollection.create({
      email,
      passwordHash: await hashPassword(password),
      name,
      role: role || 'ADMIN',
      isPlatformAdmin: true,
      isActive: true,
    })

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    const { passwordHash: _, ...userWithoutPassword } = user
    return authCookie(
      NextResponse.json({ user: userWithoutPassword }, { status: 201 }),
      token
    )
  } catch (error) {
    console.error('Error during registration:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
