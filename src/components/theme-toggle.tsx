'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { initTheme, setTheme, storedTheme, systemTheme, type Theme } from '@/lib/theme'

export function ThemeToggle({
  compact = false,
  variant = 'button',
}: {
  compact?: boolean
  variant?: 'button' | 'menu'
}) {
  const [theme, setCurrent] = useState<Theme>('light')

  useEffect(() => {
    setCurrent(initTheme())
  }, [])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const menu = variant === 'menu'

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next)
        setCurrent(next)
      }}
      className={
        menu
          ? 'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-800'
          : `inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors ${
              compact ? 'h-9 w-9' : 'gap-2 px-3 py-2 text-sm font-medium w-full'
            }`
      }
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      {compact ? null : <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

export function ThemeDock() {
  const pathname = usePathname()
  const inAdminChrome =
    pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/logout'
  if (inAdminChrome) return null
  return <FloatingThemeToggle />
}

function FloatingThemeToggle() {
  const [theme, setCurrent] = useState<Theme | null>(null)

  useEffect(() => {
    setCurrent(storedTheme() || systemTheme())
  }, [])

  if (!theme) return null

  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next)
        setCurrent(next)
      }}
      className="fixed top-4 right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-lg hover:bg-gray-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05 5.636 5.636m12.728 0L16.95 7.05M7.05 16.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
      />
    </svg>
  )
}
