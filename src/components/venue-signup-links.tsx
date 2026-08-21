'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Venue = { name: string; slug: string; signupPath?: string; logoUrl?: string }

export function VenueSignupLinks() {
  const [venues, setVenues] = useState<Venue[]>([])

  useEffect(() => {
    fetch('/api/tenants?public=1')
      .then((res) => res.json())
      .then((data) => setVenues(data.tenants || []))
      .catch(() => setVenues([]))
  }, [])

  const signupPath = (venue?: Venue) => venue?.signupPath || `/t/${venue?.slug || 'default'}/membership/register`

  if (venues.length <= 1) {
    const venue = venues[0]
    return (
      <div className="text-center space-y-4">
        <Link
          href={signupPath(venue)}
          className="inline-flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-lg"
        >
          Become a Member
          <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
        <div className="text-slate-500 dark:text-slate-400">
          Already a member?{' '}
          <Link href={`/t/${venue?.slug || 'default'}/membership/lookup`} className="text-blue-600 dark:text-blue-400 hover:underline">
            Look up your card
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="text-center space-y-6">
      <p className="text-gray-600 dark:text-slate-300">Choose your venue</p>
      <div className="grid sm:grid-cols-2 gap-3 max-w-xl mx-auto">
        {venues.map((venue) => (
          <Link
            key={venue.slug}
            href={signupPath(venue)}
            className="rounded-xl border border-gray-200 bg-white dark:bg-slate-900 dark:border-slate-700 px-5 py-4 text-gray-900 dark:text-white hover:border-blue-500 transition-colors text-left flex items-center gap-3"
          >
            {venue.logoUrl ? (
              <img src={venue.logoUrl} alt="" className="h-12 w-auto max-w-[8rem] object-contain shrink-0" />
            ) : null}
            <div>
            <p className="font-semibold">{venue.name}</p>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Join or look up a card</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
