import { tenantsCollection } from '@/lib/db'
import { findTenantByPublicStub, tenantLogoPath } from '@/lib/tenancy'

export async function cardUnavailableBrand(input: { tenantId?: string; stub?: string }) {
  const tenant = input.tenantId
    ? await tenantsCollection.findById(input.tenantId)
    : input.stub
      ? await findTenantByPublicStub(input.stub)
      : null
  if (!tenant) return { venueName: undefined as string | undefined, logoUrl: '' }
  return { venueName: tenant.name, logoUrl: tenantLogoPath(tenant, 'logo') }
}
