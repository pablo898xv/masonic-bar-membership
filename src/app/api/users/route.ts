import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection, tenantUsersCollection } from '@/lib/db'
import { hashPassword, requireAdmin } from '@/lib/auth'
import { ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'
import { parseVenueRole, venueUserPayload } from '@/lib/venue-users'

export async function GET(request: NextRequest) {
  try {
    const { user: actor, error: authError } = await requireAdmin(request)
    if (authError || !actor) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(actor.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }
    const links = await tenantUsersCollection.findByTenant(tenant.id)
    const users = await Promise.all(
      links.map(async (link) => {
        const user = await adminUsersCollection.findById(link.userId)
        if (!user) return null
        return venueUserPayload(user, link)
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
    const { user: actor, error: authError } = await requireAdmin(request)
    if (authError || !actor) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(actor.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const role = parseVenueRole(body.role)

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

    const link = await tenantUsersCollection.create({ tenantId: tenant.id, userId: user.id, role })
    return NextResponse.json(venueUserPayload(user, link), { status: 201 })
  } catch (error) {
    console.error('Error adding user:', error)
    return NextResponse.json({ error: 'Failed to add user' }, { status: 500 })
  }
}
