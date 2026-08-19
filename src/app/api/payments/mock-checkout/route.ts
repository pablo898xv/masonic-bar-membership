import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membersCollection, subscriptionPlansCollection } from '@/lib/db'

function sameOriginPath(url: string | null, fallback: string) {
  if (!url) return fallback
  try {
    const parsed = new URL(url, 'http://placeholder.local')
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url.startsWith('/') ? url : fallback
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const membershipId = searchParams.get('membershipId')
  const paymentId = searchParams.get('paymentId')
  const returnUrl = searchParams.get('returnUrl')
  
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
  
  const amount = Number(plan?.price || 0).toFixed(2)
  const token = encodeURIComponent(membership.accessToken || '')
  const defaultSuccess = `/membership/card/${membershipId}?token=${token}&paid=1`
  const successUrl = sameOriginPath(returnUrl, defaultSuccess)
  const failUrl = `/membership/payment-complete?membershipId=${membershipId}&status=failed`
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Checkout - Membership Manager</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; background: #f8fafc; color: #0f172a; }
    .card { background: white; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(15,23,42,.08); }
    h1 { font-size: 22px; margin: 0 0 8px; }
    .sub { color: #64748b; margin-bottom: 20px; }
    .amount { font-size: 32px; font-weight: bold; color: #2563eb; margin: 16px 0; }
    .details { color: #475569; font-size: 14px; line-height: 1.7; }
    .buttons { display: flex; gap: 12px; margin-top: 8px; }
    button { flex: 1; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; }
    .success { background: #16a34a; color: white; }
    .cancel { background: #e2e8f0; color: #0f172a; }
    .note { font-size: 12px; color: #94a3b8; margin-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <h1>Pay for your membership</h1>
  <p class="sub">Mock checkout for local development (Pixl Pay is not connected yet).</p>
  <div class="card">
    <div class="details">
      <strong>Member:</strong> ${member?.name || 'Unknown'}<br>
      <strong>Plan:</strong> ${plan?.name || 'Unknown'}<br>
      <strong>Method:</strong> ${membership.paymentMethod === 'OPEN_BANKING' ? 'Open Banking' : 'Card'}
    </div>
    <div class="amount">&pound;${amount}</div>
  </div>
  <div class="buttons">
    <button class="cancel" onclick="completePayment('failed')">Cancel</button>
    <button class="success" onclick="completePayment('success')">Pay &pound;${amount}</button>
  </div>
  <p class="note">Payment ID ${paymentId || 'pending'}</p>
  <script>
    async function completePayment(status) {
      const response = await fetch('/api/payments/mock-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: ${JSON.stringify(paymentId)},
          membershipId: ${JSON.stringify(membershipId)},
          status: status
        })
      });
      if (response.ok) {
        window.location.href = status === 'success'
          ? ${JSON.stringify(successUrl)}
          : ${JSON.stringify(failUrl)};
      } else {
        alert('Payment processing failed');
      }
    }
  </script>
</body>
</html>
  `
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
