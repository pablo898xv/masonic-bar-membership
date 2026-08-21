'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { DeleteMembershipButton } from '@/components/admin/delete-membership-button'
import { Modal } from '@/components/ui/modal'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'
import { isMsrx6Cancelled } from '@/lib/msrx6/device'
import { cardTypeLabel, hasDigitalCard, hasPhysicalCard, passTypesOf, venueAllowsFormat, type VenuePassTypes } from '@/lib/card-type'
import { isManualPaymentMethod, paymentMethodLabel } from '@/lib/payment-methods'
import { formatGbp } from '@/lib/money'
import { type PaymentOptionsView } from '@/components/payment-method-picker'
import { canRenewMembership, isRenewalPayment, renewedExpiryDate } from '@/lib/renewal'
import { withMagstripeSentinels } from '@/lib/msrx6/protocol'

interface MembershipPayment {
  method?: string | null
  methodLabel?: string
  provider?: string | null
  providerLabel?: string
  status?: string | null
  amount?: number | null
  currency?: string
  reference?: string | null
  note?: string | null
  recordedBy?: string | null
  paidAt?: string | null
}

interface MembershipDetail {
  id: string
  cardType: string
  status: string
  paymentMethod?: string
  paymentStatus?: string
  payment?: MembershipPayment | null
  pendingPayment?: {
    id: string
    paymentMethod: string
    status: string
    amount: number
    metadata?: Record<string, unknown>
  } | null
  startDate?: string
  expiryDate?: string
  tillSystemEnabled: boolean
  tillSystemEnabledAt?: string
  accessToken?: string
  digitalCardPath?: string | null
  member: {
    id: string
    name: string
    email: string
    phone: string
  }
  membershipNumber: {
    cardNumber: number
  }
  subscriptionPlan: {
    id?: string
    name: string
    durationYears: number
    price: number
    currency?: string
  }
  cardIssuance?: {
    id?: string
    queueStatus: string
    magstripeData?: string
    encodedAt?: string
    issuedAt?: string
  } | null
  magstripeData?: string
}

function statusVariant(status: string): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  if (status === 'ACTIVE') return 'success'
  if (status === 'PAID') return 'info'
  if (status === 'PENDING_PAYMENT') return 'warning'
  if (status === 'EXPIRED' || status === 'CANCELLED') return 'danger'
  return 'default'
}

function formatDate(value?: string) {
  if (!value) return '—'
  return format(new Date(value), 'dd MMM yyyy')
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return format(new Date(value), 'dd MMM yyyy HH:mm')
}

function paymentStatusLabel(status?: string | null) {
  if (status === 'COMPLETED') return 'Paid'
  if (status === 'PROCESSING') return 'Processing'
  if (status === 'PENDING') return 'Awaiting payment'
  if (status === 'FAILED') return 'Failed'
  if (status === 'REFUNDED') return 'Refunded'
  return status || '—'
}

export default function MembershipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [membership, setMembership] = useState<MembershipDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tillLoading, setTillLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [paymentMethodDraft, setPaymentMethodDraft] = useState('OPEN_BANKING')
  const [payments, setPayments] = useState<PaymentOptionsView>({
    openBanking: true,
    card: [],
    defaultMethod: 'OPEN_BANKING',
    cardLabel: 'Card',
  })
  const [paymentNote, setPaymentNote] = useState('')
  const [encodeOpen, setEncodeOpen] = useState(false)
  const [encodeLoading, setEncodeLoading] = useState(false)
  const [encodeMessage, setEncodeMessage] = useState<string | null>(null)
  const [formatLoading, setFormatLoading] = useState(false)
  const [smsLoading, setSmsLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [notifyNotice, setNotifyNotice] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [passTypes, setPassTypes] = useState<VenuePassTypes>(passTypesOf())
  const [plans, setPlans] = useState<Array<{ id: string; name: string; durationYears: number; price: number }>>([])
  const [renewOpen, setRenewOpen] = useState(false)
  const [renewPlanId, setRenewPlanId] = useState('')
  const [renewMethod, setRenewMethod] = useState('CASH')
  const [renewLoading, setRenewLoading] = useState(false)
  const writer = useMsrx6()

  const fetchMembership = async () => {
    try {
      const [res, tenantRes, plansRes] = await Promise.all([
        fetch(`/api/memberships/${id}`),
        fetch('/api/tenants/current'),
        fetch('/api/subscription-plans?active=true'),
      ])
      if (!res.ok) throw new Error('Membership not found')
      const data = await res.json()
      setMembership(data)
      if (typeof data.pendingPayment?.paymentMethod === 'string') {
        setPaymentMethodDraft(data.pendingPayment.paymentMethod)
      } else if (typeof data.paymentMethod === 'string') {
        setPaymentMethodDraft(data.paymentMethod)
      }
      const tenantData = await tenantRes.json()
      setCreditBalance(
        typeof tenantData.tenant?.creditBalance === 'number' ? tenantData.tenant.creditBalance : 0
      )
      setPassTypes(passTypesOf(tenantData.tenant?.passTypes))
      if (tenantData.tenant?.payments) {
        setPayments(tenantData.tenant.payments)
      }
      if (plansRes.ok) {
        const plansData = await plansRes.json()
        const list = Array.isArray(plansData) ? plansData : []
        setPlans(list)
        setRenewPlanId((current) => current || data.subscriptionPlan?.id || list[0]?.id || '')
      }
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load membership')
      setMembership(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembership()
  }, [id])

  const handleCompletePayment = async () => {
    if (!membership) return
    setPayLoading(true)
    setError('')
    try {
      if (paymentMethodDraft !== membership.paymentMethod) {
        const saved = await fetch(`/api/memberships/${membership.id}/payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_method', paymentMethod: paymentMethodDraft }),
        })
        const savedData = await saved.json().catch(() => ({}))
        if (!saved.ok) throw new Error(savedData.error || 'Failed to update payment method')
      }
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: membership.id,
          paymentMethod: paymentMethodDraft,
          returnUrl: `${window.location.origin}/admin/memberships/${membership.id}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start payment')
      const checkoutUrl = data.redirectUrl || data.paymentUrl
      if (!checkoutUrl) throw new Error('No checkout URL returned')
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment')
      setPayLoading(false)
    }
  }

  const handleSavePaymentMethod = async () => {
    if (!membership) return
    setPayLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_method', paymentMethod: paymentMethodDraft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update payment method')
      await fetchMembership()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment method')
    } finally {
      setPayLoading(false)
    }
  }

  const handleMarkPaid = async () => {
    if (!membership) return
    setPayLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          paymentMethod: isManualPaymentMethod(paymentMethodDraft)
            ? paymentMethodDraft
            : paymentMethodDraft === 'COMPLIMENTARY'
              ? 'COMPLIMENTARY'
              : 'IN_PERSON',
          note: paymentNote,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to mark payment as paid')
      setPaymentNote('')
      await fetchMembership()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark payment as paid')
    } finally {
      setPayLoading(false)
    }
  }

  const handleRenew = async () => {
    if (!membership || !renewPlanId) return
    setRenewLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionPlanId: renewPlanId,
          paymentMethod: renewMethod,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to start renewal')
      setRenewOpen(false)
      if (data.paymentRequired && (renewMethod === 'CARD' || renewMethod === 'OPEN_BANKING')) {
        const pay = await fetch('/api/payments/initiate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            membershipId: membership.id,
            paymentMethod: renewMethod,
            returnUrl: window.location.href,
          }),
        })
        const payData = await pay.json().catch(() => ({}))
        if (!pay.ok) throw new Error(payData.error || 'Failed to start payment')
        const checkoutUrl = payData.redirectUrl || payData.paymentUrl
        if (checkoutUrl) {
          window.location.href = checkoutUrl
          return
        }
      }
      await fetchMembership()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to renew membership')
    } finally {
      setRenewLoading(false)
    }
  }

  const handleEnableTill = async () => {
    if (!membership) return
    setTillLoading(true)
    try {
      const res = await fetch('/api/till-system/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: membership.id }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enable till access')
      }
      await fetchMembership()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable till access')
    } finally {
      setTillLoading(false)
    }
  }

  const magstripeData = membership?.magstripeData || membership?.cardIssuance?.magstripeData
  const magstripeDisplay = magstripeData ? withMagstripeSentinels(magstripeData) : magstripeData
  const pendingRenewal = isRenewalPayment(membership?.pendingPayment)
  const awaitingPayment = membership?.status === 'PENDING_PAYMENT' || pendingRenewal
  const canRenew = Boolean(
    membership &&
      canRenewMembership({ status: membership.status, expiryDate: membership.expiryDate }) &&
      !pendingRenewal
  )
  const renewPlan = plans.find((plan) => plan.id === renewPlanId)
  const canIssueCards = Boolean(
    membership &&
      membership.status !== 'PENDING_PAYMENT' &&
      membership.status !== 'CANCELLED'
  )
  const canEncode = canIssueCards && Boolean(magstripeData)
  const issuingPhysical = Boolean(
    membership && !hasPhysicalCard(membership.cardType) && venueAllowsFormat(passTypes, 'PHYSICAL_CARD')
  )
  const issuingDigital = Boolean(
    membership && !hasDigitalCard(membership.cardType) && venueAllowsFormat(passTypes, 'QR_CODE')
  )
  const outOfCredits = creditBalance !== null && creditBalance < 1
  const blockedNewIssue = outOfCredits && (issuingPhysical || issuingDigital)

  const handleIssueDigital = async () => {
    if (!membership || !canIssueCards || (outOfCredits && issuingDigital)) return
    setFormatLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/card-format`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'QR_CODE' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to issue digital card')
      await fetchMembership()
      if (data.digitalCardPath) {
        window.open(data.digitalCardPath, '_blank')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue digital card')
    } finally {
      setFormatLoading(false)
    }
  }

  const handleSendCardSms = async () => {
    if (!membership || !hasDigitalCard(membership.cardType)) return
    setSmsLoading(true)
    setNotifyNotice(null)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/notify-sms`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send SMS')
      setNotifyNotice({
        type: 'ok',
        text: data.to ? `Card SMS sent to ${data.to}` : 'Card SMS sent',
      })
      await fetchMembership()
    } catch (err) {
      setNotifyNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send SMS',
      })
    } finally {
      setSmsLoading(false)
    }
  }

  const handleSendCardEmail = async () => {
    if (!membership || !hasDigitalCard(membership.cardType)) return
    setEmailLoading(true)
    setNotifyNotice(null)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membership.id}/notify-email`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email')
      setNotifyNotice({
        type: 'ok',
        text: data.to ? `Card email sent to ${data.to}` : 'Card email sent',
      })
      await fetchMembership()
    } catch (err) {
      setNotifyNotice({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send email',
      })
    } finally {
      setEmailLoading(false)
    }
  }

  const closeEncodeModal = () => {
    void writer.cancelOperation()
    setEncodeOpen(false)
    setEncodeMessage(null)
    setEncodeLoading(false)
  }

  const handleWriterEncode = async () => {
    if (!membership || !canEncode || !magstripeData) return
    if (issuingPhysical && outOfCredits) {
      setEncodeMessage('No issuance credits remaining. Buy a credit pack before issuing a physical card.')
      return
    }
    if (!writer.connected) {
      setEncodeMessage('Connect the MSRx6 from the bar at the top of the page, then click Encode and write.')
      return
    }
    setEncodeLoading(true)
    setEncodeMessage('Sending write command. Swipe the blank card through the MSRx6 now.')
    try {
      await writer.encodeCard(magstripeData)
      setEncodeMessage('Verified. Saving…')
      const res = await fetch(`/api/memberships/${membership.id}/encode-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          encodedBy: 'MSRx6',
          notes: issuingPhysical
            ? `Physical card issued from QR membership. MSRx6 ${writer.transport || 'bluetooth'} ${writer.coercivity}, verified`
            : `Replacement card. MSRx6 ${writer.transport || 'bluetooth'} ${writer.coercivity}, verified`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Wrote the card, but failed to save encode status')
      setEncodeMessage(issuingPhysical ? 'Physical card encoded.' : 'Replacement card encoded.')
      await fetchMembership()
    } catch (err) {
      if (isMsrx6Cancelled(err)) {
        setEncodeMessage(null)
        return
      }
      const message = err instanceof Error ? err.message : 'Writer encode failed'
      setEncodeMessage(message)
      writer.setError(message)
    } finally {
      setEncodeLoading(false)
    }
  }

  const openEncode = () => {
    if (issuingPhysical && outOfCredits) {
      setError('No issuance credits remaining. Buy a credit pack before issuing a physical card.')
      return
    }
    setEncodeMessage(null)
    setEncodeOpen(true)
    if (writer.connected) {
      void handleWriterEncode()
    } else {
      setEncodeMessage('Connect the MSRx6 from the bar at the top of the page, then click Encode and write.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error || 'Membership not found'}</p>
        <Link href="/admin/memberships">
          <Button className="mt-4">Back to Memberships</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Card #{membership.membershipNumber.cardNumber}
          </h1>
          <p className="text-gray-500 mt-1">{membership.member.name}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/admin/memberships" className="w-full sm:w-auto">
            <Button variant="secondary" className="w-full">Back</Button>
          </Link>
          <DeleteMembershipButton
            membershipId={membership.id}
            cardNumber={membership.membershipNumber.cardNumber}
            cardType={membership.cardType}
            memberName={membership.member.name}
            onDeleted={() => router.push('/admin/memberships')}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Membership</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <Badge variant={statusVariant(membership.status)}>{membership.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Plan</span>
              <span className="font-medium text-gray-900">{membership.subscriptionPlan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Card type</span>
              <span className="font-medium text-gray-900">
                {cardTypeLabel(membership.cardType)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 shrink-0">Paid with</span>
              <span className="font-medium text-gray-900 text-right">
                {membership.payment?.methodLabel || paymentMethodLabel(membership.paymentMethod)}
                {membership.payment?.providerLabel && membership.payment.providerLabel !== '—'
                  ? ` · ${membership.payment.providerLabel}`
                  : ''}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500 shrink-0">Payment status</span>
              <span className="font-medium text-gray-900 text-right">
                {paymentStatusLabel(membership.payment?.status || membership.paymentStatus)}
              </span>
            </div>
            {membership.payment?.amount != null && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Amount</span>
                <span className="font-medium text-gray-900">
                  {formatGbp(membership.payment.amount, membership.payment.currency)}
                </span>
              </div>
            )}
            {membership.payment?.reference && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Processor reference</span>
                <span className="font-mono text-xs text-gray-900 text-right break-all">
                  {membership.payment.reference}
                </span>
              </div>
            )}
            {membership.payment?.paidAt && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Paid at</span>
                <span className="font-medium text-gray-900">{formatDateTime(membership.payment.paidAt)}</span>
              </div>
            )}
            {membership.payment?.recordedBy && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Recorded by</span>
                <span className="font-medium text-gray-900">{membership.payment.recordedBy}</span>
              </div>
            )}
            {membership.payment?.note && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Note</span>
                <span className="font-medium text-gray-900 text-right">{membership.payment.note}</span>
              </div>
            )}
            {awaitingPayment && (
              <div className="pt-3 space-y-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {pendingRenewal
                    ? 'A renewal payment is outstanding. The extra year is added from the current expiry once this is paid. Card number stays the same.'
                    : 'Cards and QR codes stay blocked until this is paid. Change the method, take online payment, record cash / in person, or issue as complimentary.'}
                </p>
                <Select
                  label="Payment method"
                  value={paymentMethodDraft}
                  onChange={(event) => setPaymentMethodDraft(event.target.value)}
                  options={[
                    ...(payments.openBanking || paymentMethodDraft === 'OPEN_BANKING'
                      ? [
                          {
                            value: 'OPEN_BANKING',
                            label: payments.openBanking ? 'Open banking' : 'Open banking (disabled)',
                          },
                        ]
                      : []),
                    ...(payments.card.length || paymentMethodDraft === 'CARD'
                      ? [{ value: 'CARD', label: payments.cardLabel || 'Card' }]
                      : []),
                    { value: 'CASH', label: 'Cash' },
                    { value: 'IN_PERSON', label: 'In person' },
                    { value: 'COMPLIMENTARY', label: 'Complimentary (no charge)' },
                  ]}
                />
                <Input
                  label="Note (optional)"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  placeholder="Taken at the bar, receipt number…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={handleSavePaymentMethod} loading={payLoading}>
                    Save method
                  </Button>
                  {((paymentMethodDraft === 'OPEN_BANKING' && payments.openBanking) ||
                    (paymentMethodDraft === 'CARD' && payments.card.length > 0)) && (
                    <Button size="sm" onClick={handleCompletePayment} loading={payLoading}>
                      Take payment
                    </Button>
                  )}
                  {isManualPaymentMethod(paymentMethodDraft) && (
                    <Button size="sm" onClick={handleMarkPaid} loading={payLoading}>
                      Mark paid
                    </Button>
                  )}
                  {paymentMethodDraft === 'COMPLIMENTARY' && (
                    <Button size="sm" onClick={handleMarkPaid} loading={payLoading}>
                      Issue complimentary
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Start</span>
              <span className="font-medium text-gray-900">{formatDate(membership.startDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expiry</span>
              <span className="font-medium text-gray-900">{formatDate(membership.expiryDate)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Member</h2>
              <Link
                href={`/admin/members/${membership.member.id}?edit=1`}
                className="text-sm text-blue-600 hover:underline"
              >
                Edit details
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <Link href={`/admin/members/${membership.member.id}`} className="font-medium text-blue-600 hover:underline">
                {membership.member.name}
              </Link>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 shrink-0">Email</span>
              <span className="font-medium text-gray-900 text-right break-all min-w-0">{membership.member.email}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500 shrink-0">Phone</span>
              <span className="font-medium text-gray-900 text-right break-all min-w-0">{membership.member.phone}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Card and till</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Till access</span>
              {membership.tillSystemEnabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge variant="default">Not enabled</Badge>
              )}
            </div>
            {membership.cardIssuance && (
              <div className="flex justify-between">
                <span className="text-gray-500">Encode queue</span>
                <span className="font-medium text-gray-900">{membership.cardIssuance.queueStatus.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>

          {magstripeData && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">Magstripe</p>
              <p className="font-mono font-medium text-gray-900">{magstripeDisplay}</p>
            </div>
          )}

          {membership.cardType === 'QR_CODE' && canEncode && (
            <p className="text-sm text-gray-600">
              This member signed up for a digital QR card. Encoding a plastic card writes this QR number onto a blank card. It does not take a number from printed physical stock.
            </p>
          )}
          {membership.cardType === 'PHYSICAL_CARD' && canIssueCards && (
            <p className="text-sm text-gray-600">
              This member has a plastic card. You can also issue a digital QR they can show on their phone.
            </p>
          )}

          {blockedNewIssue && (
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
              This venue has no issuance credits left.{' '}
              <Link href="/admin/credits" className="underline">Buy a credit pack</Link> to issue a QR code or a new physical card.
              Replacement encodes of an already-issued physical card still work.
            </p>
          )}

          {notifyNotice && (
            <p className={`text-sm rounded-lg p-3 ${
              notifyNotice.type === 'ok'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {notifyNotice.text}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canEncode && magstripeData && (hasPhysicalCard(membership.cardType) || issuingPhysical) && (
              <Button
                size="sm"
                onClick={openEncode}
                loading={encodeLoading}
                disabled={issuingPhysical && outOfCredits}
              >
                {issuingPhysical ? 'Issue physical card' : 'Encode and write'}
              </Button>
            )}
            {canIssueCards && !hasDigitalCard(membership.cardType) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleIssueDigital}
                loading={formatLoading}
                disabled={outOfCredits}
              >
                Issue digital QR
              </Button>
            )}
            {canRenew && (
              <Button size="sm" variant="secondary" onClick={() => setRenewOpen(true)}>
                Renew membership
              </Button>
            )}
            {membership.status === 'ACTIVE' && !membership.tillSystemEnabled && (
              <Button size="sm" onClick={handleEnableTill} loading={tillLoading}>
                Enable till access
              </Button>
            )}
            {hasDigitalCard(membership.cardType) && membership.status === 'ACTIVE' && (
              <Link href={`/api/memberships/${membership.id}/wallet-pass?format=preview`} target="_blank">
                <Button size="sm" variant="secondary">View QR code</Button>
              </Link>
            )}
            {hasDigitalCard(membership.cardType) && membership.digitalCardPath && (
              <Link href={membership.digitalCardPath} target="_blank">
                <Button size="sm" variant="secondary">Open digital card</Button>
              </Link>
            )}
            {hasDigitalCard(membership.cardType) && canIssueCards && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSendCardEmail}
                  loading={emailLoading}
                >
                  Send card email
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSendCardSms}
                  loading={smsLoading}
                >
                  Send card SMS
                </Button>
              </>
            )}
            {(hasPhysicalCard(membership.cardType) || membership.cardIssuance) && (
              <Link href="/admin/card-queue">
                <Button size="sm" variant="secondary">Open card queue</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={renewOpen}
        onClose={() => setRenewOpen(false)}
        title="Renew membership"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Card number {membership.membershipNumber.cardNumber} stays the same. The extra year is added from
            the current expiry, not from today. Replacement cards are not issued.
          </p>
          <Select
            label="Plan"
            value={renewPlanId}
            onChange={(event) => setRenewPlanId(event.target.value)}
            options={plans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} — ${formatGbp(plan.price)} (${plan.durationYears} year${plan.durationYears > 1 ? 's' : ''})`,
            }))}
          />
          <Select
            label="Payment method"
            value={renewMethod}
            onChange={(event) => setRenewMethod(event.target.value)}
            options={[
              ...(payments.openBanking ? [{ value: 'OPEN_BANKING', label: 'Open banking' }] : []),
              ...(payments.card.length ? [{ value: 'CARD', label: payments.cardLabel || 'Card' }] : []),
              { value: 'CASH', label: 'Cash' },
              { value: 'IN_PERSON', label: 'In person' },
              { value: 'COMPLIMENTARY', label: 'Complimentary (no charge)' },
            ]}
          />
          {renewPlan && membership.expiryDate && (
            <p className="text-sm text-gray-700">
              New expiry:{' '}
              <strong>{formatDate(renewedExpiryDate(membership.expiryDate, renewPlan.durationYears).toISOString())}</strong>
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRenewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenew} loading={renewLoading} disabled={!renewPlanId}>
              {renewMethod === 'CARD' || renewMethod === 'OPEN_BANKING' ? 'Pay and renew' : 'Renew'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={encodeOpen}
        onClose={closeEncodeModal}
        title={
          issuingPhysical
            ? 'Issue physical card'
            : membership.cardIssuance?.queueStatus === 'ISSUED' || membership.cardIssuance?.queueStatus === 'SHIPPED'
              ? 'Write replacement card'
              : 'Encode card'
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
            <p className="text-sm text-yellow-700">Magstripe data (till swipe):</p>
            <p className="text-2xl font-mono font-bold text-yellow-900 mt-1">{magstripeDisplay}</p>
          </div>
          <p className="text-sm text-gray-600">
            Match the physical card numbered <strong>{membership.membershipNumber.cardNumber}</strong> on the back.
            Replacement cards keep this membership’s current expiry.
            {writer.connected
              ? ' Swipe once to encode, then swipe again to verify.'
              : ' Connect the MSRx6 from the bar at the top of the page first.'}
          </p>
          {encodeMessage && (
            <p className={`text-sm rounded-lg p-3 ${
              encodeLoading || writer.phase === 'writing' || writer.phase === 'verifying'
                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                : encodeMessage === 'Replacement card encoded.' || encodeMessage === 'Physical card encoded.'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {writer.phase === 'writing' && 'Swipe the blank card through the writer now. '}
              {writer.phase === 'verifying' && 'Write succeeded. Swipe the same card again to verify. '}
              {encodeMessage}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeEncodeModal}>
              Cancel
            </Button>
            {writer.connected && (
              <Button onClick={handleWriterEncode} loading={encodeLoading}>
                {writer.phase === 'writing' || writer.phase === 'verifying' ? 'Waiting for swipe…' : issuingPhysical ? 'Issue physical card' : 'Encode and write'}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
