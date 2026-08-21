import { NextRequest, NextResponse } from 'next/server'
import { tenantsCollection } from '@/lib/db'
import { decodeTenantPng, pngImageResponse } from '@/lib/branding'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; kind: string }> }
) {
  const { tenantId, kind } = await params
  if (kind !== 'logo' && kind !== 'icon') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tenant = await tenantsCollection.findById(tenantId)
  if (!tenant || tenant.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const raw = kind === 'icon' ? tenant.iconPng || tenant.logoPng : tenant.logoPng
  const buf = decodeTenantPng(raw)
  if (!buf) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return pngImageResponse(buf, tenant.logoUpdatedAt)
}
