'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { isMsrx6Cancelled } from '@/lib/msrx6/device'
import { withMagstripeSentinels } from '@/lib/msrx6/protocol'
import type { Msrx6Writer } from '@/lib/msrx6/use-msrx6'

export type BatchEncodeCard = {
  id: string
  magstripeData: string
  membership: {
    cardType: string
    member: { name: string }
    membershipNumber: { cardNumber: number }
    subscriptionPlan: { name: string }
  }
}

function cardNumber(card: BatchEncodeCard) {
  return card.membership.membershipNumber.cardNumber
}

export function BatchEncodeModal({
  isOpen,
  cards,
  writer,
  outOfCredits,
  onClose,
  onComplete,
}: {
  isOpen: boolean
  cards: BatchEncodeCard[]
  writer: Msrx6Writer
  outOfCredits: boolean
  onClose: () => void
  onComplete: () => Promise<void> | void
}) {
  const [index, setIndex] = useState(0)
  const [encodedCount, setEncodedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [messageKind, setMessageKind] = useState<'info' | 'ok' | 'error'>('info')
  const [finished, setFinished] = useState(false)
  const indexRef = useRef(0)
  const runIdRef = useRef(0)

  const current = cards[index]
  const remaining = Math.max(0, cards.length - index - (finished ? 0 : 1))
  const needsCredit = current?.membership.cardType === 'QR_CODE'
  const blocked = Boolean(current && needsCredit && outOfCredits)

  const markEncoded = async (card: BatchEncodeCard) => {
    const res = await fetch(`/api/card-issuance/${card.id}/encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        encodedBy: writer.connected ? 'MSRx6' : 'Bar Manager',
        notes: writer.connected
          ? `MSRx6 ${writer.transport || 'bluetooth'} ${writer.coercivity}, batch encode, verified`
          : 'Marked encoded during batch encode',
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to mark as encoded')
    }
  }

  const finish = async () => {
    runIdRef.current += 1
    setFinished(true)
    setBusy(false)
    await onComplete()
  }

  const advance = (fromIndex: number, runId: number) => {
    if (runId !== runIdRef.current) return
    const next = fromIndex + 1
    if (next >= cards.length) {
      void finish()
      return
    }
    indexRef.current = next
    setIndex(next)
    setMessage(null)
    setMessageKind('info')
    window.setTimeout(() => {
      if (runIdRef.current !== runId || indexRef.current !== next) return
      if (writer.connected) void encodeCurrent(next, runId)
    }, 350)
  }

  const encodeCurrent = async (expectedIndex: number, runId: number) => {
    const card = cards[expectedIndex]
    if (!card || runId !== runIdRef.current || indexRef.current !== expectedIndex) return
    if (card.membership.cardType === 'QR_CODE' && outOfCredits) {
      setMessageKind('error')
      setMessage('No issuance credits remaining for this card. Skip it or buy a credit pack.')
      return
    }
    if (!writer.connected) {
      setMessageKind('info')
      setMessage('Connect the MSRx6 from the bar at the top of the page, then encode this card.')
      return
    }

    setBusy(true)
    setMessageKind('info')
    setMessage('Sending write command. Swipe the blank card through the MSRx6 now.')
    try {
      await writer.encodeCard(card.magstripeData)
      if (runId !== runIdRef.current || indexRef.current !== expectedIndex) return
      setMessage('Verified. Saving…')
      await markEncoded(card)
      if (runId !== runIdRef.current || indexRef.current !== expectedIndex) return
      setEncodedCount((count) => count + 1)
      setMessageKind('ok')
      setMessage('Encoded.')
      setBusy(false)
      advance(expectedIndex, runId)
    } catch (error) {
      if (isMsrx6Cancelled(error)) {
        setBusy(false)
        setMessage(null)
        return
      }
      const text = error instanceof Error ? error.message : 'Writer encode failed'
      setMessageKind('error')
      setMessage(text)
      writer.setError(text)
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    indexRef.current = 0
    setIndex(0)
    setEncodedCount(0)
    setSkippedCount(0)
    setBusy(false)
    setFinished(false)
    setMessage(null)
    setMessageKind('info')
    if (writer.connected && cards[0]) {
      void encodeCurrent(0, runId)
    } else if (cards[0]) {
      setMessage('Connect the MSRx6 from the bar at the top of the page, then encode this card.')
    }
    return () => {
      runIdRef.current += 1
      void writer.cancelOperation()
    }
    // Start once when the batch opens. Later connects use Encode this card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleClose = async () => {
    runIdRef.current += 1
    await writer.cancelOperation()
    onClose()
    await onComplete()
  }

  const handleSkip = async () => {
    const from = indexRef.current
    const runId = runIdRef.current
    await writer.cancelOperation()
    setSkippedCount((count) => count + 1)
    setBusy(false)
    advance(from, runId)
  }

  const handleManual = async () => {
    const card = current
    const expectedIndex = indexRef.current
    const runId = runIdRef.current
    if (!card) return
    if (blocked) {
      setMessageKind('error')
      setMessage('No issuance credits remaining. Buy a credit pack before encoding a new physical card.')
      return
    }
    setBusy(true)
    try {
      await markEncoded(card)
      if (runId !== runIdRef.current || indexRef.current !== expectedIndex) return
      setEncodedCount((count) => count + 1)
      setMessageKind('ok')
      setMessage('Marked encoded.')
      setBusy(false)
      advance(expectedIndex, runId)
    } catch (error) {
      setMessageKind('error')
      setMessage(error instanceof Error ? error.message : 'Failed to mark as encoded')
      setBusy(false)
    }
  }

  const swipeHint =
    writer.phase === 'writing'
      ? 'Swipe 1 of 2 — encode'
      : writer.phase === 'verifying'
        ? 'Swipe 2 of 2 — verify'
        : null

  const nextCard = !finished && current ? cards[index + 1] : undefined

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => void handleClose()}
      title={finished ? 'Batch encode complete' : `Batch encode · ${cards.length ? index + 1 : 0} of ${cards.length}`}
      size="lg"
    >
      {finished || !current ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-lg font-semibold text-green-900">
              Encoded {encodedCount} of {cards.length}
            </p>
            {skippedCount > 0 && (
              <p className="text-sm text-green-800 mt-1">{skippedCount} skipped</p>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Encoded cards are in Ready to Issue. Hand them to members from the queue when you are ready.
          </p>
          <div className="flex justify-end pt-2">
            <Button onClick={() => void handleClose()}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              {encodedCount} encoded
              {skippedCount ? ` · ${skippedCount} skipped` : ''}
              {remaining > 0 ? ` · ${remaining} after this` : ''}
            </span>
            <span>{current.membership.subscriptionPlan.name}</span>
          </div>

          <div className="p-5 rounded-xl border-2 border-yellow-300 bg-yellow-50 text-center">
            <p className="text-sm font-medium text-yellow-800 uppercase tracking-wide">Pick this card</p>
            <p className="mt-2 text-5xl sm:text-6xl font-mono font-bold text-yellow-950 leading-none">
              {cardNumber(current)}
            </p>
            <p className="mt-3 text-lg font-medium text-gray-900">{current.membership.member.name}</p>
            <p className="text-sm font-mono text-yellow-900 mt-2 break-all">{withMagstripeSentinels(current.magstripeData)}</p>
          </div>

          {swipeHint && (
            <div className="p-4 rounded-lg bg-blue-600 text-white text-center">
              <p className="text-lg font-semibold">{swipeHint}</p>
              <p className="text-sm text-blue-100 mt-1">
                {writer.phase === 'writing'
                  ? 'Swipe the blank card through the writer now.'
                  : 'Write succeeded. Swipe the same card again to verify.'}
              </p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Match the number printed on the back, then swipe once to encode and once to verify.
            {nextCard ? ` Next: #${cardNumber(nextCard)} ${nextCard.membership.member.name}.` : ' This is the last card in the batch.'}
          </p>

          {message && (
            <p
              className={`text-sm rounded-lg p-3 ${
                messageKind === 'ok'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : messageKind === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {message}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 sm:gap-3 pt-2">
            <Button variant="secondary" onClick={() => void handleClose()}>
              Stop batch
            </Button>
            <Button variant="ghost" onClick={() => void handleSkip()}>
              Skip
            </Button>
            <Button variant="ghost" onClick={() => void handleManual()} disabled={blocked || busy}>
              Mark encoded manually
            </Button>
            {writer.connected && (
              <Button
                onClick={() => void encodeCurrent(indexRef.current, runIdRef.current)}
                loading={busy}
                disabled={blocked}
              >
                {writer.phase === 'writing' || writer.phase === 'verifying' ? 'Waiting for swipe…' : 'Encode this card'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
