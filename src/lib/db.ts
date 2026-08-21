import { getDb, Timestamp } from './firebase'
import type { TenantCardPayments } from './card-processors'
import {
  canonicalMemberPhone,
  memberEmailHash,
  memberPhoneHash,
  normalizeMemberEmail,
  sealMemberFields,
  storedMemberNeedsSeal,
  unsealMemberFields,
} from './member-pii'

export interface Member {
  id: string
  tenantId: string
  name: string
  email: string
  phone: string
  signupCampaignId?: string
  createdAt: Date
  updatedAt: Date
}

export interface MembershipNumber {
  id: string
  tenantId: string
  cardNumber: number
  batchId?: string
  isAssigned: boolean
  assignedAt?: Date
  createdAt: Date
}

export interface SubscriptionPlan {
  id: string
  tenantId: string
  name: string
  durationYears: number
  price: number
  currency: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Membership {
  id: string
  tenantId: string
  memberId: string
  membershipNumberId: string
  subscriptionPlanId: string
  cardType: 'QR_CODE' | 'PHYSICAL_CARD' | 'BOTH'
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  startDate?: Date
  expiryDate?: Date
  paymentId?: string
  paymentMethod?: 'CARD' | 'OPEN_BANKING' | 'CASH' | 'IN_PERSON' | 'COMPLIMENTARY'
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  tillSystemEnabled: boolean
  tillSystemEnabledAt?: Date
  accessToken?: string
  shortCode?: string
  signupCampaignId?: string
  createdAt: Date
  updatedAt: Date
}

export interface CardIssuance {
  id: string
  tenantId: string
  membershipId: string
  queueStatus: 'PENDING' | 'READY_TO_ENCODE' | 'ENCODED' | 'ISSUED' | 'SHIPPED'
  magstripeData?: string
  encodedAt?: Date
  encodedBy?: string
  issuedAt?: Date
  issuedBy?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface WalletPass {
  id: string
  tenantId: string
  membershipId: string
  passTypeId: string
  serialNumber: string
  authToken: string
  qrCodeData: string
  passUrl?: string
  deviceLibraryId?: string
  pushToken?: string
  lastUpdated: Date
  createdAt: Date
}

export interface PaymentTransaction {
  id: string
  tenantId?: string
  membershipId?: string
  creditPurchase?: boolean
  amount: number
  currency: string
  paymentMethod: 'CARD' | 'OPEN_BANKING' | 'CASH' | 'IN_PERSON' | 'COMPLIMENTARY'
  provider: string
  externalId?: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface SystemConfig {
  id: string
  key: string
  value: string
  updatedAt: Date
}

export interface AdminUser {
  id: string
  email: string
  passwordHash: string
  name: string
  role: 'ADMIN' | 'MANAGER'
  isPlatformAdmin: boolean
  isActive: boolean
  totpEnabled?: boolean
  totpSecret?: string
  totpPendingSecret?: string
  totpBackupHashes?: string[]
  totpEnabledAt?: Date
  passwordUpdatedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Tenant {
  id: string
  name: string
  slug: string
  urlStub?: string
  status: 'ACTIVE' | 'SUSPENDED'
  creditBalance: number
  paymentMode: 'PLATFORM' | 'OWN'
  bankAccountName?: string
  bankSortCode?: string
  bankAccountNumber?: string
  magstripePrefix?: string
  magstripeTracks?: number[]
  qrCodeMode?: 'TILL' | 'URL'
  qrRedirectUrl?: string
  tillSystemApiUrl?: string
  tillSystemApiKey?: string
  cardPayments?: TenantCardPayments
  openBankingEnabled?: boolean
  addressLine1?: string
  addressLine2?: string
  city?: string
  county?: string
  postcode?: string
  country?: string
  phone?: string
  email?: string
  website?: string
  contactName?: string
  contactRole?: string
  contactEmail?: string
  contactPhone?: string
  logoPng?: string
  iconPng?: string
  logoUpdatedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface TenantUser {
  id: string
  tenantId: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'MANAGER'
  createdAt: Date
}

export interface TenantApiKey {
  id: string
  tenantId: string
  name: string
  keyPrefix: string
  keyHash: string
  createdByUserId?: string
  lastUsedAt?: Date
  revokedAt?: Date
  createdAt: Date
}

export interface SignupCampaign {
  id: string
  tenantId: string
  name: string
  token: string
  status: 'ACTIVE' | 'ENDED'
  createdByUserId?: string
  endedAt?: Date
  linkOpens?: number
  createdAt: Date
  updatedAt: Date
}

export interface CreditLedgerEntry {
  id: string
  tenantId: string
  type: 'ISSUE' | 'TOPUP' | 'GRANT' | 'ADJUSTMENT' | 'REFUND' | 'SMS'
  amount: number
  format?: 'QR_CODE' | 'PHYSICAL_CARD'
  membershipId?: string
  membershipNumberId?: string
  packageKey?: string
  packageName?: string
  pricePence?: number
  paymentId?: string
  revoked?: boolean
  revokedAt?: Date
  revokedByUserId?: string
  revokedEntryId?: string
  note?: string
  createdByUserId?: string
  createdAt: Date
}

const COLLECTIONS = {
  members: 'members',
  membershipNumbers: 'membershipNumbers',
  subscriptionPlans: 'subscriptionPlans',
  memberships: 'memberships',
  cardIssuances: 'cardIssuances',
  walletPasses: 'walletPasses',
  paymentTransactions: 'paymentTransactions',
  systemConfig: 'systemConfig',
  adminUsers: 'adminUsers',
  tenants: 'tenants',
  tenantUsers: 'tenantUsers',
  creditLedger: 'creditLedger',
  tenantApiKeys: 'tenantApiKeys',
  signupCampaigns: 'signupCampaigns',
}

function toFirestoreData(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Date) {
      result[key] = Timestamp.fromDate(value)
    } else if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

function fromFirestoreData<T>(id: string, data: FirebaseFirestore.DocumentData): T {
  const result: Record<string, unknown> = { id }
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate()
    } else {
      result[key] = value
    }
  }
  return result as T
}

function scoped<T extends { tenantId?: string }>(items: T[], tenantId?: string) {
  if (!tenantId) return items
  return items.filter((item) => item.tenantId === tenantId)
}

type StoredMember = Member & { emailHash?: string }

function readMemberDoc(id: string, data: FirebaseFirestore.DocumentData): { member: Member; needsSeal: boolean } {
  const stored = fromFirestoreData<StoredMember>(id, data)
  return {
    member: unsealMemberFields(stored) as Member,
    needsSeal: storedMemberNeedsSeal(data),
  }
}

async function persistSealedMembers(members: Member[]) {
  if (!members.length) return
  const db = getDb()
  const chunkSize = 400
  for (let offset = 0; offset < members.length; offset += chunkSize) {
    const batch = db.batch()
    for (const member of members.slice(offset, offset + chunkSize)) {
      batch.update(
        db.collection(COLLECTIONS.members).doc(member.id),
        toFirestoreData({ ...sealMemberFields(member) })
      )
    }
    await batch.commit()
  }
}

export const membersCollection = {
  async create(data: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>): Promise<Member> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.members).doc()
    const now = new Date()
    const member: Member = {
      ...data,
      id: docRef.id,
      name: data.name.trim(),
      email: normalizeMemberEmail(data.email),
      phone: data.phone.trim(),
      createdAt: now,
      updatedAt: now,
    }
    await docRef.set(
      toFirestoreData({
        ...member,
        ...sealMemberFields(member),
      } as unknown as Record<string, unknown>)
    )
    return member
  },

  async findById(id: string): Promise<Member | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.members).doc(id).get()
    if (!docRef.exists) return null
    const { member, needsSeal } = readMemberDoc(id, docRef.data()!)
    if (needsSeal) await persistSealedMembers([member])
    return member
  },

  async findByEmail(email: string, tenantId?: string): Promise<Member | null> {
    const db = getDb()
    const normalized = normalizeMemberEmail(email)
    const hashed = await db.collection(COLLECTIONS.members)
      .where('emailHash', '==', memberEmailHash(normalized))
      .get()
    let docs = hashed.docs
    if (!docs.length) {
      const legacy = await db.collection(COLLECTIONS.members)
        .where('email', '==', email)
        .get()
      docs = legacy.docs
    }
    if (!docs.length && email !== normalized) {
      const legacyLower = await db.collection(COLLECTIONS.members)
        .where('email', '==', normalized)
        .get()
      docs = legacyLower.docs
    }
    const matches = docs
      .map((doc) => readMemberDoc(doc.id, doc.data()))
      .filter((item) => !tenantId || item.member.tenantId === tenantId)
    const match = matches[0]
    if (!match) return null
    if (match.needsSeal) await persistSealedMembers([match.member])
    return match.member
  },

  async findByPhone(phone: string, tenantId?: string): Promise<Member | null> {
    const hash = memberPhoneHash(phone)
    if (!hash) return null
    const db = getDb()
    const hashed = await db.collection(COLLECTIONS.members)
      .where('phoneHash', '==', hash)
      .get()
    const matches = hashed.docs
      .map((doc) => readMemberDoc(doc.id, doc.data()))
      .filter((item) => !tenantId || item.member.tenantId === tenantId)
    if (matches[0]) {
      if (matches[0].needsSeal) await persistSealedMembers([matches[0].member])
      return matches[0].member
    }
    if (!tenantId) return null
    const { members } = await this.findMany({ tenantId })
    return members.find((member) => {
      const left = canonicalMemberPhone(member.phone)
      const right = canonicalMemberPhone(phone)
      return Boolean(left && right && left === right)
    }) || null
  },

  async findMany(options: { 
    tenantId?: string
    search?: string
    skip?: number
    take?: number 
  } = {}): Promise<{ members: Member[]; total: number }> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.members)
      .orderBy('createdAt', 'desc')
    
    if (options.take) {
      query = query.limit(options.take)
    }

    const snapshot = await query.get()
    const read = snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
      readMemberDoc(d.id, d.data())
    )
    await persistSealedMembers(read.filter((item) => item.needsSeal).map((item) => item.member))
    let members = scoped(
      read.map((item) => item.member),
      options.tenantId
    )

    if (options.search) {
      const searchLower = options.search.toLowerCase()
      members = members.filter((m: Member) => 
        m.name.toLowerCase().includes(searchLower) ||
        m.email.toLowerCase().includes(searchLower) ||
        m.phone.includes(options.search!)
      )
    }

    const countSnapshot = await db.collection(COLLECTIONS.members).count().get()
    
    return { members, total: options.tenantId ? members.length : countSnapshot.data().count }
  },

  async update(id: string, data: Partial<Member>): Promise<Member> {
    const db = getDb()
    const { name, email, phone, ...rest } = data
    const updateData = {
      ...rest,
      ...sealMemberFields({ name, email, phone }),
      updatedAt: new Date(),
    }
    await db.collection(COLLECTIONS.members).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.members).doc(id).delete()
  },

  async count(): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.members).count().get()
    return snapshot.data().count
  }
}

export const membershipNumbersCollection = {
  async createMany(numbers: Array<{ cardNumber: number; batchId?: string }>, tenantId: string): Promise<number> {
    const db = getDb()
    const now = new Date()
    const chunkSize = 400

    for (let offset = 0; offset < numbers.length; offset += chunkSize) {
      const batch = db.batch()
      for (const num of numbers.slice(offset, offset + chunkSize)) {
        const docRef = db.collection(COLLECTIONS.membershipNumbers).doc()
        const data: MembershipNumber = {
          id: docRef.id,
          tenantId,
          cardNumber: num.cardNumber,
          batchId: num.batchId,
          isAssigned: false,
          createdAt: now,
        }
        batch.set(docRef, toFirestoreData(data as unknown as Record<string, unknown>))
      }
      await batch.commit()
    }

    return numbers.length
  },

  async findByCardNumber(cardNumber: number, tenantId?: string): Promise<MembershipNumber | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('cardNumber', '==', cardNumber)
      .get()
    const matches = snapshot.docs
      .map((doc) => fromFirestoreData<MembershipNumber>(doc.id, doc.data()))
      .filter((number) => !tenantId || number.tenantId === tenantId)
    return matches[0] || null
  },

  async findFirstAvailable(tenantId?: string): Promise<MembershipNumber | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('isAssigned', '==', false)
      .orderBy('cardNumber', 'asc')
      .get()
    const matches = snapshot.docs
      .map((doc) => fromFirestoreData<MembershipNumber>(doc.id, doc.data()))
      .filter((number) => !tenantId || number.tenantId === tenantId)
    return matches[0] || null
  },

  async findById(id: string): Promise<MembershipNumber | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.membershipNumbers).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<MembershipNumber>(id, docRef.data()!)
  },

  async findMany(options: {
    tenantId?: string
    assigned?: boolean
    batchId?: string
    skip?: number
    take?: number
  } = {}): Promise<{ numbers: MembershipNumber[]; total: number; stats: { total: number; assigned: number; available: number } }> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.membershipNumbers)
      .orderBy('cardNumber', 'asc')

    if (options.batchId) {
      query = query.where('batchId', '==', options.batchId)
    }

    const snapshot = await query.get()
    const all = scoped(
      snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
        fromFirestoreData<MembershipNumber>(d.id, d.data())
      ),
      options.tenantId
    )

    const stats = {
      total: all.length,
      assigned: all.filter((number) => number.isAssigned).length,
      available: all.filter((number) => !number.isAssigned).length,
    }

    let numbers = all
    if (options.assigned !== undefined) {
      numbers = numbers.filter((number) => number.isAssigned === options.assigned)
    }

    const total = numbers.length
    const skip = Math.max(0, options.skip || 0)
    if (options.take) {
      numbers = numbers.slice(skip, skip + options.take)
    } else if (skip) {
      numbers = numbers.slice(skip)
    }

    return { numbers, total, stats }
  },

  async findInRange(start: number, end: number): Promise<MembershipNumber[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('cardNumber', '>=', start)
      .where('cardNumber', '<=', end)
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<MembershipNumber>(d.id, d.data())
    )
  },

  async update(id: string, data: Partial<MembershipNumber>): Promise<MembershipNumber> {
    const db = getDb()
    await db.collection(COLLECTIONS.membershipNumbers).doc(id).update(toFirestoreData(data as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async release(id: string): Promise<MembershipNumber> {
    const existing = await this.findById(id)
    if (!existing) {
      throw new Error('Card number not found')
    }

    const db = getDb()
    await db.collection(COLLECTIONS.membershipNumbers).doc(id).set(
      toFirestoreData({
        id: existing.id,
        tenantId: existing.tenantId,
        cardNumber: existing.cardNumber,
        ...(existing.batchId ? { batchId: existing.batchId } : {}),
        isAssigned: false,
        createdAt: existing.createdAt,
      })
    )
    const updated = await this.findById(id)
    return updated!
  },

  async countAvailable(): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('isAssigned', '==', false)
      .count()
      .get()
    return snapshot.data().count
  }
}

export const subscriptionPlansCollection = {
  async create(data: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.subscriptionPlans).doc()
    const now = new Date()
    const plan: SubscriptionPlan = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(plan as unknown as Record<string, unknown>))
    return plan
  },

  async findById(id: string): Promise<SubscriptionPlan | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.subscriptionPlans).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<SubscriptionPlan>(id, docRef.data()!)
  },

  async findMany(activeOnly: boolean = false, tenantId?: string): Promise<SubscriptionPlan[]> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.subscriptionPlans)
      .orderBy('durationYears', 'asc')
    if (activeOnly) {
      query = query.where('isActive', '==', true)
    }
    const snapshot = await query.get()
    return scoped(snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<SubscriptionPlan>(d.id, d.data())
    ), tenantId)
  },

  async update(id: string, data: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.subscriptionPlans).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.subscriptionPlans).doc(id).delete()
  }
}

export const membershipsCollection = {
  async create(data: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>): Promise<Membership> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.memberships).doc()
    const now = new Date()
    const membership: Membership = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(membership as unknown as Record<string, unknown>))
    return membership
  },

  async findById(id: string): Promise<Membership | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.memberships).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<Membership>(id, docRef.data()!)
  },

  async findByShortCode(shortCode: string, tenantId?: string): Promise<Membership | null> {
    const code = shortCode.trim()
    if (!code) return null
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.memberships).where('shortCode', '==', code).limit(1).get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    const membership = fromFirestoreData<Membership>(doc.id, doc.data())
    if (tenantId && membership.tenantId !== tenantId) return null
    return membership
  },

  async findByIdWithRelations(id: string): Promise<{
    membership: Membership
    member: Member
    membershipNumber: MembershipNumber
    subscriptionPlan: SubscriptionPlan
    cardIssuance?: CardIssuance
  } | null> {
    const membership = await this.findById(id)
    if (!membership) return null

    const [member, membershipNumber, subscriptionPlan, cardIssuance] = await Promise.all([
      membersCollection.findById(membership.memberId),
      membershipNumbersCollection.findById(membership.membershipNumberId),
      subscriptionPlansCollection.findById(membership.subscriptionPlanId),
      cardIssuancesCollection.findByMembershipId(membership.id),
    ])

    if (!member || !membershipNumber || !subscriptionPlan) return null

    return { membership, member, membershipNumber, subscriptionPlan, cardIssuance: cardIssuance || undefined }
  },

  async findMany(options: {
    tenantId?: string
    status?: string
    cardType?: string
    memberId?: string
    skip?: number
    take?: number
  } = {}): Promise<{ memberships: Membership[]; total: number }> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.memberships)
      .orderBy('createdAt', 'desc')
    
    if (options.status) {
      query = query.where('status', '==', options.status)
    }
    if (options.cardType) {
      query = query.where('cardType', '==', options.cardType)
    }
    if (options.memberId) {
      query = query.where('memberId', '==', options.memberId)
    }
    if (options.take) {
      query = query.limit(options.take)
    }

    const snapshot = await query.get()
    const memberships = scoped(snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Membership>(d.id, d.data())
    ), options.tenantId)

    return { memberships, total: memberships.length }
  },

  async findExpiring(daysAhead: number): Promise<Membership[]> {
    const db = getDb()
    const now = new Date()
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
    
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', 'ACTIVE')
      .where('expiryDate', '>=', Timestamp.fromDate(now))
      .where('expiryDate', '<=', Timestamp.fromDate(futureDate))
      .orderBy('expiryDate', 'asc')
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Membership>(d.id, d.data())
    )
  },

  async findExpired(tenantId?: string): Promise<Membership[]> {
    const db = getDb()
    const now = new Date()
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', 'ACTIVE')
      .where('expiryDate', '<', Timestamp.fromDate(now))
      .get()
    return scoped(
      snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
        fromFirestoreData<Membership>(d.id, d.data())
      ),
      tenantId
    )
  },

  async findExpiringInRange(startDays: number, endDays: number, tenantId?: string): Promise<Membership[]> {
    const db = getDb()
    const now = new Date()
    const startDate = new Date(now.getTime() + startDays * 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + endDays * 24 * 60 * 60 * 1000)
    
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', 'ACTIVE')
      .where('expiryDate', '>=', Timestamp.fromDate(startDate))
      .where('expiryDate', '<=', Timestamp.fromDate(endDate))
      .get()
    return scoped(
      snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
        fromFirestoreData<Membership>(d.id, d.data())
      ),
      tenantId
    )
  },

  async update(id: string, data: Partial<Membership>): Promise<Membership> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.memberships).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async countByStatus(status: string): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', status)
      .count()
      .get()
    return snapshot.data().count
  },

  async findByMembershipNumberId(membershipNumberId: string): Promise<Membership[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('membershipNumberId', '==', membershipNumberId)
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
      fromFirestoreData<Membership>(d.id, d.data())
    )
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.memberships).doc(id).delete()
  }
}

export const cardIssuancesCollection = {
  async create(data: Omit<CardIssuance, 'id' | 'createdAt' | 'updatedAt'>): Promise<CardIssuance> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.cardIssuances).doc()
    const now = new Date()
    const issuance: CardIssuance = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(issuance as unknown as Record<string, unknown>))
    return issuance
  },

  async findById(id: string): Promise<CardIssuance | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.cardIssuances).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<CardIssuance>(id, docRef.data()!)
  },

  async findByMembershipId(membershipId: string): Promise<CardIssuance | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.cardIssuances)
      .where('membershipId', '==', membershipId)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<CardIssuance>(doc.id, doc.data())
  },

  async findMany(options: {
    tenantId?: string
    queueStatus?: string
    skip?: number
    take?: number
  } = {}): Promise<{ issuances: CardIssuance[]; total: number }> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.cardIssuances)
      .orderBy('createdAt', 'asc')
    
    if (options.queueStatus) {
      query = query.where('queueStatus', '==', options.queueStatus)
    }
    if (options.take) {
      query = query.limit(options.take)
    }

    const snapshot = await query.get()
    const issuances = scoped(snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<CardIssuance>(d.id, d.data())
    ), options.tenantId)

    return { issuances, total: issuances.length }
  },

  async findByStatuses(statuses: string[], tenantId?: string): Promise<CardIssuance[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.cardIssuances)
      .where('queueStatus', 'in', statuses)
      .orderBy('createdAt', 'asc')
      .get()
    return scoped(snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<CardIssuance>(d.id, d.data())
    ), tenantId)
  },

  async update(id: string, data: Partial<CardIssuance>): Promise<CardIssuance> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.cardIssuances).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.cardIssuances).doc(id).delete()
  },

  async countByStatus(tenantId?: string): Promise<Record<string, number>> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.cardIssuances).get()
    const counts: Record<string, number> = {
      PENDING: 0,
      READY_TO_ENCODE: 0,
      ENCODED: 0,
      ISSUED: 0,
      SHIPPED: 0,
    }
    snapshot.docs.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => {
      if (tenantId && d.data().tenantId !== tenantId) return
      const status = d.data().queueStatus as string
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }
}

export const walletPassesCollection = {
  async create(data: Omit<WalletPass, 'id' | 'createdAt'>): Promise<WalletPass> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.walletPasses).doc()
    const now = new Date()
    const pass: WalletPass = { ...data, id: docRef.id, createdAt: now }
    await docRef.set(toFirestoreData(pass as unknown as Record<string, unknown>))
    return pass
  },

  async findByMembershipId(membershipId: string): Promise<WalletPass | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.walletPasses)
      .where('membershipId', '==', membershipId)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<WalletPass>(doc.id, doc.data())
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.walletPasses).doc(id).delete()
  },

  async update(id: string, data: Partial<WalletPass>): Promise<WalletPass> {
    const db = getDb()
    await db.collection(COLLECTIONS.walletPasses).doc(id).update(toFirestoreData(data as Record<string, unknown>))
    const docRef = await db.collection(COLLECTIONS.walletPasses).doc(id).get()
    return fromFirestoreData<WalletPass>(id, docRef.data()!)
  }
}

export const paymentTransactionsCollection = {
  async create(data: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.paymentTransactions).doc()
    const now = new Date()
    const transaction: PaymentTransaction = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(transaction as unknown as Record<string, unknown>))
    return transaction
  },

  async findByTenantId(tenantId: string): Promise<PaymentTransaction[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.paymentTransactions)
      .where('tenantId', '==', tenantId)
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
      fromFirestoreData<PaymentTransaction>(d.id, d.data())
    )
  },

  async findByMembershipId(membershipId: string): Promise<PaymentTransaction[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.paymentTransactions)
      .where('membershipId', '==', membershipId)
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) =>
      fromFirestoreData<PaymentTransaction>(d.id, d.data())
    )
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.paymentTransactions).doc(id).delete()
  },

  async findByExternalId(externalId: string): Promise<PaymentTransaction | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.paymentTransactions)
      .where('externalId', '==', externalId)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<PaymentTransaction>(doc.id, doc.data())
  },

  async update(id: string, data: Partial<PaymentTransaction>): Promise<PaymentTransaction> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.paymentTransactions).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const docRef = await db.collection(COLLECTIONS.paymentTransactions).doc(id).get()
    return fromFirestoreData<PaymentTransaction>(id, docRef.data()!)
  },

  async updateByExternalId(externalId: string, data: Partial<PaymentTransaction>): Promise<void> {
    const transaction = await this.findByExternalId(externalId)
    if (transaction) {
      await this.update(transaction.id, data)
    }
  }
}

export const systemConfigCollection = {
  async get(key: string): Promise<string | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.systemConfig)
      .where('key', '==', key)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    return snapshot.docs[0].data().value as string
  },

  async set(key: string, value: string): Promise<void> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.systemConfig)
      .where('key', '==', key)
      .limit(1)
      .get()
    
    if (snapshot.empty) {
      const docRef = db.collection(COLLECTIONS.systemConfig).doc()
      await docRef.set({
        key,
        value,
        updatedAt: Timestamp.now()
      })
    } else {
      await snapshot.docs[0].ref.update({
        value,
        updatedAt: Timestamp.now()
      })
    }
  },

  async exists(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }
}

export const adminUsersCollection = {
  async create(data: Omit<AdminUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdminUser> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.adminUsers).doc()
    const now = new Date()
    const user: AdminUser = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(user as unknown as Record<string, unknown>))
    return user
  },

  async findById(id: string): Promise<AdminUser | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.adminUsers).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<AdminUser>(id, docRef.data()!)
  },

  async findMany(): Promise<AdminUser[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.adminUsers).orderBy('createdAt', 'desc').get()
    return snapshot.docs.map((doc) => fromFirestoreData<AdminUser>(doc.id, doc.data()))
  },

  async findByEmail(email: string): Promise<AdminUser | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.adminUsers)
      .where('email', '==', email)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<AdminUser>(doc.id, doc.data())
  },

  async count(): Promise<number> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.adminUsers).count().get()
    return snapshot.data().count
  },

  async update(id: string, data: Partial<AdminUser>): Promise<AdminUser> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.adminUsers).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  }
}

export const tenantsCollection = {
  async create(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.tenants).doc()
    const now = new Date()
    const tenant: Tenant = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(tenant as unknown as Record<string, unknown>))
    return tenant
  },

  async findById(id: string): Promise<Tenant | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.tenants).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<Tenant>(id, docRef.data()!)
  },

  async findBySlug(slug: string): Promise<Tenant | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenants).where('slug', '==', slug).limit(1).get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<Tenant>(doc.id, doc.data())
  },

  async findByUrlStub(urlStub: string): Promise<Tenant | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenants).where('urlStub', '==', urlStub).limit(1).get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<Tenant>(doc.id, doc.data())
  },

  async findMany(): Promise<Tenant[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenants).orderBy('name', 'asc').get()
    return snapshot.docs.map((doc) => fromFirestoreData<Tenant>(doc.id, doc.data()))
  },

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    const db = getDb()
    await db.collection(COLLECTIONS.tenants).doc(id).update(
      toFirestoreData({ ...data, updatedAt: new Date() } as Record<string, unknown>)
    )
    const updated = await this.findById(id)
    return updated!
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.tenants).doc(id).delete()
  },
}

export const tenantUsersCollection = {
  async create(data: Omit<TenantUser, 'id' | 'createdAt'>): Promise<TenantUser> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.tenantUsers).doc()
    const row: TenantUser = { ...data, id: docRef.id, createdAt: new Date() }
    await docRef.set(toFirestoreData(row as unknown as Record<string, unknown>))
    return row
  },

  async findByUser(userId: string): Promise<TenantUser[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenantUsers).where('userId', '==', userId).get()
    return snapshot.docs.map((doc) => fromFirestoreData<TenantUser>(doc.id, doc.data()))
  },

  async findByTenant(tenantId: string): Promise<TenantUser[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenantUsers).where('tenantId', '==', tenantId).get()
    return snapshot.docs.map((doc) => fromFirestoreData<TenantUser>(doc.id, doc.data()))
  },

  async find(userId: string, tenantId: string): Promise<TenantUser | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenantUsers)
      .where('userId', '==', userId)
      .where('tenantId', '==', tenantId)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<TenantUser>(doc.id, doc.data())
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.collection(COLLECTIONS.tenantUsers).doc(id).delete()
  },
}

export const tenantApiKeysCollection = {
  async create(data: Omit<TenantApiKey, 'id' | 'createdAt'>): Promise<TenantApiKey> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.tenantApiKeys).doc()
    const row: TenantApiKey = { ...data, id: docRef.id, createdAt: new Date() }
    await docRef.set(toFirestoreData(row as unknown as Record<string, unknown>))
    return row
  },

  async findById(id: string): Promise<TenantApiKey | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.tenantApiKeys).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<TenantApiKey>(id, docRef.data()!)
  },

  async findByHash(keyHash: string): Promise<TenantApiKey | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenantApiKeys).where('keyHash', '==', keyHash).limit(1).get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<TenantApiKey>(doc.id, doc.data())
  },

  async findByTenant(tenantId: string): Promise<TenantApiKey[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.tenantApiKeys).where('tenantId', '==', tenantId).get()
    return snapshot.docs
      .map((doc) => fromFirestoreData<TenantApiKey>(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  async update(id: string, data: Partial<TenantApiKey>): Promise<TenantApiKey> {
    const db = getDb()
    await db.collection(COLLECTIONS.tenantApiKeys).doc(id).update(toFirestoreData(data as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },
}

export const signupCampaignsCollection = {
  async create(data: Omit<SignupCampaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<SignupCampaign> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.signupCampaigns).doc()
    const now = new Date()
    const row: SignupCampaign = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(row as unknown as Record<string, unknown>))
    return row
  },

  async findById(id: string): Promise<SignupCampaign | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.signupCampaigns).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<SignupCampaign>(id, docRef.data()!)
  },

  async findByToken(token: string): Promise<SignupCampaign | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.signupCampaigns).where('token', '==', token).limit(1).get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<SignupCampaign>(doc.id, doc.data())
  },

  async findByTenant(tenantId: string): Promise<SignupCampaign[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.signupCampaigns).where('tenantId', '==', tenantId).get()
    return snapshot.docs
      .map((doc) => fromFirestoreData<SignupCampaign>(doc.id, doc.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },

  async update(id: string, data: Partial<SignupCampaign>): Promise<SignupCampaign> {
    const db = getDb()
    await db.collection(COLLECTIONS.signupCampaigns).doc(id).update(
      toFirestoreData({ ...data, updatedAt: new Date() } as Record<string, unknown>)
    )
    const updated = await this.findById(id)
    return updated!
  },

  async incrementLinkOpens(id: string): Promise<void> {
    const campaign = await this.findById(id)
    if (!campaign) return
    await this.update(id, { linkOpens: (campaign.linkOpens || 0) + 1 })
  },
}

export const creditLedgerCollection = {
  async create(data: Omit<CreditLedgerEntry, 'id' | 'createdAt'>): Promise<CreditLedgerEntry> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.creditLedger).doc()
    const entry: CreditLedgerEntry = { ...data, id: docRef.id, createdAt: new Date() }
    await docRef.set(toFirestoreData(entry as unknown as Record<string, unknown>))
    return entry
  },

  async findByTenant(tenantId: string, take = 50): Promise<CreditLedgerEntry[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.creditLedger)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .limit(take)
      .get()
    return snapshot.docs.map((doc) => fromFirestoreData<CreditLedgerEntry>(doc.id, doc.data()))
  },

  async findIssue(tenantId: string, membershipId: string, format: 'QR_CODE' | 'PHYSICAL_CARD') {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.creditLedger)
      .where('tenantId', '==', tenantId)
      .where('membershipId', '==', membershipId)
      .where('format', '==', format)
      .where('type', '==', 'ISSUE')
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<CreditLedgerEntry>(doc.id, doc.data())
  },

  async findIssueByNumber(tenantId: string, membershipNumberId: string, format: 'QR_CODE' | 'PHYSICAL_CARD') {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.creditLedger)
      .where('tenantId', '==', tenantId)
      .where('membershipNumberId', '==', membershipNumberId)
      .where('format', '==', format)
      .where('type', '==', 'ISSUE')
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<CreditLedgerEntry>(doc.id, doc.data())
  },

  async findByPaymentId(paymentId: string): Promise<CreditLedgerEntry | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.creditLedger)
      .where('paymentId', '==', paymentId)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<CreditLedgerEntry>(doc.id, doc.data())
  },

  async findById(id: string): Promise<CreditLedgerEntry | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.creditLedger).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<CreditLedgerEntry>(id, docRef.data()!)
  },

  async update(id: string, data: Partial<CreditLedgerEntry>): Promise<CreditLedgerEntry> {
    const db = getDb()
    await db.collection(COLLECTIONS.creditLedger).doc(id).update(toFirestoreData(data as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },
}
