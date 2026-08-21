'use client'

type Method = 'CARD' | 'OPEN_BANKING'

export type PaymentOptionsView = {
  openBanking: boolean
  card: { id: string; name: string }[]
  defaultMethod: Method
  cardLabel: string
}

export function selectableTileClass(selected: boolean) {
  return `rounded-lg border-2 cursor-pointer transition-colors ${
    selected
      ? 'border-blue-500 bg-blue-50'
      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
  }`
}

export function defaultPaymentMethod(options: PaymentOptionsView): Method | '' {
  const cardAvailable = options.card.length > 0
  if (cardAvailable && options.openBanking) return ''
  if (cardAvailable) return 'CARD'
  if (options.openBanking) return 'OPEN_BANKING'
  return ''
}

export function PaymentMethodPicker({
  value,
  onChange,
  options,
}: {
  value: Method | ''
  onChange: (method: Method) => void
  options: PaymentOptionsView
}) {
  const cardAvailable = options.card.length > 0
  const methods: { id: Method; title: string; hint: string }[] = []
  if (cardAvailable) {
    methods.push({
      id: 'CARD',
      title: options.cardLabel || 'Card',
      hint: 'Pay by debit or credit card. You will be redirected to a secure checkout.',
    })
  }
  if (options.openBanking) {
    methods.push({
      id: 'OPEN_BANKING',
      title: 'Open banking',
      hint: 'Pay from your bank. You will be redirected to approve the payment.',
    })
  }

  if (methods.length === 0) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Payment</label>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          This venue is not accepting online payments. Please pay at the bar or contact the venue.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Payment</label>
      <div className="space-y-2">
        {methods.map((method) => {
          const selected = value === method.id
          return (
            <label key={method.id} className={`block p-4 ${selectableTileClass(selected)}`}>
              <div className="flex items-start gap-3">
                {methods.length > 1 && (
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1"
                    required
                    checked={selected}
                    onChange={() => onChange(method.id)}
                  />
                )}
                <div>
                  <p className="font-medium text-gray-900">{method.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{method.hint}</p>
                </div>
              </div>
            </label>
          )
        })}
      </div>
      {methods.length > 1 && !value && (
        <p className="text-sm text-gray-500">Choose how you want to pay to continue.</p>
      )}
    </div>
  )
}
