'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type SettingsForm = {
  magstripePrefix: string
  pixlPayApiUrl: string
  pixlPayApiKey: string
  pixlPayApiKeySet: boolean
  pixlPayMerchantId: string
  pixlPayWebhookSecret: string
  pixlPayWebhookSecretSet: boolean
  tillSystemApiUrl: string
  tillSystemApiKey: string
  tillSystemApiKeySet: boolean
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
  pixlPayConfigured: boolean
  tillConfigured: boolean
  emailConfigured: boolean
  walletConfigured: boolean
  googleWalletConfigured: boolean
}

const emptyForm: SettingsForm = {
  magstripePrefix: ';9998',
  pixlPayApiUrl: '',
  pixlPayApiKey: '',
  pixlPayApiKeySet: false,
  pixlPayMerchantId: '',
  pixlPayWebhookSecret: '',
  pixlPayWebhookSecretSet: false,
  tillSystemApiUrl: '',
  tillSystemApiKey: '',
  tillSystemApiKeySet: false,
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
  pixlPayConfigured: false,
  tillConfigured: false,
  emailConfigured: false,
  walletConfigured: false,
  googleWalletConfigured: false,
}

function StatusBadge({ configured, mockLabel }: { configured: boolean; mockLabel: string }) {
  if (configured) return <Badge variant="success">Configured</Badge>
  return <Badge variant="warning">{mockLabel}</Badge>
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [loadError, setLoadError] = useState('')

  const applySettings = (data: Partial<SettingsForm>) => {
    setForm((current) => ({
      ...current,
      ...data,
      pixlPayApiKey: '',
      pixlPayWebhookSecret: '',
      tillSystemApiKey: '',
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

  const handlePixlPay = (event: FormEvent) => {
    event.preventDefault()
    void save('pixlPay', {
      pixlPayApiUrl: form.pixlPayApiUrl,
      pixlPayMerchantId: form.pixlPayMerchantId,
      pixlPayApiKey: form.pixlPayApiKey,
      pixlPayWebhookSecret: form.pixlPayWebhookSecret,
    })
  }

  const handleTill = (event: FormEvent) => {
    event.preventDefault()
    void save('till', {
      tillSystemApiUrl: form.tillSystemApiUrl,
      tillSystemApiKey: form.tillSystemApiKey,
    })
  }

  const handleMagstripe = (event: FormEvent) => {
    event.preventDefault()
    void save('magstripe', { magstripePrefix: form.magstripePrefix.trim() || ';9998' })
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Configure integrations and card encoding. Changes are saved to the database.</p>
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
              <h2 className="text-lg font-semibold text-gray-900">Pixl Pay Integration</h2>
              <StatusBadge configured={form.pixlPayConfigured} mockLabel="Mock payments" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePixlPay} className="space-y-4">
              <p className="text-sm text-gray-600">
                Live card and open banking payments. Leave the API URL empty to keep using mock checkout.
              </p>
              <Input
                label="API URL"
                value={form.pixlPayApiUrl}
                onChange={(event) => setField('pixlPayApiUrl', event.target.value)}
                placeholder="https://api.pixlpay.example"
              />
              <Input
                label="Merchant ID"
                value={form.pixlPayMerchantId}
                onChange={(event) => setField('pixlPayMerchantId', event.target.value)}
              />
              <Input
                label="API key"
                type="password"
                value={form.pixlPayApiKey}
                onChange={(event) => setField('pixlPayApiKey', event.target.value)}
                placeholder={form.pixlPayApiKeySet ? 'Leave blank to keep the current key' : 'API key'}
                autoComplete="new-password"
              />
              <Input
                label="Webhook secret"
                type="password"
                value={form.pixlPayWebhookSecret}
                onChange={(event) => setField('pixlPayWebhookSecret', event.target.value)}
                placeholder={form.pixlPayWebhookSecretSet ? 'Leave blank to keep the current secret' : 'Optional'}
                autoComplete="new-password"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'pixlPay'}>Save Pixl Pay</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Till System Integration</h2>
              <StatusBadge configured={form.tillConfigured} mockLabel="Mock mode" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTill} className="space-y-4">
              <p className="text-sm text-gray-600">
                Notify the bar till when a card is issued or a membership expires.
              </p>
              <Input
                label="API URL"
                value={form.tillSystemApiUrl}
                onChange={(event) => setField('tillSystemApiUrl', event.target.value)}
                placeholder="https://till.example/api"
              />
              <Input
                label="API key"
                type="password"
                value={form.tillSystemApiKey}
                onChange={(event) => setField('tillSystemApiKey', event.target.value)}
                placeholder={form.tillSystemApiKeySet ? 'Leave blank to keep the current key' : 'API key'}
                autoComplete="new-password"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'till'}>Save till settings</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Magstripe Card Configuration</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMagstripe} className="space-y-4">
            <p className="text-sm text-gray-600">
              Track 2 data written to physical cards. The prefix is followed by the number printed on the back of the card.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Track 2 prefix"
                value={form.magstripePrefix}
                onChange={(event) => setField('magstripePrefix', event.target.value)}
                className="font-mono"
              />
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Example card 1500</p>
                <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-gray-900">
                  {form.magstripePrefix || ';9998'}1500
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'magstripe'}>Save magstripe prefix</Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                placeholder="pass.com.masonichall.membership"
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
                placeholder="/path/to/pass.p12"
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Maintenance</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Check Expired Memberships</h3>
              <p className="text-sm text-gray-500">
                Mark expired memberships and disable till system access.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const res = await fetch('/api/cron/check-expiry', { method: 'POST' })
                  const data = await res.json()
                  const results = data.results || data
                  alert(`Processed: ${results.processed}, Expired: ${results.expired}, Till disabled: ${results.tillSystemDisabled}`)
                } catch {
                  alert('Failed to run expiry check')
                }
              }}
            >
              Run Now
            </Button>
          </div>

          <div className="border-t border-gray-200 pt-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-medium text-gray-900">Send Renewal Reminders</h3>
              <p className="text-sm text-gray-500">
                Send email reminders to members expiring in the next 30 days.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const res = await fetch('/api/cron/send-renewal-reminders', { method: 'POST' })
                  const data = await res.json()
                  const results = data.results || data
                  alert(
                    `Processed: ${results.processed}, Emails sent: ${results.sent}, Already sent: ${results.skipped}`
                  )
                } catch {
                  alert('Failed to send renewal reminders')
                }
              }}
            >
              Send Reminders
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
