import { getDb, Timestamp } from './firebase'
import { FieldValue } from 'firebase-admin/firestore'

export interface Member {
  id: string
  name: string
  email: string
  phone: string
  createdAt: Date
  updatedAt: Date
}

export interface MembershipNumber {
  id: string
  cardNumber: number
  batchId?: string
  isAssigned: boolean
  assignedAt?: Date
  createdAt: Date
}

export interface SubscriptionPlan {
  id: string
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
  memberId: string
  membershipNumberId: string
  subscriptionPlanId: string
  cardType: 'QR_CODE' | 'PHYSICAL_CARD'
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
  startDate?: Date
  expiryDate?: Date
  paymentId?: string
  paymentMethod?: 'CARD' | 'OPEN_BANKING'
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  tillSystemEnabled: boolean
  tillSystemEnabledAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CardIssuance {
  id: string
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
  membershipId?: string
  amount: number
  currency: string
  paymentMethod: 'CARD' | 'OPEN_BANKING'
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
  isActive: boolean
  createdAt: Date
  updatedAt: Date
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

export const membersCollection = {
  async create(data: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>): Promise<Member> {
    const db = getDb()
    const docRef = db.collection(COLLECTIONS.members).doc()
    const now = new Date()
    const member: Member = { ...data, id: docRef.id, createdAt: now, updatedAt: now }
    await docRef.set(toFirestoreData(member as unknown as Record<string, unknown>))
    return member
  },

  async findById(id: string): Promise<Member | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.members).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<Member>(id, docRef.data()!)
  },

  async findByEmail(email: string): Promise<Member | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.members)
      .where('email', '==', email)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<Member>(doc.id, doc.data())
  },

  async findMany(options: { 
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
    let members = snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Member>(d.id, d.data())
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
    
    return { members, total: countSnapshot.data().count }
  },

  async update(id: string, data: Partial<Member>): Promise<Member> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
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
  async createMany(numbers: Array<{ cardNumber: number; batchId?: string }>): Promise<number> {
    const db = getDb()
    const batch = db.batch()
    const now = new Date()
    
    for (const num of numbers) {
      const docRef = db.collection(COLLECTIONS.membershipNumbers).doc()
      const data: MembershipNumber = {
        id: docRef.id,
        cardNumber: num.cardNumber,
        batchId: num.batchId,
        isAssigned: false,
        createdAt: now,
      }
      batch.set(docRef, toFirestoreData(data as unknown as Record<string, unknown>))
    }
    
    await batch.commit()
    return numbers.length
  },

  async findByCardNumber(cardNumber: number): Promise<MembershipNumber | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('cardNumber', '==', cardNumber)
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<MembershipNumber>(doc.id, doc.data())
  },

  async findFirstAvailable(): Promise<MembershipNumber | null> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.membershipNumbers)
      .where('isAssigned', '==', false)
      .orderBy('cardNumber', 'asc')
      .limit(1)
      .get()
    if (snapshot.empty) return null
    const doc = snapshot.docs[0]
    return fromFirestoreData<MembershipNumber>(doc.id, doc.data())
  },

  async findById(id: string): Promise<MembershipNumber | null> {
    const db = getDb()
    const docRef = await db.collection(COLLECTIONS.membershipNumbers).doc(id).get()
    if (!docRef.exists) return null
    return fromFirestoreData<MembershipNumber>(id, docRef.data()!)
  },

  async findMany(options: {
    assigned?: boolean
    batchId?: string
    skip?: number
    take?: number
  } = {}): Promise<{ numbers: MembershipNumber[]; total: number; stats: { total: number; assigned: number; available: number } }> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.membershipNumbers)
      .orderBy('cardNumber', 'asc')
    
    if (options.assigned !== undefined) {
      query = query.where('isAssigned', '==', options.assigned)
    }
    if (options.batchId) {
      query = query.where('batchId', '==', options.batchId)
    }
    if (options.take) {
      query = query.limit(options.take)
    }

    const snapshot = await query.get()
    const numbers = snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<MembershipNumber>(d.id, d.data())
    )

    const [totalCount, assignedCount, availableCount] = await Promise.all([
      db.collection(COLLECTIONS.membershipNumbers).count().get(),
      db.collection(COLLECTIONS.membershipNumbers).where('isAssigned', '==', true).count().get(),
      db.collection(COLLECTIONS.membershipNumbers).where('isAssigned', '==', false).count().get(),
    ])
    
    const stats = {
      total: totalCount.data().count,
      assigned: assignedCount.data().count,
      available: availableCount.data().count,
    }

    return { numbers, total: snapshot.size, stats }
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

  async findMany(activeOnly: boolean = false): Promise<SubscriptionPlan[]> {
    const db = getDb()
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.subscriptionPlans)
      .orderBy('durationYears', 'asc')
    if (activeOnly) {
      query = query.where('isActive', '==', true)
    }
    const snapshot = await query.get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<SubscriptionPlan>(d.id, d.data())
    )
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
    const memberships = snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Membership>(d.id, d.data())
    )

    const countSnapshot = await db.collection(COLLECTIONS.memberships).count().get()
    
    return { memberships, total: countSnapshot.data().count }
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

  async findExpired(): Promise<Membership[]> {
    const db = getDb()
    const now = new Date()
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', 'ACTIVE')
      .where('expiryDate', '<', Timestamp.fromDate(now))
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Membership>(d.id, d.data())
    )
  },

  async findExpiringInRange(startDays: number, endDays: number): Promise<Membership[]> {
    const db = getDb()
    const now = new Date()
    const startDate = new Date(now.getTime() + startDays * 24 * 60 * 60 * 1000)
    const endDate = new Date(now.getTime() + endDays * 24 * 60 * 60 * 1000)
    
    const snapshot = await db.collection(COLLECTIONS.memberships)
      .where('status', '==', 'ACTIVE')
      .where('expiryDate', '>=', Timestamp.fromDate(startDate))
      .where('expiryDate', '<=', Timestamp.fromDate(endDate))
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<Membership>(d.id, d.data())
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
    const issuances = snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<CardIssuance>(d.id, d.data())
    )

    const countSnapshot = await db.collection(COLLECTIONS.cardIssuances).count().get()
    
    return { issuances, total: countSnapshot.data().count }
  },

  async findByStatuses(statuses: string[]): Promise<CardIssuance[]> {
    const db = getDb()
    const snapshot = await db.collection(COLLECTIONS.cardIssuances)
      .where('queueStatus', 'in', statuses)
      .orderBy('createdAt', 'asc')
      .get()
    return snapshot.docs.map((d: FirebaseFirestore.QueryDocumentSnapshot) => 
      fromFirestoreData<CardIssuance>(d.id, d.data())
    )
  },

  async update(id: string, data: Partial<CardIssuance>): Promise<CardIssuance> {
    const db = getDb()
    const updateData = { ...data, updatedAt: new Date() }
    await db.collection(COLLECTIONS.cardIssuances).doc(id).update(toFirestoreData(updateData as Record<string, unknown>))
    const updated = await this.findById(id)
    return updated!
  },

  async countByStatus(): Promise<Record<string, number>> {
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
