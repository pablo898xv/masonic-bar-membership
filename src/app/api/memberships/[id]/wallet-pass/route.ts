import { NextRequest, NextResponse } from 'next/server'
import { 
  membershipsCollection, 
  membersCollection, 
  membershipNumbersCollection, 
  subscriptionPlansCollection,
  walletPassesCollection 
} from '@/lib/db'
import { generateQRCodeBuffer, formatMembershipQRData } from '@/lib/qrcode'
import { generatePkpassFile, generateWalletPass } from '@/lib/wallet-pass'
import { getAppSettings } from '@/lib/settings'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'

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
    const qrData = await formatMembershipQRData(membershipNumber.cardNumber, membership.tenantId)

    if (!walletPass) {
      const settings = await getAppSettings()
      walletPass = await walletPassesCollection.create({
        membershipId: id,
        tenantId: membership.tenantId,
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
      const generatedPass = await generateWalletPass({
        cardNumber: membershipNumber.cardNumber,
        memberName: member.name,
        memberEmail: member.email,
        subscriptionName: subscriptionPlan.name,
        expiryDate: membership.expiryDate!,
        tenantId: membership.tenantId,
        serialNumber: walletPass.serialNumber,
        authToken: walletPass.authToken,
      })

      const pkpass = await generatePkpassFile(generatedPass.passData)
      if (!pkpass) {
        return NextResponse.json(
          { error: 'Apple Wallet pass generation not configured' },
          { status: 501 }
        )
      }

      return new NextResponse(new Uint8Array(pkpass), {
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="membership-${membershipNumber.cardNumber}.pkpass"`,
        },
      })
    }
    
    if (format === 'preview') {
      const pngUrl = `/api/memberships/${id}/wallet-pass?format=png${token ? `&token=${encodeURIComponent(token)}` : ''}`
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Card #${membershipNumber.cardNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 28rem; margin: 2rem auto; text-align: center; color: #0f172a;">
  <p style="color:#64748b; font-size:0.875rem;">${member.name}</p>
  <p style="font-weight:600; margin: 0.25rem 0 1rem;">Card #${membershipNumber.cardNumber}</p>
  <img src="${pngUrl}" alt="Membership QR code" width="280" height="280" />
  <p style="font-size:0.875rem; color:#64748b; margin-top:1rem;">Show this code at the bar</p>
</body>
</html>`
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
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
