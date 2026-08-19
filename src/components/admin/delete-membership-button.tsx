'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface DeleteMembershipButtonProps {
  membershipId: string
  cardNumber?: number
  cardType?: string
  memberName?: string
  onDeleted: () => void
}

export function DeleteMembershipButton({
  membershipId,
  cardNumber,
  cardType,
  memberName,
  onDeleted,
}: DeleteMembershipButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/memberships/${membershipId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete membership')
      setOpen(false)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete membership')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Delete membership">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Delete this membership{memberName ? ` for ${memberName}` : ''}
            {cardNumber != null ? ` (card #${cardNumber})` : ''}? The card number will be returned to available stock.
          </p>
          {(cardType === 'PHYSICAL_CARD' || cardType === 'BOTH') && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              If this plastic card was already encoded, wipe or re-encode it before issuing it to someone else.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={loading}>
              Delete and return card
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
