# HiArya — Full Data Pack (for consultant review)

**Generated:** 2026-08-08 · **Product:** AI Vedic astrology chat app (hiarya.in) · **Launch:** ~Aug 3, 2026
**Funnel:** Landing → birth-details form → chat with "Arya" → signup gate → paywall → paid questions
**Monetization:** Packs ₹10/10q, ₹20/30q, ₹30/50q, ₹60/7-day unlimited · **Ad spend:** ₹1,400 to date

---

## 1. REVENUE & TRANSACTIONS (Razorpay + Supabase)

- **Total captured revenue: ₹600** (29 payments, all UPI) — includes ~₹40 idempotency-test data; real ≈ ₹580
- **Daily:** Aug 4 ₹10 · Aug 5 ₹40 · Aug 6 ₹220 · Aug 7 ₹150 · Aug 8 ₹180
- **Paid orders in DB:** 28 · distinct payers: **15**
- **Repeat buyers: 6 of 15 (40%)** → ₹450 of ₹590 (76% of revenue)
  - 5 orders (₹110), 4 orders (₹150), 3×2 users, 2×2 users
- **Cross-day returns exist — this is NOT a zero-return product:**
  - `8d08e768`: **3 consecutive days (Aug 6, 7, 8)** — genuine returning customer, ₹150
  - `db06c396`: bought Aug 5 + 6 (returned next day)
  - `5a805afc`: bought Aug 7 + 8 (returned next day)
  - `8f5eeeaa`: Aug 7 + 8 (crossed midnight, mostly same-day refills)
  - `9583f2d2`, `e5c000db`: same-day refills only
  - **4 of 6 repeat buyers made purchases on separate days** → early signal that a retention loop can work; "zero returning users" is outdated (AGENTS.md note is wrong)
- **AVG payment: ~₹20.7 per transaction** · avg per payer ₹40
- **Discrepancy (DB vs Razorpay):** RZP 29 captured / ₹600 vs DB 28 / ₹590 — one ₹10 captured payment never marked `paid` (webhook miss)

## 2. FUNNEL (Clarity, Aug 2–8)

| Stage | Users | Conversion |
|---|---|---|
| Unique visitors | 245 | 100% |
| Reached /details | 184 | 75% |
| Reached /chat | 143 | **58%** |
| Signups (profiles) | 177 | 72%* |
| Paid (distinct) | **15** | **6.1%** of visitors / **10.5%** of chat starters |

*Profiles created device-level even pre-gate, so overlaps upstream.

**Funnel leaks:** (1) 42% of details-visitors never start a chat (Q1→Q2) — teaser chip shipped to fix; (2) biggest drop overall is entry into chat.

## 3. TRAFFIC SOURCE & DEVICE (Clarity)

- **Sources:** Instagram 102 sessions · Direct 99 · Facebook 92+90+11+11 (~204 total FB/Meta)
- **Browsers:** InstagramApp 131 · FacebookApp 123 · Chrome (PC) 53 · ChromeMobile 43 · Safari 21 · GoogleApp 9
- **≈ 88% of sessions are in-app browsers** (Meta in-app webview) — payments/redirect friction risk
- **Geography:** all India — Pune 53, Mumbai 20, Delhi 12, Jaipur 12, Vadodara 10, Bengaluru 7, Ahmedabad 6, Aurangabad 5, Lucknow 5

## 4. ENGAGEMENT & UX (Clarity)

- Avg session duration: **8.4 min** · Avg scroll depth: **85%** · Avg clicks/session: 2.4
- **Quick backs: 163** · **Dead clicks: 647** · **JS errors: 38** (worth investigating — could explain Vaishnavi's "sheet won't open" issue)
- Language mix: Hindi PV 292 > English 131 > Marathi 112

## 5. WHAT USERS ASK (1,226 real questions)

| Topic | Count |
|---|---|
| Marriage (timing/love-vs-arrange/partner) | ~347 (28%) |
| Career/job/govt-job (SSC GD, NET, professor) | 87 |
| Love/relationship | 79 |
| Future/predictions (month/year windows) | 39 |
| Business/money/debt | 35 |
| Kundli reading (dosh, yog, rahu-ketu) | 17 |
| Children/family | 16 |
| Spiritual/upay | 14 |
| Health | 8 |
| Yes/hoo/sanga teaser follow-ups | 631 |

- **Marriage + love ≈ 35% of all questions**; payers are crisis-driven (love-marriage family conflict, divorce/reconciliation)
- Teaser chip converts 1 question into 5–10 follow-ups (631 yes/hoo replies) — engine works
- **3 explicit self-harm messages** + heavy anxiety language in crisis threads (crisis guard is load-bearing)

## 6. ROAS / UNIT ECONOMICS

| Metric | Value |
|---|---|
| Ad spend (Meta) | ₹1,932.17 (₹1,400 earlier estimate was wrong — campaign alone spent more) |
| Revenue | ~₹580–600 |
| **ROAS** | **~0.30×** (Meta reports 0.27) |
| Net | **~−₹1,340** |
| Cost per purchase | ₹77.29 |
| Avg revenue per purchase | ₹20.87 |
| Break-even | needs 3.7× AOV or ~3.7× fewer purchases cost |

### Meta vs internal — RECONCILED (no real discrepancy)

| | Meta | Internal |
|---|---|---|
| Purchases | 25 | 29 payments / 15 payers |
| Value | ₹522 (avg ₹20.87) | ₹600 (avg ₹20.69/payment) |
| ROAS | 0.27 | 0.30 |

**The "gap" is an artifact of counting, not lost revenue:** we fire one Purchase event *per payment* (₹10/₹20 packs), so Meta's 25 purchases ≈ our 29 payments. Avg value per purchase matches almost exactly (₹20.87 vs ₹20.69). The remaining ~₹60 difference = attribution window (7-day click/1-day view) + the ₹40 idempotency-test payments. **There is no hidden revenue and no broken tracking — the problem is pure unit economics: ₹77 CAC vs ₹21 AOV.**

### Creative breakdown (Arya | Maharashtra | Test 01)

| Creative | Spend | Purchases | ROAS | CTR | CPP | Value/purchase |
|---|---|---|---|---|---|---|
| Hindi | ₹971 (50%) | 12 | 0.22 | 5.31% | ₹81 | ₹17.80 |
| Marathi | ₹691 (36%) | 9 | **0.35** | 2.82% | ₹77 | ₹26.87 |
| English | ₹270 (14%) | 4 | 0.26 | **8.43%** | ₹68 | ₹17.57 |

- **Marathi is the best creative** (highest ROAS, best value/purchase) despite lowest CTR — its users actually pay more (₹26.87 vs ₹17.8) — aligns with "Marathi users engage deeper"
- **Hindi burns the most budget at worst economics** (50% of spend, 0.22 ROAS)
- **English has the highest CTR but converts lowest** (high interest, low purchase intent)
- Frequency 1.77 · CTR 4.37% · CPC ₹4.87 · CPM ₹212.86 · Reach 5,138

## 6b. CAMPAIGN CONFIG (Arya | Maharashtra | Test 01)

- Objective: Sales optimization · Daily budget ₹500 · Active now · Maharashtra-targeted
- **Geography note:** campaign targets Maharashtra but Clarity shows users in Delhi/Jaipur/Vadodara/Bengaluru → either other campaigns are running or targeting is broader than labeled — **confirm all campaigns, not just this one**

---

## 7. DATA I NEED FROM META ADS (questions to run in Meta Ads Manager / ask Meta AI)

To complete the picture I need these from the **Meta side** (Pixel events + ads manager). Please pull each:

1. **Spend & ROAS:** Total ad spend, total attributed purchases (7-day click / 1-day view), and purchase ROAS for the whole campaign + by campaign/adset. Compare to our ₹1,400 spend / ₹600 tracked revenue.
2. **Campaign structure:** Number of campaigns/adsets/ads, their names, objectives (traffic vs leads vs conversions), daily budgets, and which adset(s) drove the ₹600.
3. **Pixel funnel events (Aug 2–8):** Counts for PageView → Lead → Signup → FirstAnswer → QuestionChip → PaywallShown → PackSelected → InitiateCheckout → CheckoutOpened → CheckoutAbandoned → Purchase. This tells us where Meta-attributed users drop vs our Clarity funnel.
4. **Purchase value by pack:** how many purchases per amount (₹10/₹20/₹30/₹60) in Meta attribution.
5. **Breakdowns:** purchases + spend by gender, age, region (state), and by platform (FB vs IG) — we suspect heavy Instagram in-app-browser traffic.
6. **Frequency & CTR:** avg frequency, CTR, CPC, CPM per adset — is frequency too high (re-impressions to same users)?
7. **Pixel health:** any event deduplication warnings (CAPI vs browser), unverified purchases, or event quality issues.
8. **Audience:** which interest/lookalike/advantage+ audiences were used, and which delivered the 15 payers (esp. the 6 repeat buyers).

> If you'd rather not touch Ads Manager, Meta AI can read it from the same account — just ask it for the exact metrics above with the date range **Aug 3 – Aug 8, 2026**.

---

## 8. KNOWN ISSUES / OPEN THREADS

- **Vaishnavi Aug 8:** 8 Razorpay orders created, **0 payment attempts** = checkout sheet never opened (likely checkout.js load failure in in-app browser). **Idempotency fix shipped** (reuse pending order + Pay-button lock) — stops duplicate-order spam.
- **Funnel leak Q1→Q2** (details→chat) is the biggest fixable loss.
- **Webhook miss:** 1 captured payment not marked paid in DB — needs reconciliation job.
- **Zero CAPI** — purchase dedup is browser-only today.
- 38 JS errors in Clarity — suspect source of sheet-fail issues on in-app browsers.
- Google OAuth not fully published; login degrades gracefully.
