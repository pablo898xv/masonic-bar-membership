import { NextRequest, NextResponse } from 'next/server'
import { requirePartner } from '@/lib/partner-auth'
import { issuePartnerMembership } from '@/lib/partner-issue'
import { partnerIssueSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const { tenant, error } = await requirePartner(request)
    if (error || !tenant) return error!

    const body = await request.json().catch(() => ({}))
    const validation = partnerIssueSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION', details: validation.error.issues },
        { status: 400 }
      )
    }

    const result = await issuePartnerMembership(tenant, validation.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Partner membership issue failed:', error)
    return NextResponse.json({ error: 'Failed to issue membership', code: 'ISSUE_FAILED' }, { status: 500 })
  }
}
