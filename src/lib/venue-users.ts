import { publicAdminUser } from '@/lib/admin-user'
import {
  adminUsersCollection,
  tenantUsersCollection,
  type AdminUser,
  type TenantUser,
} from '@/lib/db'

export function parseVenueRole(value: unknown): TenantUser['role'] {
  if (value === 'OWNER' || value === 'ADMIN') return value
  return 'MANAGER'
}

export function venueUserPayload(user: AdminUser, link: TenantUser) {
  return { ...publicAdminUser(user), tenantRole: link.role, tenantUserId: link.id }
}

export async function findVenueUser(tenantId: string, userId: string) {
  const link = await tenantUsersCollection.find(userId, tenantId)
  if (!link) return null
  const user = await adminUsersCollection.findById(userId)
  if (!user) return null
  return { user, link }
}

export async function venueOwnerCount(tenantId: string) {
  const links = await tenantUsersCollection.findByTenant(tenantId)
  return links.filter((item) => item.role === 'OWNER').length
}

export async function wouldLeaveVenueWithoutOwner(
  tenantId: string,
  link: TenantUser,
  nextRole?: TenantUser['role'] | null
) {
  if (link.role !== 'OWNER') return false
  if (nextRole === 'OWNER') return false
  return (await venueOwnerCount(tenantId)) <= 1
}
