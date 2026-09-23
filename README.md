# Managika Homes

Multi-landlord property management app for the Kenyan market: tenants, units,
leases, rent invoicing, three different ways rent actually gets paid, and
the WhatsApp/SMS messages that go with all of it. Live at
[managikahomes.co.ke](https://managikahomes.co.ke).

Built with Next.js (App Router) and Supabase (Postgres + Auth), deployed on
Vercel, DNS on Cloudflare. There's also a signed Android app (a Trusted Web
Activity wrapping the same site) — see [Android app](#android-app) below.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll need a `.env.local`
with at least the Supabase variables below to get past the login screens —
see [Environment variables](#environment-variables).

```bash
npm test        # runs the automated test suite (vitest)
npm run lint    # eslint
npm run build   # production build
```

## How the app is organized

- `app/landlord/*`, `app/tenants`, `app/payments`, `app/units`, `app/properties`,
  etc. — the landlord-facing pages (client components, talk to Supabase
  directly through the anon key + Row Level Security, or through `app/api/*`
  routes when a server-held secret is needed).
- `app/tenant/*` — the tenant-facing portal (own payments, maintenance
  requests, complaints, documents).
- `app/api/*` — server routes. Two kinds: ones a browser calls (auth'd via a
  Supabase session token), and ones a third party calls (M-Pesa's callback,
  the bank SMS forwarder, cron triggers) — those are auth'd by a shared
  secret in the URL or a signature header instead, since there's no Supabase
  session involved.
- `lib/*` — shared server logic. The important ones:
  - `supabase-admin.ts` / `supabase.ts` — the two Supabase clients: admin
    (service-role key, bypasses RLS, server-only) and the anon client the
    browser uses (RLS-scoped to whoever is logged in).
  - `invoice-math.ts` — the "is this invoice paid, partial, or unpaid"
    calculation, shared by every place a payment gets recorded so it can't
    drift between them. Fully covered by `lib/__tests__/invoice-math.test.ts`.
  - `payment-confirmation.ts` — sends the "we got your payment" message on
    WhatsApp **and** SMS together (neither is a fallback for the other),
    used by every payment-recording route.
  - `admin-alert.ts` — texts the landlord (`ADMIN_ALERT_PHONE`) when
    something in the payment pipeline fails silently — a payment that
    didn't save, a bank SMS that couldn't be matched to a tenant, a webhook
    crash. Throttled to one alert per problem every 30 minutes.
  - `tenant-phone.ts` — normalizes any Kenyan phone format
    (`07...`, `254...`, `+254...`) to E.164, used everywhere a message gets
    sent or a tenant gets looked up by phone.
  - `period.ts` — "what billing period is it right now, in Nairobi time" —
    servers run in UTC, so this exists to stop a 1am payment landing on the
    wrong month's invoice.
  - `rate-limit.ts` — a shared Postgres-backed counter (`rate_limits` table +
    `rate_limit_hit()` function) used for both public-endpoint rate limiting
    and admin-alert throttling.
- `supabase/migrations/*` — SQL migrations, applied via the Supabase MCP/CLI.

## How rent actually gets recorded

There are three independent paths, all converging on the same invoice/payment
tables and the same `invoiceStatusFor()` / `sendPaymentConfirmation()` calls:

1. **M-Pesa STK Push** (`app/api/mpesa-callback/route.ts`) — a tenant taps
   "Pay" in the app, gets an STK prompt on their phone, and Safaricom calls
   this URL back with the result. Guarded by a `token` query param
   (`MPESA_CALLBACK_SECRET`).
2. **Bank SMS forwarder** (`app/api/sms-payment-webhook/route.ts`) — an
   Android SMS-forwarding app on the landlord's phone watches for
   `FamilyBank` texts (the paybill confirmation SMS) and POSTs them here.
   The tenant is identified by a "#unit" tag they're asked to put in the
   M-Pesa message (e.g. `#D25`). Guarded by an HMAC-SHA-256 signature
   (`SMS_WEBHOOK_SECRET`) computed over the raw body, and optionally scoped
   to one landlord via `SMS_WEBHOOK_LANDLORD_ID`. Anything that arrives but
   can't be parsed or matched lands in `sms_payment_log` (visible on the
   "Unmatched bank SMS" admin page) instead of being silently dropped.
3. **Manual entry** (`app/payments/page.tsx` + `app/api/send-payment-whatsapp/route.ts`) —
   a landlord records a cash/bank payment by hand.

Water-bill payments (`app/api/water-readings`) and payment-claim approvals
(`app/api/landlord/payment-claims`) also update invoice status through the
same shared math.

## Scheduled jobs

Defined in `vercel.json`, each guarded by `CRON_SECRET`:

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/rent-reminders` | 1st of month, 08:00 | SMS + WhatsApp rent reminders |
| `/api/cron/subscription-renewals` | daily 03:00 | Landlord subscription billing |
| `/api/cron/trial-expirations` | daily 04:00 | Trial-ending notices |
| `/api/cron/lease-renewal-reminders` | daily 05:00 | Lease ending soon |
| `/api/cron/maintenance-due` | daily 06:00 | Preventive maintenance due |
| `/api/cron/weekly-summary` | Mondays 05:00 | Weekly landlord summary |

All times UTC (= Nairobi time − 3h).

## Environment variables

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, used by the browser client.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, bypasses RLS. Never exposed to the browser.

**Rent payments**
- `MPESA_CALLBACK_SECRET` — shared secret in the Safaricom callback URL.
- `SMS_WEBHOOK_SECRET` — HMAC key the bank-SMS forwarder app signs with.
- `SMS_WEBHOOK_LANDLORD_ID` — optional; scopes bank-SMS matching to one landlord.

**Messaging**
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — Meta WhatsApp Cloud API.
- `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_SENDER_ID` — SMS.
- `ADMIN_ALERT_PHONE` — where payment-pipeline failure alerts get texted.
- `WEEKLY_SUMMARY_SMS` — toggles SMS delivery of the weekly summary.

**Managika's own subscription billing** (landlords paying Managika, not
tenants paying rent — via IntaSend, separate from the M-Pesa Daraja flow above)
- `INTASEND_ENV`, `INTASEND_PUBLISHABLE_KEY`, `INTASEND_SECRET_KEY`
- `MANAGIKA_SUBSCRIPTION_CALLBACK_SECRET`

**Other**
- `CRON_SECRET` — guards every `/api/cron/*` route.
- `GEMINI_API_KEY` — powers the AI Assistant page and tenant-list scanning.

## Testing

`npm test` runs the vitest suite (`lib/__tests__/*.test.ts`). It currently
covers the payment-critical pure logic: invoice status/balance/collection-rate
math, phone number normalization, the Nairobi-timezone billing period
calculation, and the tenant-facing balance text. It does **not** cover the
API routes themselves (those need a live Supabase instance) — the tests are
deliberately scoped to logic that's pure, high-stakes, and was previously
duplicated across multiple files.

Run it before pushing any change that touches payment/invoice logic.

## Deployment

Push to `main` → Vercel auto-deploys. DNS is on Cloudflare, pointed at
Vercel. No staging environment currently — changes go straight to
production, so `npm test` + a manual look at the affected page before
pushing is the safety net.

## Android app

`public/managika.apk` is a signed Trusted Web Activity (built with
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap)) wrapping the
live site — not a separate codebase. `/download-app` is the public download
page. `public/.well-known/assetlinks.json` has to keep matching the
signing key's SHA-256 fingerprint for the app to open full-screen (without a
browser address bar) instead of falling back to a Chrome Custom Tab.

## A few things worth knowing

- **Timezone**: the server runs in UTC; Nairobi is UTC+3. Anything involving
  "what month is it" or "what day is it" for billing purposes goes through
  `lib/period.ts`, never a plain `new Date()` — see the comment there for the
  exact bug this avoids.
- **Multi-landlord isolation**: every table with landlord-owned data has RLS
  enabled and is scoped by `landlord_id`. When adding a new table or route,
  match that pattern rather than filtering in application code alone.
- **Windows line endings**: this repo is normally worked on from a Windows
  machine; Git's `core.autocrlf` warnings about LF→CRLF on commit are
  expected and harmless.
