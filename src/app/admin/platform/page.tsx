'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type SettingsForm = {
  hopeMacyBaseUrl: string
  hopeMacyAppId: string
  hopeMacyAppSecret: string
  hopeMacyAppSecretSet: boolean
  hopeMacyMaxAmount: string
  bankAccountName: string
  bankSortCode: string
  bankAccountNumber: string
  bankAccountNumberSet: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  smtpUser: string
  smtpPass: string
  smtpPassSet: boolean
  emailFrom: string
  passTypeIdentifier: string
  teamIdentifier: string
  passCertificatePath: string
  passCertificatePassword: string
  passCertificatePasswordSet: boolean
  googleWalletIssuerId: string
  googleWalletClassSuffix: string
  googleWalletServiceAccountPath: string
  googleWalletServiceAccountJson: string
  googleWalletServiceAccountJsonSet: boolean
  googleWalletLogoUrl: string
  hopeMacyConfigured: boolean
  emailConfigured: boolean
  walletConfigured: boolean
  googleWalletConfigured: boolean
  canManagePlatformIntegrations: boolean
}

const emptyForm: SettingsForm = {
  hopeMacyBaseUrl: 'https://pis.hopemacy.com/api/v1',
  hopeMacyAppId: '',
  hopeMacyAppSecret: '',
  hopeMacyAppSecretSet: false,
  hopeMacyMaxAmount: '1000',
  bankAccountName: 'Ashlar Technologies',
  bankSortCode: '',
  bankAccountNumber: '',
  bankAccountNumberSet: false,
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: false,
  smtpUser: '',
  smtpPass: '',
  smtpPassSet: false,
  emailFrom: '',
  passTypeIdentifier: '',
  teamIdentifier: '',
  passCertificatePath: '',
  passCertificatePassword: '',
  passCertificatePasswordSet: false,
  googleWalletIssuerId: '',
  googleWalletClassSuffix: 'membership',
  googleWalletServiceAccountPath: '',
  googleWalletServiceAccountJson: '',
  googleWalletServiceAccountJsonSet: false,
  googleWalletLogoUrl: '',
  hopeMacyConfigured: false,
  emailConfigured: false,
  walletConfigured: false,
  googleWalletConfigured: false,
  canManagePlatformIntegrations: false,
}

function StatusBadge({ configured, mockLabel }: { configured: boolean; mockLabel: string }) {
  if (configured) return <Badge variant="success">Configured</Badge>
  return <Badge variant="warning">{mockLabel}</Badge>
}

export default function PlatformSettingsPage() {
  const router = useRouter()
  const [form, setForm] = useState<SettingsForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [loadError, setLoadError] = useState('')

  const applySettings = (data: Partial<SettingsForm>) => {
    setForm((current) => ({
      ...current,
      ...data,
      hopeMacyAppSecret: '',
      bankAccountNumber: '',
      smtpPass: '',
      passCertificatePassword: '',
      googleWalletServiceAccountJson: '',
    }))
  }

  const fetchSettings = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load settings')
      if (!data.canManagePlatformIntegrations) {
        router.replace('/admin/settings')
        return
      }
      applySettings(data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchSettings()
  }, [])

  const setField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async (section: string, payload: Record<string, string>) => {
    setSaving(section)
    setMessage(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')
      applySettings(data)
      setMessage({ type: 'ok', text: 'Settings saved.' })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save settings' })
    } finally {
      setSaving(null)
    }
  }

  const handleHopeMacy = (event: FormEvent) => {
    event.preventDefault()
    void save('hopeMacy', {
      hopeMacyBaseUrl: form.hopeMacyBaseUrl,
      hopeMacyAppId: form.hopeMacyAppId,
      hopeMacyAppSecret: form.hopeMacyAppSecret,
      hopeMacyMaxAmount: form.hopeMacyMaxAmount,
      bankAccountName: form.bankAccountName,
      bankSortCode: form.bankSortCode,
      bankAccountNumber: form.bankAccountNumber,
    })
  }

  const handleWallet = (event: FormEvent) => {
    event.preventDefault()
    void save('wallet', {
      passTypeIdentifier: form.passTypeIdentifier,
      teamIdentifier: form.teamIdentifier,
      passCertificatePath: form.passCertificatePath,
      passCertificatePassword: form.passCertificatePassword,
    })
  }

  const handleGoogleWallet = (event: FormEvent) => {
    event.preventDefault()
    void save('googleWallet', {
      googleWalletIssuerId: form.googleWalletIssuerId,
      googleWalletClassSuffix: form.googleWalletClassSuffix || 'membership',
      googleWalletServiceAccountPath: form.googleWalletServiceAccountPath,
      googleWalletServiceAccountJson: form.googleWalletServiceAccountJson,
      googleWalletLogoUrl: form.googleWalletLogoUrl,
    })
  }

  const handleEmail = (event: FormEvent) => {
    event.preventDefault()
    void save('email', {
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort || '587',
      smtpSecure: form.smtpSecure ? 'true' : 'false',
      smtpUser: form.smtpUser,
      smtpPass: form.smtpPass,
      emailFrom: form.emailFrom,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform settings</h1>
        <p className="text-gray-500 mt-1">
          Super admin only. Hope Macy API credentials are shared by every venue. Membership payouts use each venue’s own bank account.
        </p>
      </div>

      {loadError && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{loadError}</p>
      )}
      {message && (
        <p
          className={`text-sm rounded-lg p-3 border ${
            message.type === 'ok'
              ? 'text-green-800 bg-green-50 border-green-200'
              : 'text-red-700 bg-red-50 border-red-200'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Hope Macy API</h2>
              <StatusBadge configured={form.hopeMacyConfigured} mockLabel="Mock payments" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHopeMacy} className="space-y-4">
              <p className="text-sm text-gray-600">
                Platform open banking credentials. Every venue uses this Hope Macy app. Leave App ID empty to keep using mock checkout locally.
              </p>
              <Input
                label="API base URL"
                value={form.hopeMacyBaseUrl}
                onChange={(event) => setField('hopeMacyBaseUrl', event.target.value)}
                placeholder="https://pis.hopemacy.com/api/v1"
              />
              <Input
                label="App ID"
                value={form.hopeMacyAppId}
                onChange={(event) => setField('hopeMacyAppId', event.target.value)}
              />
              <Input
                label="App secret"
                type="password"
                value={form.hopeMacyAppSecret}
                onChange={(event) => setField('hopeMacyAppSecret', event.target.value)}
                placeholder={form.hopeMacyAppSecretSet ? 'Leave blank to keep the current secret' : 'App secret'}
                autoComplete="new-password"
              />
              <Input
                label="Maximum payment (£)"
                value={form.hopeMacyMaxAmount}
                onChange={(event) => setField('hopeMacyMaxAmount', event.target.value)}
                placeholder="1000"
              />
              <Input
                label="Credit pack account name"
                value={form.bankAccountName}
                onChange={(event) => setField('bankAccountName', event.target.value)}
              />
              <Input
                label="Credit pack sort code"
                value={form.bankSortCode}
                onChange={(event) => setField('bankSortCode', event.target.value)}
                placeholder="000000"
              />
              <Input
                label="Credit pack account number"
                type="password"
                value={form.bankAccountNumber}
                onChange={(event) => setField('bankAccountNumber', event.target.value)}
                placeholder={form.bankAccountNumberSet ? 'Leave blank to keep the current account number' : '8-digit account number'}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500">
                This account receives payment when a venue buys credits. Membership open banking payouts use the bank account on each venue’s Venue settings page.
              </p>
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'hopeMacy'}>Save Hope Macy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Apple Wallet Pass</h2>
            <StatusBadge configured={form.walletConfigured} mockLabel="QR image only" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWallet} className="space-y-4">
            <p className="text-sm text-gray-600">
              Required to issue signed .pkpass files. Until this is complete, members receive a QR image instead.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Pass Type ID"
                value={form.passTypeIdentifier}
                onChange={(event) => setField('passTypeIdentifier', event.target.value)}
                placeholder="pass.com.ashlartechnologies.membership"
              />
              <Input
                label="Team identifier"
                value={form.teamIdentifier}
                onChange={(event) => setField('teamIdentifier', event.target.value)}
              />
              <Input
                label="Certificate path"
                value={form.passCertificatePath}
                onChange={(event) => setField('passCertificatePath', event.target.value)}
                placeholder="certs/apple-wallet"
              />
              <Input
                label="Certificate password"
                type="password"
                value={form.passCertificatePassword}
                onChange={(event) => setField('passCertificatePassword', event.target.value)}
                placeholder={form.passCertificatePasswordSet ? 'Leave blank to keep the current password' : 'Certificate password'}
                autoComplete="new-password"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'wallet'}>Save Apple Wallet settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Google Wallet</h2>
            <StatusBadge configured={form.googleWalletConfigured} mockLabel="QR image only" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGoogleWallet} className="space-y-4">
            <p className="text-sm text-gray-600">
              Required to show Add to Google Wallet on the digital card. Create an issuer in the Google Pay &amp; Wallet Console, enable the Google Wallet API, then upload a service account JSON. Google also reviews new issuers before live saves work.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Issuer ID"
                value={form.googleWalletIssuerId}
                onChange={(event) => setField('googleWalletIssuerId', event.target.value)}
                placeholder="3388000000022…"
              />
              <Input
                label="Class suffix"
                value={form.googleWalletClassSuffix}
                onChange={(event) => setField('googleWalletClassSuffix', event.target.value)}
                placeholder="membership"
              />
              <Input
                label="Service account JSON path"
                value={form.googleWalletServiceAccountPath}
                onChange={(event) => setField('googleWalletServiceAccountPath', event.target.value)}
                placeholder="/path/to/google-wallet.json"
              />
              <Input
                label="Logo URL (optional HTTPS)"
                value={form.googleWalletLogoUrl}
                onChange={(event) => setField('googleWalletLogoUrl', event.target.value)}
                placeholder="https://…"
              />
              <div className="md:col-span-2">
                <label htmlFor="google-wallet-json" className="block text-sm font-medium text-gray-700 mb-1">
                  Service account JSON
                </label>
                <textarea
                  id="google-wallet-json"
                  value={form.googleWalletServiceAccountJson}
                  onChange={(event) => setField('googleWalletServiceAccountJson', event.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-900 placeholder:text-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    form.googleWalletServiceAccountJsonSet
                      ? 'Leave blank to keep the current key'
                      : '{ "type": "service_account", "client_email": "…", "private_key": "…" }'
                  }
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'googleWallet'}>Save Google Wallet settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
            <StatusBadge configured={form.emailConfigured} mockLabel="Logged only" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmail} className="space-y-4">
            <p className="text-sm text-gray-600">
              Welcome emails and renewal reminders 30 days before expiry. Without SMTP, messages are logged but not sent.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="SMTP host"
                value={form.smtpHost}
                onChange={(event) => setField('smtpHost', event.target.value)}
                placeholder="127.0.0.1"
              />
              <Input
                label="SMTP port"
                value={form.smtpPort}
                onChange={(event) => setField('smtpPort', event.target.value)}
                placeholder="587"
              />
              <Input
                label="SMTP username"
                value={form.smtpUser}
                onChange={(event) => setField('smtpUser', event.target.value)}
                autoComplete="off"
              />
              <Input
                label="SMTP password"
                type="password"
                value={form.smtpPass}
                onChange={(event) => setField('smtpPass', event.target.value)}
                placeholder={form.smtpPassSet ? 'Leave blank to keep the current password' : 'Optional'}
                autoComplete="new-password"
              />
              <div className="md:col-span-2">
                <Input
                  label="From address"
                  value={form.emailFrom}
                  onChange={(event) => setField('emailFrom', event.target.value)}
                  placeholder="Membership Manager <noreply@masonichall.bar>"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(event) => setField('smtpSecure', event.target.checked)}
              />
              Use TLS (SMTP_SECURE)
            </label>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'email'}>Save email settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
