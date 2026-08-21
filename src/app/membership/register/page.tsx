'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import Link from 'next/link'
import { PublicVenueHeader } from '@/components/brand/public-venue-header'

interface SubscriptionPlan {
  id: string
  name: string
  durationYears: number
  price: number
  currency: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subscriptionPlanId: '',
    cardType: 'QR_CODE',
    paymentMethod: 'OPEN_BANKING'
  })

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/subscription-plans?active=true')
        const data = await res.json()
        setPlans(data)
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, subscriptionPlanId: data[0].id }))
        }
      } catch (error) {
        console.error('Error fetching plans:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      const memberRes = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        })
      })

      let member
      if (memberRes.status === 409) {
        const existingMemberRes = await fetch(`/api/members?email=${encodeURIComponent(formData.email)}`)
        const existingData = await existingMemberRes.json()
        if (existingData.members?.length > 0) {
          member = existingData.members[0]
        } else {
          throw new Error('Email already registered but could not find member')
        }
      } else if (!memberRes.ok) {
        const data = await memberRes.json()
        throw new Error(data.error || 'Failed to register')
      } else {
        member = await memberRes.json()
      }

      const membershipRes = await fetch('/api/memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          subscriptionPlanId: formData.subscriptionPlanId,
          cardType: formData.cardType,
          paymentMethod: formData.paymentMethod
        })
      })

      if (!membershipRes.ok) {
        const data = await membershipRes.json()
        throw new Error(data.error || 'Failed to create membership')
      }

      const membershipData = await membershipRes.json()

      const paymentRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: membershipData.membership.id })
      })

      if (!paymentRes.ok) {
        throw new Error('Failed to initiate payment')
      }

      const paymentData = await paymentRes.json()
      const checkoutUrl = paymentData.redirectUrl || paymentData.paymentUrl

      if (!checkoutUrl) {
        throw new Error('Payment provider did not return a checkout URL')
      }

      window.location.href = checkoutUrl
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const selectedPlan = plans.find(p => p.id === formData.subscriptionPlanId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <PublicVenueHeader subtitle="Membership registration" />

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              1
            </div>
            <span className="ml-2 text-sm">Details</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              2
            </div>
            <span className="ml-2 text-sm">Options</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
              3
            </div>
            <span className="ml-2 text-sm">Payment</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Your Details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
                )}
                <Input
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  required
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44 7700 900000"
                  required
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (formData.name && formData.email && formData.phone) {
                      setStep(2)
                      setError('')
                    } else {
                      setError('Please fill in all fields')
                    }
                  }}
                >
                  Continue
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Membership Options</h2>
              </CardHeader>
              <CardContent className="space-y-6">
                {plans.length === 0 ? (
                  <p className="text-center text-gray-500">No membership plans available at this time.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Select Plan</label>
                      {plans.map((plan) => (
                        <label
                          key={plan.id}
                          className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            formData.subscriptionPlanId === plan.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="plan"
                              value={plan.id}
                              checked={formData.subscriptionPlanId === plan.id}
                              onChange={(e) => setFormData({ ...formData, subscriptionPlanId: e.target.value })}
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

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700">Card Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                            formData.cardType === 'QR_CODE'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cardType"
                            value="QR_CODE"
                            checked={formData.cardType === 'QR_CODE'}
                            onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                            className="sr-only"
                          />
                          <svg className="mx-auto w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                          <p className="font-medium text-gray-900">Digital QR Code</p>
                          <p className="text-xs text-gray-500 mt-1">Instant issue</p>
                        </label>
                        <label
                          className={`p-4 rounded-lg border-2 cursor-pointer text-center transition-colors ${
                            formData.cardType === 'PHYSICAL_CARD'
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cardType"
                            value="PHYSICAL_CARD"
                            checked={formData.cardType === 'PHYSICAL_CARD'}
                            onChange={(e) => setFormData({ ...formData, cardType: e.target.value })}
                            className="sr-only"
                          />
                          <svg className="mx-auto w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                          <p className="font-medium text-gray-900">Physical Card</p>
                          <p className="text-xs text-gray-500 mt-1">Collect at bar</p>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)} disabled={!formData.subscriptionPlanId}>
                  Continue
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Payment</h2>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
                )}

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Member</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plan</span>
                      <span className="font-medium">{selectedPlan?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Card Type</span>
                      <span className="font-medium">
                        {formData.cardType === 'QR_CODE' ? 'Digital QR Code' : 'Physical Card'}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between text-lg">
                        <span className="font-medium">Total</span>
                        <span className="font-bold">£{selectedPlan?.price.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Payment</label>
                  <div className="p-4 rounded-lg border-2 border-blue-500 bg-blue-50">
                    <p className="font-medium text-gray-900">Open banking</p>
                    <p className="text-xs text-gray-500 mt-1">Pay from your bank via Hope Macy. You will be redirected to approve the payment.</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" loading={submitting}>
                  Pay £{selectedPlan?.price.toFixed(2)}
                </Button>
              </CardFooter>
            </Card>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/" className="hover:underline">Cancel and return home</Link>
        </p>
      </div>
    </div>
  )
}
