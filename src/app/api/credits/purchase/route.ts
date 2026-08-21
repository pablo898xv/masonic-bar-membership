import { NextRequest, NextResponse } from 'next/server'
import { findPackage } from '@/lib/credits'
import { paymentTransactionsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { initiateOpenBankingPayment } from '@/lib/hopemacy'
import { creditPurchaseMethods } from '@/lib/payment-options'
import { createStripeCheckout, platformStripeSecret } from '@/lib/stripe-checkout'
import { platformCreditor, requireTenant } from '@/lib/tenancy'
import { publicOrigin } from '@/lib/public-url'

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

    const methods = await creditPurchaseMethods()
    const requested = body.method === 'CARD' ? 'CARD' : 'OPEN_BANKING'
    if (requested === 'CARD' && !methods.card) {
      return NextResponse.json(
        { error: 'Card payments for credit packs are not configured. A super admin must add Stripe in Platform settings.' },
        { status: 400 }
      )
    }
    if (requested !== 'CARD' && !methods.openBanking) {
      return NextResponse.json(
        { error: 'Open banking is not available. Use card or ask a super admin to configure open banking.' },
        { status: 400 }
      )
    }

    const origin = publicOrigin(request)
    const metadata = {
      kind: 'credit_pack',
      tenantId: tenant.id,
      packageKey: pack.key,
      packageName: pack.name,
      credits: String(pack.credits),
      pricePence: String(pack.pricePence),
      purchasedByUserId: user.id,
      returnUrl: `${origin}/admin/credits?paid=1`,
    }

    if (requested === 'CARD') {
      const paymentResult = await createStripeCheckout({
        secretKey: await platformStripeSecret(),
        amountGbp: pack.pricePence / 100,
        currency: 'GBP',
        description: `${pack.name} credit pack (${pack.credits} credits) for ${tenant.name}`,
        customerEmail: tenant.email || user.email,
        successUrl: `${origin}/api/payments/return?kind=credits&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/admin/credits?cancelled=1`,
        clientReferenceId: `credits-${tenant.id}-${pack.key}`,
        metadata,
      })

      if (!paymentResult.success || !paymentResult.paymentUrl) {
        return NextResponse.json(
          { error: (!paymentResult.success && paymentResult.error) || 'Could not start Stripe payment' },
          { status: 502 }
        )
      }

      await paymentTransactionsCollection.create({
        tenantId: tenant.id,
        creditPurchase: true,
        amount: pack.pricePence / 100,
        currency: 'GBP',
        paymentMethod: 'CARD',
        provider: 'STRIPE',
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
        paymentMethod: 'CARD',
        provider: 'STRIPE',
        package: pack,
      })
    }

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
      metadata,
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
      paymentMethod: 'OPEN_BANKING',
      provider: 'HOPE_MACY',
      package: pack,
    })
  } catch (error) {
    console.error('Error purchasing credits:', error)
    return NextResponse.json({ error: 'Failed to start credit pack purchase' }, { status: 500 })
  }
}
