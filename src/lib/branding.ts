import { NextResponse } from 'next/server'
import { Tenant, tenantsCollection } from '@/lib/db'
import { publicAppUrl } from '@/lib/card-link'
import { tenantLogoPath } from '@/lib/tenancy'

export const MAX_LOGO_BYTES = 700_000

function pngBuffer(raw: string, label: string) {
  const cleaned = raw.replace(/^data:image\/png;base64,/i, '').replace(/\s/g, '')
  if (!cleaned) throw new Error(`${label} is required`)
  const buf = Buffer.from(cleaned, 'base64')
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error(`${label} must be a PNG image`)
  }
  if (buf.length > MAX_LOGO_BYTES) {
    throw new Error(`${label} is too large. Use a smaller image.`)
  }
  return buf
}

export function decodeTenantPng(raw: string | undefined) {
  if (!raw) return null
  try {
    return Buffer.from(raw, 'base64')
  } catch {
    return null
  }
}

export function publicTenantLogoUrl(tenant: Tenant, kind: 'logo' | 'icon' = 'logo') {
  const path = tenantLogoPath(tenant, kind)
  if (!path) return ''
  return `${publicAppUrl()}${path}`
}

export async function saveTenantLogo(tenantId: string, logoPng: string, iconPng?: string) {
  const logo = pngBuffer(logoPng, 'Logo')
  const icon = iconPng ? pngBuffer(iconPng, 'Icon') : logo
  return tenantsCollection.update(tenantId, {
    logoPng: logo.toString('base64'),
    iconPng: icon.toString('base64'),
    logoUpdatedAt: new Date(),
  })
}

export async function clearTenantLogo(tenantId: string) {
  return tenantsCollection.update(tenantId, {
    logoPng: '',
    iconPng: '',
    logoUpdatedAt: new Date(),
  })
}

export function pngImageResponse(buf: Buffer, updatedAt?: Date) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      ...(updatedAt ? { 'Last-Modified': updatedAt.toUTCString() } : {}),
    },
  })
}
