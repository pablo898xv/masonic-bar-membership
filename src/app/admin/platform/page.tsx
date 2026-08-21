'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { publicAppBaseUrl } from '@/lib/public-url'
import { maskAccountNumber, maskSortCode } from '@/lib/bank-account'

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
  stripeConfigured: boolean
  stripePublishableKey: string
  stripeSecretKey: string
  stripeSecretKeySet: boolean
  stripeWebhookSecret: string
  stripeWebhookSecretSet: boolean
  emailConfigured: boolean
  walletConfigured: boolean
  googleWalletConfigured: boolean
  smsConfigured: boolean
  smsCreditCost: string
  twilioAccountSid: string
  twilioAuthToken: string
  twilioAuthTokenSet: boolean
  twilioFromNumber: string
  twilioLogFallback: boolean
  creditsPerSms: string
  smsWelcomeEnabled: boolean
  smsRenewalEnabled: boolean
  smsDigitalCardEnabled: boolean
  smsWelcomeTemplate: string
  smsRenewalTemplate: string
  smsDigitalCardTemplate: string
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
  stripeConfigured: false,
  stripePublishableKey: '',
  stripeSecretKey: '',
  stripeSecretKeySet: false,
  stripeWebhookSecret: '',
  stripeWebhookSecretSet: false,
  emailConfigured: false,
  walletConfigured: false,
  googleWalletConfigured: false,
  smsConfigured: false,
  smsCreditCost: '0.25',
  twilioAccountSid: '',
  twilioAuthToken: '',
  twilioAuthTokenSet: false,
  twilioFromNumber: '',
  twilioLogFallback: true,
  creditsPerSms: '0.25',
  smsWelcomeEnabled: true,
  smsRenewalEnabled: true,
  smsDigitalCardEnabled: true,
  smsWelcomeTemplate: '',
  smsRenewalTemplate: '',
  smsDigitalCardTemplate: '',
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
  const [testPhone, setTestPhone] = useState('')
  const [testingSms, setTestingSms] = useState(false)
  const [stripeWebhookUrl, setStripeWebhookUrl] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [loadError, setLoadError] = useState('')

  const applySettings = (data: Partial<SettingsForm>) => {
    setForm((current) => ({
      ...current,
      ...data,
      bankSortCode: maskSortCode(String(data.bankSortCode ?? '')),
      hopeMacyAppSecret: '',
      stripeSecretKey: '',
      stripeWebhookSecret: '',
      bankAccountNumber: '',
      smtpPass: '',
      passCertificatePassword: '',
      googleWalletServiceAccountJson: '',
      twilioAuthToken: '',
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
    setStripeWebhookUrl(`${window.location.origin}/api/payments/stripe/webhook`)
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
      bankSortCode: maskSortCode(form.bankSortCode),
      bankAccountNumber: maskAccountNumber(form.bankAccountNumber),
    })
  }

  const handleStripe = (event: FormEvent) => {
    event.preventDefault()
    void save('stripe', {
      stripePublishableKey: form.stripePublishableKey,
      stripeSecretKey: form.stripeSecretKey,
      stripeWebhookSecret: form.stripeWebhookSecret,
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

  const handleSms = (event: FormEvent) => {
    event.preventDefault()
    void save('sms', {
      twilioAccountSid: form.twilioAccountSid,
      twilioAuthToken: form.twilioAuthToken,
      twilioFromNumber: form.twilioFromNumber,
      twilioLogFallback: form.twilioLogFallback ? 'true' : 'false',
      creditsPerSms: form.creditsPerSms || '0.25',
      smsWelcomeEnabled: form.smsWelcomeEnabled ? 'true' : 'false',
      smsRenewalEnabled: form.smsRenewalEnabled ? 'true' : 'false',
      smsDigitalCardEnabled: form.smsDigitalCardEnabled ? 'true' : 'false',
      smsWelcomeTemplate: form.smsWelcomeTemplate,
      smsRenewalTemplate: form.smsRenewalTemplate,
      smsDigitalCardTemplate: form.smsDigitalCardTemplate,
    })
  }

  const sendTestSms = async () => {
    setTestingSms(true)
    setMessage(null)
    try {
      const res = await fetch('/api/settings/sms-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send test SMS')
      setMessage({
        type: 'ok',
        text: data.logged ? `Test SMS logged for ${data.to} (Twilio not live).` : `Test SMS sent to ${data.to}.`,
      })
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to send test SMS' })
    } finally {
      setTestingSms(false)
    }
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
          Super admin only. Open banking is the platform bank-pay option. Stripe is used when a venue buys credit packs by card. Membership card checkout uses each venue’s own processor keys.
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
              <h2 className="text-lg font-semibold text-gray-900">Open banking</h2>
              <StatusBadge configured={form.hopeMacyConfigured} mockLabel="Mock payments" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleHopeMacy} className="space-y-4">
              <p className="text-sm text-gray-600">
                Platform open banking credentials. Every venue uses this app. Whitelist{' '}
                <span className="font-mono">
                  {publicAppBaseUrl()}
                  /api/payments/return
                </span>{' '}
                on the open banking application (query strings are ignored for that match). Leave App ID empty to keep using
                mock checkout locally.
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
                onChange={(event) => setField('bankSortCode', maskSortCode(event.target.value))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="off"
                className="font-mono"
              />
              <Input
                label="Credit pack account number"
                type="password"
                value={form.bankAccountNumber}
                onChange={(event) => setField('bankAccountNumber', maskAccountNumber(event.target.value))}
                placeholder={form.bankAccountNumberSet ? 'Leave blank to keep the current account number' : '12345678'}
                autoComplete="new-password"
                inputMode="numeric"
                className="font-mono"
              />
              <p className="text-xs text-gray-500">
                This account receives payment when a venue buys credits. Membership open banking payouts use the bank account on each venue’s Venue settings page.
              </p>
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'hopeMacy'}>Save open banking</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Stripe</h2>
              <StatusBadge configured={form.stripeConfigured} mockLabel="Not configured" />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStripe} className="space-y-4">
              <p className="text-sm text-gray-600">
                Platform Stripe account for venues buying credit packs by card. Membership card payments use each venue’s own Stripe (or other processor) keys in Venue settings.
              </p>
              <Input
                label="Publishable key"
                value={form.stripePublishableKey}
                onChange={(event) => setField('stripePublishableKey', event.target.value)}
                placeholder="pk_live_…"
              />
              <Input
                label="Secret key"
                type="password"
                value={form.stripeSecretKey}
                onChange={(event) => setField('stripeSecretKey', event.target.value)}
                placeholder={form.stripeSecretKeySet ? 'Leave blank to keep the current secret' : 'sk_live_…'}
                autoComplete="new-password"
              />
              <Input
                label="Webhook signing secret"
                type="password"
                value={form.stripeWebhookSecret}
                onChange={(event) => setField('stripeWebhookSecret', event.target.value)}
                placeholder={form.stripeWebhookSecretSet ? 'Leave blank to keep the current secret' : 'whsec_…'}
                autoComplete="new-password"
              />
              <div>
                <p className="block text-sm font-medium text-gray-700 mb-1">Webhook endpoint</p>
                <p className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 font-mono text-xs text-gray-900 break-all">
                  {stripeWebhookUrl || '/api/payments/stripe/webhook'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Add this URL in the Stripe Dashboard with checkout session completed and expired events.
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={saving === 'stripe'}>Save Stripe</Button>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 placeholder:text-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">SMS notifications</h2>
            <StatusBadge configured={form.smsConfigured} mockLabel="Logged only" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSms} className="space-y-4">
            <p className="text-sm text-gray-600">
              Platform Twilio account for every venue. Each successful SMS uses {form.creditsPerSms || '0.25'} credits from that venue. Messages are only sent to UK mobiles beginning 07 or +44 7 — landlines are skipped and not charged. Venues cannot set their own SMS number or credentials.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Twilio Account SID / API key"
                value={form.twilioAccountSid}
                onChange={(event) => setField('twilioAccountSid', event.target.value)}
                placeholder="ACxxx or SKxxx"
                autoComplete="off"
              />
              <Input
                label="Twilio auth token"
                type="password"
                value={form.twilioAuthToken}
                onChange={(event) => setField('twilioAuthToken', event.target.value)}
                placeholder={form.twilioAuthTokenSet ? 'Leave blank to keep the current token' : 'Auth token'}
                autoComplete="new-password"
              />
              <Input
                label="From number"
                value={form.twilioFromNumber}
                onChange={(event) => setField('twilioFromNumber', event.target.value)}
                placeholder="+447450458667"
              />
              <Input
                label="Credits per SMS"
                value={form.creditsPerSms}
                onChange={(event) => setField('creditsPerSms', event.target.value)}
                placeholder="0.25"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.twilioLogFallback}
                onChange={(event) => setField('twilioLogFallback', event.target.checked)}
              />
              Log SMS when Twilio is not configured (local/dev)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.smsWelcomeEnabled}
                  onChange={(event) => setField('smsWelcomeEnabled', event.target.checked)}
                />
                Welcome SMS
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.smsRenewalEnabled}
                  onChange={(event) => setField('smsRenewalEnabled', event.target.checked)}
                />
                Renewal reminder SMS
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.smsDigitalCardEnabled}
                  onChange={(event) => setField('smsDigitalCardEnabled', event.target.checked)}
                />
                Digital card SMS
              </label>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="sms-welcome-template" className="block text-sm font-medium text-gray-700 mb-1">
                  Welcome template
                </label>
                <textarea
                  id="sms-welcome-template"
                  value={form.smsWelcomeTemplate}
                  onChange={(event) => setField('smsWelcomeTemplate', event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="sms-renewal-template" className="block text-sm font-medium text-gray-700 mb-1">
                  Renewal template
                </label>
                <textarea
                  id="sms-renewal-template"
                  value={form.smsRenewalTemplate}
                  onChange={(event) => setField('smsRenewalTemplate', event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="sms-digital-template" className="block text-sm font-medium text-gray-700 mb-1">
                  Digital card template
                </label>
                <textarea
                  id="sms-digital-template"
                  value={form.smsDigitalCardTemplate}
                  onChange={(event) => setField('smsDigitalCardTemplate', event.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white dark:bg-slate-900 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                Digital card SMS is sent when a QR code is issued, not for physical cards. The card link is a short URL.
                Merge fields: {'{{tenant_name}}'}, {'{{member_name}}'}, {'{{card_number}}'}, {'{{plan}}'}, {'{{expiry}}'}, {'{{days}}'}, {'{{renewal_url}}'}, {'{{card_url}}'}
              </p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={saving === 'sms'}>Save SMS settings</Button>
            </div>
          </form>
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[12rem]">
              <Input
                label="Send a test SMS"
                value={testPhone}
                onChange={(event) => setTestPhone(event.target.value)}
                placeholder="07xxx or +44 7xxx"
              />
            </div>
            <Button type="button" variant="secondary" loading={testingSms} onClick={() => void sendTestSms()}>
              Send test
            </Button>
            <p className="text-xs text-gray-500 w-full">Test messages are not charged to the venue.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
