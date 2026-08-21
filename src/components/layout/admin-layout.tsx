'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { Msrx6StatusBar } from '@/components/admin/msrx6-status-bar'
import { TenantSwitcher } from '@/components/admin/tenant-switcher'
import { VenueBrandMark } from '@/components/admin/venue-brand-mark'

interface AdminLayoutProps {
  children: ReactNode
}

type NavChild = { name: string; href: string }

type NavItem = {
  name: string
  href: string
  icon: () => ReactNode
  children?: NavChild[]
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Members', href: '/admin/members', icon: UsersIcon },
  { name: 'Memberships', href: '/admin/memberships', icon: CreditCardIcon },
  { name: 'Card Queue', href: '/admin/card-queue', icon: QueueIcon },
  { name: 'Card Numbers', href: '/admin/card-numbers', icon: HashIcon },
  { name: 'Card Lookup', href: '/admin/card-lookup', icon: SearchIcon },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: CalendarIcon },
  { name: 'Credits', href: '/admin/credits', icon: CreditsIcon },
  { name: 'Users', href: '/admin/users', icon: StaffIcon },
  { name: 'Venue settings', href: '/admin/settings', icon: SettingsIcon },
]

function pathMatches(pathname: string, href: string, exact = false) {
  if (pathname === href) return true
  if (exact || href === '/admin') return false
  return pathname.startsWith(`${href}/`)
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function HashIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function CreditsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function StaffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PlatformIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname()
  const [userName, setUserName] = useState<string | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const bare = pathname === '/admin/login' || pathname === '/admin/logout'

  useEffect(() => {
    if (bare) return
    void (async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        setUserName(null)
        setIsPlatformAdmin(false)
        return
      }
      const data = await res.json()
      setUserName(data.user?.name || data.user?.email || null)
      setIsPlatformAdmin(Boolean(data.user?.isPlatformAdmin))
    })()
  }, [bare, pathname])

  if (bare) return <>{children}</>

  const items: NavItem[] = [
    ...navigation,
    ...(isPlatformAdmin
      ? [
          {
            name: 'Platform settings',
            href: '/admin/platform',
            icon: PlatformIcon,
            children: [{ name: 'Venues', href: '/admin/platform/venues' }],
          },
        ]
      : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 bg-slate-900">
          <div className="flex flex-col h-full">
            <div className="px-4 py-4 bg-slate-800">
              <VenueBrandMark />
            </div>
            <div className="pt-4 border-b border-slate-800">
              <TenantSwitcher />
            </div>
            
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {items.map((item) => {
                const childActive = item.children?.some((child) => pathMatches(pathname, child.href))
                const isActive = pathMatches(pathname, item.href, Boolean(item.children)) || Boolean(childActive)
                
                return (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive && !childActive
                          ? 'bg-blue-600 text-white'
                          : childActive
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <item.icon />
                      {item.name}
                    </Link>
                    {item.children && (
                      <div className="mt-1 ml-4 pl-3 border-l border-slate-700 space-y-1">
                        {item.children.map((child) => {
                          const active = pathMatches(pathname, child.href)
                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={`block px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                active
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                              }`}
                            >
                              {child.name}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </nav>
            
            <div className="p-4 border-t border-slate-700">
              {userName && (
                <p className="px-3 pb-2 text-xs text-slate-400 truncate">{userName}</p>
              )}
              <Link
                href={userName ? '/admin/logout' : `/admin/login?next=${encodeURIComponent(pathname)}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                {userName ? 'Logout' : 'Sign in'}
              </Link>
            </div>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 ml-64">
          <Msrx6StatusBar />
          <main className="p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
