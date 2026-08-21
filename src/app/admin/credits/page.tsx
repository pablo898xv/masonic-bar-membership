'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
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

function formatEntryAmount(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
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
  const [payments, setPayments] = useState({ card: false, openBanking: true })
  const pollRef = useRef<number | null>(null)

  const stopWatching = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const load = async () => {
    const res = await fetch('/api/credits')
    const data = await res.json()
    setBalance(data.creditBalance || 0)
    setPackages(data.packages || [])
    setLedger(data.ledger || [])
    setCanAdjust(Boolean(data.canAdjust))
    setCanRevokePacks(Boolean(data.canRevokePacks))
    setPayments({
      card: Boolean(data.payments?.card),
      openBanking: data.payments?.openBanking !== false,
    })
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
    if (params.get('cancelled') === '1') setMessage('Payment was cancelled.')
    void load()
    return () => stopWatching()
  }, [])

  const watchPayment = (paymentId: string) => {
    stopWatching()
    const started = Date.now()
    const tick = async () => {
      try {
        const res = await fetch(`/api/payments/initiate?paymentId=${encodeURIComponent(paymentId)}`)
        const data = await res.json().catch(() => ({}))
        const status = typeof data.status === 'string' ? data.status.toLowerCase() : ''
        if (status === 'completed') {
          stopWatching()
          setNotice('Credit pack purchased. Credits have been added to this venue.')
          await load()
          return
        }
        if (status === 'failed') {
          stopWatching()
          setMessage('Payment failed or was cancelled.')
          return
        }
      } catch {
        /* keep polling */
      }
      if (Date.now() - started > 15 * 60 * 1000) stopWatching()
    }
    void tick()
    pollRef.current = window.setInterval(() => void tick(), 3000)
  }

  const buy = async (packageKey: string, method: 'CARD' | 'OPEN_BANKING') => {
    setMessage('')
    setNotice('')
    setBuying(`${packageKey}:${method}`)
    const checkout = window.open('', 'mbm-credit-checkout')
    try {
      const res = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageKey, method }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start purchase')
      if (!data.paymentUrl) throw new Error('No payment URL returned')
      if (data.paymentId) window.sessionStorage.setItem('mbmCreditPaymentId', data.paymentId)
      if (checkout && !checkout.closed) {
        checkout.location.href = data.paymentUrl
        checkout.focus()
        setNotice('Complete payment in the new window. This page will update when it goes through.')
        if (data.paymentId) watchPayment(data.paymentId)
        setBuying(null)
        return
      }
      window.location.href = data.paymentUrl
    } catch (error) {
      checkout?.close()
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
          Issuing a QR code or a physical card uses 1 credit. Each SMS notification uses 0.25 credits. Replacements and renewals of the same card number do not. When the balance is 0, new cards cannot be issued and SMS is skipped.
        </p>
      </div>

      {notice && <p className="text-sm text-emerald-700">{notice}</p>}
      {message && <p className="text-sm text-red-600">{message}</p>}

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Balance</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">
            {Number.isInteger(balance) ? balance : balance.toFixed(2)}
          </p>
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
                <div className="mt-4 space-y-2">
                  {payments.card && (
                    <Button
                      className="w-full"
                      onClick={() => void buy(pack.key, 'CARD')}
                      loading={buying === `${pack.key}:CARD`}
                      disabled={Boolean(buying)}
                    >
                      Buy with card
                    </Button>
                  )}
                  {payments.openBanking && (
                    <Button
                      className="w-full"
                      variant={payments.card ? 'secondary' : 'primary'}
                      onClick={() => void buy(pack.key, 'OPEN_BANKING')}
                      loading={buying === `${pack.key}:OPEN_BANKING`}
                      disabled={Boolean(buying)}
                    >
                      Buy with open banking
                    </Button>
                  )}
                  {!payments.card && !payments.openBanking && (
                    <p className="text-xs text-amber-700">
                      Payments are not configured. A super admin must add card or open banking in Platform settings.
                    </p>
                  )}
                </div>
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
            <div key={entry.id} className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3 text-sm border-b border-gray-100 py-2">
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
                  {entry.amount > 0 ? `+${formatEntryAmount(entry.amount)}` : formatEntryAmount(entry.amount)}
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
