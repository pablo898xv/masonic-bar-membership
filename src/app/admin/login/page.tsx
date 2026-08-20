'use client'

import { FormEvent, Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/admin') || value.startsWith('/admin/login') || value.startsWith('/admin/logout')) {
    return '/admin'
  }
  return value
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [needsSetup, setNeedsSetup] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const [setupRes, meRes] = await Promise.all([
        fetch('/api/auth/setup'),
        fetch('/api/auth/me'),
      ])
      const setup = await setupRes.json()
      setNeedsSetup(Boolean(setup.needsSetup))
      if (meRes.ok) router.replace(next)
    })()
  }, [next, router])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch(needsSetup ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsSetup ? { name, email, password, role: 'ADMIN' } : { email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Sign in failed')
        return
      }
      router.replace(next)
      router.refresh()
    } catch {
      setMessage('Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs text-gray-500">Ashlar Technologies</p>
          <h1 className="text-xl font-bold text-gray-900">
            {needsSetup ? 'Create super admin' : 'Sign in'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {needsSetup
              ? 'Create the first super admin account to manage Membership Manager.'
              : 'Sign in with your admin account to manage members, cards, and venues.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            {needsSetup && (
              <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={needsSetup ? 8 : 6}
              required
            />
            {message && <p className="text-sm text-red-600">{message}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              {needsSetup ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <LoginForm />
    </Suspense>
  )
}
