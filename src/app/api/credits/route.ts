import { NextRequest, NextResponse } from 'next/server'
import { packIsRevocable, presentCatalog, formatCredits } from '@/lib/credits'
import { creditLedgerCollection } from '@/lib/db'
import { isSuperAdmin, requireAdmin } from '@/lib/auth'
import { creditPurchaseMethods } from '@/lib/payment-options'
import { addCredits, requireTenant } from '@/lib/tenancy'

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    const platformAdmin = isSuperAdmin(user)
    const ledger = await creditLedgerCollection.findByTenant(tenant.id)
    const payments = await creditPurchaseMethods()
    return NextResponse.json({
      creditBalance: tenant.creditBalance,
      creditBalanceLabel: formatCredits(tenant.creditBalance),
      packages: presentCatalog(),
      canAdjust: platformAdmin,
      canRevokePacks: platformAdmin,
      payments,
      ledger: ledger.map((entry) => ({
        ...entry,
        revocable: platformAdmin && packIsRevocable(entry),
      })),
    })
  } catch (error) {
    console.error('Error loading credits:', error)
    return NextResponse.json({ error: 'Failed to load credits' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!
    if (!isSuperAdmin(user)) {
      return NextResponse.json(
        { error: 'Credit packs are purchased by the venue. Support adjustments are super admin only.' },
        { status: 403 }
      )
    }
    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    const body = await request.json()

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: 'Enter an adjustment amount' }, { status: 400 })
    }
    const note = typeof body.note === 'string' && body.note ? body.note : 'Credit adjustment'
    const result = await addCredits(tenant.id, Math.trunc(amount), 'ADJUSTMENT', note, user.id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adding credits:', error)
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
  }
}
