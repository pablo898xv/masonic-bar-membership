import { NextRequest } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe-webhook'

export async function POST(request: NextRequest) {
  return handleStripeWebhook(request)
}
