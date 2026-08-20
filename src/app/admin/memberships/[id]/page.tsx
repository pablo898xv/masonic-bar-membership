'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeleteMembershipButton } from '@/components/admin/delete-membership-button'
import { Modal } from '@/components/ui/modal'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'
import { isMsrx6Cancelled } from '@/lib/msrx6/device'
import { cardTypeLabel, hasDigitalCard, hasPhysicalCard } from '@/lib/card-type'

interface MembershipDetail {
  id: string
  cardType: string
  status: string
  paymentMethod?: string
  paymentStatus?: string
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

export default function MembershipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [membership, setMembership] = useState<MembershipDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tillLoading, setTillLoading] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [encodeOpen, setEncodeOpen] = useState(false)
  const [encodeLoading, setEncodeLoading] = useState(false)
  const [encodeMessage, setEncodeMessage] = useState<string | null>(null)
  const [formatLoading, setFormatLoading] = useState(false)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const writer = useMsrx6()

  const fetchMembership = async () => {
    try {
      const [res, tenantRes] = await Promise.all([
        fetch(`/api/memberships/${id}`),
        fetch('/api/tenants/current'),
      ])
      if (!res.ok) throw new Error('Membership not found')
      setMembership(await res.json())
      const tenantData = await tenantRes.json()
      setCreditBalance(
        typeof tenantData.tenant?.creditBalance === 'number' ? tenantData.tenant.creditBalance : 0
      )
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
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: membership.id,
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
  const canIssueCards = Boolean(
    membership &&
      membership.status !== 'PENDING_PAYMENT' &&
      membership.status !== 'CANCELLED'
  )
  const canEncode = canIssueCards && Boolean(magstripeData)
  const issuingPhysical = Boolean(membership && !hasPhysicalCard(membership.cardType))
  const issuingDigital = Boolean(membership && !hasDigitalCard(membership.cardType))
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Card #{membership.membershipNumber.cardNumber}
          </h1>
          <p className="text-gray-500 mt-1">{membership.member.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/memberships">
            <Button variant="secondary">Back</Button>
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
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span className="font-medium text-gray-900">
                {membership.paymentMethod || '—'}
                {membership.paymentStatus ? ` · ${membership.paymentStatus}` : ''}
              </span>
            </div>
            {membership.status === 'PENDING_PAYMENT' && (
              <div className="pt-2">
                <Button size="sm" onClick={handleCompletePayment} loading={payLoading}>
                  Complete purchase
                </Button>
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
            <h2 className="text-lg font-semibold text-gray-900">Member</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <Link href={`/admin/members/${membership.member.id}`} className="font-medium text-blue-600 hover:underline">
                {membership.member.name}
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-medium text-gray-900">{membership.member.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-900">{membership.member.phone}</span>
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
              <p className="text-xs text-gray-500">Magstripe Track 2</p>
              <p className="font-mono font-medium text-gray-900">{magstripeData}</p>
            </div>
          )}

          {membership.cardType === 'QR_CODE' && canEncode && (
            <p className="text-sm text-gray-600">
              This member signed up for a digital QR card. You can also encode a plastic card with the same number.
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

          <div className="flex flex-wrap gap-2">
            {canEncode && magstripeData && (
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
            {(hasPhysicalCard(membership.cardType) || membership.cardIssuance) && (
              <Link href="/admin/card-queue">
                <Button size="sm" variant="secondary">Open card queue</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

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
            <p className="text-sm text-yellow-700">Track 2 data (till swipe):</p>
            <p className="text-2xl font-mono font-bold text-yellow-900 mt-1">{magstripeData}</p>
          </div>
          <p className="text-sm text-gray-600">
            Match the physical card numbered <strong>{membership.membershipNumber.cardNumber}</strong> on the back.
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
