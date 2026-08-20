import { NextRequest, NextResponse } from 'next/server'
import { membershipsCollection, membershipNumbersCollection } from '@/lib/db'
import { requireCronOrAdmin } from '@/lib/auth'
import { tillSystemFor } from '@/lib/till-system'
import { requireTenant } from '@/lib/tenancy'

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCronOrAdmin(request)
    if (error) return error

    let tenantId: string | undefined
    if (user) {
      const resolved = await requireTenant(request)
      if (resolved.error || !resolved.tenant) return resolved.error!
      tenantId = resolved.tenant.id
    }

    const expiredMemberships = await membershipsCollection.findExpired(tenantId)

    const results = {
      processed: 0,
      expired: 0,
      tillSystemDisabled: 0,
      errors: [] as string[],
    }

    for (const membership of expiredMemberships) {
      results.processed++

      try {
        await membershipsCollection.update(membership.id, {
          status: 'EXPIRED',
        })
        results.expired++

        if (membership.tillSystemEnabled) {
          const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)

          if (membershipNumber) {
            try {
              const till = await tillSystemFor(membership.tenantId)
              const tillResult = await till.disableCard({
                cardNumber: membershipNumber.cardNumber.toString(),
                reason: 'Membership expired',
              })

              if (tillResult.success) {
                await membershipsCollection.update(membership.id, {
                  tillSystemEnabled: false,
                })
                results.tillSystemDisabled++
              }
            } catch (tillError) {
              results.errors.push(`Till system disable failed for ${membership.id}: ${tillError}`)
            }
          }
        }
      } catch (error) {
        results.errors.push(`Failed to process membership ${membership.id}: ${error}`)
      }
    }

    return NextResponse.json({
      message: 'Expiry check completed',
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error running expiry check:', error)
    return NextResponse.json({ error: 'Failed to run expiry check' }, { status: 500 })
  }
}
