import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { tenantApiKeysCollection, tenantsCollection, type Tenant, type TenantApiKey } from '@/lib/db'

export function hashPartnerApiKey(key: string) {
  return createHash('sha256').update(key.trim()).digest('hex')
}

export function generatePartnerApiKey() {
  const key = `mbm_${randomBytes(32).toString('hex')}`
  return {
    key,
    prefix: key.slice(0, 12),
    keyHash: hashPartnerApiKey(key),
  }
}

export function serializeApiKey(row: TenantApiKey) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.keyPrefix,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt || null,
    revokedAt: row.revokedAt || null,
  }
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || ''
}

export async function requirePartner(request: NextRequest) {
  const token = bearerToken(request)
  if (!token || !token.startsWith('mbm_')) {
    return {
      tenant: null as Tenant | null,
      key: null as TenantApiKey | null,
      error: NextResponse.json({ error: 'API key required', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }

  const row = await tenantApiKeysCollection.findByHash(hashPartnerApiKey(token))
  if (!row || row.revokedAt) {
    return {
      tenant: null,
      key: null,
      error: NextResponse.json({ error: 'Invalid API key', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }

  const expected = Buffer.from(row.keyHash, 'hex')
  const actual = Buffer.from(hashPartnerApiKey(token), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return {
      tenant: null,
      key: null,
      error: NextResponse.json({ error: 'Invalid API key', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }

  const tenant = await tenantsCollection.findById(row.tenantId)
  if (!tenant || tenant.status !== 'ACTIVE') {
    return {
      tenant: null,
      key: null,
      error: NextResponse.json({ error: 'This venue is not available', code: 'VENUE_UNAVAILABLE' }, { status: 403 }),
    }
  }

  void tenantApiKeysCollection.update(row.id, { lastUsedAt: new Date() }).catch(() => undefined)

  return { tenant, key: row, error: null as NextResponse | null }
}
