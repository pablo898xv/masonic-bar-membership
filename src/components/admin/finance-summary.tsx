'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatGbp, methodLabel } from '@/lib/money'

export type FinanceMethodRow = {
  method: string
  count: number
  revenue: number
}

export type FinancePeriod = {
  label: string
  revenue: number
  paidCount: number
  complimentaryCount: number
  average: number
  byMethod?: FinanceMethodRow[]
}

export type SubscriptionReport = {
  venue: { id: string; name: string }
  currency: string
  timezone: string
  asOf: string
  counts: { members: number; activeMemberships: number }
  periods: {
    today: FinancePeriod
    mtd: FinancePeriod
    lastMonth: FinancePeriod
    ytd: FinancePeriod
    lastYear: FinancePeriod
    allTime: FinancePeriod
  }
  months: Array<FinancePeriod & { key: string }>
  byPlan: Array<FinancePeriod & { planId: string; planName: string }>
  byMethod: Array<FinancePeriod & { method: string }>
}

function PeriodCard({
  period,
  currency,
  href,
}: {
  period: FinancePeriod
  currency: string
  href?: string
}) {
  const methods = period.byMethod || []
  const card = (
    <Card className={href ? 'h-full transition-shadow group-hover:shadow-md group-hover:border-blue-200' : ''}>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-gray-500">{period.label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{formatGbp(period.revenue, currency)}</p>
        <p className="text-sm text-gray-500 mt-2">
          {period.paidCount} paid membership{period.paidCount === 1 ? '' : 's'}
          {period.complimentaryCount ? ` · ${period.complimentaryCount} complimentary` : ''}
        </p>
        {period.paidCount > 0 && (
          <p className="text-xs text-gray-400 mt-1">Avg {formatGbp(period.average, currency)}</p>
        )}
        {methods.length > 0 && (
          <ul className="mt-3 space-y-1">
            {methods.map((row) => (
              <li key={row.method} className="flex justify-between gap-3 text-xs text-gray-500">
                <span>{methodLabel(row.method)}</span>
                <span className="shrink-0">
                  {row.method === 'COMPLIMENTARY'
                    ? `${row.count} comp`
                    : `${formatGbp(row.revenue, currency)} · ${row.count}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {href && <p className="text-sm text-blue-600 mt-3 group-hover:underline">View payments →</p>}
      </CardContent>
    </Card>
  )

  if (!href) return card
  return (
    <Link href={href} className="block group h-full">
      {card}
    </Link>
  )
}

export function FinancePeriodGrid({
  report,
  compact = false,
  href,
}: {
  report: SubscriptionReport
  compact?: boolean
  href?: string
}) {
  const items = compact
    ? [report.periods.mtd, report.periods.ytd, report.periods.lastMonth, report.periods.allTime]
    : [
        report.periods.today,
        report.periods.mtd,
        report.periods.lastMonth,
        report.periods.ytd,
        report.periods.lastYear,
        report.periods.allTime,
      ]

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
      {items.map((period) => (
        <PeriodCard key={period.label} period={period} currency={report.currency} href={href} />
      ))}
    </div>
  )
}

export function FinanceBreakdown({ report }: { report: SubscriptionReport }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Year to date by month</h2>
        </CardHeader>
        <CardContent>
          {report.months.length === 0 ? (
            <p className="text-sm text-gray-500">No subscription sales yet this year.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full min-w-[20rem] text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 font-medium">Month</th>
                  <th className="py-2 font-medium text-right">Paid</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.months.map((month) => (
                  <tr key={month.key} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{month.label}</td>
                    <td className="py-2 text-right text-gray-600">{month.paidCount}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatGbp(month.revenue, report.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Year to date by plan</h2>
        </CardHeader>
        <CardContent>
          {report.byPlan.length === 0 ? (
            <p className="text-sm text-gray-500">No paid or complimentary plans recorded this year.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full min-w-[24rem] text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 font-medium">Plan</th>
                  <th className="py-2 font-medium text-right">Paid</th>
                  <th className="py-2 font-medium text-right">Comp</th>
                  <th className="py-2 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.byPlan.map((plan) => (
                  <tr key={plan.planId} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">{plan.planName}</td>
                    <td className="py-2 text-right text-gray-600">{plan.paidCount}</td>
                    <td className="py-2 text-right text-gray-600">{plan.complimentaryCount}</td>
                    <td className="py-2 text-right font-medium text-gray-900">
                      {formatGbp(plan.revenue, report.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Year to date by payment method</h2>
        </CardHeader>
        <CardContent>
          {report.byMethod.length === 0 ? (
            <p className="text-sm text-gray-500">No payments recorded this year.</p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {report.byMethod.map((row) => (
                <div key={row.method} className="rounded-lg border border-gray-200 px-4 py-3 min-w-[12rem]">
                  <p className="text-sm text-gray-500">{methodLabel(row.method)}</p>
                  <p className="text-xl font-semibold text-gray-900 mt-1">
                    {formatGbp(row.revenue, report.currency)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {row.paidCount} paid
                    {row.complimentaryCount ? ` · ${row.complimentaryCount} complimentary` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
