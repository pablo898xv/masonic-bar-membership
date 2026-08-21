import { NextRequest, NextResponse } from 'next/server'
import {
  membershipsCollection,
  membersCollection,
  membershipNumbersCollection,
  subscriptionPlansCollection,
} from '@/lib/db'
import { hasDigitalCard } from '@/lib/card-type'
import { createGoogleWalletSaveUrl, isGoogleWalletConfigured } from '@/lib/google-wallet'
import { publicOrigin } from '@/lib/public-url'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.nextUrl.searchParams.get('token') || ''

    if (!(await isGoogleWalletConfigured())) {
      return NextResponse.json({ error: 'Google Wallet is not configured' }, { status: 501 })
    }

    const membership = await membershipsCollection.findById(id)
    if (!membership || !membership.accessToken || membership.accessToken !== token) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    if (membership.status !== 'ACTIVE' || !hasDigitalCard(membership.cardType)) {
      return NextResponse.json({ error: 'Digital card is not available for this membership' }, { status: 400 })
    }

    const [member, membershipNumber, subscriptionPlan] = await Promise.all([
      membersCollection.findById(membership.memberId),
      membershipNumbersCollection.findById(membership.membershipNumberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
    ])
    if (!member || !membershipNumber || !subscriptionPlan) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const saveUrl = await createGoogleWalletSaveUrl({
      membershipId: membership.id,
      memberName: member.name,
      cardNumber: membershipNumber.cardNumber,
      planName: subscriptionPlan.name,
      expiryDate: membership.expiryDate,
      origins: [publicOrigin(request)],
      tenantId: membership.tenantId,
    })

    return NextResponse.redirect(saveUrl)
  } catch (error) {
    console.error('Error creating Google Wallet pass:', error)
    return NextResponse.json({ error: 'Failed to create Google Wallet pass' }, { status: 500 })
  }
}
