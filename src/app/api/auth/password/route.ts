import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { authCookie, hashPassword, requireAdmin, sessionTokenFor, verifyPassword } from '@/lib/auth'
import { loginUserResponse, userHasTotp, verifyUserSecondFactor } from '@/lib/admin-totp'
import { adminChangePasswordSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json()
    const validation = adminChangePasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Check your current and new passwords.' }, { status: 400 })
    }

    const account = await adminUsersCollection.findById(user.id)
    if (!account) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })

    const { currentPassword, newPassword, code } = validation.data
    if (!(await verifyPassword(currentPassword, account.passwordHash))) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }
    if (await verifyPassword(newPassword, account.passwordHash)) {
      return NextResponse.json({ error: 'Choose a different new password' }, { status: 400 })
    }
    if (userHasTotp(account)) {
      const checked = await verifyUserSecondFactor(account, code || '')
      if (!checked.ok) {
        return NextResponse.json({ error: 'Enter a valid authenticator or backup code' }, { status: 401 })
      }
    }

    const passwordUpdatedAt = new Date()
    const updated = await adminUsersCollection.update(account.id, {
      passwordHash: await hashPassword(newPassword),
      passwordUpdatedAt,
    })
    return authCookie(NextResponse.json(loginUserResponse(updated)), sessionTokenFor(updated))
  } catch (error) {
    console.error('Error changing password', error)
    return NextResponse.json({ error: 'Could not change password' }, { status: 500 })
  }
}
