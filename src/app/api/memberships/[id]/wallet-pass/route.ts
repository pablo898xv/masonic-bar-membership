import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateWalletPass, generatePkpassFile, isWalletPassConfigured } from '@/lib/wallet-pass'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    
    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        member: true,
        membershipNumber: true,
        subscriptionPlan: true,
      }
    })
    
    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }
    
    if (membership.cardType !== 'QR_CODE') {
      return NextResponse.json(
        { error: 'Wallet pass is only available for QR code memberships' },
        { status: 400 }
      )
    }
    
    if (membership.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Membership must be active to generate wallet pass' },
        { status: 400 }
      )
    }
    
    if (!membership.expiryDate) {
      return NextResponse.json(
        { error: 'Membership has no expiry date set' },
        { status: 400 }
      )
    }
    
    let walletPass = await prisma.walletPass.findFirst({
      where: { membershipId: id }
    })
    
    if (!walletPass) {
      const generatedPass = await generateWalletPass({
        cardNumber: membership.membershipNumber.cardNumber,
        memberName: membership.member.name,
        memberEmail: membership.member.email,
        subscriptionName: membership.subscriptionPlan.name,
        expiryDate: membership.expiryDate,
      })
      
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      
      walletPass = await prisma.walletPass.create({
        data: {
          membershipId: id,
          passTypeId: generatedPass.passData.passTypeId,
          serialNumber: generatedPass.serialNumber,
          authToken: generatedPass.authToken,
          qrCodeData: generatedPass.qrCodeData,
          passUrl: `${appUrl}/api/memberships/${id}/wallet-pass?format=pkpass`,
        }
      })
    }
    
    if (format === 'pkpass') {
      if (!isWalletPassConfigured()) {
        return NextResponse.json(
          { 
            error: 'Apple Wallet pass generation not configured',
            message: 'Please configure PASS_TYPE_IDENTIFIER, TEAM_IDENTIFIER, and certificate settings',
            qrCodeUrl: `/api/memberships/${id}/wallet-pass?format=qrcode`
          },
          { status: 501 }
        )
      }
      
      const pass = await generateWalletPass({
        cardNumber: membership.membershipNumber.cardNumber,
        memberName: membership.member.name,
        memberEmail: membership.member.email,
        subscriptionName: membership.subscriptionPlan.name,
        expiryDate: membership.expiryDate,
      })
      
      const pkpassBuffer = await generatePkpassFile(pass.passData)
      
      if (!pkpassBuffer) {
        return NextResponse.json(
          { error: 'Failed to generate pass file' },
          { status: 500 }
        )
      }
      
      return new NextResponse(new Uint8Array(pkpassBuffer), {
        headers: {
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="membership-${membership.membershipNumber.cardNumber}.pkpass"`,
        }
      })
    }
    
    if (format === 'qrcode') {
      const pass = await generateWalletPass({
        cardNumber: membership.membershipNumber.cardNumber,
        memberName: membership.member.name,
        memberEmail: membership.member.email,
        subscriptionName: membership.subscriptionPlan.name,
        expiryDate: membership.expiryDate,
      })
      
      return NextResponse.json({
        qrCodeData: pass.qrCodeData,
        qrCodeImage: pass.qrCodeImage,
        cardNumber: membership.membershipNumber.cardNumber,
        memberName: membership.member.name,
        expiryDate: membership.expiryDate,
      })
    }
    
    const pass = await generateWalletPass({
      cardNumber: membership.membershipNumber.cardNumber,
      memberName: membership.member.name,
      memberEmail: membership.member.email,
      subscriptionName: membership.subscriptionPlan.name,
      expiryDate: membership.expiryDate,
    })
    
    return NextResponse.json({
      walletPass: {
        ...walletPass,
        qrCodeImage: pass.qrCodeImage,
      },
      membership: {
        id: membership.id,
        cardNumber: membership.membershipNumber.cardNumber,
        memberName: membership.member.name,
        subscriptionName: membership.subscriptionPlan.name,
        expiryDate: membership.expiryDate,
      },
      appleWalletConfigured: isWalletPassConfigured(),
    })
  } catch (error) {
    console.error('Error generating wallet pass:', error)
    return NextResponse.json({ error: 'Failed to generate wallet pass' }, { status: 500 })
  }
}
