import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membersCollection, subscriptionPlansCollection } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const membershipId = searchParams.get('membershipId')
  const paymentId = searchParams.get('paymentId')
  
  if (!membershipId) {
    return new NextResponse('Missing membershipId', { status: 400 })
  }
  
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) {
    return new NextResponse('Membership not found', { status: 404 })
  }
  
  const [member, plan] = await Promise.all([
    membersCollection.findById(membership.memberId),
    subscriptionPlansCollection.findById(membership.subscriptionPlanId),
  ])
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Mock Payment - Pixl Pay</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
    .card { background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
    h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
    .amount { font-size: 32px; font-weight: bold; color: #2563eb; margin: 20px 0; }
    .details { color: #666; font-size: 14px; line-height: 1.6; }
    .buttons { display: flex; gap: 12px; margin-top: 24px; }
    button { flex: 1; padding: 12px 24px; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
    .success { background: #22c55e; color: white; }
    .cancel { background: #ef4444; color: white; }
    .success:hover { background: #16a34a; }
    .cancel:hover { background: #dc2626; }
  </style>
</head>
<body>
  <h1>Mock Pixl Pay Checkout</h1>
  <div class="card">
    <div class="details">
      <strong>Member:</strong> ${member?.name || 'Unknown'}<br>
      <strong>Plan:</strong> ${plan?.name || 'Unknown'}<br>
      <strong>Payment Method:</strong> ${membership.paymentMethod || 'CARD'}
    </div>
    <div class="amount">${plan?.currency || 'GBP'} ${((plan?.price || 0) / 100).toFixed(2)}</div>
  </div>
  <div class="buttons">
    <button class="success" onclick="completePayment('success')">Complete Payment</button>
    <button class="cancel" onclick="completePayment('failed')">Cancel</button>
  </div>
  <script>
    async function completePayment(status) {
      const response = await fetch('/api/payments/mock-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: '${paymentId}',
          membershipId: '${membershipId}',
          status: status
        })
      });
      if (response.ok) {
        window.location.href = '${baseUrl}/membership/payment-complete?membershipId=${membershipId}&status=' + status;
      } else {
        alert('Payment processing failed');
      }
    }
  </script>
</body>
</html>
  `
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  })
}
