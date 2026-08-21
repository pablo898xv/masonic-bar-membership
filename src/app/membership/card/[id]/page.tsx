'use client'

import { Suspense } from 'react'
import MembershipCardPage from './card-client'

export default function MembershipCardRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full items-center justify-center bg-gray-50">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <MembershipCardPage />
    </Suspense>
  )
}
