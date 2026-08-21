import type { Metadata } from 'next'
import { Brochure } from '@/components/marketing/brochure'

export const metadata: Metadata = {
  title: 'Membership Manager | Ashlar Technologies',
  description:
    'Digital QR and physical membership cards for venues, with Apple Wallet, Google Wallet, renewals on the same card number, till scan or custom landing scripts, and a partner issue API.',
}

export default function Home() {
  return <Brochure />
}
