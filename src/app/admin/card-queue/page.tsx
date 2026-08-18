'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

interface CardIssuance {
  id: string
  queueStatus: string
  magstripeData: string
  encodedAt?: string
  issuedAt?: string
  notes?: string
  membership: {
    id: string
    cardType: string
    member: {
      name: string
      email: string
      phone: string
    }
    membershipNumber: {
      cardNumber: number
    }
    subscriptionPlan: {
      name: string
    }
  }
}

interface QueueData {
  queue: {
    readyToEncode: CardIssuance[]
    encoded: CardIssuance[]
    pending: CardIssuance[]
    issued: CardIssuance[]
  }
  summary: {
    total: number
    readyToEncode: number
    encoded: number
    pending: number
    actionRequired: number
  }
  encodingInstructions: {
    prefix: string
    format: string
    example: string
    note: string
  }
}

export default function CardQueuePage() {
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardIssuance | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const fetchQueue = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/card-issuance/queue?includeCompleted=false')
      const data = await res.json()
      setQueueData(data)
    } catch (error) {
      console.error('Error fetching queue:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const handleEncode = async (issuance: CardIssuance) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/card-issuance/${issuance.id}/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encodedBy: 'Bar Manager' })
      })

      if (!res.ok) throw new Error('Failed to mark as encoded')
      
      await fetchQueue()
      setSelectedCard(null)
    } catch (error) {
      console.error('Error encoding card:', error)
      alert('Failed to mark card as encoded')
    } finally {
      setActionLoading(false)
    }
  }

  const handleIssue = async (issuance: CardIssuance) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/card-issuance/${issuance.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuedBy: 'Bar Manager' })
      })

      if (!res.ok) throw new Error('Failed to issue card')
      
      const tollRes = await fetch('/api/toll-system/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: issuance.membership.id })
      })

      if (!tollRes.ok) {
        console.warn('Failed to enable card in toll system')
      }
      
      await fetchQueue()
      setSelectedCard(null)
    } catch (error) {
      console.error('Error issuing card:', error)
      alert('Failed to issue card')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Card Issuance Queue</h1>
          <p className="text-gray-500 mt-1">Process physical membership cards</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowInstructions(true)}>
            Encoding Instructions
          </Button>
          <Button onClick={fetchQueue}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{queueData?.summary.readyToEncode || 0}</p>
              <p className="text-sm text-gray-500">Ready to Encode</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{queueData?.summary.encoded || 0}</p>
              <p className="text-sm text-gray-500">Ready to Issue</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{queueData?.summary.pending || 0}</p>
              <p className="text-sm text-gray-500">Pending Payment</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{queueData?.summary.actionRequired || 0}</p>
              <p className="text-sm text-gray-500">Action Required</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready to Encode */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="warning">Ready to Encode</Badge>
            <span className="text-sm text-gray-500">
              Cards waiting to be written with card writer
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {queueData?.queue.readyToEncode.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No cards waiting to be encoded</p>
          ) : (
            <div className="space-y-3">
              {queueData?.queue.readyToEncode.map((issuance) => (
                <div key={issuance.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div>
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                    <p className="text-sm font-mono text-yellow-800 mt-1">
                      Encode: <span className="font-bold">{issuance.magstripeData}</span>
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSelectedCard(issuance)}>
                    Mark Encoded
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Encoded - Ready to Issue */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="info">Encoded - Ready to Issue</Badge>
            <span className="text-sm text-gray-500">
              Cards ready to be handed to members
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {queueData?.queue.encoded.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No cards ready to issue</p>
          ) : (
            <div className="space-y-3">
              {queueData?.queue.encoded.map((issuance) => (
                <div key={issuance.id} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div>
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {issuance.membership.member.phone}
                    </p>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => handleIssue(issuance)} loading={actionLoading}>
                    Issue to Member
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Payment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="default">Pending Payment</Badge>
            <span className="text-sm text-gray-500">
              Awaiting payment completion
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {queueData?.queue.pending.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No cards pending payment</p>
          ) : (
            <div className="space-y-3">
              {queueData?.queue.pending.map((issuance) => (
                <div key={issuance.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                  </div>
                  <Badge variant="warning">Awaiting Payment</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Encode Modal */}
      <Modal
        isOpen={!!selectedCard && selectedCard.queueStatus === 'READY_TO_ENCODE'}
        onClose={() => setSelectedCard(null)}
        title="Confirm Card Encoding"
      >
        {selectedCard && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Member</p>
              <p className="font-medium">{selectedCard.membership.member.name}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-sm text-yellow-700">Encode this data to Track 1:</p>
              <p className="text-2xl font-mono font-bold text-yellow-900 mt-1">
                {selectedCard.magstripeData}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Use the card writer to encode the above data onto the physical card with number{' '}
              <strong>{selectedCard.membership.membershipNumber.cardNumber}</strong> printed on the back.
            </p>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => setSelectedCard(null)}>
                Cancel
              </Button>
              <Button onClick={() => handleEncode(selectedCard)} loading={actionLoading}>
                Confirm Encoded
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Encoding Instructions Modal */}
      <Modal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        title="Card Encoding Instructions"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900">Magstripe Format</h3>
            <p className="text-sm text-blue-700 mt-1">
              {queueData?.encodingInstructions.format}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900">Example</h3>
            <p className="text-lg font-mono mt-1">{queueData?.encodingInstructions.example}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-yellow-900">Important</h3>
            <p className="text-sm text-yellow-700 mt-1">
              {queueData?.encodingInstructions.note}
            </p>
          </div>
          <div className="text-sm text-gray-600">
            <h3 className="font-medium text-gray-900 mb-2">Steps:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Take the physical card matching the card number shown</li>
              <li>Connect the card writer to your computer</li>
              <li>Copy the magstripe data exactly as shown</li>
              <li>Write the data to Track 1 of the card</li>
              <li>Click "Mark Encoded" to confirm</li>
            </ol>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowInstructions(false)}>Got it</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
