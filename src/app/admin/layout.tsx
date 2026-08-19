import { AdminLayout } from '@/components/layout/admin-layout'
import { Msrx6Provider } from '@/lib/msrx6/use-msrx6'
import { ReactNode } from 'react'

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <Msrx6Provider>
      <AdminLayout>{children}</AdminLayout>
    </Msrx6Provider>
  )
}
