import type { ReactNode } from 'react'

function BrowserFrame({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl shadow-slate-900/10"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <p className="ml-2 truncate font-mono text-[11px] text-slate-500">{title}</p>
      </div>
      {children}
    </div>
  )
}

function FakeQr() {
  const cells = [
    1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0,
    1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1,
    0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1,
  ]
  return (
    <div className="grid h-28 w-28 grid-cols-[repeat(9,1fr)] gap-px bg-white p-1">
      {cells.map((on, index) => (
        <span key={index} className={on ? 'bg-slate-900' : 'bg-white'} />
      ))}
    </div>
  )
}

function Pill({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'ok' | 'warn' | 'info'
}) {
  const tones = {
    default: 'bg-slate-100 text-slate-700',
    ok: 'bg-emerald-100 text-emerald-800',
    warn: 'bg-amber-100 text-amber-900',
    info: 'bg-sky-100 text-sky-800',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function MembersShot() {
  const rows = [
    ['Alex Morgan', 'a.morgan@example.com', '1 active', 'ok'],
    ['Jordan Hale', 'j.hale@example.com', 'Pending payment', 'warn'],
    ['Sam Whitaker', 's.whitaker@example.com', 'Expired', 'default'],
  ] as const

  return (
    <BrowserFrame title="admin / members · Riverside Lodge">
      <div className="bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Members</p>
            <p className="text-[11px] text-slate-500">Riverside Lodge · sample data</p>
          </div>
          <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white">
            Add member
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, email, status, tone]) => (
                <tr key={name} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{name}</td>
                  <td className="px-3 py-2 text-slate-500">{email}</td>
                  <td className="px-3 py-2">
                    <Pill tone={tone}>{status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </BrowserFrame>
  )
}

export function QueueShot() {
  return (
    <BrowserFrame title="admin / card-queue · Riverside Lodge">
      <div className="bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Card queue</p>
          <Pill tone="ok">Card writer connected</Pill>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            ['Ready', '3'],
            ['Encoded', '12'],
            ['Issued', '148'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {[
            ['#1042', 'Alex Morgan', 'Annual · QR + physical'],
            ['#1108', 'Jordan Hale', 'Annual · Physical'],
            ['#1180', 'Sam Whitaker', 'Three year · QR'],
          ].map(([card, name, plan]) => (
            <div
              key={card}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div>
                <p className="text-[11px] font-medium text-slate-900">
                  {card} · {name}
                </p>
                <p className="text-[10px] text-slate-500">{plan}</p>
              </div>
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[10px] text-white">Encode</span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

export function ReportsShot() {
  const bars = [42, 68, 55, 80, 61, 90]
  return (
    <BrowserFrame title="admin / reports · Riverside Lodge">
      <div className="bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Subscription sales</p>
        <p className="mb-3 text-[11px] text-slate-500">This month · Europe/London · sample figures</p>
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            ['Taken', '£2,140'],
            ['Memberships', '18'],
            ['Avg. plan', '£119'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex h-24 items-end gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
          {bars.map((height, index) => (
            <div
              key={index}
              className="flex-1 rounded-t bg-blue-600/80"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-600">
          <Pill tone="info">Card 12</Pill>
          <Pill tone="ok">Open banking 4</Pill>
          <Pill>Complimentary 2</Pill>
        </div>
      </div>
    </BrowserFrame>
  )
}

export function MemberCardShot() {
  return (
    <div className="mx-auto w-[18rem]" aria-hidden="true">
      <div className="rounded-[2rem] border border-slate-700 bg-slate-900 p-3 shadow-2xl shadow-slate-900/40">
        <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-slate-700" />
        <p className="text-center text-[10px] text-slate-400">Riverside Lodge</p>
        <p className="mb-3 text-center text-sm font-semibold text-white">Your membership card</p>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 text-white ring-1 ring-white/10">
          <div className="px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-blue-300">Member</p>
            <p className="mt-1 text-lg font-semibold">Alex Morgan</p>
            <p className="text-xs text-slate-400">Annual Membership</p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 px-4 py-3 text-[11px]">
            <div>
              <p className="text-slate-400">Card number</p>
              <p className="font-mono text-base font-bold">1042</p>
            </div>
            <div>
              <p className="text-slate-400">Valid until</p>
              <p>21 Aug 2027</p>
            </div>
          </div>
          <div className="bg-white px-4 py-4 text-center">
            <div className="mx-auto w-fit">
              <FakeQr />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Show this code at the bar</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="rounded-lg bg-black py-2 text-center text-[11px] font-medium text-white">
            Add to Apple Wallet
          </div>
          <div className="rounded-full bg-[#1f1f1f] py-2 text-center text-[11px] font-medium text-white">
            Add to Google Wallet
          </div>
        </div>
      </div>
    </div>
  )
}

export function ApiShot() {
  return (
    <BrowserFrame title="Partner API · issue a membership">
      <pre className="overflow-x-auto bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-200">
        <code>{`Authorization: Bearer ••••••••
Content-Type: application/json

{
  "member": {
    "name": "Alex Morgan",
    "email": "a.morgan@example.com",
    "phone": "07700900123"
  },
  "plan": "annual",
  "card": "qr",
  "notify": { "email": true, "sms": true }
}

← Created
{
  "cardNumber": 1042,
  "status": "active",
  "cardUrl": "https://…"
}`}</code>
      </pre>
    </BrowserFrame>
  )
}
