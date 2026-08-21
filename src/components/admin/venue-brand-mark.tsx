'use client'

import { useEffect, useState } from 'react'

type Brand = {
  name: string
  logoUrl: string
}

export function VenueBrandMark({ compact = false }: { compact?: boolean }) {
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

  if (compact) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        {brand.logoUrl ? (
          <img src={brand.logoUrl} alt="" className="h-8 w-8 shrink-0 object-contain" />
        ) : null}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{brand.name}</p>
        </div>
      </div>
    )
  }

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
        <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{brand.name}</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Membership Manager</p>
      </div>
    </div>
  )
}
