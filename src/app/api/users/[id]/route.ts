import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection, tenantUsersCollection } from '@/lib/db'
import { authCookie, hashPassword, isSuperAdmin, requireAdmin, sessionTokenFor } from '@/lib/auth'
import { ensureUserCanAccessTenant, requireTenant } from '@/lib/tenancy'
import { adminStaffUpdateSchema } from '@/lib/validation'
import { findVenueUser, venueUserPayload, wouldLeaveVenueWithoutOwner } from '@/lib/venue-users'

async function loadVenueStaff(request: NextRequest, userId: string) {
  const { user: actor, error: authError } = await requireAdmin(request)
  if (authError || !actor) return { error: authError! }

  const { tenant, error } = await requireTenant(request)
  if (error || !tenant) return { error: error! }
  if (!(await ensureUserCanAccessTenant(actor.id, tenant.id))) {
    return { error: NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 }) }
  }

  const found = await findVenueUser(tenant.id, userId)
  if (!found) {
    return { error: NextResponse.json({ error: 'That user is not on this venue' }, { status: 404 }) }
  }

  return { actor, tenant, ...found }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loaded = await loadVenueStaff(request, id)
    if ('error' in loaded) return loaded.error
    const { user, link } = loaded
    return NextResponse.json({ user: venueUserPayload(user, link) })
  } catch (error) {
    console.error('Error loading venue user:', error)
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loaded = await loadVenueStaff(request, id)
    if ('error' in loaded) return loaded.error
    const { actor, tenant, user, link } = loaded

    const body = await request.json()
    const validation = adminStaffUpdateSchema.safeParse(body)
    if (!validation.success) {
      const first = validation.error.issues[0]?.message
      return NextResponse.json({ error: first || 'Check the user details' }, { status: 400 })
    }

    const { name, email, role, isActive, password, disableTotp } = validation.data
    const changingSignIn =
      Boolean(password) ||
      disableTotp === true ||
      isActive !== undefined ||
      name !== undefined ||
      email !== undefined

    if (user.isPlatformAdmin && !isSuperAdmin(actor) && changingSignIn) {
      return NextResponse.json(
        { error: 'Only a platform admin can change this person’s sign-in details.' },
        { status: 403 }
      )
    }

    if (actor.id === user.id && isActive === false) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
    }

    if (role && role !== link.role && (await wouldLeaveVenueWithoutOwner(tenant.id, link, role))) {
      return NextResponse.json(
        { error: 'Give another person the Owner role before changing this one.' },
        { status: 400 }
      )
    }

    if (email) {
      const nextEmail = email.trim().toLowerCase()
      if (nextEmail !== user.email) {
        const taken = await adminUsersCollection.findByEmail(nextEmail)
        if (taken && taken.id !== user.id) {
          return NextResponse.json({ error: 'That email is already in use.' }, { status: 409 })
        }
      }
    }

    const accountPatch: Parameters<typeof adminUsersCollection.update>[1] = {}
    if (name !== undefined) accountPatch.name = name.trim()
    if (email !== undefined) accountPatch.email = email.trim().toLowerCase()
    if (isActive !== undefined) accountPatch.isActive = isActive
    if (password) {
      accountPatch.passwordHash = await hashPassword(password)
      accountPatch.passwordUpdatedAt = new Date()
    }
    if (disableTotp) {
      accountPatch.totpEnabled = false
      accountPatch.totpSecret = ''
      accountPatch.totpPendingSecret = ''
      accountPatch.totpBackupHashes = []
    }

    let updated = user
    if (Object.keys(accountPatch).length) {
      updated = await adminUsersCollection.update(user.id, accountPatch)
    }

    let nextLink = link
    if (role && role !== link.role) {
      nextLink = await tenantUsersCollection.update(link.id, { role })
    }

    const payload = { user: venueUserPayload(updated, nextLink) }
    if (actor.id === user.id && password) {
      return authCookie(NextResponse.json(payload), sessionTokenFor(updated))
    }
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Error updating venue user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loaded = await loadVenueStaff(request, id)
    if ('error' in loaded) return loaded.error
    const { actor, tenant, user, link } = loaded

    if (await wouldLeaveVenueWithoutOwner(tenant.id, link, null)) {
      return NextResponse.json(
        { error: 'Give another person the Owner role before removing this one.' },
        { status: 400 }
      )
    }

    if (actor.id === user.id && !isSuperAdmin(actor)) {
      return NextResponse.json({ error: 'You cannot remove yourself from this venue.' }, { status: 400 })
    }

    await tenantUsersCollection.delete(link.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error removing venue user:', error)
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }
}
