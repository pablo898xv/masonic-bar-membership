import { NextRequest, NextResponse } from 'next/server'
import { mergeCardPayments, serializeCardPayments } from '@/lib/card-processors'
import { tenantsCollection, Tenant } from '@/lib/db'
import { isSuperAdmin, requireAdmin } from '@/lib/auth'
import { publicPaymentOptions } from '@/lib/payment-options'
import { maskAccountNumber, maskSortCode } from '@/lib/bank-account'
import { qrCodeModeOf, qrRedirectUrlError, qrScanScriptError } from '@/lib/qr-payload'
import { qrNumberStartOf } from '@/lib/card-number-alloc'
import { parsePassTypesBody, passTypesOf } from '@/lib/card-type'
import {
  formatMagstripeTrackList,
  magstripePrefixIsNumeric,
  normalizeMagstripeTracks,
  parseMagstripeTracks,
} from '@/lib/msrx6/protocol'
import {
  ensureUserCanAccessTenant,
  requireTenant,
  serializeVenue,
  tenantCookie,
  userTenants,
} from '@/lib/tenancy'

function venuePaymentFields(tenant: Tenant) {
  return {
    bankAccountName: tenant.bankAccountName || '',
    bankSortCode: maskSortCode(tenant.bankSortCode || ''),
    bankAccountNumberSet: Boolean(tenant.bankAccountNumber),
    magstripePrefix: tenant.magstripePrefix || ';9998',
    magstripeTracks: normalizeMagstripeTracks(tenant.magstripeTracks),
    qrCodeMode: qrCodeModeOf(tenant.qrCodeMode),
    qrRedirectUrl: tenant.qrRedirectUrl || '',
    qrScanScript: tenant.qrScanScript || '',
    qrNumberStart: qrNumberStartOf(tenant),
    passTypes: passTypesOf(tenant.passTypes),
    tillSystemApiUrl: tenant.tillSystemApiUrl || '',
    tillSystemApiKeySet: Boolean(tenant.tillSystemApiKey),
    cardPayments: {
      defaultProvider: tenant.cardPayments?.defaultProvider || '',
      processors: serializeCardPayments(tenant.cardPayments),
    },
    openBankingEnabled: tenant.openBankingEnabled !== false,
    renewalEmailEnabled: tenant.renewalEmailEnabled !== false,
    renewalSmsEnabled: tenant.renewalSmsEnabled !== false,
  }
}

async function venueAdminFields(tenant: Tenant) {
  return {
    ...venuePaymentFields(tenant),
    payments: await publicPaymentOptions(tenant),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!

    const allowed = await ensureUserCanAccessTenant(user.id, tenant.id)
    if (!allowed) {
      const fallback = (await userTenants(user.id, isSuperAdmin(user)))[0]
      if (!fallback) {
        return NextResponse.json({ error: 'No venue access' }, { status: 403 })
      }
      const response = NextResponse.json({
        tenant: {
          ...serializeVenue(fallback),
          ...(await venueAdminFields(fallback)),
        },
      })
      return tenantCookie(response, fallback)
    }

    return NextResponse.json({
      tenant: {
        ...serializeVenue(tenant),
        ...(await venueAdminFields(tenant)),
      },
    })
  } catch (error) {
    console.error('Error loading current tenant:', error)
    return NextResponse.json({ error: 'Failed to load venue' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAdmin(request)
    if (error || !user) return error!

    const body = await request.json()
    const tenant = await tenantsCollection.findById(body.tenantId)
    if (!tenant) return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }
    const response = NextResponse.json({ ok: true, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } })
    return tenantCookie(response, tenant)
  } catch (error) {
    console.error('Error switching tenant:', error)
    return NextResponse.json({ error: 'Failed to switch venue' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAdmin(request)
    if (authError || !user) return authError!

    const { tenant, error } = await requireTenant(request)
    if (error || !tenant) return error!
    if (!(await ensureUserCanAccessTenant(user.id, tenant.id))) {
      return NextResponse.json({ error: 'You do not have access to that venue' }, { status: 403 })
    }

    const body = await request.json()
    const patch: Partial<Tenant> = {}
    if (body.name) patch.name = String(body.name)
    if (body.paymentMode === 'OWN' || body.paymentMode === 'PLATFORM') patch.paymentMode = body.paymentMode
    if (typeof body.bankAccountName === 'string') patch.bankAccountName = body.bankAccountName
    if (typeof body.bankSortCode === 'string') patch.bankSortCode = maskSortCode(body.bankSortCode)
    if (typeof body.bankAccountNumber === 'string' && body.bankAccountNumber) {
      patch.bankAccountNumber = maskAccountNumber(body.bankAccountNumber)
    }
    if (typeof body.magstripePrefix === 'string') patch.magstripePrefix = body.magstripePrefix.trim() || ';9998'
    if (Array.isArray(body.magstripeTracks)) {
      const tracks = parseMagstripeTracks(body.magstripeTracks)
      if (!tracks.length) {
        return NextResponse.json({ error: 'Select at least one magstripe track to encode.' }, { status: 400 })
      }
      patch.magstripeTracks = tracks
    }
    if (patch.magstripePrefix !== undefined || patch.magstripeTracks !== undefined) {
      const tracks = normalizeMagstripeTracks(patch.magstripeTracks ?? tenant.magstripeTracks)
      const prefix = patch.magstripePrefix ?? tenant.magstripePrefix ?? ';9998'
      if ((tracks.includes(2) || tracks.includes(3)) && !magstripePrefixIsNumeric(prefix)) {
        return NextResponse.json(
          {
            error: `${formatMagstripeTrackList(tracks.filter((track) => track !== 1))} only accept digits. Use a numeric prefix, or encode Track 1 only.`,
          },
          { status: 400 }
        )
      }
    }
    if (body.qrCodeMode === 'TILL' || body.qrCodeMode === 'URL' || body.qrCodeMode === 'SCRIPT') {
      patch.qrCodeMode = body.qrCodeMode
    }
    if (typeof body.qrRedirectUrl === 'string') patch.qrRedirectUrl = body.qrRedirectUrl.trim()
    if (typeof body.qrScanScript === 'string') {
      const scriptError = qrScanScriptError(body.qrScanScript)
      if (scriptError) return NextResponse.json({ error: scriptError }, { status: 400 })
      patch.qrScanScript = body.qrScanScript
    }
    if (body.qrNumberStart !== undefined && body.qrNumberStart !== null && body.qrNumberStart !== '') {
      const start = Number(body.qrNumberStart)
      if (!Number.isInteger(start) || start < 1) {
        return NextResponse.json({ error: 'QR card numbers must start at a whole number of 1 or more.' }, { status: 400 })
      }
      patch.qrNumberStart = start
    }
    if (body.passTypes !== undefined) {
      const parsed = parsePassTypesBody(body.passTypes)
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }
      patch.passTypes = parsed
    }
    if (qrCodeModeOf(patch.qrCodeMode || tenant.qrCodeMode) === 'URL') {
      const urlError = qrRedirectUrlError(patch.qrRedirectUrl ?? tenant.qrRedirectUrl ?? '')
      if (urlError) return NextResponse.json({ error: urlError }, { status: 400 })
    }
    if (typeof body.tillSystemApiUrl === 'string') patch.tillSystemApiUrl = body.tillSystemApiUrl.trim()
    if (typeof body.tillSystemApiKey === 'string' && body.tillSystemApiKey) patch.tillSystemApiKey = body.tillSystemApiKey
    if (body.cardPayments && typeof body.cardPayments === 'object') {
      patch.cardPayments = mergeCardPayments(tenant.cardPayments, body.cardPayments)
    }
    if (typeof body.openBankingEnabled === 'boolean') patch.openBankingEnabled = body.openBankingEnabled
    if (typeof body.renewalEmailEnabled === 'boolean') patch.renewalEmailEnabled = body.renewalEmailEnabled
    if (typeof body.renewalSmsEnabled === 'boolean') patch.renewalSmsEnabled = body.renewalSmsEnabled

    const updated = await tenantsCollection.update(tenant.id, patch)
    return NextResponse.json({
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        paymentMode: updated.paymentMode,
        ...venuePaymentFields(updated),
      },
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json({ error: 'Failed to update venue' }, { status: 500 })
  }
}
