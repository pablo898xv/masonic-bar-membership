'use client'

import { useEffect, useState } from 'react'
import { CampaignSignupReportView } from '@/components/admin/campaign-report'
import { FinanceBreakdown, FinancePeriodGrid, type SubscriptionReport } from '@/components/admin/finance-summary'
import type { CampaignSignupReport } from '@/lib/campaign-report'

export default function ReportsPage() {
  const [report, setReport] = useState<SubscriptionReport | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignSignupReport | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const [salesRes, campaignRes] = await Promise.all([
          fetch('/api/reports/subscriptions'),
          fetch('/api/reports/campaigns'),
        ])
        const sales = await salesRes.json()
        const campaignData = await campaignRes.json()
        if (!salesRes.ok) throw new Error(sales.error || 'Failed to load report')
        if (!campaignRes.ok) throw new Error(campaignData.error || 'Failed to load campaign report')
        setReport(sales)
        setCampaigns(campaignData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">
          Subscription sales and campaign sign-ups for the current venue. Figures use Europe/London dates
          and exclude credit-pack purchases.
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {report && (
        <>
          <p className="text-sm text-gray-500">
            {report.venue.name} · as of {report.asOf}
          </p>
          <FinancePeriodGrid report={report} />
          <FinanceBreakdown report={report} />
        </>
      )}

      {campaigns && (
        <div id="campaigns" className="scroll-mt-24">
          <CampaignSignupReportView report={campaigns} currency={report?.currency || 'GBP'} />
        </div>
      )}
    </div>
  )
}
