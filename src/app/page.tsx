import type { Metadata } from 'next'
import { Brochure } from '@/components/marketing/brochure'

export const metadata: Metadata = {
  title: 'Membership Manager | Ashlar Technologies',
  description:
    'Digital QR and physical magstripe membership cards for venues, with Apple Wallet, Google Wallet, Stripe, open banking, till integration, and a partner issue API.',
}

export default function Home() {
  return <Brochure />
}
