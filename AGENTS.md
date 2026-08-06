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
```

Verify with lint + build before any push. Browser tests use Playwright MCP against `localhost:3000` (dev) or the live site.

## Key architecture

- Chat-first funnel: landing → details form → chat. The chat (`src/components/arya-chat.tsx`) is the core: instant chart-at-a-glance, context-aware starter chips, one-tap teaser chip, signup gate, paywall, kundli matching.
- `/api/chat` = 5-node pipeline: routing → transits → Vedic RAG → composed streaming → reflection. Crisis guard first. Optional `matchKundli` for compatibility. Panchang node: for tithi/muhurat questions (`panchang` routing topic), injects free offline panchang (`src/lib/panchang.ts`, sidereal tithi/nakshatra/yoga/karana, validated against drikPanchang reference) and — env-gated only — the lazy drikPanchang API (`src/lib/drikpanchang.ts`, `DRIKPANCHANG_API_KEY`, cached per date+place, 5s timeout, fallback to free calc) for timing-window intent.
- `/api/kundli` computes a chart (Swiss Ephemeris). `match: true` skips profile persistence (partner chart).
- Monetization (experiment): Q1 free → Google signup gate before Q2 → 5 free total (`FREE_LIMIT=5` in `arya-chat.tsx`) → paywall. Packs: `PACKS` = ₹10/10q, ₹20/30q (default), ₹30/50q. Repeat buyers (prior purchase in localStorage) also see `UNLIMITED_PACK` (p60): ₹60 for unlimited questions over 7 days (`UNLIMITED_DAYS`, `jyotish_unlimited_until_v1`). `asked_count` persisted in localStorage.
- Orders: `orders` table records amount/pack/order_id/payment_id; `paid20_at` on profiles is legacy (name is misleading).

## Key files

- `src/app/[locale]/page.tsx` — landing (Ask Arya CTA, question chips → `/details?q=`)
- `src/app/[locale]/details/page.tsx` + `src/components/details-form.tsx` — birth details (time optional → 12:00)
- `src/app/[locale]/chat/page.tsx` — thin server wrapper → `src/components/arya-chat.tsx`
- `src/components/place-autocomplete.tsx` — Google Places + Open-Meteo fallback + "Use <city>" escape hatch
- `src/components/match-card.tsx` + `src/lib/ashtakoota.ts` + `src/lib/match.ts` — kundli matching (36-guna)
- `src/lib/prompt.ts` — Arya's persona + rules (punchy 90–110 words, plain language, chart-bound, no deception, consistency, re-anchor, short teaser)
- `src/lib/pixel.ts` — Meta Pixel events (Purchase = real-only, `event_id` for CAPI dedup)
- `src/lib/supabase.ts` — client; non-production uses test project when `*_TEST` env vars set
- `src/lib/starters.ts` — context-aware follow-up chips
- `supabase/migrations/` — 0001_init, 0002_auth_rls (staged), 0003_orders

## Supabase

- **Migrations:** files are Supabase CLI format. CLI not installed locally; migrations applied manually in the dashboard SQL editor (user's established workflow). Plan: set up CLI + Vercel migration step (pending).
- **Test branch:** create a second Supabase project, run migrations, set `NEXT_PUBLIC_SUPABASE_URL_TEST`, `NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST`, `SUPABASE_SERVICE_ROLE_KEY_TEST`. Code automatically uses it in non-production. (Not yet created — pending.)
- RLS enabled but zero policies on all tables (0002 staged). Fine while single-device; revisit before real auth.
- **Current prod data:** ~35 real profiles, 33 chats. Paid: Pratiksha ₹30, Gourav ₹10. No test residue (cleaned).

## Tracking

- **Meta Pixel (ID 1909120949758851):** PageView (SPA), Lead, Signup, FirstAnswer, QuestionChip, PaywallShown, PackSelected, InitiateCheckout (Pay click), Purchase (real-only, value = actual order amount, INR, event_id), PaywallDismissed.
- **Clarity (project xxn1pixdrd):** session replays/heatmaps; birth fields excluded (`data-exclude`).
- Note: no Conversions API yet.

## Known issues / pending

- Google OAuth consent screen not published + `hiarya.in` origin not added to OAuth origins (login degrades gracefully via timeout).
- Razorpay webhook secret set; confirm webhook active in dashboard.
- No re-engagement loop (zero returning users) — daily reading reminder + resume-last-chat are open ideas.
- Revisit restoring prior chat threads on return (no resume UX yet).
- Set up Supabase CLI + Vercel migration step (user deferred — "tomorrow").
- Create the test Supabase project for a clean test DB.

## Findings so far (see PROJECT-REPORT.md)

- **#1 funnel leak = Q1 → Q2** (every user asks one question then drops). One-tap teaser chip shipped to attack it.
- **Conversion is crisis-driven** — both payers had a relationship crisis; paid within ~10 min.
- **Zero returning users** — no retention mechanism.
- Hindi/Marathi users engage deeper than English.

## Privacy

- `user-questions.txt`, `.env*`, `.playwright-mcp/` are gitignored. Do not commit secrets, PII, or real chat transcripts. Don't use real user names in tests.
