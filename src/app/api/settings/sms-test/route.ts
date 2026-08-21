import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { UK_MOBILE_SMS_MESSAGE } from '@/lib/phone'
import { sendMembershipSms } from '@/lib/sms'
import { requireTenant } from '@/lib/tenancy'

export async function POST(request: NextRequest) {
  try {
    const { error } = await requirePlatformAdmin(request)
    if (error) return error

    const { tenant, error: tenantError } = await requireTenant(request)
    if (tenantError || !tenant) return tenantError!

    const body = (await request.json()) as { phone?: string; message?: string }
    const result = await sendMembershipSms({
      tenantId: tenant.id,
      to: body.phone,
      kind: 'test',
      charge: false,
      body: body.message || 'Membership Manager test SMS. Twilio is configured.',
    })

    if (!result.ok) {
      const message =
        result.skipped === 'invalid_phone' || result.skipped === 'not_mobile'
          ? UK_MOBILE_SMS_MESSAGE
          : result.skipped === 'no_phone'
            ? 'Enter a UK mobile number'
            : result.skipped === 'not_configured'
              ? 'Twilio is not configured'
              : result.error || 'SMS was not sent'
      return NextResponse.json({ error: message, skipped: result.skipped }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      to: result.to,
      sid: result.sid,
      logged: result.sid.startsWith('LOG'),
    })
  } catch (error) {
    console.error('Error sending test SMS:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send test SMS' },
      { status: 500 }
    )
  }
}
