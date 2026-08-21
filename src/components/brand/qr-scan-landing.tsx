'use client'

import { useEffect } from 'react'
import type { QrScanMembership } from '@/lib/qr-payload'

declare global {
  interface Window {
    membership?: QrScanMembership
  }
}

export function QrScanLanding({
  membership,
  script,
  venueName,
  logoUrl,
}: {
  membership: QrScanMembership
  script: string
  venueName?: string
  logoUrl?: string
}) {
  const brand = venueName?.trim() || membership.tenant || 'Membership Manager'

  useEffect(() => {
    window.membership = membership
    const source = script.trim()
    if (!source) return

    try {
      const run = new Function('membership', 'name', 'mobile', 'email', 'cardNumber', 'phone', source)
      run(
        membership,
        membership.name,
        membership.mobile,
        membership.email,
        membership.cardNumber,
        membership.phone
      )
    } catch (error) {
      console.error('Venue QR scan script failed', error)
    }
  }, [membership, script])

  return (
    <div id="qr-scan-root" className="flex min-h-full flex-col bg-gray-50 px-4 py-12 text-gray-900">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          <div className="px-6 py-8 text-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="mx-auto mb-5 h-16 max-w-[14rem] object-contain" />
            ) : null}
            <p className="text-xs uppercase tracking-[0.2em] text-blue-300">{brand}</p>
            <h1 data-qr-name className="mt-4 text-2xl font-semibold">
              {membership.name || 'Member'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Card <span data-qr-card>{String(membership.cardNumber).padStart(6, '0')}</span>
            </p>
            {membership.planName ? (
              <p className="mt-1 text-sm text-slate-400">{membership.planName}</p>
            ) : null}
            {membership.expiry ? (
              <p className="mt-1 text-sm text-slate-400">Valid until {membership.expiry}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
