import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  ApiShot,
  MemberCardShot,
  MembersShot,
  QueueShot,
  ReportsShot,
} from '@/components/marketing/product-shots'

const NAV = [
  { href: '#product', label: 'Product' },
  { href: '#cards', label: 'Cards' },
  { href: '#till', label: 'Till & wallets' },
  { href: '#renew', label: 'Renewals' },
  { href: '#payments', label: 'Payments' },
  { href: '#api', label: 'API' },
]

const CAPABILITIES: { title: string; body: string; methods?: string[] }[] = [
  {
    title: 'Members and memberships',
    body: 'Keep a venue-scoped register. Edit contact details, issue a new membership, and resume unpaid sign-ups from admin.',
    methods: ['People', 'Plans', 'Card numbers'],
  },
  {
    title: 'Digital and physical cards',
    body: 'Each venue chooses which pass types to sell. QR-only numbers stay off printed stock. Only physical cards go to the encode queue.',
    methods: ['QR cards for phones', 'Physical cards for the till', 'QR and physical together'],
  },
  {
    title: 'Phone wallets',
    body: 'Members add a pass from their card page. The pass uses the venue name and logo. Google Wallet keeps each venue’s cards in their own group.',
    methods: ['Apple Wallet', 'Google Wallet'],
  },
  {
    title: 'Payments the venue already uses',
    body: 'Each venue can take its own payouts. Free plans can sit on the public signup form; complimentary issue stays staff-only.',
    methods: ['Card checkout', 'Open banking', 'Cash', 'In person', 'Free plans', 'Complimentary (staff only)'],
  },
  {
    title: 'Renewals on the same card',
    body: 'Members can renew from a month before expiry. The extra year is added from the current expiry date, not from the day they pay. Replacement cards keep the original expiry.',
    methods: ['Same card number', 'Email and SMS reminders the venue can switch off'],
  },
  {
    title: 'Credits and reports',
    body: 'Venues buy credit packs to issue cards. Subscription reports show paid memberships without mixing in credit-pack purchases.',
    methods: ['This month', 'Last month', 'Year to date'],
  },
  {
    title: 'Partner API',
    body: 'Issue a membership with a venue API key, choose whether we send notifications, and receive the card URL.',
    methods: ['Till', 'Website', 'Club system'],
  },
]

const INTEGRATIONS = [
  { name: 'Apple Wallet', detail: 'Add to Wallet' },
  { name: 'Google Wallet', detail: 'Save to Wallet' },
  { name: 'Card checkout', detail: 'Pay by card online' },
  { name: 'Open banking', detail: 'Pay from the member’s bank' },
  { name: 'SMS', detail: 'Welcome, card, and renewal texts' },
  { name: 'Email', detail: 'Card and renewal mail' },
  { name: 'Till / POS', detail: 'Scan at the bar' },
  { name: 'Physical cards', detail: 'Encode in venue' },
]

function MethodList({ items, className = 'text-sm text-gray-600' }: { items: string[]; className?: string }) {
  return (
    <ul className={`mt-2 list-disc space-y-1 pl-5 ${className}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id?: string
  eyebrow?: string
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
        ) : null}
        <h2 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {title}
        </h2>
        {lead ? <p className="mt-3 max-w-2xl text-lg text-gray-600">{lead}</p> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

export function Brochure() {
  return (
    <div className="bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-gray-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 pr-16">
          <a href="#top" className="text-sm font-semibold text-gray-900">
            Membership Manager
          </a>
          <nav className="hidden items-center gap-5 text-sm text-gray-600 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-gray-900">
                {item.label}
              </a>
            ))}
          </nav>
          <Link
            href="/admin/login"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Venue sign in
          </Link>
        </div>
      </header>

      <section id="top" className="relative overflow-hidden bg-slate-950 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.35),_transparent_50%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-300">
              Ashlar Technologies
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Membership cards for venues that still run a real till.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              Take payment and let the till or a partner system talk to the same register.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-slate-300">
              <li>Digital QR cards</li>
              <li>Physical cards</li>
              <li>Apple Wallet and Google Wallet</li>
              <li>Renewals on the same card number</li>
            </ul>
            <div className="mt-8">
              <Link
                href="/admin/login"
                className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Venue sign in
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-400">
              Screens on this page use fictional people and card numbers. They are not live members.
            </p>
          </div>
          <MemberCardShot />
        </div>
      </section>

      <Section
        id="product"
        eyebrow="Platform"
        title="One register for people, cards, and the till."
        lead="Built for bars, clubs, and venues that need a membership discount card — not a generic CRM with a barcode bolted on."
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <MembersShot />
          <ul className="grid gap-5 sm:grid-cols-2">
            {CAPABILITIES.map((item) => (
              <li key={item.title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:bg-slate-900">
                <h3 className="font-semibold text-gray-900">{item.title}</h3>
                {item.methods ? <MethodList items={item.methods} /> : null}
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section
        id="cards"
        eyebrow="Issuing"
        title="Encode a stack of cards, or send a link in minutes."
        lead="Staff work a queue for physical cards. Members get a page they can keep on their phone. Card numbers stay unique per venue, and QR-only numbers do not use printed stock."
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <QueueShot />
          <div className="space-y-5 text-gray-600">
            <p>Each venue turns on the pass types it actually issues:</p>
            <MethodList
              items={['QR only', 'Physical only', 'QR and physical']}
              className="text-sm text-gray-600"
            />
            <p>The public signup form only shows those options. Physical cards still come from imported stock. QR-only cards take the next number from a separate range the venue sets.</p>
            <p>The encode queue is for physical cards only. It shows:</p>
            <MethodList
              items={['Ready to encode', 'Encoded', 'Handed over']}
              className="text-sm text-gray-600"
            />
            <ul className="space-y-3 text-sm">
              <li className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-slate-900">
                <span className="font-medium text-gray-900">Physical cards</span>
                <p className="mt-1">
                  Encode from the card queue, including batch encode when you have a pile of blanks.
                  Additional hardware is required.
                </p>
              </li>
              <li className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-slate-900">
                <span className="font-medium text-gray-900">Digital card page</span>
                <p className="mt-1">Short links, then the member can:</p>
                <MethodList items={['Save the QR', 'Apple Wallet', 'Google Wallet']} />
              </li>
              <li className="rounded-xl border border-gray-200 bg-white p-4 dark:bg-slate-900">
                <span className="font-medium text-gray-900">One live card per member</span>
                <p className="mt-1">Staff still control:</p>
                <MethodList items={['Complimentary issue', 'In-person issue', 'Replacement cards']} />
                <p className="mt-1">
                  A person cannot collect a second active card at the same venue. A replacement keeps the
                  original expiry; it does not add a year.
                </p>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section
        id="till"
        eyebrow="At the bar"
        title="How the till and phone wallets talk to the same card."
        lead="QR codes can be scanned at the till, open a stable link, or run a landing-page script the venue writes. Phone wallets use the venue name and logo."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Till mode</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Till QR</h3>
            <p className="mt-2 text-sm text-gray-600">
              A QR the till can scan as a membership card at the bar. Additional hardware is required.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">URL mode</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Scan gateway</h3>
            <p className="mt-2 text-sm text-gray-600">
              The QR stores a stable link for that venue. On scan we send the till or partner system
              the card details they need, so you can change the destination without reprinting cards.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Script mode</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Custom landing page</h3>
            <p className="mt-2 text-sm text-gray-600">
              On scan, a branded page runs JavaScript the venue supplies. Name, mobile, email, and card
              number are in scope, so a door or till system can check someone in without a new card print.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Wallets</p>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">Phone wallets</h3>
            <p className="mt-2 text-sm text-gray-600">
              Apple Wallet and Google Wallet use the venue name and logo. Google Wallet keeps each venue’s
              cards in their own group, so two halls do not sit under one issuer pile.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="renew"
        eyebrow="Keep the number"
        title="Renew the same card, from a month before it runs out."
        lead="The extra year is added from the current expiry date, not from the day the member pays. Staff can renew at the bar. Members use the reminder link."
      >
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">Same card number</h3>
            <p className="mt-2 text-sm text-gray-600">
              Renewal updates the existing membership. It does not issue a second card or send the
              physical card back through the encode queue.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">When it opens</h3>
            <p className="mt-2 text-sm text-gray-600">
              Members can renew from one month before expiry, and after it has expired. Paying early
              still adds the year on to the printed expiry, not to today.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">Reminders the venue controls</h3>
            <p className="mt-2 text-sm text-gray-600">
              Email and text reminders can be switched on or off per venue. Replacement cards keep the
              original expiry — they are not a free extra year.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="payments"
        eyebrow="Money"
        title="Take payment how the venue already takes payment."
        lead="Members pay online. Staff record payment at the venue. Venues buy credits to issue cards, and can see subscription take without mixing those packs in."
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4 text-sm text-gray-600">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:bg-slate-900">
              <p className="font-semibold text-gray-900">Online</p>
              <MethodList items={['Card checkout', 'Open banking', 'Free plans on the public form']} />
              <p className="mt-2">When payment completes, the membership is issued and the card is sent. A £0 plan can be completed without a card or bank payment.</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:bg-slate-900">
              <p className="font-semibold text-gray-900">At the venue</p>
              <p className="mt-1">Staff only, so a public form cannot issue a complimentary card.</p>
              <MethodList items={['Cash', 'In person', 'Complimentary']} />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:bg-slate-900">
              <p className="font-semibold text-gray-900">Payouts and processors</p>
              <p className="mt-1">A venue can take payment through:</p>
              <MethodList items={['Platform payments', 'The venue’s own card processor', 'Open banking']} />
            </div>
          </div>
          <ReportsShot />
        </div>
      </Section>

      <section className="border-y border-gray-200 bg-white py-14 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Integrations</p>
          <h2 className="mt-2 text-3xl font-bold text-gray-900">Wired for the stack venues already have.</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {INTEGRATIONS.map((item) => (
              <div key={item.name} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 dark:bg-slate-800">
                <p className="font-medium text-gray-900">{item.name}</p>
                <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Section
        id="api"
        eyebrow="Partner API"
        title="Issue a membership from a partner system."
        lead="Each venue creates its own keys. The key is shown once. Calls are scoped to that venue — they cannot see another venue’s members."
      >
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <ApiShot />
          <div className="space-y-4 text-sm text-gray-600">
            <p>Authenticate with a bearer key. List plans, then issue from:</p>
            <MethodList items={['Till', 'Website', 'Club system']} />
            <p>You choose whether this platform notifies the member, or you notify them yourself and just collect the card URL:</p>
            <MethodList items={['Email', 'SMS']} />
            <p>
              Optional card numbers can be supplied by the partner. Numbers stay unique at that venue.
            </p>
            <p className="text-gray-500">
              Names and emails in the sample are fictional. Live keys never appear on this page.
            </p>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Operations"
        title="Multi-venue, and branded for each venue."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">Venues</h3>
            <p className="mt-2 text-sm text-gray-600">Each venue has its own:</p>
            <MethodList
              items={['Members', 'Plans', 'Card stock', 'Pass types', 'Branding', 'Payment settings', 'API keys', 'Staff logins']}
            />
            <p className="mt-2 text-sm text-gray-600">Staff switch venue in admin.</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <p className="mt-2 text-sm text-gray-600">Email:</p>
            <MethodList items={['Welcome', 'Digital card', 'Renewal reminders']} />
            <p className="mt-2 text-sm text-gray-600">
              SMS for welcome, digital card, and renewal. Each venue can switch renewal email and renewal
              texts on or off.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:bg-slate-900">
            <h3 className="font-semibold text-gray-900">Branding</h3>
            <p className="mt-2 text-sm text-gray-600">Venue logo and name appear on:</p>
            <MethodList items={['Signup', 'Digital card', 'Wallet passes', 'Scan landing page']} />
            <p className="mt-2 text-sm text-gray-600">
              Members see their venue, not a generic platform. Google Wallet groups cards by venue.
            </p>
          </div>
        </div>
      </Section>

      <section className="border-t border-gray-200 bg-white py-16 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900">Run a venue?</h2>
          <p className="mt-3 text-gray-600">
            Members join through the link their venue sends. This site does not list venues or look up
            cards.
          </p>
          <Link
            href="/admin/login"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Sign in to Membership Manager
          </Link>
        </div>
      </section>
    </div>
  )
}
