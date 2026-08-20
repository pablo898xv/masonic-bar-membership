'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Pack = {
  key: string
  name: string
  credits: number
  pricePence: number
  priceLabel: string
  pencePerCredit: number | null
  savingPercent: number | null
}

type Entry = {
  id: string
  type: string
  amount: number
  format?: string
  packageName?: string
  note?: string
  createdAt: string
  revoked?: boolean
  revocable?: boolean
}

export default function CreditsPage() {
  const [balance, setBalance] = useState(0)
  const [packages, setPackages] = useState<Pack[]>([])
  const [ledger, setLedger] = useState<Entry[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('Support adjustment')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [buying, setBuying] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [canAdjust, setCanAdjust] = useState(false)
  const [canRevokePacks, setCanRevokePacks] = useState(false)

  const load = async () => {
    const res = await fetch('/api/credits')
    const data = await res.json()
    setBalance(data.creditBalance || 0)
    setPackages(data.packages || [])
    setLedger(data.ledger || [])
    setCanAdjust(Boolean(data.canAdjust))
    setCanRevokePacks(Boolean(data.canRevokePacks))
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('paid') === '1') {
      setNotice('Credit pack purchased. Credits have been added to this venue.')
      const paymentId = window.sessionStorage.getItem('mbmCreditPaymentId')
      if (paymentId && !paymentId.startsWith('mock_')) {
        void fetch('/api/payments/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        }).then(() => load())
      }
    }
    if (params.get('cancelled') === '1') setMessage('Open banking payment was cancelled.')
    void load()
  }, [])

  const buy = async (packageKey: string) => {
    setMessage('')
    setNotice('')
    setBuying(packageKey)
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start purchase')
      if (!data.paymentUrl) throw new Error('No payment URL returned')
      if (data.paymentId) window.sessionStorage.setItem('mbmCreditPaymentId', data.paymentId)
      window.location.href = data.paymentUrl
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to start purchase')
      setBuying(null)
    }
  }

  const revoke = async (entry: Entry) => {
    if (!window.confirm(`Revoke ${entry.packageName || 'this pack'} and remove ${entry.amount} unused credits?`)) {
      return
    }
    setMessage('')
    setRevoking(entry.id)
    try {
      const res = await fetch(`/api/credits/${entry.id}/revoke`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke pack')
      setNotice(`Revoked ${entry.packageName || 'pack'}.`)
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to revoke pack')
    } finally {
      setRevoking(null)
    }
  }

  const adjust = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const res = await fetch('/api/credits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), note }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'Failed to adjust credits')
      return
    }
    setAmount('')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
        <p className="text-gray-500 mt-1">
          Issuing a QR code or a physical card uses 1 credit. Replacements and renewals of the same card number do not. When the balance is 0, new cards cannot be issued.
        </p>
      </div>

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {message && <p className="text-sm text-red-600">{message}</p>}

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Balance</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">{balance}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Credit packs</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {packages.map((pack) => (
              <div key={pack.key} className="border border-gray-200 rounded-xl p-4 flex flex-col">
                <p className="font-medium text-gray-900">{pack.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{pack.credits}</p>
                <p className="text-sm text-gray-500 mt-1">{pack.priceLabel}</p>
                {pack.pencePerCredit != null && (
                  <p className="text-xs text-gray-500">£{(pack.pencePerCredit / 100).toFixed(2)} per credit</p>
                )}
                <p className="text-xs text-emerald-700 min-h-[1.25rem] mt-1">
                  {pack.savingPercent ? `Save ${pack.savingPercent}% vs Starter` : 'Base rate'}
                </p>
                <Button
                  className="mt-4 w-full"
                  onClick={() => void buy(pack.key)}
                  loading={buying === pack.key}
                  disabled={Boolean(buying)}
                >
                  Buy with open banking
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {canAdjust && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Support adjustment</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={adjust} className="flex flex-wrap gap-3 items-end">
              <Input label="Amount" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="+10 or -5" />
              <Input label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
              <Button type="submit" variant="secondary">Adjust</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ledger</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {ledger.length === 0 && <p className="text-sm text-gray-500">No credit movements yet.</p>}
          {ledger.map((entry) => (
            <div key={entry.id} className="flex justify-between gap-3 text-sm border-b border-gray-100 py-2">
              <div>
                <p className="font-medium text-gray-900">
                  {entry.type}
                  {entry.packageName ? ` · ${entry.packageName}` : ''}
                  {entry.format ? ` · ${entry.format}` : ''}
                  {entry.revoked ? ' · revoked' : ''}
                </p>
                <p className="text-gray-500">{entry.note}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className={entry.amount < 0 ? 'text-red-600' : 'text-green-700'}>
                  {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                </p>
                {canRevokePacks && entry.revocable && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={revoking === entry.id}
                    disabled={Boolean(revoking)}
                    onClick={() => void revoke(entry)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
