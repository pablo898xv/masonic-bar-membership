'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { AccountMenu } from '@/components/admin/account-menu'
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
  { name: 'Reports', href: '/admin/reports', icon: ReportsIcon },
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

function ReportsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18M7 11v10M15 7v14M3 21h18" />
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
  const [account, setAccount] = useState<{ name: string; email: string; totpEnabled: boolean } | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const bare = pathname === '/admin/login' || pathname === '/admin/logout'

  useEffect(() => {
    if (bare) return
    void (async () => {
      const res = await fetch('/api/auth/me')
      if (!res.ok) {
        setAccount(null)
        setIsPlatformAdmin(false)
        return
      }
      const data = await res.json()
      const nextUser = data.user
      setAccount(
        nextUser
          ? {
              name: nextUser.name || nextUser.email || '',
              email: nextUser.email || '',
              totpEnabled: Boolean(nextUser.totpEnabled),
            }
          : null
      )
      setIsPlatformAdmin(Boolean(nextUser?.isPlatformAdmin))
    })()
  }, [bare, pathname])

  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [navOpen])

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
    <div className="min-h-full flex-1 bg-gray-50 overflow-x-hidden">
      <div className="flex min-h-full">
        {navOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <aside
          id="admin-nav"
          className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[min(18rem,85vw)] flex-col border-r border-gray-200 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-transform duration-200 ease-out dark:bg-slate-900 lg:w-64 lg:translate-x-0 ${
            navOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between gap-2 px-4 py-4 bg-gray-50 dark:bg-slate-800">
            <VenueBrandMark />
            <button
              type="button"
              className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 lg:hidden dark:hover:bg-slate-700"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            >
              <CloseIcon />
            </button>
          </div>
          <div className="pt-4 border-b border-gray-200 dark:border-slate-800">
            <TenantSwitcher />
          </div>

          <nav className="flex-1 px-4 py-4 pb-6 space-y-1 overflow-y-auto">
            {items.map((item) => {
              const childActive = item.children?.some((child) => pathMatches(pathname, child.href))
              const isActive = pathMatches(pathname, item.href, Boolean(item.children)) || Boolean(childActive)

              return (
                <div key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive && !childActive
                        ? 'bg-blue-600 text-white'
                        : childActive
                          ? 'bg-gray-100 text-gray-900 dark:bg-slate-800 dark:text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <item.icon />
                    {item.name}
                  </Link>
                  {item.children && (
                    <div className="mt-1 ml-4 pl-3 border-l border-gray-200 dark:border-slate-700 space-y-1">
                      {item.children.map((child) => {
                        const active = pathMatches(pathname, child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
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
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
          <div className="sticky top-0 z-20 bg-white dark:bg-slate-900">
            <header className="flex items-center gap-3 border-b border-gray-200 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] dark:border-slate-800 lg:px-6">
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-200 lg:hidden"
                aria-label="Open menu"
                aria-expanded={navOpen}
                aria-controls="admin-nav"
                onClick={() => setNavOpen(true)}
              >
                <MenuIcon />
              </button>
              <Msrx6StatusBar />
              <div className="shrink-0">
                <AccountMenu user={account} onUserChange={setAccount} />
              </div>
            </header>
          </div>
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
