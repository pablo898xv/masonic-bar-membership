'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Branding = {
  name: string
  logoUrl: string
}

export function PublicVenueHeader({ subtitle }: { subtitle?: string }) {
  const [brand, setBrand] = useState<Branding>({ name: 'Membership Manager', logoUrl: '' })

  useEffect(() => {
    void fetch('/api/branding')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.name) return
        setBrand({
          name: data.name,
          logoUrl: data.logoUrl || '',
        })
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="text-center mb-8">
      <Link href="/" className="inline-flex flex-col items-center gap-3">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="h-24 max-w-[20rem] object-contain" />
        ) : null}
        <span className="text-2xl font-bold text-gray-900">{brand.name}</span>
      </Link>
      {subtitle && <h1 className="text-xl text-gray-600 mt-2">{subtitle}</h1>}
    </div>
  )
}
