# Jyotish — AI Vedic Astrologer

Mobile-first web app: generate a **Vedic Kundli** (Swiss Ephemeris) and chat with **Arya**, a chart-aware AI astrologer. 3 languages — English, Hindi, Marathi.

## Design
"Vedic night" system — warm plum-black + saffron/marigold/kumkum, grounded in the subject's vernacular. Display serif **Fraunces** + **Tiro Devanagari Marathi** for headings, Inter for body. Signature element: a slowly rotating **navagraha mandala** (12 rashi glyphs + 9 planetary forces around ॐ) in the landing hero, motion-safe.

## Stack
- **Next.js 16** (App Router) + TypeScript + Tailwind v4 · dark cosmic + gold UI
- **next-intl** for i18n (`/en`, `/hi`, `/mr`)
- **swisseph-wasm** — Swiss Ephemeris (Lahiri ayanamsa, whole-sign houses, Vimshottari Dasha) on the Node backend
- **Google Places Autocomplete** for birth-place selection (falls back to Open-Meteo search if no key)
- **Open-Meteo** for timezone resolution (free, no key)
- **Swiss Ephemeris "transit tool"** — real current gochar positions computed for today and injected into every Arya prompt (no guessing the sky)
- **Topic routing node** — classifies each question (love/marriage/career/money/health/education, en/hi/mr keywords) and focuses Arya on the relevant houses/planets instead of reading the whole chart
- **Vedic RAG node** — retrieves authoritative knowledge (nakshatra traits, planet karakas, house meanings, Dasha rules, Mangal Dosha/Gun Milan, remedies) scored by topic + chart and grounds each answer
- **Reflection node** — fact-checks claim-heavy answers against the real chart data with a second LLM pass and auto-corrects (toggle with `LLM_REFLECTION`)
- **LLM API** (OpenAI-compatible, defaults to DeepSeek) streaming Arya's replies

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

## Configure

Copy `.env.local.example` → `.env.local` and fill in:

| Variable | Purpose |
|---|---|
| `LLM_API_KEY` | Required for live Arya replies |
| `LLM_BASE_URL` | OpenAI-compatible endpoint. DeepSeek: `https://api.deepseek.com/v1` · Groq: `https://api.groq.com/openai/v1` |
| `LLM_MODEL` | e.g. `deepseek-v4-flash`, `deepseek-chat`, `llama-3.3-70b-versatile` |
| `LLM_MAX_TOKENS` | Output budget (default 4096). Raise for reasoning models — hidden `reasoning_content` still consumes it |
| `LLM_REASONING_EFFORT` | `low` for reasoning models (e.g. `deepseek-v4-flash`) — cuts hidden reasoning tokens ~40%, the biggest cost lever. Remove for non-reasoning models. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional — schema in `supabase/migrations/0001_init.sql`, not yet wired |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Enables Google Places autocomplete. **Restrict this key by HTTP referrer** in Google Cloud (it's exposed in the browser). Falls back to Open-Meteo search without it. |

Without `LLM_API_KEY`, Arya returns a friendly placeholder so the UI flow still works.

## Flow
`/` (landing) → `/details` (birth form + place geocoding) → `/api/kundli` (Swiss Ephemeris) → `/kundli` (North-Indian SVG chart, planets, Dasha) → `/chat` (streaming chat with Arya, personalized to the chart, replies in the selected language).

Kundli data is stored in `localStorage` (no account needed — matches the ad → free-chat → later-paywall funnel).

## Scripts
```bash
npm run dev     # dev server
npm run build   # production build
npm run start   # serve production build
npm run lint    # eslint
```

## Notes
- `swisseph-wasm` is a WASM build of Swiss Ephemeris (AGPL). Fine for testing; buy a commercial license from Astrodienst before a commercial launch, or swap to an MIT engine.
- Wireframes preserved in `wireframes/`.
