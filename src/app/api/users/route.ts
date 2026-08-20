import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection, tenantUsersCollection } from '@/lib/db'
import { hashPassword, requireAdmin } from '@/lib/auth'
import { requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    const links = await tenantUsersCollection.findByTenant(tenant.id)
    const users = await Promise.all(
      links.map(async (link) => {
        const user = await adminUsersCollection.findById(link.userId)
        if (!user) return null
        const { passwordHash: _, ...safe } = user
        return { ...safe, tenantRole: link.role, tenantUserId: link.id }
      })
    )
    return NextResponse.json({ users: users.filter(Boolean) })
  } catch (error) {
    console.error('Error listing users:', error)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request)
    if (authError) return authError
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const role = body.role === 'OWNER' || body.role === 'ADMIN' ? body.role : 'MANAGER'

    if (!email || !name) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
    }

    let user = await adminUsersCollection.findByEmail(email)
    if (!user) {
      if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters for a new user' }, { status: 400 })
      }
      user = await adminUsersCollection.create({
        email,
        name,
        passwordHash: await hashPassword(password),
        role: 'MANAGER',
        isPlatformAdmin: false,
        isActive: true,
      })
    }

    const existing = await tenantUsersCollection.find(user.id, tenant.id)
    if (existing) {
      return NextResponse.json({ error: 'That user already belongs to this venue' }, { status: 409 })
    }

    await tenantUsersCollection.create({ tenantId: tenant.id, userId: user.id, role })
    const { passwordHash: _, ...safe } = user
    return NextResponse.json({ ...safe, tenantRole: role }, { status: 201 })
  } catch (error) {
    console.error('Error adding user:', error)
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
  }
}
