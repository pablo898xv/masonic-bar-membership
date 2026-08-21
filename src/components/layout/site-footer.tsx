'use client'

import { usePathname } from 'next/navigation'

export function SiteFooter() {
  const pathname = usePathname()
  const inAdminChrome =
    pathname.startsWith('/admin') && pathname !== '/admin/login' && pathname !== '/admin/logout'

  return (
    <footer
      className={`border-t border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs text-gray-500 ${
        inAdminChrome ? 'lg:ml-64' : ''
      }`}
    >
      © Ashlar Technologies Ltd.
    </footer>
  )
}
