'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

function PaymentCompleteContent() {
  const searchParams = useSearchParams()
  const membershipId = searchParams.get('membershipId')
  const status = searchParams.get('status')
  
  const [membership, setMembership] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [qrCode, setQrCode] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!membershipId) return
      
      try {
        const res = await fetch(`/api/memberships/${membershipId}`)
        const payload = await res.json()
        const data = payload.membership
          ? { ...payload.membership, membershipNumber: payload.membershipNumber, subscriptionPlan: payload.subscriptionPlan }
          : payload
        setMembership(data)
        
        if (data.status === 'ACTIVE' && (data.cardType === 'QR_CODE' || data.cardType === 'BOTH' || data.digitalCardPath)) {
          setQrCode(`/api/memberships/${membershipId}/wallet-pass?format=qrcode`)
        }
      } catch (error) {
        console.error('Error fetching membership:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [membershipId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const isSuccess = status === 'success'

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            {isSuccess ? (
              <>
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
                <p className="text-gray-500 mt-1">Your membership is now active</p>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Failed</h1>
                <p className="text-gray-500 mt-1">There was a problem processing your payment</p>
              </>
            )}
          </CardHeader>
          <CardContent>
            {isSuccess && membership && (
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Card Number</p>
                      <p className="font-mono font-bold text-lg">
                        {membership.membershipNumber?.cardNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Plan</p>
                      <p className="font-medium">{membership.subscriptionPlan?.name}</p>
                    </div>
                  </div>
                </div>

                {(membership.cardType === 'QR_CODE' || membership.cardType === 'BOTH') && qrCode && (
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-4">
                      Show this QR code at the bar to use your membership
                    </p>
                    <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                      <img src={qrCode} alt="Membership QR Code" className="w-48 h-48" />
                    </div>
                    <div className="mt-4 space-y-2">
                      <Button
                        className="w-full"
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = qrCode
                          link.download = `membership-${membership.membershipNumber?.cardNumber}.png`
                          link.click()
                        }}
                      >
                        Download QR Code
                      </Button>
                      <p className="text-xs text-gray-500">
                        Apple Wallet and Google Wallet can be enabled in Settings after your issuer accounts are approved.
                      </p>
                    </div>
                  </div>
                )}

                {(membership.cardType === 'PHYSICAL_CARD' || membership.cardType === 'BOTH') && (
                  <div className="p-4 bg-yellow-50 rounded-lg text-center">
                    <svg className="mx-auto w-12 h-12 text-yellow-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <h3 className="font-medium text-yellow-800">Physical Card</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Your physical membership card will be prepared and available for collection at the bar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!isSuccess && (
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  Please try again or contact the bar manager for assistance.
                </p>
                <Link href="/membership/register">
                  <Button>Try Again</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/" className="hover:underline">Return to home</Link>
        </p>
      </div>
    </div>
  )
}

export default function PaymentCompletePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <PaymentCompleteContent />
    </Suspense>
  )
}
