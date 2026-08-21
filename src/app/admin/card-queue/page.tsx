'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { BatchEncodeModal } from '@/components/admin/batch-encode-modal'
import { useMsrx6 } from '@/lib/msrx6/use-msrx6'
import { isMsrx6Cancelled } from '@/lib/msrx6/device'
import { withMagstripeSentinels } from '@/lib/msrx6/protocol'

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
    tracks?: number[]
  }
}

export default function CardQueuePage() {
  const [queueData, setQueueData] = useState<QueueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<CardIssuance | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [encodeMessage, setEncodeMessage] = useState<string | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchCards, setBatchCards] = useState<CardIssuance[]>([])
  const writer = useMsrx6()
  const outOfCredits = creditBalance !== null && creditBalance < 1
  const needsCredit = (issuance: CardIssuance) => issuance.membership.cardType === 'QR_CODE'

  const closeEncodeModal = () => {
    void writer.cancelOperation()
    setSelectedCard(null)
    setEncodeMessage(null)
    setActionLoading(false)
  }

  const fetchQueue = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [res, tenantRes] = await Promise.all([
        fetch('/api/card-issuance/queue?includeCompleted=false'),
        fetch('/api/tenants/current'),
      ])
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch queue')
      setQueueData(data)
      const tenantData = await tenantRes.json()
      setCreditBalance(
        typeof tenantData.tenant?.creditBalance === 'number' ? tenantData.tenant.creditBalance : 0
      )
    } catch (error) {
      console.error('Error fetching queue:', error)
      setQueueData(null)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const markEncoded = async (issuance: CardIssuance, encodedBy: string, notes: string) => {
    const res = await fetch(`/api/card-issuance/${issuance.id}/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encodedBy, notes })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to mark as encoded')
    }
    await fetchQueue(true)
    setSelectedCard(null)
    setEncodeMessage(null)
  }

  const handleEncode = async (issuance: CardIssuance) => {
    if (needsCredit(issuance) && outOfCredits) {
      alert('No issuance credits remaining. Buy a credit pack before encoding a new physical card.')
      return
    }
    setActionLoading(true)
    try {
      await markEncoded(issuance, 'Bar Manager', 'Marked encoded manually')
    } catch (error) {
      console.error('Error encoding card:', error)
      alert(error instanceof Error ? error.message : 'Failed to mark card as encoded')
    } finally {
      setActionLoading(false)
    }
  }

  const handleWriterEncode = async (issuance: CardIssuance) => {
    if (needsCredit(issuance) && outOfCredits) {
      setEncodeMessage('No issuance credits remaining. Buy a credit pack before issuing a physical card.')
      return
    }
    setActionLoading(true)
    setEncodeMessage('Sending write command. Swipe the blank card through the MSRx6 now.')
    try {
      await writer.encodeCard(issuance.magstripeData)
      setEncodeMessage('Verified. Saving…')
      await markEncoded(
        issuance,
        'MSRx6',
        `MSRx6 ${writer.transport || 'bluetooth'} ${writer.coercivity}, verified`
      )
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

  const handleIssue = async (issuance: CardIssuance) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/card-issuance/${issuance.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuedBy: 'Bar Manager' })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to issue card')
      
      const tillRes = await fetch('/api/till-system/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: issuance.membership.id })
      })

      if (!tillRes.ok) {
        console.warn('Failed to enable card in till system')
      }
      
      await fetchQueue(true)
      setSelectedCard(null)
    } catch (error) {
      console.error('Error issuing card:', error)
      alert(error instanceof Error ? error.message : 'Failed to issue card')
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

  const readyCards = [...(queueData?.queue?.readyToEncode || [])].sort(
    (a, b) => a.membership.membershipNumber.cardNumber - b.membership.membershipNumber.cardNumber
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Card Issuance Queue</h1>
          <p className="text-gray-500 mt-1">Process physical membership cards</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button variant="secondary" onClick={() => setShowInstructions(true)} className="w-full sm:w-auto">
            Encoding Instructions
          </Button>
          {readyCards.length > 0 && (
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedCard(null)
                setBatchCards(readyCards)
                setBatchOpen(true)
              }}
            >
              Batch encode ({readyCards.length})
            </Button>
          )}
          <Button onClick={() => void fetchQueue()} className="w-full sm:w-auto">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {outOfCredits && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          This venue has no issuance credits left. Encoding a new physical card for a QR-only membership is blocked.{' '}
          <a href="/admin/credits" className="underline">Buy a credit pack</a>. Replacement encodes of cards already charged still work.
        </p>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
        <a href="#encode" className="block h-full min-h-[7.5rem]">
          <Card className="h-full hover:border-yellow-300 transition-colors">
            <CardContent className="pt-4 h-full">
              <div className="text-center h-full flex flex-col justify-center">
                <p className="text-2xl font-bold text-yellow-600">{queueData?.summary?.readyToEncode || 0}</p>
                <p className="text-sm text-gray-500">Ready to Encode</p>
                <p className="text-xs text-gray-400 mt-1 invisible">Encode + issue</p>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="#issue" className="block h-full min-h-[7.5rem]">
          <Card className="h-full hover:border-blue-300 transition-colors">
            <CardContent className="pt-4 h-full">
              <div className="text-center h-full flex flex-col justify-center">
                <p className="text-2xl font-bold text-blue-600">{queueData?.summary?.encoded || 0}</p>
                <p className="text-sm text-gray-500">Ready to Issue</p>
                <p className="text-xs text-gray-400 mt-1 invisible">Encode + issue</p>
              </div>
            </CardContent>
          </Card>
        </a>
        <a href="#payment" className="block h-full min-h-[7.5rem]">
          <Card className="h-full hover:border-gray-400 transition-colors">
            <CardContent className="pt-4 h-full">
              <div className="text-center h-full flex flex-col justify-center">
                <p className="text-2xl font-bold text-gray-600">{queueData?.summary?.pending || 0}</p>
                <p className="text-sm text-gray-500">Pending Payment</p>
                <p className="text-xs text-gray-400 mt-1 invisible">Encode + issue</p>
              </div>
            </CardContent>
          </Card>
        </a>
        <div className="h-full min-h-[7.5rem]">
          <Card className="h-full">
            <CardContent className="pt-4 h-full">
              <div className="text-center h-full flex flex-col justify-center">
                <p className="text-2xl font-bold text-red-600">{queueData?.summary?.actionRequired || 0}</p>
                <p className="text-sm text-gray-500">Action Required</p>
                <p className="text-xs text-gray-400 mt-1">Encode + issue</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ready to Encode */}
      <Card id="encode" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="warning">Ready to Encode</Badge>
            <span className="text-sm text-gray-500">
              Cards waiting to be written with card writer
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!readyCards.length ? (
            <p className="text-gray-500 text-center py-4">No cards waiting to be encoded</p>
          ) : (
            <div className="space-y-3">
              {readyCards.map((issuance) => (
                <div key={issuance.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                    <p className="text-sm font-mono text-yellow-800 mt-1 break-all">
                      Encode: <span className="font-bold">{withMagstripeSentinels(issuance.magstripeData)}</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto shrink-0"
                    disabled={needsCredit(issuance) && outOfCredits}
                    onClick={() => {
                      if (needsCredit(issuance) && outOfCredits) return
                      setEncodeMessage(null)
                      setSelectedCard(issuance)
                      if (writer.connected) {
                        void handleWriterEncode(issuance)
                      }
                    }}
                  >
                    {writer.connected ? 'Encode' : 'Mark Encoded'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Encoded - Ready to Issue */}
      <Card id="issue" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="info">Encoded - Ready to Issue</Badge>
            <span className="text-sm text-gray-500">
              Cards ready to be handed to members
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!queueData?.queue?.encoded?.length ? (
            <p className="text-gray-500 text-center py-4">No cards ready to issue</p>
          ) : (
            <div className="space-y-3">
              {queueData.queue.encoded.map((issuance) => (
                <div key={issuance.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {issuance.membership.member.phone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-full sm:w-auto shrink-0"
                    onClick={() => handleIssue(issuance)}
                    loading={actionLoading}
                    disabled={needsCredit(issuance) && outOfCredits}
                  >
                    Issue to Member
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Payment */}
      <Card id="payment" className="scroll-mt-24">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant="default">Pending Payment</Badge>
            <span className="text-sm text-gray-500">
              Awaiting payment completion
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {!queueData?.queue?.pending?.length ? (
            <p className="text-gray-500 text-center py-4">No cards pending payment</p>
          ) : (
            <div className="space-y-3">
              {queueData.queue.pending.map((issuance) => (
                <div key={issuance.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{issuance.membership.member.name}</p>
                    <p className="text-sm text-gray-600">
                      Card #{issuance.membership.membershipNumber.cardNumber} • {issuance.membership.subscriptionPlan.name}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Badge variant="warning">Awaiting Payment</Badge>
                    <Link href={`/admin/memberships/${issuance.membership.id}`} className="w-full sm:w-auto">
                      <Button size="sm" variant="secondary" className="w-full">Record payment</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Encode Modal */}
      <Modal
        isOpen={!!selectedCard && selectedCard.queueStatus === 'READY_TO_ENCODE'}
        onClose={closeEncodeModal}
        title="Confirm Card Encoding"
      >
        {selectedCard && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Member</p>
              <p className="font-medium">{selectedCard.membership.member.name}</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border-2 border-yellow-300">
              <p className="text-sm text-yellow-700">Magstripe data (till swipe):</p>
              <p className="text-2xl font-mono font-bold text-yellow-900 mt-1 break-all">
                {withMagstripeSentinels(selectedCard.magstripeData)}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Match the physical card numbered{' '}
              <strong>{selectedCard.membership.membershipNumber.cardNumber}</strong> on the back.
              {writer.connected
                ? ' Swipe the blank card now. After a successful write you will swipe once more to verify.'
                : ' Connect the MSRx6 from the bar at the top of the page, or write this data in EasyMSR and confirm here.'}
            </p>
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
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-4">
              <Button variant="secondary" onClick={closeEncodeModal}>
                Cancel
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleEncode(selectedCard)}
                loading={actionLoading}
                disabled={needsCredit(selectedCard) && outOfCredits}
              >
                Mark encoded manually
              </Button>
              {writer.connected && (
                <Button
                  onClick={() => handleWriterEncode(selectedCard)}
                  loading={actionLoading}
                  disabled={needsCredit(selectedCard) && outOfCredits}
                >
                  {writer.phase === 'writing' || writer.phase === 'verifying' ? 'Waiting for swipe…' : 'Retry write'}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <BatchEncodeModal
        isOpen={batchOpen}
        cards={batchCards}
        writer={writer}
        outOfCredits={outOfCredits}
        onClose={() => setBatchOpen(false)}
        onComplete={() => fetchQueue(true)}
      />

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
              <li>Copy the magstripe data exactly as shown, including the ? at the end</li>
              <li>Write the magstripe data as shown (or use Write with MSRx6 on this page)</li>
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
