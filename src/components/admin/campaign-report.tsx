'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatGbp } from '@/lib/money'
import type { CampaignSignupReport, CampaignSignupRow } from '@/lib/campaign-report'

function percent(value: number | null) {
  if (value == null) return '—'
  return `${Math.round(value * 100)}%`
}

function SummaryTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        {detail ? <p className="text-xs text-gray-500 mt-1">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}

function CampaignTable({ rows, currency }: { rows: CampaignSignupRow[]; currency: string }) {
  if (!rows.length) {
    return <p className="text-sm text-gray-500">No signup campaigns yet. Create one in Venue settings.</p>
  }

  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4 font-medium">Campaign</th>
            <th className="py-2 pr-4 font-medium text-right">Link opens</th>
            <th className="py-2 pr-4 font-medium text-right">Members</th>
            <th className="py-2 pr-4 font-medium text-right">Started</th>
            <th className="py-2 pr-4 font-medium text-right">Pending</th>
            <th className="py-2 pr-4 font-medium text-right">Paid</th>
            <th className="py-2 pr-4 font-medium text-right">Paid of opens</th>
            <th className="py-2 pr-4 font-medium text-right">Paid of started</th>
            <th className="py-2 font-medium text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100">
              <td className="py-3 pr-4 align-top">
                <p className="font-medium text-gray-900">{row.name}</p>
                <div className="mt-1">
                  <Badge variant={row.status === 'ACTIVE' ? 'success' : 'default'}>
                    {row.status === 'ACTIVE' ? 'Active' : 'Ended'}
                  </Badge>
                </div>
              </td>
              <td className="py-3 pr-4 text-right text-gray-900">{row.linkOpens}</td>
              <td className="py-3 pr-4 text-right text-gray-900">{row.members}</td>
              <td className="py-3 pr-4 text-right text-gray-900">{row.started}</td>
              <td className="py-3 pr-4 text-right text-gray-600">{row.pending}</td>
              <td className="py-3 pr-4 text-right font-medium text-gray-900">{row.paid}</td>
              <td className="py-3 pr-4 text-right text-gray-600">{percent(row.paidOfOpens)}</td>
              <td className="py-3 pr-4 text-right text-gray-600">{percent(row.paidOfStarted)}</td>
              <td className="py-3 text-right font-medium text-gray-900">{formatGbp(row.revenue, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CampaignSignupReportView({
  report,
  currency = 'GBP',
}: {
  report: CampaignSignupReport
  currency?: string
}) {
  const { totals } = report
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Campaign sign-ups</h2>
        <p className="text-sm text-gray-500 mt-1">
          Link opens count each time someone uses a campaign QR or link. Paid is a completed membership
          from that campaign. Figures from before tracking started will show as zero.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryTile label="Link opens" value={String(totals.linkOpens)} />
        <SummaryTile label="Members" value={String(totals.members)} detail="New people via campaign" />
        <SummaryTile label="Started" value={String(totals.started)} detail={`${totals.pending} awaiting payment`} />
        <SummaryTile
          label="Paid"
          value={String(totals.paid)}
          detail={`${percent(totals.paidOfStarted)} of started`}
        />
        <SummaryTile
          label="Revenue"
          value={formatGbp(totals.revenue, currency)}
          detail={`${percent(totals.paidOfOpens)} of opens`}
        />
      </div>
      <CampaignTable rows={report.campaigns} currency={currency} />
    </div>
  )
}
