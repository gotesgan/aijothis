<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jyotish — Project Context

AI Vedic astrology chat app. Users chat with **Arya**, an AI astrologer. Live at `https://www.hiarya.in` (Vercel project `aijothis`, GitHub `gotesgan/aijothis`). Mobile-first, 3 languages (en/hi/mr).

## Workflow rules (IMPORTANT)

- **Branch first:** create a new git branch before ANY change; implement + verify there; the user merges/pushes when ready. Do not commit directly to `main`.
- **Deploy:** pushing to `main` auto-deploys to Vercel. Prod = `https://www.hiarya.in` (Vercel `aijothis`, GitHub repo `gotesgan/aijothis`).
- **Never pollute production data with tests.** The DB is already clean (33 real users). Before any browser/curl test, use a `test-*` device id and — ideally — the test Supabase project (see Supabase section). Never use real-looking names like "Aarav"/"Shweta" in tests.
- **Ask before changing pricing/monetization mechanics** (gates, packs, paywall timing) — the user has strong opinions here.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind v4, Turbopack) — **this Next.js has breaking changes; read `node_modules/next/dist/docs/` before writing code**.
- `next-intl` (en/hi/mr), `swisseph-wasm` (server-side chart computation).
- LLM: DeepSeek `deepseek-v4-flash` (reasoning, `reasoning_effort=low`).
- Supabase (Postgres, RLS), Razorpay (live payments), Google Places + Identity.
- Tracking: Meta Pixel (funnel events) + Microsoft Clarity (replays) + Vercel Analytics.
- Key env: `.env.local` (gitignored). `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, LLM_*.

## Commands

```bash
npm run dev        # local dev (localhost:3000)
npm run lint       # eslint
npm run build      # production build (must pass before pushing)
npm run start      # run production build locally
npm run test:invariants  # pricing/quota invariants against a running dev server
```

Verify with lint + build before any push. Browser tests use Playwright MCP against `localhost:3000` (dev) or the live site.

**`npm run test:invariants` asserts PROPERTIES, not current numbers** — that the amount charged equals the pack the UI displayed, that client-supplied price/currency is ignored, that a forged region cookie cannot downgrade the price, that a malformed cookie is a 200 not a 500, that a replayed payment signature cannot grant to another device, and that the server blocks the 6th free question. Run it after ANY pricing, checkout or quota change — it is what stops the display-vs-charge class of bug from coming back. Writes only `test-inv-*` rows and deletes them at the end.

## Key architecture

- Chat-first funnel: landing → details form → chat. The chat (`src/components/arya-chat.tsx`) is the core: instant chart-at-a-glance, context-aware starter chips, one-tap teaser chip, signup gate, paywall, kundli matching.
- `/api/chat` = 5-node pipeline: routing → transits → Vedic RAG → composed streaming → reflection. Crisis guard first. Optional `matchKundli` for compatibility. Panchang node: for tithi/muhurat questions (`panchang` routing topic), injects free offline panchang (`src/lib/panchang.ts`, sidereal tithi/nakshatra/yoga/karana, validated against drikPanchang reference) and — env-gated only — the lazy drikPanchang API (`src/lib/drikpanchang.ts`, `DRIKPANCHANG_API_KEY`, cached per date+place, 5s timeout, fallback to free calc) for timing-window intent.
- `/api/kundli` computes a chart (Swiss Ephemeris). `match: true` skips profile persistence (partner chart).
- Monetization (experiment): Q1 free → Google signup gate before Q2 → 5 free total → paywall. The **server is the authority** on the free limit (`src/lib/quota.ts`, `FREE_LIMIT=5`): it counts persisted `messages` for the person and credits from `paid` orders across all google-linked devices. The client mirrors the limit purely so the paywall can appear without a round-trip, and handles the server's `402 quota_exhausted` by rolling back its optimistic bubble and opening the paywall. **Fails open** on any DB error — the worse failure is locking a paying customer out — and `SERVER_QUOTA_ENABLED=0` disables it without a deploy. Question packs are **cohort-based** (`src/lib/pricing.ts`, cutoff `PRICING_CUTOFF = 2026-09-20` IST): `current` = ₹99/20q, ₹149/50q (default), ₹299/100q; `legacy` = ₹60/10q, ₹70/30q, ₹80/50q, kept for devices whose profile predates the cutoff (resolved cross-device via `google_sub` in `src/lib/pricing-server.ts`). Legacy menu is INR-only — a legacy device seen from abroad is served the current menu in that currency. `asked_count` persisted in localStorage (`jyotish_asked_count_v1`).
- **Region pricing (INR / USD / EUR).** The price shown and the price charged are both derived server-side from one rule (`resolveRegion` in `src/lib/geo.ts`, pure so `src/proxy.ts` (edge) and `src/lib/region-server.ts` (Node) cannot drift):
  1. `PRICING_GEO_ENABLED=0` → kill switch, everyone is INR.
  2. `PRICING_REGION_OVERRIDE=IN|US|EU` → forced region, local testing.
  3. The sticky `jyotish_region_v1` cookie — the region we first showed prices for. It is **HttpOnly AND HMAC-signed** (`signRegionCookie`/`verifyRegionCookie` in `src/lib/region-signing.ts`, secret derived from `RAZORPAY_KEY_SECRET`, overridable with `PRICING_GEO_SECRET`). HttpOnly alone only stops same-origin JS — it does not stop `curl -H 'Cookie: jyotish_region_v1=IN'`, and self-downgrading is a ~76% revenue leak. An unsigned or tampered cookie fails **closed** and falls through to the IP header. The cookie beats the IP header so a traveller/VPN is never repriced at payment.
  4. `x-vercel-ip-country` → IN / eurozone → EU / everything else → US. Unknown ⇒ IN, so nobody sees a higher price than before.
  `resolveRegion` never parses raw cookie text — it takes an already-verified region, so unverified input cannot reach the pricing decision. Signing lives in `region-signing.ts` (server-only) because `geo.ts` is imported by the client bundle and must stay free of `node:crypto`.
  Foreign ladders: USD $4.99/20q, $9.99/50q, $19.99/100q; EUR €5.49/20q, €10.99/50q, €21.99/100q (priced off 2026 comps — Co-Star 25q=$6.99, Nummi $7.99/mo, human psychic chat $1.99–$30/min). **UK/CH/Nordics are charged in USD on purpose** (their cards bill USD natively); native GBP is a follow-up.
- **Money rules.** Prices are MAJOR-unit decimals everywhere; `src/lib/money.ts` owns `toMinorUnits`/`fromMinorUnits` (exponent per currency) + `formatPrice`. Never hardcode `₹` in JSX and never divide an order amount by 100 — INR/USD/EUR are all exponent 2 today but the helper exists so JPY can't silently send 100x. The browser sends only a **tier** to `/api/checkout`; amount, currency and credits are all server-owned.
- `orders.currency` already exists (default `INR`), so multi-currency needed no migration. `orders.amount_paise` is still named `amount_paise` but stores minor units of whatever `currency` says — **do not sum it across currencies.** `/api/admin/stats` scopes every `*Inr` field to INR orders and reports the rest under `revenue.byCurrency`.
- Razorpay handles USD/EUR on the same account and checkout integration (international cards 3% + GST; Stripe is 2.9% + $0.30 and only wins on bigger tickets). So no second provider — but **confirm the Razorpay international plan is enabled on the account before advertising to the US/EU**, and expect chargebacks/international-dispute handling to become a live problem at volume.
- Orders: `orders` table records amount/currency/pack/order_id/payment_id; `paid20_at` on profiles is legacy (name is misleading). The webhook now refuses to fulfil when the captured amount ≠ the amount we created the order for, and sends Meta CAPI the **order's** currency (must match the browser Pixel's, or dedup breaks and every foreign purchase double-counts).

## Key files

- `src/app/[locale]/page.tsx` — landing (Ask Arya CTA, question chips → `/details?q=`)
- `src/app/[locale]/details/page.tsx` + `src/components/details-form.tsx` — birth details (time optional → 12:00)
- `src/app/[locale]/chat/page.tsx` — thin server wrapper → `src/components/arya-chat.tsx`
- `src/components/place-autocomplete.tsx` — Google Places + Open-Meteo fallback + "Use <city>" escape hatch
- `src/components/match-card.tsx` + `src/lib/ashtakoota.ts` + `src/lib/match.ts` — kundli matching (36-guna)
- `src/lib/prompt.ts` — Arya's persona + rules (punchy 90–110 words, plain language, chart-bound, no deception, consistency, re-anchor, short teaser)
- `src/lib/pricing.ts` — cohort + currency pack menus (the single source of pricing truth)
- `src/lib/geo.ts` — country → region rule + `resolveRegion` (pure, isomorphic, shared edge/Node)
- `src/lib/region-signing.ts` — HMAC sign/verify for the region cookie (server-only; holds `node:crypto`)
- `src/lib/money.ts` — `toMinorUnits`/`fromMinorUnits`/`formatPrice` (no raw `₹` in JSX; throws on negative/non-finite rather than silently returning 0)
- `src/lib/pixel.ts` — Meta Pixel events (Purchase = real-only, `event_id` for CAPI dedup, carries `currency`)
- `src/lib/supabase.ts` — client; non-production uses test project when `*_TEST` env vars set
- `src/lib/starters.ts` — context-aware follow-up chips
- `supabase/migrations/` — 0001_init, 0003_orders, 0004_memory (auto-applied on push to main by GitHub Action). `supabase/deferred-migrations/0002_auth_rls.sql` — held back until real auth lands (see its README).

## Supabase

- **Migrations:** Supabase CLI installed (`brew install supabase/tap/supabase`). `.github/workflows/supabase-migrate.yml` runs `supabase db push` on every push to main (before Vercel serves new code). Migrations are idempotent (`IF NOT EXISTS`) so the first automated run replays already-applied 0001/0003 harmlessly and applies 0004 for real.
- **Secrets needed in GitHub** (repo → Settings → Secrets & variables → Actions): `SUPABASE_ACCESS_TOKEN` (Supabase dashboard → Account → Access Tokens), `SUPABASE_PROJECT_REF` = `pzezariotjvlsrjhbtnk`, `SUPABASE_DB_PASSWORD` (project DB password). Local link: `supabase login` then `supabase link --project-ref pzezariotjvlsrjhbtnk`.

- **Test branch:** create a second Supabase project, run migrations, set `NEXT_PUBLIC_SUPABASE_URL_TEST`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST`, `SUPABASE_SERVICE_ROLE_KEY_TEST`. Code automatically uses it in non-production. (Not yet created — pending.)
- RLS enabled but zero policies on all tables (`0002` deferred until real auth). Fine while single-device; revisit before real auth.

## Tracking

- **Meta Pixel (ID 1909120949758851):** PageView (SPA), Lead, Signup, FirstAnswer, QuestionChip, PaywallShown, PackSelected, InitiateCheckout (Pay click), CheckoutOpened, CheckoutAbandoned (dismissed/script_failed/failed), Purchase (real-only, value = actual order amount, INR, event_id), PaywallDismissed. Checkout recovery: `GET /api/orders` reconciles paid grants on return (webhook-only/cleared storage) + surfaces a resume-payment banner for recent abandoned checkouts.
- **Clarity (project xxn1pixdrd):** session replays/heatmaps; birth fields excluded (`data-exclude`).
- Note: no Conversions API yet.

## Known issues / pending

- Google OAuth consent screen not published + `hiarya.in` origin not added to OAuth origins (login degrades gracefully via timeout).
- Razorpay webhook secret set; confirm webhook active in dashboard.
- No re-engagement loop — daily reading reminder + resume-last-chat are open ideas (early cross-day repeat signal exists: 4 of 6 repeat buyers purchased on separate days, one on 3 consecutive days).
- Revisit restoring prior chat threads on return (no resume UX yet).
- Add GitHub secrets so the migration workflow runs: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` (first push to main will also apply migration 0004 for real).
- Create the test Supabase project for a clean test DB.

## Findings so far (see PROJECT-REPORT.md)

- **#1 funnel leak = Q1 → Q2** (every user asks one question then drops). One-tap teaser chip shipped to attack it.
- **Conversion is crisis-driven** — both payers had a relationship crisis; paid within ~10 min.
- **Early cross-day retention exists** — 4 of 6 repeat buyers purchased on separate days (one on 3 consecutive days); no explicit retention loop built yet, but the pull is real.
- Hindi/Marathi users engage deeper than English.

## Privacy

- `user-questions.txt`, `.env*`, `.playwright-mcp/` are gitignored. Do not commit secrets, PII, or real chat transcripts. Don't use real user names in tests.
