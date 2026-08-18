import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { memberSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit
    
    const where = search ? {
      OR: [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ]
    } : {}
    
    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            include: {
              membershipNumber: true,
              subscriptionPlan: true,
            }
          }
        }
      }),
      prisma.member.count({ where })
    ])
    
    return NextResponse.json({
      members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validation = memberSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { name, email, phone } = validation.data
    
    const existingMember = await prisma.member.findUnique({
      where: { email }
    })
    
    if (existingMember) {
      return NextResponse.json(
        { error: 'A member with this email already exists' },
        { status: 409 }
      )
    }
    
    const member = await prisma.member.create({
      data: { name, email, phone }
    })
    
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Error creating member:', error)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}
