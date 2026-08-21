import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { requireAdmin, verifyPassword } from '@/lib/auth'
import { storeTotpSecret } from '@/lib/admin-totp'
import { generateQRCodeDataURL } from '@/lib/qrcode'
import { generateTotpSecret, totpOtpauthUrl } from '@/lib/totp'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json().catch(() => ({}))
    const password = typeof body.password === 'string' ? body.password : ''
    const account = await adminUsersCollection.findById(user.id)
    if (!account) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
    if (!(await verifyPassword(password, account.passwordHash))) {
      return NextResponse.json({ error: 'Password is incorrect' }, { status: 401 })
    }
    if (account.totpEnabled && account.totpSecret) {
      return NextResponse.json({ error: 'Two-factor authentication is already on' }, { status: 409 })
    }

    const secret = generateTotpSecret()
    const otpauthUrl = totpOtpauthUrl(account.email, secret)
    await adminUsersCollection.update(account.id, {
      totpPendingSecret: storeTotpSecret(secret),
      totpEnabled: false,
    })

    return NextResponse.json({
      secret,
      otpauthUrl,
      qrCode: await generateQRCodeDataURL(otpauthUrl, { width: 220 }),
    })
  } catch (error) {
    console.error('Error starting two-factor setup', error)
    return NextResponse.json({ error: 'Could not start two-factor setup' }, { status: 500 })
  }
}
