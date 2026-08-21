import type { AdminUser } from '@/lib/db'

export type PublicAdminUser = {
  id: string
  email: string
  name: string
  role: AdminUser['role']
  isPlatformAdmin: boolean
  isActive: boolean
  totpEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export function publicAdminUser(user: AdminUser): PublicAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isPlatformAdmin: user.isPlatformAdmin,
    isActive: user.isActive,
    totpEnabled: Boolean(user.totpEnabled && user.totpSecret),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
