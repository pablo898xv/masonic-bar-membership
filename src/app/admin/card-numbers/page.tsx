'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'
import { isMsrx6Cancelled } from '@/lib/msrx6/device'
import { withMagstripeSentinels } from '@/lib/msrx6/protocol'

interface CardNumber {
  id: string
  cardNumber: number
  batchId?: string
  pool?: 'PHYSICAL' | 'QR'
  isAssigned: boolean
  assignedAt?: string
  magstripeData: string
  canEncode?: boolean
  membership?: {
    id: string
    status: string
    cardType: string
    member: {
      name: string
    }
  } | null
  cardIssuance?: {
    id: string
    queueStatus: string
  } | null
}

export default function CardNumbersPage() {
  const [cardNumbers, setCardNumbers] = useState<CardNumber[]>([])
  const [stats, setStats] = useState({ total: 0, assigned: 0, available: 0, qrTotal: 0 })
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState({ startNumber: '', endNumber: '', batchId: '' })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: boolean; error?: string; imported?: number; skipped?: number } | null>(null)
  const [filter, setFilter] = useState<'all' | 'assigned' | 'available'>('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [selected, setSelected] = useState<CardNumber | null>(null)
  const [encodeMessage, setEncodeMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const writer = useMsrx6()

  const closeEncodeModal = () => {
    void writer.cancelOperation()
    setSelected(null)
    setEncodeMessage(null)
    setActionLoading(false)
  }

  const fetchCardNumbers = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' })
      if (filter === 'assigned') params.set('assigned', 'true')
      if (filter === 'available') params.set('assigned', 'false')
      
      const res = await fetch(`/api/card-numbers?${params}`)
      const data = await res.json()
      
      setCardNumbers(data.cardNumbers || [])
      setStats(data.stats || { total: 0, assigned: 0, available: 0, qrTotal: 0 })
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Error fetching card numbers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCardNumbers()
  }, [filter])

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setImporting(true)
    setImportResult(null)

    try {
      const res = await fetch('/api/card-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startNumber: parseInt(importData.startNumber),
          endNumber: parseInt(importData.endNumber),
          batchId: importData.batchId || undefined
        })
      })

      const data = await res.json()
      
      if (!res.ok) {
        setImportResult({ success: false, error: data.error })
      } else {
        setImportResult({ success: true, ...data })
        fetchCardNumbers()
      }
    } catch (error) {
      setImportResult({ success: false, error: error instanceof Error ? error.message : 'Import failed' })
    } finally {
      setImporting(false)
    }
  }

  const markEncodedIfQueued = async (card: CardNumber) => {
    if (card.cardIssuance?.queueStatus !== 'READY_TO_ENCODE') return
    const res = await fetch(`/api/card-issuance/${card.cardIssuance.id}/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encodedBy: writer.connected ? 'MSRx6' : 'Bar Manager',
        notes: writer.connected
          ? `MSRx6 ${writer.transport || 'bluetooth'} ${writer.coercivity}, encoded from card numbers`
          : 'Marked encoded from card numbers',
      }),
    })
    if (!res.ok) throw new Error('Wrote the card, but failed to mark it encoded in the queue')
  }

  const handleWriterEncode = async (card: CardNumber) => {
    if (card.canEncode === false) {
      setEncodeMessage('This membership has not been paid. Encode is blocked until payment is completed.')
      return
    }
    setActionLoading(true)
    setEncodeMessage('Sending write command. Swipe the blank card through the MSRx6 now.')
    try {
      await writer.encodeCard(card.magstripeData)
      await markEncodedIfQueued(card)
      setEncodeMessage('Card encoded.')
      setSelected(null)
      fetchCardNumbers(pagination.page)
    } catch (error) {
      if (isMsrx6Cancelled(error)) {
        setEncodeMessage(null)
        return
      }
      const message = error instanceof Error ? error.message : 'Writer encode failed'
      setEncodeMessage(message)
      writer.setError(message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleManualEncode = async (card: CardNumber) => {
    if (card.canEncode === false) {
      setEncodeMessage('This membership has not been paid. Encode is blocked until payment is completed.')
      return
    }
    setActionLoading(true)
    try {
      await markEncodedIfQueued(card)
      setSelected(null)
      fetchCardNumbers(pagination.page)
    } catch (error) {
      setEncodeMessage(error instanceof Error ? error.message : 'Failed to mark encoded')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Card Numbers</h1>
          <p className="text-gray-500 mt-1">
            Printed physical stock. QR-only memberships use a separate range set in Venue settings, so they do not take these numbers.
          </p>
        </div>
        <Button onClick={() => setShowImportModal(true)} className="w-full sm:w-auto">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import Numbers
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Physical stock</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              <p className="text-sm text-gray-500">Physical available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
              <p className="text-sm text-gray-500">Physical assigned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.qrTotal}</p>
              <p className="text-sm text-gray-500">QR-only numbers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-gray-500">Filter:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={filter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === 'available' ? 'primary' : 'ghost'}
                onClick={() => setFilter('available')}
              >
                Available
              </Button>
              <Button
                size="sm"
                variant={filter === 'assigned' ? 'primary' : 'ghost'}
                onClick={() => setFilter('assigned')}
              >
                Assigned
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : cardNumbers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No card numbers found</p>
              <Button onClick={() => setShowImportModal(true)} className="mt-4">
                Import card numbers
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {cardNumbers.map((num) => (
                  <button
                    key={num.id}
                    type="button"
                    onClick={() => {
                      setEncodeMessage(null)
                      setSelected(num)
                      if (num.pool === 'QR') return
                      if (num.canEncode !== false && writer.connected) {
                        void handleWriterEncode(num)
                      }
                    }}
                    className={`p-3 rounded-lg border text-center w-full transition-shadow hover:shadow-md ${
                      num.isAssigned
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <p className="font-mono font-bold text-lg">{num.cardNumber}</p>
                    {num.isAssigned && num.membership?.member && (
                      <p className="text-xs text-gray-600 truncate">
                        {num.membership.member.name}
                      </p>
                    )}
                    <Badge
                      variant={
                        num.pool === 'QR'
                          ? 'default'
                          : !num.isAssigned
                            ? 'success'
                            : num.membership?.status === 'PENDING_PAYMENT'
                              ? 'warning'
                              : 'info'
                      }
                      className="mt-1"
                    >
                      {num.pool === 'QR'
                        ? 'QR only'
                        : !num.isAssigned
                          ? 'Available'
                          : num.membership?.status === 'PENDING_PAYMENT'
                            ? 'Unpaid'
                            : 'Assigned'}
                    </Badge>
                    {num.pool !== 'QR' && (
                      <p className="text-xs text-blue-700 mt-2">
                        {num.isAssigned && num.canEncode === false ? 'Awaiting payment' : 'Encode'}
                      </p>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Showing {cardNumbers.length} of {pagination.total} numbers
                  {pagination.totalPages > 1 ? ` · page ${pagination.page} of ${pagination.totalPages}` : ''}
                </p>
                {pagination.totalPages > 1 && (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => fetchCardNumbers(pagination.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page === pagination.totalPages}
                      onClick={() => fetchCardNumbers(pagination.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={!!selected}
        onClose={closeEncodeModal}
        title={
          selected
            ? selected.pool === 'QR'
              ? `QR number #${selected.cardNumber}`
              : `Encode card #${selected.cardNumber}`
            : 'Encode card'
        }
      >
        {selected && selected.pool === 'QR' ? (
          <div className="space-y-4">
            {selected.membership?.member && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Assigned to</p>
                <p className="font-medium">{selected.membership.member.name}</p>
              </div>
            )}
            <p className="text-sm text-gray-600">
              This number is from the QR-only range. It is not printed physical stock. Encode a plastic card from the membership page if you later issue one — that writes this number to a blank card rather than using imported stock.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={closeEncodeModal}>
                Close
              </Button>
              {selected.membership?.id && (
                <Link href={`/admin/memberships/${selected.membership.id}`}>
                  <Button>Open membership</Button>
                </Link>
              )}
            </div>
          </div>
        ) : selected && selected.canEncode === false ? (
          <div className="space-y-4">
            {selected.membership?.member && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Assigned to</p>
                <p className="font-medium">{selected.membership.member.name}</p>
              </div>
            )}
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              This membership has not been paid. Encoding and QR issue stay blocked until an admin records payment on the membership.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={closeEncodeModal}>
                Close
              </Button>
              {selected.membership?.id && (
                <Link href={`/admin/memberships/${selected.membership.id}`}>
                  <Button>Open membership</Button>
                </Link>
              )}
            </div>
          </div>
        ) : selected && (
          <div className="space-y-4">
            {selected.membership?.member && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Assigned to</p>
                <p className="font-medium">{selected.membership.member.name}</p>
              </div>
            )}
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-sm text-yellow-700">Magstripe data (till swipe):</p>
              <p className="text-2xl font-mono font-bold text-yellow-900 mt-1">
                {withMagstripeSentinels(selected.magstripeData)}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Swipe the physical card with <strong>#{selected.cardNumber}</strong> printed on the back.
              {writer.connected
                ? ' Swipe once to encode, then swipe again to verify.'
                : ' Connect the MSRx6 from the bar at the top of the page, or write this data in EasyMSR.'}
            </p>
            {selected.cardIssuance?.queueStatus === 'READY_TO_ENCODE' && (
              <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
                This card is in the encode queue. A successful write will mark it encoded.
              </p>
            )}
            {encodeMessage && (
              <p className={`text-sm rounded-lg p-3 ${
                actionLoading || writer.phase === 'writing' || writer.phase === 'verifying'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {writer.phase === 'writing' && 'Swipe the blank card through the writer now. '}
                {writer.phase === 'verifying' && 'Write succeeded. Swipe the same card again to verify. '}
                {encodeMessage}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={closeEncodeModal}>
                Cancel
              </Button>
              {selected.cardIssuance?.queueStatus === 'READY_TO_ENCODE' && (
                <Button variant="ghost" onClick={() => handleManualEncode(selected)} loading={actionLoading}>
                  Mark encoded manually
                </Button>
              )}
              {writer.connected && (
                <Button onClick={() => handleWriterEncode(selected)} loading={actionLoading}>
                  {writer.phase === 'writing' || writer.phase === 'verifying' ? 'Waiting for swipe…' : 'Retry write'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false)
          setImportResult(null)
          setImportData({ startNumber: '', endNumber: '', batchId: '' })
        }}
        title="Import Card Numbers"
      >
        <form onSubmit={handleImport} className="space-y-4">
          <p className="text-sm text-gray-600">
            Import a sequential range of numbers printed on your physical membership cards. QR-only memberships do not use this stock — set their starting number in Venue settings.
          </p>
          
          {importResult && (
            <div className={`p-3 rounded-lg ${importResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {importResult.success ? (
                <>
                  <p className="font-medium">Import successful!</p>
                  <p className="text-sm">{importResult.imported} numbers imported, {importResult.skipped} skipped (already exist)</p>
                </>
              ) : (
                <p>{importResult.error}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Number"
              type="number"
              value={importData.startNumber}
              onChange={(e) => setImportData({ ...importData, startNumber: e.target.value })}
              placeholder="e.g., 1500"
              required
            />
            <Input
              label="End Number"
              type="number"
              value={importData.endNumber}
              onChange={(e) => setImportData({ ...importData, endNumber: e.target.value })}
              placeholder="e.g., 2000"
              required
            />
          </div>
          <Input
            label="Batch ID (optional)"
            value={importData.batchId}
            onChange={(e) => setImportData({ ...importData, batchId: e.target.value })}
            placeholder="e.g., batch-2024-01"
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowImportModal(false)
                setImportResult(null)
              }}
            >
              Close
            </Button>
            <Button type="submit" loading={importing}>
              Import Numbers
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
