'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { PublicVenueHeader } from '@/components/brand/public-venue-header'
import {
  PaymentMethodPicker,
  defaultPaymentMethod,
  selectableTileClass,
  type PaymentOptionsView,
} from '@/components/payment-method-picker'
import { memberSchema } from '@/lib/validation'
import { formatPlanPrice, isZeroPrice } from '@/lib/money'
import { PassTypePicker } from '@/components/pass-type-picker'
import {
  cardTypeLabel,
  offeredCardTypes,
  passTypesOf,
  type VenuePassTypes,
} from '@/lib/card-type'

interface SubscriptionPlan {
  id: string
  name: string
  durationYears: number
  price: number
  currency: string
}

function RegisterNotice({
  error,
  alreadyMember,
}: {
  error: string
  alreadyMember: 'lookup' | 'renew' | null
}) {
  if (!error && !alreadyMember) return null
  return (
    <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm space-y-2">
      {error && <p>{error}</p>}
      {alreadyMember && (
        <p>
          {alreadyMember === 'renew'
            ? 'Ask the bar manager to help you renew.'
            : 'If you already paid, speak to the bar manager.'}
        </p>
      )}
    </div>
  )
}

function fieldError(issues: { path: PropertyKey[]; message: string }[], key: string) {
  return issues.find((issue) => issue.path[0] === key)?.message || ''
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [signupOpen, setSignupOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [alreadyMember, setAlreadyMember] = useState<'lookup' | 'renew' | null>(null)
  const [checking, setChecking] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; phone?: string }>({})
  const [payments, setPayments] = useState<PaymentOptionsView>({
    openBanking: true,
    card: [],
    defaultMethod: 'OPEN_BANKING',
    cardLabel: 'Card',
  })
  const [passTypes, setPassTypes] = useState<VenuePassTypes>(passTypesOf())

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subscriptionPlanId: '',
    cardType: '',
    paymentMethod: '' as 'CARD' | 'OPEN_BANKING' | '',
  })

  useEffect(() => {
    async function fetchPlans() {
      try {
        const [plansRes, brandingRes] = await Promise.all([
          fetch('/api/subscription-plans?active=true'),
          fetch('/api/branding'),
        ])
        const data = await plansRes.json()
        const branding = brandingRes.ok ? await brandingRes.json() : null
        setSignupOpen(Boolean(branding?.signup?.open))
        setPlans(Array.isArray(data) ? data : [])
        const nextPassTypes = passTypesOf(branding?.passTypes)
        setPassTypes(nextPassTypes)
        const offered = offeredCardTypes(nextPassTypes)
        const autoType = offered.length === 1 ? offered[0] : ''
        if (branding?.payments) {
          setPayments(branding.payments)
          setFormData((prev) => ({
            ...prev,
            paymentMethod: prev.paymentMethod || defaultPaymentMethod(branding.payments),
            subscriptionPlanId:
              prev.subscriptionPlanId || (Array.isArray(data) && data.length === 1 ? data[0].id : ''),
            cardType: prev.cardType || autoType,
          }))
        } else {
          setFormData((prev) => ({
            ...prev,
            subscriptionPlanId:
              prev.subscriptionPlanId || (Array.isArray(data) && data.length === 1 ? data[0].id : ''),
            cardType: prev.cardType || autoType,
          }))
        }
      } catch (error) {
        console.error('Error fetching plans:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
  }, [])

  const details = memberSchema.safeParse({
    name: formData.name.trim(),
    email: formData.email.trim(),
    phone: formData.phone.trim(),
  })
  const detailsReady = details.success
  const optionsReady = Boolean(formData.subscriptionPlanId && formData.cardType)
  const selectedPlan = plans.find((p) => p.id === formData.subscriptionPlanId)
  const freePlan = isZeroPrice(selectedPlan?.price)
  const paymentReady = Boolean(formData.paymentMethod) && (payments.openBanking || payments.card.length > 0)

  const goToOptions = async () => {
    const parsed = memberSchema.safeParse({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    })
    if (!parsed.success) {
      setFieldErrors({
        name: fieldError(parsed.error.issues, 'name'),
        email: fieldError(parsed.error.issues, 'email'),
        phone: fieldError(parsed.error.issues, 'phone'),
      })
      setError('Please complete all required fields')
      return
    }
    setFieldErrors({})
    setChecking(true)
    setError('')
    setAlreadyMember(null)
    try {
      const res = await fetch('/api/members/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: parsed.data.email, phone: parsed.data.phone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.code === 'ALREADY_A_MEMBER') {
          setAlreadyMember(data.next === 'renew' ? 'renew' : 'lookup')
        }
        setError(data.error || 'Could not check those details')
        return
      }
      setFormData((prev) => ({ ...prev, ...parsed.data }))
      setStep(2)
    } catch {
      setError('Could not check those details')
    } finally {
      setChecking(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailsReady || !optionsReady || (!freePlan && !paymentReady)) {
      setError('Please complete all required fields')
      return
    }
    setSubmitting(true)
    setError('')
    setAlreadyMember(null)

    try {
      const memberRes = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        }),
      })

      let member
      if (!memberRes.ok) {
        const data = await memberRes.json()
        if (data.code === 'ALREADY_A_MEMBER') {
          setAlreadyMember(data.next === 'renew' ? 'renew' : 'lookup')
        }
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
          paymentMethod: freePlan ? undefined : formData.paymentMethod,
        }),
      })

      if (!membershipRes.ok) {
        const data = await membershipRes.json()
        if (data.code === 'ALREADY_A_MEMBER') {
          setAlreadyMember(data.next === 'renew' ? 'renew' : 'lookup')
        }
        throw new Error(data.error || 'Failed to create membership')
      }

      const membershipData = await membershipRes.json()
      const membership = membershipData.membership
      const token = membership?.accessToken || ''

      if (!membershipData.paymentRequired || membershipData.freeIssue || membershipData.complimentary) {
        if (membership?.id && token) {
          window.location.href = `/membership/card/${membership.id}?token=${encodeURIComponent(token)}&paid=1`
          return
        }
      }

      const paymentRes = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membershipId: membershipData.membership.id,
          paymentMethod: formData.paymentMethod,
        }),
      })

      const paymentData = await paymentRes.json().catch(() => ({}))
      if (!paymentRes.ok) {
        throw new Error(paymentData.error || 'Failed to initiate payment')
      }
      const checkoutUrl = paymentData.redirectUrl || paymentData.paymentUrl

      if (!checkoutUrl) {
        throw new Error('Payment provider did not return a checkout URL')
      }

      window.location.href = checkoutUrl
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-full bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!signupOpen) {
    return (
      <div className="min-h-full bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <PublicVenueHeader subtitle="Membership registration" />
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Signup is not open</h2>
              <p className="text-sm text-gray-600">
                Online membership purchase is only available through a current campaign link from this
                venue. If you were sent a link, it may have ended.
              </p>
              <p className="text-sm text-gray-500">Speak to the bar manager if you need a membership.</p>
            </CardContent>
            <CardFooter className="justify-center">
              <Link href="/">
                <Button variant="secondary">Return home</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <PublicVenueHeader subtitle="Membership registration" />

        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              1
            </div>
            <span className="ml-2 text-sm">Details</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
              2
            </div>
            <span className="ml-2 text-sm">Options</span>
          </div>
          <div className={`w-12 h-0.5 mx-2 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`} />
          <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
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
                {error && <RegisterNotice error={error} alreadyMember={alreadyMember} />}
                <Input
                  label="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                  autoComplete="name"
                  minLength={2}
                  required
                  error={fieldErrors.name}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                  autoComplete="email"
                  required
                  error={fieldErrors.email}
                />
                <Input
                  label="Phone Number"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44 7700 900000"
                  autoComplete="tel"
                  minLength={10}
                  required
                  error={fieldErrors.phone}
                />
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="button" loading={checking} disabled={!detailsReady} onClick={() => void goToOptions()}>
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
                          className={`flex items-center justify-between p-4 ${selectableTileClass(
                            formData.subscriptionPlanId === plan.id
                          )}`}
                        >
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="plan"
                              value={plan.id}
                              required
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
                          <p className="text-lg font-bold text-gray-900">{formatPlanPrice(plan.price)}</p>
                        </label>
                      ))}
                    </div>

                    <PassTypePicker
                      value={formData.cardType}
                      passTypes={passTypes}
                      onChange={(cardType) => setFormData({ ...formData, cardType })}
                    />
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)} disabled={!optionsReady}>
                  Continue
                </Button>
              </CardFooter>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">{freePlan ? 'Confirm' : 'Payment'}</h2>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && <RegisterNotice error={error} alreadyMember={alreadyMember} />}

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
                        {formData.cardType ? cardTypeLabel(formData.cardType) : '—'}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between text-lg">
                        <span className="font-medium">Total</span>
                        <span className="font-bold">{formatPlanPrice(selectedPlan?.price)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {!freePlan && (
                  <PaymentMethodPicker
                    value={formData.paymentMethod}
                    onChange={(method) => setFormData({ ...formData, paymentMethod: method })}
                    options={payments}
                  />
                )}
                {freePlan && (
                  <p className="text-sm text-gray-600">
                    This membership is free. Continue to issue your card — no payment is taken.
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button type="submit" loading={submitting} disabled={!freePlan && !paymentReady}>
                  {freePlan ? 'Complete registration' : `Pay ${formatPlanPrice(selectedPlan?.price)}`}
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
