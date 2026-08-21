import { NextRequest, NextResponse } from 'next/server'
import { mockPaymentsAllowed } from '@/lib/hopemacy'
import { membershipsCollection, membersCollection, subscriptionPlansCollection, tenantsCollection } from '@/lib/db'
import { findPackage } from '@/lib/credits'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function sameOriginPath(url: string | null, fallback: string) {
  if (!url) return fallback
  try {
    const parsed = new URL(url, 'http://placeholder.local')
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url.startsWith('/') ? url : fallback
  }
}

function checkoutPage(opts: {
  title: string
  subtitle: string
  details: string
  amount: string
  paymentId: string | null
  payload: Record<string, unknown>
  successUrl: string
  failUrl: string
}) {
  return `
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
  <h1>${opts.title}</h1>
  <p class="sub">${opts.subtitle}</p>
  <div class="card">
    <div class="details">${opts.details}</div>
    <div class="amount">&pound;${opts.amount}</div>
  </div>
  <div class="buttons">
    <button class="cancel" onclick="completePayment('failed')">Cancel</button>
    <button class="success" onclick="completePayment('success')">Pay &pound;${opts.amount}</button>
  </div>
  <p class="note">Open banking (mock) · Payment ID ${opts.paymentId || 'pending'}</p>
  <script>
    async function completePayment(status) {
      const response = await fetch('/api/payments/mock-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...${JSON.stringify(opts.payload)},
          status: status
        })
      });
      if (response.ok) {
        window.location.href = status === 'success'
          ? ${JSON.stringify(opts.successUrl)}
          : ${JSON.stringify(opts.failUrl)};
      } else {
        alert('Payment processing failed');
      }
    }
  </script>
</body>
</html>
  `
}

export async function GET(request: NextRequest) {
  if (!mockPaymentsAllowed()) {
    return new NextResponse('Not found', { status: 404 })
  }
  const { searchParams } = new URL(request.url)
  const membershipId = searchParams.get('membershipId')
  const paymentId = searchParams.get('paymentId')
  const returnUrl = searchParams.get('returnUrl')

  if (searchParams.get('kind') === 'credits') {
    const tenantId = searchParams.get('tenantId') || ''
    const packageKey = searchParams.get('packageKey') || ''
    const pack = findPackage(packageKey)
    const tenant = tenantId ? await tenantsCollection.findById(tenantId) : null
    if (!pack || !tenant) {
      return new NextResponse('Credit pack purchase not found', { status: 404 })
    }
    const amount = (pack.pricePence / 100).toFixed(2)
    const successUrl = sameOriginPath(returnUrl, '/admin/credits?paid=1')
    const html = checkoutPage({
      title: 'Buy credit pack',
      subtitle: 'Mock open banking checkout for local development (Hope Macy is not connected yet).',
      details: `<strong>Venue:</strong> ${escapeHtml(tenant.name)}<br><strong>Pack:</strong> ${escapeHtml(pack.name)} (${pack.credits} credits)<br><strong>Method:</strong> Open Banking`,
      amount,
      paymentId,
      payload: { kind: 'credits', paymentId, tenantId, packageKey },
      successUrl,
      failUrl: '/admin/credits?cancelled=1',
    })
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

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

  const html = checkoutPage({
    title: 'Pay for your membership',
    subtitle: 'Mock checkout for local development (Hope Macy is not connected yet).',
      details: `<strong>Member:</strong> ${escapeHtml(member?.name || 'Unknown')}<br><strong>Plan:</strong> ${escapeHtml(plan?.name || 'Unknown')}<br><strong>Method:</strong> Open Banking`,
    amount,
    paymentId,
    payload: { paymentId, membershipId },
    successUrl,
    failUrl,
  })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
