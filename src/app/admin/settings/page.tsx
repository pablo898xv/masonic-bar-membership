'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  const [tillSystemStatus, setTillSystemStatus] = useState<'checking' | 'configured' | 'not_configured'>('checking')
  const [pixlPayStatus, setPixlPayStatus] = useState<'checking' | 'configured' | 'not_configured'>('checking')
  
  const envVars = {
    tillSystem: {
      TILL_SYSTEM_API_URL: process.env.NEXT_PUBLIC_TILL_SYSTEM_API_URL || 'Not set',
    },
    pixlPay: {
      PIXL_PAY_API_URL: process.env.NEXT_PUBLIC_PIXL_PAY_API_URL || 'Not set',
    },
    magstripe: {
      MAGSTRIPE_PREFIX: ';9998',
    },
    wallet: {
      PASS_TYPE_IDENTIFIER: process.env.NEXT_PUBLIC_PASS_TYPE_IDENTIFIER || 'Not set',
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">System configuration and integrations</p>
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Pixl Pay Integration</h2>
              <Badge variant="warning">Development Mode</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Payment processing via Pixl Pay platform. Supports card payments (Dojo) and open banking.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">API URL</span>
                <span className="font-mono text-gray-900">
                  {envVars.pixlPay.PIXL_PAY_API_URL === 'Not set' ? (
                    <Badge variant="warning">Not configured</Badge>
                  ) : (
                    envVars.pixlPay.PIXL_PAY_API_URL
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Status</span>
                <span className="text-yellow-600">Mock payments active</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Set PIXL_PAY_API_URL, PIXL_PAY_API_KEY, and PIXL_PAY_MERCHANT_ID environment variables for production.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Till System Integration</h2>
              <Badge variant="warning">Not Connected</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              External till system for card activation and access control at the bar.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">API URL</span>
                <span className="font-mono text-gray-900">
                  {envVars.tillSystem.TILL_SYSTEM_API_URL === 'Not set' ? (
                    <Badge variant="warning">Not configured</Badge>
                  ) : (
                    envVars.tillSystem.TILL_SYSTEM_API_URL
                  )}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Status</span>
                <span className="text-yellow-600">Mock mode active</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Set TILL_SYSTEM_API_URL and TILL_SYSTEM_API_KEY environment variables when till system is ready.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Magstripe Configuration */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Magstripe Card Configuration</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Configuration for physical card magstripe encoding.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Track 1 Prefix</span>
                  <span className="font-mono font-bold">{envVars.magstripe.MAGSTRIPE_PREFIX}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Example Card</span>
                  <span className="font-mono">{envVars.magstripe.MAGSTRIPE_PREFIX}1500</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Encoding Format</h3>
              <p className="text-sm text-gray-600">
                Track 1 data: <code className="bg-gray-200 px-1 rounded">{envVars.magstripe.MAGSTRIPE_PREFIX}</code> followed by the card number printed on the back of the physical card.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Change MAGSTRIPE_PREFIX environment variable to modify the prefix.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apple Wallet Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Apple Wallet Pass</h2>
            <Badge variant="warning">Not Configured</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Generate Apple Wallet passes for QR code memberships. Requires Apple Developer account and Pass signing certificate.
          </p>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="font-medium text-yellow-800 mb-2">Setup Required</h3>
            <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
              <li>Create a Pass Type ID in Apple Developer Portal</li>
              <li>Generate a Pass signing certificate</li>
              <li>Export the certificate as .p12 file</li>
              <li>Set environment variables: PASS_TYPE_IDENTIFIER, TEAM_IDENTIFIER, PASS_CERTIFICATE_PATH, PASS_CERTIFICATE_PASSWORD</li>
            </ol>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Until configured, members will receive a downloadable QR code image instead of a Wallet pass.
          </p>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
            <Badge variant="warning">Not Configured</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Send renewal reminder emails to members when their membership is expiring.
            Reminders are sent 30 days before expiry.
          </p>
          <div className="bg-yellow-50 p-4 rounded-lg mb-4">
            <h3 className="font-medium text-yellow-800 mb-2">SMTP Configuration Required</h3>
            <p className="text-sm text-yellow-700">
              Set these environment variables to enable email:
            </p>
            <ul className="text-sm text-yellow-700 list-disc list-inside mt-2 space-y-1">
              <li>SMTP_HOST - SMTP server hostname</li>
              <li>SMTP_PORT - SMTP server port (default: 587)</li>
              <li>SMTP_USER - SMTP username</li>
              <li>SMTP_PASS - SMTP password</li>
              <li>EMAIL_FROM - From address for emails</li>
            </ul>
          </div>
          <p className="text-xs text-gray-500">
            Without email configuration, renewal reminders will be logged but not sent.
          </p>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Maintenance</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
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
                  alert(`Processed: ${data.processed}, Expired: ${data.expired}, Till disabled: ${data.tillSystemDisabled}`)
                } catch (error) {
                  alert('Failed to run expiry check')
                }
              }}
            >
              Run Now
            </Button>
          </div>

          <div className="border-t border-gray-200 pt-6 flex items-center justify-between">
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
                  alert(`Processed: ${data.processed}, Emails sent: ${data.emailsSent}, Already sent: ${data.alreadySent}${data.emailConfigured ? '' : '\n\nNote: Email not configured - reminders were logged only'}`)
                } catch (error) {
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
