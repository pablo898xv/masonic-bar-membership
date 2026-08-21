'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLogoutPage() {
  const router = useRouter()

  useEffect(() => {
    void (async () => {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.replace('/admin/login')
      router.refresh()
    })()
  }, [router])

  return (
    <div className="min-h-full bg-gray-50 flex items-center justify-center text-gray-600 text-sm">
      Signing out…
    </div>
  )
}
