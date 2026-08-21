import {
  membershipsCollection,
  membersCollection,
  paymentTransactionsCollection,
  subscriptionPlansCollection,
  type PaymentTransaction,
} from '@/lib/db'

export function londonDateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function inRange(key: string, start: string, end: string) {
  return key >= start && key <= end
}

export function reportingWindows(now = new Date()) {
  const today = londonDateKey(now)
  const [year, month] = today.split('-').map(Number)
  const previous = shiftMonth(year, month, -1)
  const lastMonthEnd = `${monthKey(previous.year, previous.month)}-${String(lastDayOfMonth(previous.year, previous.month)).padStart(2, '0')}`

  return {
    today,
    year,
    month,
    todayRange: { start: today, end: today, label: 'Today' },
    mtd: { start: `${monthKey(year, month)}-01`, end: today, label: 'Month to date' },
    lastMonth: {
      start: `${monthKey(previous.year, previous.month)}-01`,
      end: lastMonthEnd,
      label: 'Last month',
    },
    ytd: { start: `${year}-01-01`, end: today, label: 'Year to date' },
    lastYear: {
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
      label: 'Last year',
    },
    allTime: { start: '0000-01-01', end: today, label: 'All time' },
  }
}

function emptyBucket() {
  return { revenue: 0, paidCount: 0, complimentaryCount: 0, average: 0 }
}

function addSale(
  bucket: ReturnType<typeof emptyBucket>,
  amount: number,
  complimentary: boolean
) {
  if (complimentary) {
    bucket.complimentaryCount += 1
    return
  }
  bucket.paidCount += 1
  bucket.revenue += amount
  bucket.average = bucket.paidCount ? bucket.revenue / bucket.paidCount : 0
}

function saleDate(transaction: PaymentTransaction) {
  return transaction.updatedAt || transaction.createdAt
}

function isComplimentary(transaction: PaymentTransaction) {
  return transaction.paymentMethod === 'COMPLIMENTARY' || transaction.amount === 0
}

export async function subscriptionFinance(tenantId: string, now = new Date()) {
  const windows = reportingWindows(now)
  const [transactions, membersResult, membershipsResult] = await Promise.all([
    paymentTransactionsCollection.findByTenantId(tenantId),
    membersCollection.findMany({ tenantId }),
    membershipsCollection.findMany({ tenantId, status: 'ACTIVE' }),
  ])

  const completed = transactions.filter(
    (transaction) => transaction.status === 'COMPLETED' && !transaction.creditPurchase
  )

  const membershipIds = [
    ...new Set(completed.map((transaction) => transaction.membershipId).filter(Boolean)),
  ] as string[]
  const memberships = (
    await Promise.all(membershipIds.map((id) => membershipsCollection.findById(id)))
  ).filter((membership): membership is NonNullable<typeof membership> => Boolean(membership))
  const membershipById = new Map(memberships.map((membership) => [membership.id, membership]))
  const planIds = [...new Set(memberships.map((membership) => membership.subscriptionPlanId))]
  const plans = (
    await Promise.all(planIds.map((id) => subscriptionPlansCollection.findById(id)))
  ).filter((plan): plan is NonNullable<typeof plan> => Boolean(plan))
  const planById = new Map(plans.map((plan) => [plan.id, plan]))

  const sales = completed.map((transaction) => {
    const membership = transaction.membershipId ? membershipById.get(transaction.membershipId) : undefined
    const plan = membership ? planById.get(membership.subscriptionPlanId) : undefined
    return {
      amount: transaction.amount || 0,
      currency: transaction.currency || 'GBP',
      complimentary: isComplimentary(transaction),
      paymentMethod: transaction.paymentMethod,
      dateKey: londonDateKey(saleDate(transaction)),
      planId: plan?.id || 'unknown',
      planName: plan?.name || 'Unknown plan',
    }
  })

  const summarise = (start: string, end: string) => {
    const bucket = emptyBucket()
    const methodMap = new Map<string, { method: string; count: number; revenue: number }>()
    for (const sale of sales) {
      if (!inRange(sale.dateKey, start, end)) continue
      addSale(bucket, sale.amount, sale.complimentary)
      const method = sale.complimentary ? 'COMPLIMENTARY' : sale.paymentMethod || 'OPEN_BANKING'
      const current = methodMap.get(method) || { method, count: 0, revenue: 0 }
      current.count += 1
      if (!sale.complimentary) current.revenue += sale.amount
      methodMap.set(method, current)
    }
    return {
      ...bucket,
      byMethod: [...methodMap.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count),
    }
  }

  const periods = {
    today: { ...windows.todayRange, ...summarise(windows.todayRange.start, windows.todayRange.end) },
    mtd: { ...windows.mtd, ...summarise(windows.mtd.start, windows.mtd.end) },
    lastMonth: { ...windows.lastMonth, ...summarise(windows.lastMonth.start, windows.lastMonth.end) },
    ytd: { ...windows.ytd, ...summarise(windows.ytd.start, windows.ytd.end) },
    lastYear: { ...windows.lastYear, ...summarise(windows.lastYear.start, windows.lastYear.end) },
    allTime: { ...windows.allTime, ...summarise(windows.allTime.start, windows.allTime.end) },
  }

  const months = Array.from({ length: windows.month }, (_, index) => {
    const month = index + 1
    const start = `${monthKey(windows.year, month)}-01`
    const end =
      month === windows.month
        ? windows.today
        : `${monthKey(windows.year, month)}-${String(lastDayOfMonth(windows.year, month)).padStart(2, '0')}`
    const label = new Date(Date.UTC(windows.year, month - 1, 15)).toLocaleDateString('en-GB', {
      month: 'short',
    })
    return { key: monthKey(windows.year, month), label, ...summarise(start, end) }
  })

  const byPlanMap = new Map<string, { planId: string; planName: string } & ReturnType<typeof emptyBucket>>()
  for (const sale of sales) {
    if (!inRange(sale.dateKey, windows.ytd.start, windows.ytd.end)) continue
    const current = byPlanMap.get(sale.planId) || {
      planId: sale.planId,
      planName: sale.planName,
      ...emptyBucket(),
    }
    addSale(current, sale.amount, sale.complimentary)
    byPlanMap.set(sale.planId, current)
  }

  const byMethodMap = new Map<string, { method: string } & ReturnType<typeof emptyBucket>>()
  for (const sale of sales) {
    if (!inRange(sale.dateKey, windows.ytd.start, windows.ytd.end)) continue
    const method = sale.complimentary ? 'COMPLIMENTARY' : sale.paymentMethod || 'OPEN_BANKING'
    const current = byMethodMap.get(method) || { method, ...emptyBucket() }
    addSale(current, sale.amount, sale.complimentary)
    byMethodMap.set(method, current)
  }

  return {
    currency: sales.find((sale) => sale.currency)?.currency || 'GBP',
    timezone: 'Europe/London',
    asOf: windows.today,
    counts: {
      members: membersResult.total,
      activeMemberships: membershipsResult.memberships.length,
    },
    periods,
    months,
    byPlan: [...byPlanMap.values()].sort((a, b) => b.revenue - a.revenue || b.paidCount - a.paidCount),
    byMethod: [...byMethodMap.values()].sort((a, b) => b.revenue - a.revenue),
  }
}
