'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

interface CardNumber {
  id: string
  cardNumber: number
  batchId?: string
  isAssigned: boolean
  assignedAt?: string
  membership?: {
    member: {
      name: string
    }
  }
}

export default function CardNumbersPage() {
  const [cardNumbers, setCardNumbers] = useState<CardNumber[]>([])
  const [stats, setStats] = useState({ total: 0, assigned: 0, available: 0 })
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importData, setImportData] = useState({ startNumber: '', endNumber: '', batchId: '' })
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [filter, setFilter] = useState<'all' | 'assigned' | 'available'>('all')
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  const fetchCardNumbers = async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '50' })
      if (filter === 'assigned') params.set('assigned', 'true')
      if (filter === 'available') params.set('assigned', 'false')
      
      const res = await fetch(`/api/card-numbers?${params}`)
      const data = await res.json()
      
      setCardNumbers(data.cardNumbers || [])
      setStats(data.stats || { total: 0, assigned: 0, available: 0 })
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
    } catch (error: any) {
      setImportResult({ success: false, error: error.message })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Card Numbers</h1>
          <p className="text-gray-500 mt-1">Manage membership card number inventory</p>
        </div>
        <Button onClick={() => setShowImportModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Import Numbers
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Numbers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
              <p className="text-sm text-gray-500">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.assigned}</p>
              <p className="text-sm text-gray-500">Assigned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Filter:</span>
            <div className="flex gap-2">
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
                  <div
                    key={num.id}
                    className={`p-3 rounded-lg border text-center ${
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
                      variant={num.isAssigned ? 'info' : 'success'}
                      className="mt-1"
                    >
                      {num.isAssigned ? 'Assigned' : 'Available'}
                    </Badge>
                  </div>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Showing {cardNumbers.length} of {pagination.total} numbers
                  </p>
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
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
            Import a sequential range of card numbers. These numbers should match the numbers printed on your physical membership cards.
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
