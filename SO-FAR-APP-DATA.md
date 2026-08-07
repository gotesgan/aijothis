# So Far — App Data Report
**Date:** 6 Aug 2026 · **Source:** Meta Ads + Supabase + Microsoft Clarity + product analytics
**Status:** Live product with paid campaign, 9 paid orders, ₹170 revenue

---

## 1. Overview

| Dimension | Number |
|---|---|
| Real profiles (leads) | ~75 (90 total, ~15 test) |
| Signups since Aug 1 | 48 |
| Chats | 88 |
| Messages | 1,000 |
| Paid orders | 9 |
| Abandoned checkouts | 7 |
| **Revenue** | **₹170** |
| Campaign spend | ₹454.24 |
| Campaign ROAS | **0.20** |

---

## 2. Meta Ads (campaign "Arya | Maharashtra | Test 01", ID 120248271176420438)

| Metric | Value |
|---|---|
| Purchases (attributed) | 6 |
| Purchase ROAS | **0.20** |
| Amount spent | ₹454.24 |
| Cost per result | ₹75.71 |
| Revenue implied (ROAS) | ~₹90.85 |
| Impressions | 2,150 |
| Reach | 1,333 Meta Accounts |
| Clicks (all) | 112 (101 link clicks) |
| CTR | 5.21% |
| CPC | ₹4.06 |
| Website leads | 51 |
| Landing page views | 82 |
| Checkouts initiated | 9 |
| Creative | Non-video (ThruPlays unavailable) |
| Bidding | Highest volume · active |

---

## 3. Supabase (app data)

| Table | Total | Since Aug 1 |
|---|---|---|
| Profiles | 90 | 90 |
| Signups (`signed_up_at`) | — | 48 |
| Chats | 88 | — |
| Messages | 1,000 | — |
| Orders | 16 | — |

**Orders breakdown:** 9 paid (₹170) · 7 created/abandoned (62% completion)
**Paid packs sold:** p10 ×3, p20 ×4, p30 ×2
**Repeat buyers:** 1 (Pratiksha — bought ₹30 twice, ₹60 lifetime)

---

## 4. Microsoft Clarity (Aug 1–6)

| Metric | Value |
|---|---|
| Sessions | 95 |
| Bounce rate | 21.05% |
| Engagement time | 32,886s (~9.1h) |
| Mobile share | ~83% |
| Funnel (Hindi, 3-day) | /hi 46 → /hi/details 40 (87%) → /hi/chat 28 (70%) |
| Dead clicks | **17 on /hi/details** (17.95% of sessions) |
| Rage clicks | 5 on /hi/details?q=मेरी शादी… |
| JS errors | "Java object is gone" ×3 (Android WebView, benign) + "Script error." ×1 |

---

## 5. The funnel (Meta + Clarity combined)

```
Impressions 2,150 → clicks 112 (CTR 5.21%, CPC ₹4.06)
→ landing views 82 → LEADS 51 (62% of landings)
→ signups 48 → checkouts 9 (18% of leads) → purchases 6–9 (12% of leads)
```

**Healthy upstream, broken downstream.** 62% of ad landings become leads (strong). Only **12% of leads buy** — that's where ₹454.24 is being lost.

---

## 6. Money math

| Scenario | Revenue | ROAS |
|---|---|---|
| Campaign-attributed (Meta) | ₹90.85 | **0.20** |
| All app revenue (DB) | ₹170 | 0.37 |

**Every ₹1 of ads returns ₹0.20–0.37.** The campaign loses ~₹280–360 for every ₹170 it generates. Scaling spend at this rate is not viable until the lead→paid conversion lifts.

---

## 7. What's working vs broken

### ✅ Working
- Ad + landing funnel (62% landings → lead)
- Teaser-chip continuation (drives deep engagement; payers tap it)
- Context-aware starter chips
- Signup gate (48 signups)
- Repeat purchase + returning-user memory (Pratiksha repurchased)
- Cross-session consistency ("As I said before…")
- Crisis guard (KIRAN routed) + honest-certainty (windows not dates)
- Order recording + Payment attribution

### ❌ Broken / leaking
- **Lead → checkout = 18%** (the #1 money leak)
- **Checkout abandonment** — 7 orders created, never paid (Razorpay sheet)
- **Dead/rage clicks on the details form** (17 dead clicks)
- **ROAS 0.20** — campaign loses money at current conversion

### 🛡️ Recently hardened (ethics/legal)
- Honest-certainty rule: month+year windows, no exact dates, no promise words
- AI-generated disclaimers in Terms + Privacy + consent line on details form
- No-deception rule (removed "lie to parents" behavior)
- Crisis guard with helplines

---

## 8. Revenue by customer (since launch)

| Customer | ₹ | Notes |
|---|---|---|
| Gourav Kumar | 10 | crisis (wife leaving) |
| Pratiksha | 30 + 30 | **repeat** · marriage crisis · highest LTV |
| Shivangi | 20 | marriage |
| Praveen s Kumar | 20 | property + ex partner |
| Pooja rajbhar | 20 | relationship |
| Bharat ral | 10 | — |
| Purnima | 10 | — |
| ganesh | 20 | — |

**Pattern:** every payer is crisis/relationship-driven. Emotional need converts, not curiosity.

---

## 9. Recommended next moves

1. **Do not scale ad spend at ROAS 0.20.** Fix conversion first, re-test, then scale.
2. **Attack lead→checkout** — the Q1→Q2 teaser-chip + paywall work targets this; watch the next data.
3. **Fix details-form dead/rage clicks** (always-clickable submit + validation hints).
4. **Watch abandoned-checkout recordings** in Clarity to diagnose the Razorpay-sheet drop.
5. **Re-check ROAS after funnel fixes** — target lead→purchase ≥ 25% (from 12%) to approach break-even.
6. **Clean test profiles** from the DB (90 total, ~15 test) so lead counts match Meta's 51.

---

*Generated 6 Aug 2026 from live Meta Ads, Supabase, and Clarity data.*
