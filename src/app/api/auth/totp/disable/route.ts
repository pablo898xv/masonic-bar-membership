import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { requireAdmin, verifyPassword } from '@/lib/auth'
import { loginUserResponse, userHasTotp, verifyUserSecondFactor } from '@/lib/admin-totp'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json().catch(() => ({}))
    const password = typeof body.password === 'string' ? body.password : ''
    const code = typeof body.code === 'string' ? body.code : ''
    const account = await adminUsersCollection.findById(user.id)
    if (!account) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    if (!userHasTotp(account)) {
      return NextResponse.json(loginUserResponse(account))
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 401 })
    }
    const checked = await verifyUserSecondFactor(account, code)
    if (!checked.ok) {
      return NextResponse.json({ error: 'Enter a valid authenticator or backup code' }, { status: 401 })
    }

    const updated = await adminUsersCollection.update(account.id, {
      totpEnabled: false,
      totpSecret: '',
      totpPendingSecret: '',
      totpBackupHashes: [],
    })
    return NextResponse.json(loginUserResponse(updated))
  } catch (error) {
    console.error('Error disabling two-factor authentication', error)
    return NextResponse.json({ error: 'Could not turn off two-factor authentication' }, { status: 500 })
  }
}
