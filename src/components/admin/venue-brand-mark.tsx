'use client'

import { useEffect, useState } from 'react'

type Brand = {
  name: string
  logoUrl: string
}

export function VenueBrandMark() {
  const [brand, setBrand] = useState<Brand>({ name: 'Membership Manager', logoUrl: '' })

  useEffect(() => {
    void fetch('/api/tenants/current')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.tenant?.name) return
        setBrand({
          name: data.tenant.name,
          logoUrl: data.tenant.logoUrl || '',
        })
      })
      .catch(() => undefined)
  }, [])

  return (
    <div className="flex flex-col items-center text-center gap-2 w-full">
      {brand.logoUrl ? (
        <img
          src={brand.logoUrl}
          alt=""
          className="h-16 w-full max-w-[11rem] object-contain"
        />
      ) : null}
      <div className="w-full min-w-0">
        <h1 className="text-sm font-bold text-white leading-snug">{brand.name}</h1>
        <p className="text-xs text-slate-400 mt-0.5">Membership Manager</p>
      </div>
    </div>
  )
}
