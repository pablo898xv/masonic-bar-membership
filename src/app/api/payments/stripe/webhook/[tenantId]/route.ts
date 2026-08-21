import { NextRequest } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe-webhook'

export async function POST(request: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params
  return handleStripeWebhook(request, tenantId)
}
