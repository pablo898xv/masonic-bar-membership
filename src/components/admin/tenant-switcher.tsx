'use client'

import { useEffect, useState } from 'react'

type TenantOption = {
  id: string
  name: string
  slug: string
  creditBalance: number
}

export function TenantSwitcher() {
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [currentId, setCurrentId] = useState('')
  const [credits, setCredits] = useState<number | null>(null)

  const load = async () => {
    const [listRes, currentRes] = await Promise.all([
      fetch('/api/tenants'),
      fetch('/api/tenants/current'),
    ])
    const list = await listRes.json()
    const current = await currentRes.json()
    setTenants(list.tenants || [])
    setCurrentId(current.tenant?.id || '')
    setCredits(current.tenant?.creditBalance ?? null)
  }

  useEffect(() => {
    void load()
  }, [])

  const switchTenant = async (tenantId: string) => {
    await fetch('/api/tenants/current', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    window.location.reload()
  }

  const current = tenants.find((tenant) => tenant.id === currentId)

  return (
    <div className="px-4 pb-4 space-y-2">
      <label className="block text-xs uppercase tracking-wide text-slate-500">Venue</label>
      <select
        value={currentId}
        onChange={(event) => void switchTenant(event.target.value)}
        className="w-full rounded-lg bg-slate-800 text-slate-100 text-sm px-3 py-2 border border-slate-700"
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-400">
        Credits: <span className="font-semibold text-white">{credits ?? current?.creditBalance ?? 0}</span>
      </p>
    </div>
  )
}
