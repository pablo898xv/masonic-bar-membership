import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  walletPassesCollection 
} from '@/lib/db'
import { generateQRCodeBuffer, formatMembershipQRData } from '@/lib/qrcode'
import { generateWalletPass, isWalletPassConfigured } from '@/lib/wallet-pass'
import { getAppSettings } from '@/lib/settings'
import { v4 as uuidv4 } from 'uuid'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'qr'
    const token = searchParams.get('token')
    
    const membership = await membershipsCollection.findById(id)
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    if (token && membership.accessToken !== token) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Membership must be active to generate wallet pass' },
        { status: 400 }
      )
    }
    
    const [member, membershipNumber, subscriptionPlan] = await Promise.all([
      membersCollection.findById(membership.memberId),
      membershipNumbersCollection.findById(membership.membershipNumberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
    ])
    
    if (!member || !membershipNumber || !subscriptionPlan) {
      return NextResponse.json({ error: 'Related data not found' }, { status: 404 })
    }
    
    let walletPass = await walletPassesCollection.findByMembershipId(id)
    const qrData = await formatMembershipQRData(membershipNumber.cardNumber)

    if (!walletPass) {
      const settings = await getAppSettings()
      walletPass = await walletPassesCollection.create({
        membershipId: id,
        passTypeId: settings.passTypeIdentifier || 'pass.com.masonicbar.membership',
        serialNumber: uuidv4(),
        authToken: uuidv4(),
        qrCodeData: qrData,
        lastUpdated: new Date()
      })
    } else if (walletPass.qrCodeData !== qrData) {
      await walletPassesCollection.update(walletPass.id, {
        qrCodeData: qrData,
        lastUpdated: new Date(),
      })
    }
    
    if (format === 'pkpass') {
      if (!(await isWalletPassConfigured())) {
        return NextResponse.json(
          { error: 'Apple Wallet pass generation not configured' },
          { status: 501 }
        )
      }
      
      const generatedPass = await generateWalletPass({
        cardNumber: membershipNumber.cardNumber,
        memberName: member.name,
        memberEmail: member.email,
        subscriptionName: subscriptionPlan.name,
        expiryDate: membership.expiryDate!,
      })
      
      return NextResponse.json({
        message: 'Apple Wallet pass generation requires certificate configuration',
        passData: generatedPass.passData,
        qrCodeImage: generatedPass.qrCodeImage,
      }, { status: 501 })
    }
    
    const qrBuffer = await generateQRCodeBuffer(qrData)
    
    return new NextResponse(new Uint8Array(qrBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="membership-${membershipNumber.cardNumber}.png"`,
      }
    })
  } catch (error) {
    console.error('Error generating wallet pass:', error)
    return NextResponse.json({ error: 'Failed to generate wallet pass' }, { status: 500 })
  }
}
