import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { adminCreateSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = adminCreateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { email, password, name, role } = validation.data
    
    const existingUser = await prisma.adminUser.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 409 }
      )
    }
    
    const adminCount = await prisma.adminUser.count()
    const isFirstAdmin = adminCount === 0
    
    const passwordHash = await hashPassword(password)
    
    const user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name,
        role: isFirstAdmin ? 'ADMIN' : role,
      }
    })
    
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
    
    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      isFirstAdmin,
    }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
