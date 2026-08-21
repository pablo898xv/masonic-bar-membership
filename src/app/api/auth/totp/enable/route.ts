import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { loginUserResponse, readTotpSecret } from '@/lib/admin-totp'
import { generateBackupCodes, hashBackupCode, verifyTotpCode } from '@/lib/totp'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : ''
    const account = await adminUsersCollection.findById(user.id)
    if (!account) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    if (account.totpEnabled && account.totpSecret) {
      return NextResponse.json({ error: 'Two-factor authentication is already on' }, { status: 409 })
    }

    const secret = readTotpSecret(account.totpPendingSecret)
    if (!secret || !verifyTotpCode(secret, code)) {
      return NextResponse.json({ error: 'That authenticator code is not valid. Try again.' }, { status: 401 })
    }

    const backupCodes = generateBackupCodes()
    const updated = await adminUsersCollection.update(account.id, {
      totpSecret: account.totpPendingSecret,
      totpPendingSecret: '',
      totpEnabled: true,
      totpEnabledAt: new Date(),
      totpBackupHashes: backupCodes.map(hashBackupCode),
    })

    return NextResponse.json({
      ...loginUserResponse(updated),
      backupCodes,
    })
  } catch (error) {
    console.error('Error enabling two-factor authentication', error)
    return NextResponse.json({ error: 'Could not turn on two-factor authentication' }, { status: 500 })
  }
}
