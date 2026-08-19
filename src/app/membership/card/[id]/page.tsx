'use client'

import { Suspense } from 'react'
import MembershipCardPage from './card-client'

export default function MembershipCardRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
        </div>
      }
    >
      <MembershipCardPage />
    </Suspense>
  )
}
