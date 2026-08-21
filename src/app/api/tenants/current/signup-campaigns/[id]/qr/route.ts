import { NextRequest, NextResponse } from 'next/server'
import { signupCampaignsCollection } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { belongsToTenant, ensureUserCanAccessTenant, requireTenant, slugify } from '@/lib/tenancy'
import { signupCampaignUrl } from '@/lib/signup-campaigns'
import { generateQRCodeBuffer, generateQRCodeSVG } from '@/lib/qrcode'

function posterWidth(value: string | null) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return 1600
  return Math.min(2048, Math.max(240, parsed))
}

function posterFilename(name: string, ext: 'png' | 'svg') {
  const stub = slugify(name) || 'campaign'
  return `membership-signup-${stub}.${ext}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const { id } = await params
    const campaign = await signupCampaignsCollection.findById(id)
    if (!campaign || !belongsToTenant(campaign, tenant.id) || campaign.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Signup campaign not found' }, { status: 404 })
    }

    const format = request.nextUrl.searchParams.get('format') === 'svg' ? 'svg' : 'png'
    const width = posterWidth(request.nextUrl.searchParams.get('width'))
    const download = request.nextUrl.searchParams.get('download') === '1'
    const filename = posterFilename(campaign.name, format)
    const payload = signupCampaignUrl(campaign.token, request)
    const disposition = `${download ? 'attachment' : 'inline'}; filename="${filename}"`
    const qrOptions = {
      width,
      margin: 4,
      errorCorrectionLevel: 'H' as const,
      color: { dark: '#000000', light: '#ffffff' },
    }

    if (format === 'svg') {
      const svg = await generateQRCodeSVG(payload, qrOptions)
      return new NextResponse(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': disposition,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    const png = await generateQRCodeBuffer(payload, qrOptions)
    return new NextResponse(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Error generating signup campaign QR:', error)
    return NextResponse.json({ error: 'Failed to generate QR code' }, { status: 500 })
  }
}
