'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { PaymentOptionsView } from '@/components/payment-method-picker'
import { isManualPaymentMethod } from '@/lib/payment-methods'

interface Member {
  id: string
  name: string
  email: string
  phone: string
  memberships?: Array<{
    id: string
    status: string
    membershipNumber?: { cardNumber: number }
  }>
}

interface SubscriptionPlan {
  id: string
  name: string
  durationYears: number
  price: number
  currency: string
}

export default function PurchaseMembershipPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [selectedPlan, setSelectedPlan] = useState('')
  const [cardType, setCardType] = useState('QR_CODE')
  const [paymentMethod, setPaymentMethod] = useState('OPEN_BANKING')
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [payments, setPayments] = useState<PaymentOptionsView>({
    openBanking: true,
    card: [],
    defaultMethod: 'OPEN_BANKING',
    cardLabel: 'Card',
  })
  const isComplimentary = paymentMethod === 'COMPLIMENTARY'
  const collectedNow = isComplimentary || isManualPaymentMethod(paymentMethod)
  const outOfCredits = creditBalance !== null && creditBalance < 1
  const existingCard = member?.memberships?.find((item) => item.status !== 'CANCELLED')

  useEffect(() => {
    async function fetchData() {
      try {
        const [memberRes, plansRes, tenantRes] = await Promise.all([
          fetch(`/api/members/${resolvedParams.id}`),
          fetch('/api/subscription-plans?active=true'),
          fetch('/api/tenants/current'),
        ])

        if (!memberRes.ok) throw new Error('Member not found')

        const memberData = await memberRes.json()
        const plansData = await plansRes.json()
        const tenantData = await tenantRes.json()

        setMember(memberData)
        setPlans(plansData)
        setCreditBalance(
          typeof tenantData.tenant?.creditBalance === 'number' ? tenantData.tenant.creditBalance : 0
        )
        if (tenantData.tenant?.payments) {
          const next = tenantData.tenant.payments
          setPayments(next)
          setPaymentMethod(
            next.openBanking || next.card.length ? next.defaultMethod || 'OPEN_BANKING' : 'CASH'
          )
        }
        if (plansData.length > 0) setSelectedPlan(plansData[0].id)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [resolvedParams.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (existingCard) {
      setError('This member already has a card at this venue. Renew or replace that membership instead.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: resolvedParams.id,
          subscriptionPlanId: selectedPlan,
          cardType,
          paymentMethod,
          adminIssued: true
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create membership')
      }

      const data = await res.json()

      if (isComplimentary || data.complimentary || data.collectedInPerson || data.freeIssue || !data.paymentRequired) {
        router.push(`/admin/members/${resolvedParams.id}`)
        return
      }
      
      const paymentRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: data.membership.id, paymentMethod })
      })

      const paymentData = await paymentRes.json().catch(() => ({}))
      if (!paymentRes.ok) {
        throw new Error(paymentData.error || 'Failed to initiate payment')
      }
      const checkoutUrl = paymentData.redirectUrl || paymentData.paymentUrl

      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        router.push(`/admin/members/${resolvedParams.id}`)
      }
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error || 'Member not found'}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase Membership</h1>
        <p className="text-gray-500 mt-1">Create a new membership for {member.name}</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Member Details</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{member.name}</p>
            </div>
            <div>
              <p className="text-gray-500">Email</p>
              <p className="font-medium">{member.email}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{member.phone}</p>
            </div>
          </div>
          {existingCard && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
              This member already has card #{existingCard.membershipNumber?.cardNumber ?? '—'} (
              {existingCard.status.toLowerCase()}). Each member can have one card at this venue.{' '}
              <a href={`/admin/memberships/${existingCard.id}`} className="underline">
                Open the existing membership
              </a>{' '}
              to renew or replace it.
            </p>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Membership Options</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {plans.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500">No subscription plans available.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push('/admin/subscriptions')}
                  className="mt-2"
                >
                  Create Subscription Plan
                </Button>
              </div>
            ) : (
              <>
                <Select
                  label="Subscription Plan"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  options={plans.map(p => ({
                    value: p.id,
                    label: `${p.name} - £${p.price.toFixed(2)} (${p.durationYears} year${p.durationYears > 1 ? 's' : ''})`
                  }))}
                />

                <Select
                  label="Card Type"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  options={[
                    { value: 'QR_CODE', label: 'QR Code (Digital Wallet Pass - Instant Issue)' },
                    { value: 'PHYSICAL_CARD', label: 'Physical Magstripe Card (Requires Encoding)' }
                  ]}
                />

                <Select
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  options={[
                    ...(payments.card.length
                      ? [{ value: 'CARD', label: payments.cardLabel || 'Card' }]
                      : []),
                    ...(payments.openBanking
                      ? [{ value: 'OPEN_BANKING', label: 'Open banking' }]
                      : []),
                    { value: 'CASH', label: 'Cash' },
                    { value: 'IN_PERSON', label: 'In person' },
                    { value: 'COMPLIMENTARY', label: 'Complimentary (no charge)' },
                  ]}
                />

                {isComplimentary && (
                  <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-lg">
                    Complimentary memberships are not charged. The membership will be activated immediately and the card will go to the encode queue.
                  </p>
                )}
                {isManualPaymentMethod(paymentMethod) && (
                  <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-lg">
                    This records a cash or in-person payment taken at the venue. The membership will be activated immediately.
                  </p>
                )}

                {selectedPlanDetails && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900">Order Summary</h3>
                    <div className="mt-2 flex justify-between">
                      <span className="text-gray-600">{selectedPlanDetails.name}</span>
                      <span className="font-semibold">
                        {isComplimentary ? 'Complimentary' : `£${selectedPlanDetails.price.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Valid for {selectedPlanDetails.durationYears} year{selectedPlanDetails.durationYears > 1 ? 's' : ''}
                    </div>
                    <p className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                      Uses 1 issuance credit{creditBalance !== null ? ` (${creditBalance} remaining)` : ''}. The card will be added to the encoding queue{collectedNow ? '' : ' after payment'}.
                    </p>
                    {outOfCredits && (
                      <p className="mt-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                        This venue has no issuance credits left.{' '}
                        <a href="/admin/credits" className="underline">Buy a credit pack</a> before issuing a card.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
          {plans.length > 0 && (
            <CardFooter className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting} disabled={outOfCredits || Boolean(existingCard)}>
                {existingCard
                  ? 'Card already issued'
                  : outOfCredits
                  ? 'No credits remaining'
                  : isComplimentary
                    ? 'Issue Complimentary Membership'
                    : !selectedPlanDetails?.price
                      ? 'Issue free membership'
                    : isManualPaymentMethod(paymentMethod)
                      ? 'Record payment and issue'
                      : 'Proceed to Payment'}
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </div>
  )
}
