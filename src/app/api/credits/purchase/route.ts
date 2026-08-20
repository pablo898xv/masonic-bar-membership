import { NextRequest, NextResponse } from 'next/server'
import { findPackage } from '@/lib/credits'
import { paymentTransactionsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { initiateOpenBankingPayment } from '@/lib/hopemacy'
import { platformCreditor, requireTenant } from '@/lib/tenancy'

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const body = await request.json().catch(() => ({}))
    const packageKey = typeof body.packageKey === 'string' ? body.packageKey : ''
    const pack = findPackage(packageKey)
    if (!pack) {
      return NextResponse.json({ error: 'Unknown credit pack' }, { status: 400 })
    }

    const origin = new URL(request.url).origin
    const creditor = await platformCreditor()
    const paymentResult = await initiateOpenBankingPayment({
      amountGbp: pack.pricePence / 100,
      currency: 'GBP',
      reference: `credits-${tenant.slug}-${pack.key}`,
      description: `${pack.name} credit pack (${pack.credits} credits) for ${tenant.name}`,
      customerEmail: tenant.email || user.email,
      creditor,
      successUrl: `${origin}/api/payments/return?kind=credits`,
      cancelUrl: `${origin}/admin/credits?cancelled=1`,
      metadata: {
        kind: 'credit_pack',
        tenantId: tenant.id,
        packageKey: pack.key,
        packageName: pack.name,
        credits: pack.credits,
        pricePence: pack.pricePence,
        purchasedByUserId: user.id,
        returnUrl: `${origin}/admin/credits?paid=1`,
      },
    })

    if (!paymentResult.success || !paymentResult.paymentUrl) {
      return NextResponse.json(
        { error: (!paymentResult.success && paymentResult.error) || 'Could not start open banking payment' },
        { status: 502 }
      )
    }

    await paymentTransactionsCollection.create({
      tenantId: tenant.id,
      creditPurchase: true,
      amount: pack.pricePence / 100,
      currency: 'GBP',
      paymentMethod: 'OPEN_BANKING',
      provider: 'HOPE_MACY',
      externalId: paymentResult.paymentId,
      status: 'PENDING',
      metadata: {
        kind: 'credit_pack',
        tenantId: tenant.id,
        packageKey: pack.key,
        packageName: pack.name,
        credits: pack.credits,
        pricePence: pack.pricePence,
        purchasedByUserId: user.id,
        returnUrl: `${origin}/admin/credits?paid=1`,
      },
    })

    return NextResponse.json({
      paymentId: paymentResult.paymentId,
      paymentUrl: paymentResult.paymentUrl,
      redirectUrl: paymentResult.paymentUrl,
      package: pack,
    })
  } catch (error) {
    console.error('Error purchasing credits:', error)
    return NextResponse.json({ error: 'Failed to start credit pack purchase' }, { status: 500 })
  }
}
