import {
  membershipNumbersCollection,
  type MembershipNumber,
  type Tenant,
} from '@/lib/db'

export const DEFAULT_QR_NUMBER_START = 10000
const QR_ALLOC_SPAN = 1_000_000
const LOCAL_PHYSICAL_SEED_START = 1500
const LOCAL_PHYSICAL_SEED_COUNT = 200

export function qrNumberStartOf(tenant: Pick<Tenant, 'qrNumberStart'>) {
  const start = tenant.qrNumberStart
  if (typeof start === 'number' && Number.isInteger(start) && start > 0) return start
  return DEFAULT_QR_NUMBER_START
}

export function isPhysicalStock(number: Pick<MembershipNumber, 'pool'>) {
  return number.pool !== 'QR'
}

function localDb() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.USE_LOCAL_DB === 'true')
}

async function seedLocalPhysicalStock(tenantId: string) {
  const existing = await membershipNumbersCollection.findFirstAvailable(tenantId)
  if (existing) return existing

  await membershipNumbersCollection.createMany(
    Array.from({ length: LOCAL_PHYSICAL_SEED_COUNT }, (_, index) => ({
      cardNumber: LOCAL_PHYSICAL_SEED_START + index,
      batchId: 'local-seed',
      pool: 'PHYSICAL' as const,
    })),
    tenantId
  )
  return membershipNumbersCollection.findFirstAvailable(tenantId)
}

async function allocateQrNumber(tenant: Pick<Tenant, 'id' | 'qrNumberStart'>): Promise<MembershipNumber | null> {
  const start = qrNumberStartOf(tenant)
  const { numbers } = await membershipNumbersCollection.findMany({ tenantId: tenant.id })
  const byNumber = new Map(numbers.map((number) => [number.cardNumber, number]))

  for (let candidate = start; candidate <= start + QR_ALLOC_SPAN; candidate++) {
    const existing = byNumber.get(candidate)
    if (!existing) {
      await membershipNumbersCollection.createMany(
        [{ cardNumber: candidate, batchId: 'qr-digital', pool: 'QR' }],
        tenant.id
      )
      return membershipNumbersCollection.findByCardNumber(candidate, tenant.id)
    }
    if (existing.pool === 'QR' && !existing.isAssigned) {
      return existing
    }
  }

  return null
}

export type AllocatedNumber =
  | { ok: true; number: MembershipNumber }
  | { ok: false; status: number; error: string }

export async function allocateMembershipNumber(
  tenant: Pick<Tenant, 'id' | 'qrNumberStart'>,
  cardType: string
): Promise<AllocatedNumber> {
  if (cardType === 'QR_CODE') {
    const number = await allocateQrNumber(tenant)
    if (!number) {
      return {
        ok: false,
        status: 400,
        error: `Could not allocate a QR card number from ${qrNumberStartOf(tenant)}. Check venue QR number settings.`,
      }
    }
    return { ok: true, number }
  }

  const existing = await membershipNumbersCollection.findFirstAvailable(tenant.id)
  if (existing) return { ok: true, number: existing }

  if (localDb()) {
    const seeded = await seedLocalPhysicalStock(tenant.id)
    if (seeded) return { ok: true, number: seeded }
  }

  return {
    ok: false,
    status: 400,
    error: 'No physical card numbers available. Import more printed stock on Card numbers.',
  }
}

export async function markNumberAssigned(number: MembershipNumber) {
  return membershipNumbersCollection.update(number.id, {
    isAssigned: true,
    assignedAt: new Date(),
  })
}
