import { NextRequest, NextResponse } from 'next/server'
import { membersCollection, membershipsCollection, membershipNumbersCollection, subscriptionPlansCollection } from '@/lib/db'
import { memberSchema } from '@/lib/validation'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const email = searchParams.get('email')

    if (email) {
      const member = await membersCollection.findByEmail(email, tenant.id)
      return NextResponse.json({
        members: member ? [member] : [],
        pagination: { page: 1, limit: 1, total: member ? 1 : 0, totalPages: member ? 1 : 0 }
      })
    }
    
    const { members, total } = await membersCollection.findMany({
      tenantId: tenant.id,
      search: search || undefined,
      take: limit,
    })
    
    const membersWithMemberships = await Promise.all(
      members.map(async (member) => {
        const { memberships } = await membershipsCollection.findMany({ memberId: member.id })
        
        const membershipsWithDetails = await Promise.all(
          memberships.map(async (m) => {
            const [membershipNumber, subscriptionPlan] = await Promise.all([
              membershipNumbersCollection.findById(m.membershipNumberId),
              subscriptionPlansCollection.findById(m.subscriptionPlanId),
            ])
            return { ...m, membershipNumber, subscriptionPlan }
          })
        )
        
        return { ...member, memberships: membershipsWithDetails }
      })
    )
    
    return NextResponse.json({
      members: membersWithMemberships,
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
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json()
    
    const validation = memberSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      )
    }
    
    const { name, email, phone } = validation.data
    
    const existingMember = await membersCollection.findByEmail(email, tenant.id)
    
    if (existingMember) {
      return NextResponse.json(
        { error: 'A member with this email already exists' },
        { status: 409 }
      )
    }
    
    const member = await membersCollection.create({ tenantId: tenant.id, name, email, phone })
    
    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Error creating member:', error)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}
