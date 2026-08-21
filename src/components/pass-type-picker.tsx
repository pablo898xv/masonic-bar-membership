'use client'

import { selectableTileClass } from '@/components/payment-method-picker'
import {
  PASS_TYPE_OPTIONS,
  offeredCardTypes,
  type CardType,
  type VenuePassTypes,
} from '@/lib/card-type'

export function PassTypePicker({
  value,
  onChange,
  passTypes,
}: {
  value: string
  onChange: (value: CardType) => void
  passTypes: VenuePassTypes
}) {
  const offered = PASS_TYPE_OPTIONS.filter((option) => offeredCardTypes(passTypes).includes(option.value))
  if (!offered.length) {
    return <p className="text-sm text-gray-500">No pass types are enabled for this venue.</p>
  }

  const columns =
    offered.length === 1 ? 'grid-cols-1' : offered.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Pass type</label>
      <div className={`grid ${columns} gap-3`}>
        {offered.map((option) => (
          <label
            key={option.value}
            className={`p-4 text-center ${selectableTileClass(value === option.value)}`}
          >
            <input
              type="radio"
              name="cardType"
              value={option.value}
              required
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <p className="font-medium text-gray-900">{option.label}</p>
            <p className="text-xs text-gray-500 mt-1">{option.hint}</p>
          </label>
        ))}
      </div>
    </div>
  )
}
