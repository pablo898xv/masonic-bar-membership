'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { format } from 'date-fns'

interface Membership {
  id: string
  cardType: string
  status: string
  expiryDate: string
  member: {
    name: string
    email: string
  }
  membershipNumber: {
    cardNumber: number
  }
  subscriptionPlan: {
    id: string
    name: string
    durationYears: number
    price: number
  }
}

interface SubscriptionPlan {
  id: string
  name: string
  durationYears: number
  price: number
  currency: string
}

function RenewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const membershipId = searchParams.get('id')
  const token = searchParams.get('token')

  const [membership, setMembership] = useState<Membership | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selectedPlan, setSelectedPlan] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CARD')

  useEffect(() => {
    async function fetchData() {
      if (!membershipId) {
        setError('Invalid renewal link')
        setLoading(false)
        return
      }

      try {
        const [membershipRes, plansRes] = await Promise.all([
          fetch(`/api/memberships/${membershipId}`),
          fetch('/api/subscription-plans?active=true')
        ])

        if (!membershipRes.ok) {
          setError('Membership not found or link has expired')
          setLoading(false)
          return
        }

        const membershipData = await membershipRes.json()
        const plansData = await plansRes.json()

        if (membershipData.status !== 'ACTIVE' && membershipData.status !== 'EXPIRED') {
          setError('This membership cannot be renewed')
          setLoading(false)
          return
        }

        setMembership(membershipData)
        setPlans(plansData)
        setSelectedPlan(membershipData.subscriptionPlan.id)
      } catch (err) {
        setError('Failed to load membership details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [membershipId])

  const handleRenew = async () => {
    if (!membership) return

    setSubmitting(true)
    setError('')

    try {
      const renewRes = await fetch(`/api/memberships/${membership.id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionPlanId: selectedPlan,
          paymentMethod
        })
      })

      if (!renewRes.ok) {
        const data = await renewRes.json()
        throw new Error(data.error || 'Failed to create renewal')
      }

      const renewData = await renewRes.json()

      const paymentRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: renewData.renewal.id })
      })

      if (!paymentRes.ok) {
        throw new Error('Failed to initiate payment')
      }

      const paymentData = await paymentRes.json()

      if (paymentData.redirectUrl) {
        window.location.href = paymentData.redirectUrl
      } else {
        router.push(`/membership/payment-complete?membershipId=${renewData.renewal.id}`)
      }
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan)
  const isExpired = membership?.status === 'EXPIRED'
  const daysUntilExpiry = membership?.expiryDate
    ? Math.ceil((new Date(membership.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !membership) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Renew</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Link href="/membership/register">
                <Button>Register as New Member</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            Membership Manager
          </Link>
          <h1 className="text-xl text-gray-600 mt-2">Renew Your Membership</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Current Membership</h2>
              <Badge variant={isExpired ? 'danger' : 'warning'}>
                {isExpired ? 'Expired' : `Expires in ${daysUntilExpiry} days`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Member</p>
                  <p className="font-medium">{membership?.member.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Card Number</p>
                  <p className="font-mono font-medium">{membership?.membershipNumber.cardNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500">Current Plan</p>
                  <p className="font-medium">{membership?.subscriptionPlan.name}</p>
                </div>
                <div>
                  <p className="text-gray-500">{isExpired ? 'Expired On' : 'Expires On'}</p>
                  <p className="font-medium">
                    {membership?.expiryDate && format(new Date(membership.expiryDate), 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium text-gray-900 mb-4">Choose Renewal Plan</h3>
              
              <div className="space-y-3">
                {plans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedPlan === plan.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlan === plan.id}
                        onChange={(e) => setSelectedPlan(e.target.value)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div className="ml-3">
                        <p className="font-medium text-gray-900">{plan.name}</p>
                        <p className="text-sm text-gray-500">
                          {plan.durationYears} year{plan.durationYears > 1 ? 's' : ''} membership
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-gray-900">£{plan.price.toFixed(2)}</p>
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="font-medium text-gray-900 mb-4">Payment Method</h3>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                    paymentMethod === 'CARD'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={paymentMethod === 'CARD'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="sr-only"
                  />
                  <p className="font-medium text-gray-900">Card Payment</p>
                  <p className="text-xs text-gray-500 mt-1">Visa, Mastercard</p>
                </label>
                <label
                  className={`p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                    paymentMethod === 'OPEN_BANKING'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="OPEN_BANKING"
                    checked={paymentMethod === 'OPEN_BANKING'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="sr-only"
                  />
                  <p className="font-medium text-gray-900">Open Banking</p>
                  <p className="text-xs text-gray-500 mt-1">Bank transfer</p>
                </label>
              </div>
            </div>

            {selectedPlanDetails && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-green-800">Renewal Total</p>
                    <p className="text-sm text-green-700">
                      Your membership will be extended by {selectedPlanDetails.durationYears} year{selectedPlanDetails.durationYears > 1 ? 's' : ''}
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-green-800">£{selectedPlanDetails.price.toFixed(2)}</p>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link href="/">
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button onClick={handleRenew} loading={submitting}>
              Pay & Renew
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          Questions? Speak to the bar manager.
        </p>
      </div>
    </div>
  )
}

export default function RenewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <RenewContent />
    </Suspense>
  )
}
