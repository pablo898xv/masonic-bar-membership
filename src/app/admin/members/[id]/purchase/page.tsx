'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'

interface Member {
  id: string
  name: string
  email: string
  phone: string
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
  const [paymentMethod, setPaymentMethod] = useState('CARD')
  const isComplimentary = paymentMethod === 'COMPLIMENTARY'

  useEffect(() => {
    async function fetchData() {
      try {
        const [memberRes, plansRes] = await Promise.all([
          fetch(`/api/members/${resolvedParams.id}`),
          fetch('/api/subscription-plans?active=true')
        ])

        if (!memberRes.ok) throw new Error('Member not found')

        const memberData = await memberRes.json()
        const plansData = await plansRes.json()

        setMember(memberData)
        setPlans(plansData)
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

      if (isComplimentary || data.complimentary) {
        router.push(`/admin/members/${resolvedParams.id}`)
        return
      }
      
      const paymentRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: data.membership.id })
      })

      if (!paymentRes.ok) {
        throw new Error('Failed to initiate payment')
      }

      const paymentData = await paymentRes.json()
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
          <div className="grid grid-cols-2 gap-4 text-sm">
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
                    { value: 'CARD', label: 'Card Payment (Dojo)' },
                    { value: 'OPEN_BANKING', label: 'Open Banking' },
                    { value: 'COMPLIMENTARY', label: 'Complimentary (no charge)' }
                  ]}
                />

                {isComplimentary && (
                  <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-lg">
                    Complimentary memberships are not charged. The membership will be activated immediately and the card will go to the encode queue.
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
                      The card will be added to the encoding queue{isComplimentary ? '' : ' after payment'}
                    </p>
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
              <Button type="submit" loading={submitting}>
                {isComplimentary ? 'Issue Complimentary Membership' : 'Proceed to Payment'}
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </div>
  )
}
