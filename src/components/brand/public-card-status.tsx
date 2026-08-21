import { cardUnavailableCopy, type CardUnavailableReason } from '@/lib/card-unavailable'

export function PublicCardStatus({
  reason,
  venueName,
  logoUrl,
}: {
  reason: CardUnavailableReason
  venueName?: string
  logoUrl?: string
}) {
  const copy = cardUnavailableCopy(reason)
  const brand = venueName?.trim() || 'Membership Manager'

  return (
    <div className="flex min-h-full flex-col bg-gray-50 px-4 py-12 text-gray-900">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          <div className="px-6 py-8 text-center">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="mx-auto mb-5 h-16 max-w-[14rem] object-contain" />
            ) : null}
            <p className="text-xs uppercase tracking-[0.2em] text-blue-300">{brand}</p>
            <h1 className="mt-4 text-2xl font-semibold">{copy.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">{copy.body}</p>
          </div>
          <div className="border-t border-white/10 bg-white/5 px-6 py-5 text-center text-sm text-slate-300">
            If you think this is a mistake, please speak to staff at the venue.
          </div>
        </div>
      </div>
    </div>
  )
}
