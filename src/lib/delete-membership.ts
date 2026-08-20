import {
  cardIssuancesCollection,
  membershipNumbersCollection,
  membershipsCollection,
  paymentTransactionsCollection,
  walletPassesCollection,
} from '@/lib/db'
import { tillSystemFor } from '@/lib/till-system'

export async function deleteMembershipAndReleaseCard(membershipId: string) {
  const membership = await membershipsCollection.findById(membershipId)
  if (!membership) {
    return { ok: false as const, status: 404, error: 'Membership not found' }
  }

  const membershipNumber = await membershipNumbersCollection.findById(membership.membershipNumberId)
  const cardNumber = membershipNumber?.cardNumber

  if (membershipNumber) {
    try {
      const till = await tillSystemFor(membership.tenantId)
      await till.disableCard({
        cardNumber: membershipNumber.cardNumber.toString(),
        reason: 'Membership deleted',
      })
    } catch (error) {
      console.warn('Till disable failed while deleting membership:', error)
    }
  }

  const [issuance, pass, payments] = await Promise.all([
    cardIssuancesCollection.findByMembershipId(membershipId),
    walletPassesCollection.findByMembershipId(membershipId),
    paymentTransactionsCollection.findByMembershipId(membershipId),
  ])

  if (issuance) await cardIssuancesCollection.delete(issuance.id)
  if (pass) await walletPassesCollection.delete(pass.id)
  for (const payment of payments) {
    await paymentTransactionsCollection.delete(payment.id)
  }

  await membershipsCollection.delete(membershipId)

  let cardReturnedToStock = false
  if (membershipNumber) {
    const remaining = await membershipsCollection.findByMembershipNumberId(membershipNumber.id)
    if (remaining.length === 0) {
      await membershipNumbersCollection.release(membershipNumber.id)
      cardReturnedToStock = true
    }
  }

  return {
    ok: true as const,
    cardNumber,
    cardReturnedToStock,
  }
}
