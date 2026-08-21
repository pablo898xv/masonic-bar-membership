'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ThemeToggle } from '@/components/theme-toggle'

type AccountUser = {
  name: string
  email: string
  totpEnabled: boolean
}

const itemClass =
  'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'

export function AccountMenu({
  user,
  onUserChange,
}: {
  user: AccountUser | null
  onUserChange: (user: AccountUser) => void
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [totpOpen, setTotpOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const label = user?.name || user?.email || 'Account'
  const initials = accountInitials(label)

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex max-w-[14rem] items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-left hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {initials}
          {user && !user.totpEnabled ? (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-800" />
          ) : null}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{label}</span>
          <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
            {user?.totpEnabled ? '2FA on' : 'Account'}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          {user ? (
            <div className="border-b border-gray-100 px-3 py-2 dark:border-slate-800">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{user.name}</p>
              <p className="truncate text-xs text-gray-500 dark:text-slate-400">{user.email}</p>
            </div>
          ) : null}
          <ThemeToggle variant="menu" />
          {user ? (
            <>
              <button type="button" className={itemClass} onClick={() => { setOpen(false); setPasswordOpen(true) }}>
                <KeyIcon />
                Change password
              </button>
              <button type="button" className={itemClass} onClick={() => { setOpen(false); setTotpOpen(true) }}>
                <ShieldIcon />
                {user.totpEnabled ? 'Two-factor authentication' : 'Set up two-factor authentication'}
              </button>
            </>
          ) : null}
          <Link
            href={user ? '/admin/logout' : `/admin/login?next=${encodeURIComponent(pathname)}`}
            className={itemClass}
          >
            <LogoutIcon />
            {user ? 'Logout' : 'Sign in'}
          </Link>
        </div>
      ) : null}

      <ChangePasswordModal
        open={passwordOpen}
        totpEnabled={Boolean(user?.totpEnabled)}
        onClose={() => setPasswordOpen(false)}
      />
      <TotpModal
        open={totpOpen}
        totpEnabled={Boolean(user?.totpEnabled)}
        onClose={() => setTotpOpen(false)}
        onUserChange={onUserChange}
      />
    </div>
  )
}

function ChangePasswordModal({
  open,
  totpEnabled,
  onClose,
}: {
  open: boolean
  totpEnabled: boolean
  onClose: () => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setCode('')
      setMessage('')
    }
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, code: code || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Could not change password')
        return
      }
      onClose()
    } catch {
      setMessage('Could not change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Change password">
      <form onSubmit={submit} className="space-y-3">
        <Input
          label="Current password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {totpEnabled ? (
          <Input
            label="Authenticator or backup code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            required
          />
        ) : null}
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </Modal>
  )
}

function TotpModal({
  open,
  totpEnabled,
  onClose,
  onUserChange,
}: {
  open: boolean
  totpEnabled: boolean
  onClose: () => void
  onUserChange: (user: AccountUser) => void
}) {
  const [step, setStep] = useState<'start' | 'scan' | 'codes' | 'disable'>(totpEnabled ? 'disable' : 'start')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [secret, setSecret] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(totpEnabled ? 'disable' : 'start')
    setPassword('')
    setCode('')
    setSecret('')
    setQrCode('')
    setBackupCodes([])
    setMessage('')
  }, [open, totpEnabled])

  const startSetup = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Could not start setup')
        return
      }
      setSecret(data.secret || '')
      setQrCode(data.qrCode || '')
      setCode('')
      setStep('scan')
    } catch {
      setMessage('Could not start setup')
    } finally {
      setLoading(false)
    }
  }

  const enable = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Could not turn on two-factor authentication')
        return
      }
      if (data.user) onUserChange(data.user)
      setBackupCodes(data.backupCodes || [])
      setStep('codes')
    } catch {
      setMessage('Could not turn on two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  const disable = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data.error || 'Could not turn off two-factor authentication')
        return
      }
      if (data.user) onUserChange(data.user)
      onClose()
    } catch {
      setMessage('Could not turn off two-factor authentication')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={totpEnabled && step !== 'codes' ? 'Two-factor authentication' : 'Set up two-factor authentication'}
    >
      {step === 'start' ? (
        <form onSubmit={startSetup} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Add an authenticator app to this admin account. You will need a code each time you sign in.
          </p>
          <Input
            label="Confirm your password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {message ? <p className="text-sm text-red-600">{message}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Continue
          </Button>
        </form>
      ) : null}

      {step === 'scan' ? (
        <form onSubmit={enable} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Scan this QR code in your authenticator app, then enter the 6-digit code it shows.
          </p>
          {qrCode ? (
            <img src={qrCode} alt="Authenticator QR code" className="mx-auto h-48 w-48 rounded-lg bg-white p-2" />
          ) : null}
          <p className="break-all text-center font-mono text-xs text-gray-500">{secret}</p>
          <Input
            label="6-digit code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            inputMode="numeric"
            required
          />
          {message ? <p className="text-sm text-red-600">{message}</p> : null}
          <Button type="submit" className="w-full" loading={loading}>
            Turn on 2FA
          </Button>
        </form>
      ) : null}

      {step === 'codes' ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Save these backup codes somewhere safe. Each code can be used once if you lose your authenticator.
          </p>
          <ul className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 font-mono text-sm dark:bg-slate-800">
            {backupCodes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Button type="button" className="w-full" onClick={onClose}>
            I have saved these codes
          </Button>
        </div>
      ) : null}

      {step === 'disable' ? (
        <form onSubmit={disable} className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Two-factor authentication is on. Enter your password and a current code to turn it off.
          </p>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Input
            label="Authenticator or backup code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
            required
          />
          {message ? <p className="text-sm text-red-600">{message}</p> : null}
          <Button type="submit" variant="danger" className="w-full" loading={loading}>
            Turn off 2FA
          </Button>
        </form>
      ) : null}
    </Modal>
  )
}

function accountInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] || ''}${parts[1]![0] || ''}`.toUpperCase()
  return value.slice(0, 2).toUpperCase() || '?'
}

function KeyIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  )
}
