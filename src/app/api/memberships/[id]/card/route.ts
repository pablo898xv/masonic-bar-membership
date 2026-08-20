import { NextRequest, NextResponse } from 'next/server'
import {
  membershipsCollection,
  membersCollection,
  membershipNumbersCollection,
  subscriptionPlansCollection,
} from '@/lib/db'
import { generateQRCodeDataURL, formatMembershipQRData } from '@/lib/qrcode'
import { isWalletPassConfigured } from '@/lib/wallet-pass'
import { isGoogleWalletConfigured } from '@/lib/google-wallet'
import { hasDigitalCard } from '@/lib/card-type'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = request.nextUrl.searchParams.get('token') || ''

    const membership = await membershipsCollection.findById(id)
    if (!membership || !membership.accessToken || membership.accessToken !== token) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    const [member, membershipNumber, subscriptionPlan] = await Promise.all([
      membersCollection.findById(membership.memberId),
      membershipNumbersCollection.findById(membership.membershipNumberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
    ])

    if (!member || !membershipNumber || !subscriptionPlan) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    let qrCodeImage: string | null = null
    if (hasDigitalCard(membership.cardType) && membership.status === 'ACTIVE') {
      const qrData = await formatMembershipQRData(membershipNumber.cardNumber, membership.tenantId)
      qrCodeImage = await generateQRCodeDataURL(qrData, { width: 360 })
    }

    return NextResponse.json({
      membershipId: membership.id,
      memberName: member.name,
      cardNumber: membershipNumber.cardNumber,
      cardType: membership.cardType,
      status: membership.status,
      planName: subscriptionPlan.name,
      expiryDate: membership.expiryDate,
      qrCodeImage,
      appleWalletAvailable:
        (await isWalletPassConfigured()) &&
        hasDigitalCard(membership.cardType) &&
        membership.status === 'ACTIVE',
      googleWalletAvailable:
        (await isGoogleWalletConfigured()) &&
        hasDigitalCard(membership.cardType) &&
        membership.status === 'ACTIVE',
    })
  } catch (error) {
    console.error('Error loading membership card:', error)
    return NextResponse.json({ error: 'Failed to load membership card' }, { status: 500 })
  }
}
