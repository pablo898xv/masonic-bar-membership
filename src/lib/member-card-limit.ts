import { membersCollection, membershipsCollection, type Membership } from './db'

export function occupiesCardSlot(membership: Membership) {
  return membership.status !== 'CANCELLED'
}

export async function occupyingMemberships(memberId: string, tenantId?: string) {
  const { memberships } = await membershipsCollection.findMany({ memberId, tenantId })
  return memberships.filter(occupiesCardSlot)
}

export async function findSignupIdentity(tenantId: string, email: string, phone: string) {
  const [emailMatch, phoneMatch] = await Promise.all([
    membersCollection.findByEmail(email, tenantId),
    membersCollection.findByPhone(phone, tenantId),
  ])
  if (emailMatch && phoneMatch && emailMatch.id !== phoneMatch.id) {
    return { conflict: true as const, member: null }
  }
  return { conflict: false as const, member: emailMatch || phoneMatch || null }
}

export type SignupBlock = {
  error: string
  code: 'ALREADY_A_MEMBER' | 'DETAILS_CONFLICT'
  next?: 'lookup' | 'renew'
}

export function alreadyMemberMessage(kind: 'public' | 'admin', next?: 'lookup' | 'renew'): SignupBlock {
  if (kind === 'admin') {
    return {
      error:
        'This member already has a card at this venue. Renew the existing membership instead of issuing another card.',
      code: 'ALREADY_A_MEMBER',
      next: 'renew',
    }
  }
  return {
    error:
      next === 'renew'
        ? 'You already have a membership at this venue, and it has expired. Each member can have one card — renew that membership instead of buying another.'
        : 'You already have a membership at this venue. Each member can have one card. Find your existing card or renew it instead of buying another.',
    code: 'ALREADY_A_MEMBER',
    next: next || 'lookup',
  }
}

export async function signupIdentityBlock(
  tenantId: string,
  email: string,
  phone: string,
  kind: 'public' | 'admin' = 'public'
): Promise<SignupBlock | null> {
  const identity = await findSignupIdentity(tenantId, email, phone)
  if (identity.conflict) {
    return {
      error:
        kind === 'admin'
          ? 'That email and phone belong to two different members. Check the details before issuing a card.'
          : 'Those details match more than one member. Speak to the bar manager.',
      code: 'DETAILS_CONFLICT',
    }
  }
  if (!identity.member) return null
  return memberCardBlock(identity.member.id, tenantId, kind)
}

export async function memberCardBlock(
  memberId: string,
  tenantId: string,
  kind: 'public' | 'admin' = 'public'
): Promise<SignupBlock | null> {
  const occupying = await occupyingMemberships(memberId, tenantId)
  if (!occupying.length) return null
  const next = occupying.every((item) => item.status === 'EXPIRED') ? 'renew' : 'lookup'
  return alreadyMemberMessage(kind, next)
}
