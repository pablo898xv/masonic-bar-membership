import { NextRequest, NextResponse } from 'next/server'
import { adminUsersCollection } from '@/lib/db'
import { authCookie, sessionTokenFor, verifyToken } from '@/lib/auth'
import { loginUserResponse, userHasTotp, verifyUserSecondFactor } from '@/lib/admin-totp'
import { adminTotpVerifySchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = adminTotpVerifySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Enter the authenticator code or a backup code.' }, { status: 400 })
    }

    const payload = verifyToken(validation.data.ticket)
    if (!payload || payload.purpose !== '2fa') {
      return NextResponse.json({ error: 'That sign-in code has expired. Sign in again.' }, { status: 401 })
    }

    const user = await adminUsersCollection.findById(payload.userId)
    if (!user || !user.isActive || !userHasTotp(user)) {
      return NextResponse.json({ error: 'That sign-in code has expired. Sign in again.' }, { status: 401 })
    }

    const checked = await verifyUserSecondFactor(user, validation.data.code)
    if (!checked.ok) {
      return NextResponse.json({ error: 'That code is not valid.' }, { status: 401 })
    }

    const fresh = (await adminUsersCollection.findById(user.id)) || user
    return authCookie(NextResponse.json(loginUserResponse(fresh)), sessionTokenFor(fresh))
  } catch (error) {
    console.error('Error verifying two-factor code', error)
    return NextResponse.json({ error: 'Could not verify the code' }, { status: 500 })
  }
}
