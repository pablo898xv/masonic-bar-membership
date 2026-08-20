import {
  membershipsCollection,
  subscriptionPlansCollection,
  cardIssuancesCollection,
  membershipNumbersCollection,
  membersCollection,
  walletPassesCollection,
} from '@/lib/db'
import { tillSystemFor } from '@/lib/till-system'
import { formatMembershipQRData } from '@/lib/qrcode'
import { membershipCardUrl } from '@/lib/card-link'
import { emailService } from '@/lib/email'
import { hasDigitalCard } from '@/lib/card-type'
import { formatMagstripeData, getAppSettings } from '@/lib/settings'
import { assertCreditsAvailable, consumeIssuanceCredit, unchargedFormats } from '@/lib/tenancy'
import { v4 as uuidv4 } from 'uuid'

async function ensureAccessToken(membershipId: string, current?: string) {
  if (current) return current
  const accessToken = uuidv4()
  await membershipsCollection.update(membershipId, { accessToken })
  return accessToken
}

async function ensureWalletPass(membershipId: string, cardNumber: number) {
  const existing = await walletPassesCollection.findByMembershipId(membershipId)
  if (existing) return existing

  const membership = await membershipsCollection.findById(membershipId)
  const settings = await getAppSettings()
  return walletPassesCollection.create({
    membershipId,
    tenantId: membership?.tenantId || '',
    passTypeId: settings.passTypeIdentifier || 'pass.com.masonicbar.membership',
    serialNumber: uuidv4(),
    authToken: uuidv4(),
    qrCodeData: await formatMembershipQRData(cardNumber, membership?.tenantId),
    lastUpdated: new Date(),
  })
}

export async function ensureReadyToEncode(membershipId: string) {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) return null

  const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
  if (!membershipNumber) return null

  const magstripeData = await formatMagstripeData(membershipNumber.cardNumber, membership.tenantId)
  const existing = await cardIssuancesCollection.findByMembershipId(membershipId)

  if (!existing) {
    return cardIssuancesCollection.create({
      membershipId,
      tenantId: membership.tenantId,
      queueStatus: 'READY_TO_ENCODE',
      magstripeData,
    })
  }

  if (existing.queueStatus === 'PENDING') {
    return cardIssuancesCollection.update(existing.id, {
      queueStatus: 'READY_TO_ENCODE',
      magstripeData: existing.magstripeData || magstripeData,
    })
  }

  return existing
}

export async function recordEncodedCard(
  membershipId: string,
  encodedBy: string,
  notes: string
) {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) return { ok: false as const, status: 404, error: 'Membership not found' }
  if (membership.status === 'PENDING_PAYMENT') {
    return { ok: false as const, status: 400, error: 'Complete payment before encoding a card' }
  }
  if (membership.status === 'CANCELLED') {
    return { ok: false as const, status: 400, error: 'Cannot encode a cancelled membership' }
  }

  const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
  if (!membershipNumber) {
    return { ok: false as const, status: 404, error: 'Card number not found' }
  }

  if (membership.cardType === 'QR_CODE') {
    const charged = await consumeIssuanceCredit(
      membership.tenantId,
      membershipId,
      'PHYSICAL_CARD',
      undefined,
      membership.membershipNumberId
    )
    if (!charged.ok) return charged
    await membershipsCollection.update(membershipId, { cardType: 'BOTH' })
  }

  const magstripeData = await formatMagstripeData(membershipNumber.cardNumber, membership.tenantId)
  const existing = await cardIssuancesCollection.findByMembershipId(membershipId)
  const wasIssued = existing
    ? existing.queueStatus === 'ISSUED' || existing.queueStatus === 'SHIPPED'
    : false

  const issuance = existing
    ? await cardIssuancesCollection.update(existing.id, {
        magstripeData,
        queueStatus: wasIssued ? 'ISSUED' : 'ENCODED',
        encodedAt: new Date(),
        encodedBy,
        notes,
        ...(wasIssued ? { issuedAt: existing.issuedAt || new Date() } : {}),
      })
    : await cardIssuancesCollection.create({
        membershipId,
        tenantId: membership.tenantId,
        magstripeData,
        queueStatus: 'ENCODED',
        encodedAt: new Date(),
        encodedBy,
        notes,
      })

  return { ok: true as const, issuance, magstripeData }
}

function withAddedFormat(
  current: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH',
  added: 'QR_CODE' | 'PHYSICAL_CARD'
): 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH' {
  if (current === 'BOTH' || current === added) return current === 'BOTH' ? 'BOTH' : added
  return 'BOTH'
}

export async function enableCardFormat(membershipId: string, format: 'QR_CODE' | 'PHYSICAL_CARD') {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) return { ok: false as const, status: 404, error: 'Membership not found' }
  if (membership.status === 'PENDING_PAYMENT') {
    return { ok: false as const, status: 400, error: 'Complete payment before issuing a card' }
  }
  if (membership.status === 'CANCELLED') {
    return { ok: false as const, status: 400, error: 'Cannot issue a card for a cancelled membership' }
  }

  const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
  if (!membershipNumber) {
    return { ok: false as const, status: 404, error: 'Card number not found' }
  }

  const accessToken = await ensureAccessToken(membershipId, membership.accessToken)
  const addingFormat = membership.cardType !== 'BOTH' && membership.cardType !== format
  if (addingFormat) {
    const charged = await consumeIssuanceCredit(
      membership.tenantId,
      membershipId,
      format,
      undefined,
      membership.membershipNumberId
    )
    if (!charged.ok) return charged
  }
  const cardType = withAddedFormat(membership.cardType, format)

  if (format === 'PHYSICAL_CARD') {
    await ensureReadyToEncode(membershipId)
  } else {
    await ensureWalletPass(membershipId, membershipNumber.cardNumber)
    if (!hasDigitalCard(membership.cardType)) {
      const member = await membersCollection.findById(membership.memberId)
      if (member) {
        await emailService.sendDigitalCardEmail({
          memberName: member.name,
          memberEmail: member.email,
          cardNumber: membershipNumber.cardNumber,
          qrCodeUrl: membershipCardUrl(membershipId, accessToken),
        })
      }
    }
    if (!membership.tillSystemEnabled && membership.status === 'ACTIVE' && membership.expiryDate) {
      const till = await tillSystemFor(membership.tenantId)
      const result = await till.enableCard({
        cardNumber: membershipNumber.cardNumber.toString(),
        membershipId,
        expiryDate: membership.expiryDate,
      })
      if (result.success) {
        await membershipsCollection.update(membershipId, {
          tillSystemEnabled: true,
          tillSystemEnabledAt: new Date(),
        })
      }
    }
  }

  if (cardType !== membership.cardType) {
    await membershipsCollection.update(membershipId, { cardType })
  }

  return {
    ok: true as const,
    cardType,
    digitalCardPath: `/membership/card/${membershipId}?token=${encodeURIComponent(accessToken)}`,
    magstripeData: await formatMagstripeData(membershipNumber.cardNumber, membership.tenantId),
  }
}

export async function fulfillPaidMembership(membershipId: string) {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) {
    throw new Error('Membership not found')
  }

  const subscriptionPlan = await subscriptionPlansCollection.findById(membership.subscriptionPlanId)
  if (!subscriptionPlan) {
    throw new Error('Subscription plan not found')
  }

  const accessToken = await ensureAccessToken(membershipId, membership.accessToken)
  const alreadyActive = membership.status === 'ACTIVE'
  const now = new Date()
  const expiryDate = membership.expiryDate || new Date(now.getTime())
  if (!membership.expiryDate) {
    expiryDate.setFullYear(now.getFullYear() + subscriptionPlan.durationYears)
  }

  if (!alreadyActive) {
    const formats = await unchargedFormats(
      membership.tenantId,
      membershipId,
      membership.cardType,
      membership.membershipNumberId
    )
    const available = await assertCreditsAvailable(membership.tenantId, formats.length)
    if (!available.ok) throw new Error(available.error)
    for (const format of formats) {
      const charged = await consumeIssuanceCredit(
        membership.tenantId,
        membershipId,
        format,
        undefined,
        membership.membershipNumberId
      )
      if (!charged.ok) throw new Error(charged.error)
    }

    await membershipsCollection.update(membershipId, {
      status: 'ACTIVE',
      paymentStatus: 'COMPLETED',
      startDate: membership.startDate || now,
      expiryDate,
    })

    if (hasDigitalCard(membership.cardType)) {
      const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
      if (membershipNumber) {
        const till = await tillSystemFor(membership.tenantId)
        const result = await till.enableCard({
          cardNumber: membershipNumber.cardNumber.toString(),
          membershipId,
          expiryDate,
        })
        if (result.success) {
          await membershipsCollection.update(membershipId, {
            tillSystemEnabled: true,
            tillSystemEnabledAt: now,
          })
        }
      }
    }
  }

  await ensureReadyToEncode(membershipId)

  const [member, membershipNumber] = await Promise.all([
    membersCollection.findById(membership.memberId),
    membershipNumbersCollection.findById(membership.membershipNumberId),
  ])

  if (hasDigitalCard(membership.cardType) && membershipNumber) {
    await ensureWalletPass(membershipId, membershipNumber.cardNumber)
  }

  if (!alreadyActive && member && membershipNumber) {
    const cardUrl = membershipCardUrl(membershipId, accessToken)
    await emailService.sendWelcomeEmail({
      memberName: member.name,
      memberEmail: member.email,
      cardNumber: membershipNumber.cardNumber,
      cardType: membership.cardType,
      subscriptionName: subscriptionPlan.name,
      expiryDate,
      qrCodeUrl: hasDigitalCard(membership.cardType) ? cardUrl : undefined,
    })
  }

  return { accessToken }
}
