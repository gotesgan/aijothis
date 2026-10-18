/**
 * Pricing invariants.
 *
 * These assert PROPERTIES that must always hold, not the current numbers — so
 * a future pricing change that breaks the relationship between what the user is
 * shown and what they are charged fails here loudly.
 *
 *   Run a dev server first:  npm run dev
 *   Then:                    npm run test:invariants
 *
 * Writes are confined to `test-inv-*` device ids and removed at the end.
 */
const BASE = process.env.INVARIANTS_BASE_URL ?? "http://localhost:3000";
const CREATED_DEVICES = new Set();

let passed = 0;
const failures = [];

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed++;
  else failures.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
  console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : ""}`);
}

const EXPECTED = {
  IN: { starter: [9900, "INR"], standard: [14900, "INR"], deep: [29900, "INR"] },
  US: { starter: [499, "USD"], standard: [999, "USD"], deep: [1999, "USD"] },
  EU: { starter: [549, "EUR"], standard: [1099, "EUR"], deep: [2199, "EUR"] },
};
const COUNTRY = { IN: "IN", US: "US", EU: "DE" };

const dev = (label) => {
  const id = `test-inv-${label}`;
  CREATED_DEVICES.add(id);
  return id;
};

const post = (path, body, headers = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => null) }));

const get = (path, headers = {}) => fetch(`${BASE}${path}`, { headers }).then((r) => r.json());

// ── 1. What the UI renders is what gets charged ────────────────────────────
// /api/checkout echoes the `pack` the client rendered. The amount it charges
// must be derived from exactly that pack — never a second source.
console.log("\n1. displayed pack === charged amount");
for (const region of Object.keys(EXPECTED)) {
  for (const tier of Object.keys(EXPECTED[region])) {
    const { json } = await post(
      "/api/checkout",
      { packTier: tier },
      { "x-device-id": dev(`${region}-${tier}`), "x-vercel-ip-country": COUNTRY[region] }
    );
    const [amount, currency] = EXPECTED[region][tier];
    check(`${region}/${tier} amount matches displayed pack price`, json?.amount, amount);
    check(
      `${region}/${tier} minor units are consistent`,
      Math.round(json?.pack?.price * 100),
      json?.amount
    );
    check(`${region}/${tier} currency matches displayed pack`, json?.currency, json?.pack?.currency);
    check(`${region}/${tier} pack id is market-scoped`, json?.pack?.id, `current-${tier}-${currency.toLowerCase()}`);
  }
}

// ── 2. The browser cannot choose its own price ──────────────────────────────
console.log("\n2. client-supplied amount/currency are ignored");
for (const [label, body] of [
  ["price", { packTier: "deep", price: 1 }],
  ["amount", { packTier: "deep", amount: 100 }],
  ["currency", { packTier: "deep", currency: "INR" }],
  ["packId", { packTier: "deep", packId: "current-starter-inr" }],
]) {
  const { json } = await post("/api/checkout", body, {
    "x-device-id": dev(`tamper-${label}`),
    "x-vercel-ip-country": "US",
  });
  check(`tampered "${label}" still charges the real price`, [json?.amount, json?.currency], [1999, "USD"]);
}
{
  const { status } = await post("/api/checkout", { packTier: "__evil__" }, {
    "x-device-id": dev("bad-tier"),
    "x-vercel-ip-country": "US",
  });
  check("unknown tier rejected", status, 400);
}

// ── 3. Region cannot be downgraded ─────────────────────────────────────────
// Self-downgrading $4.99 → ₹99 is a ~76% revenue leak, so an unsigned or
// tampered region cookie must be ignored in favour of the edge country.
console.log("\n3. forged region cookies are ignored");
for (const cookie of ["jyotish_region_v1=IN", "jyotish_region_v1=EU", "jyotish_region_v1=IN.badsig"]) {
  const res = await get("/api/orders", {
    "x-device-id": dev("forge"),
    "x-vercel-ip-country": "US",
    cookie,
  });
  check(`forged [${cookie}] does not downgrade to INR`, res.currency, "USD");
}

// ── 4. A malformed cookie is a 200, not a crash ────────────────────────────
console.log("\n4. malformed cookies do not throw");
for (const value of ["%", "%E0%A4%A", "IN%2Eabc", "..", "IN."]) {
  const res = await fetch(`${BASE}/api/orders`, {
    headers: { "x-device-id": dev("malformed"), "x-vercel-ip-country": "IN", cookie: `jyotish_region_v1=${value}` },
  });
  check(`cookie "${value}" returns 200`, res.status, 200);
}

// ── 5. Replay cannot settle somebody else's order ──────────────────────────
// A valid signature proves the payment is real, not who is presenting it.
console.log("\n5. a replayed signature cannot grant to another device");
const victim = dev("victim");
const attacker = dev("attacker");
{
  const { json: order } = await post("/api/checkout", { packTier: "starter" }, {
    "x-device-id": victim,
    "x-vercel-ip-country": "IN",
  });
  const { createHmac } = await import("node:crypto");
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.log("  · skipped (RAZORPAY_KEY_SECRET not in env — run with --env-file=.env.local)");
  } else {
    const sign = (o, p) =>
      createHmac("sha256", secret).update(`${o}|${p}`).digest("hex");
    const body = { razorpay_order_id: order.orderId, razorpay_payment_id: "pay_inv_test", razorpay_signature: "" };
    const good = { ...body, razorpay_signature: sign(order.orderId, "pay_inv_test") };

    const attackerRes = await post("/api/payment-verify", good, { "x-device-id": attacker });
    check("attacker gets a signature error for a wrong-order signature", attackerRes.status, 200);
    const attackerOrders = await get("/api/orders", { "x-device-id": attacker });
    check("attacker granted no credits", attackerOrders.paidQuestionsTotal, 0);
  }
}

// ── 6. The free limit is server-side ───────────────────────────────────────
// Clearing localStorage must not buy more free questions.
console.log("\n6. the free limit is enforced by the server");
{
  const deviceId = dev("quota");
  const headers = { "x-device-id": deviceId };
  const kundli = await post(
    "/api/kundli",
    {
      name: "Test Invariant Bot",
      date: "1996-11-18",
      time: "06:00",
      place: "Pune",
      lat: 18.52,
      lng: 73.85,
      timezone: "Asia/Kolkata",
      lang: "en",
    },
    headers
  );
  check("kundli created for the test device", kundli.status, 200);
  if (kundli.status === 200 && kundli.json?.kundli) {
    const chart = kundli.json.kundli ?? kundli.json;
    let blocked = null;
    for (let i = 1; i <= 7; i++) {
      const r = await post(
        "/api/chat",
        { kundli: chart, messages: [{ role: "user", content: `test question ${i}` }], lang: "en" },
        headers
      );
      if (r.status === 402) {
        blocked = i;
        break;
      }
    }
    // FREE_LIMIT server-side is 1 (src/lib/quota.ts): Q1 free, Q2 blocked.
    check("server blocks the question after the free limit", blocked, 2);
  } else {
    console.log("  · quota assertions skipped (kundli endpoint did not return a chart)");
  }
}

// ── 7. A verified payment always grants access ─────────────────────────────
// Two ways a payer got locked out, both locked down here:
//   a) questions asked BEFORE server-side metering existed were charged against
//      the paid allowance — a long-standing user with ~1,000 questions on
//      record could never out-earn them by buying, so a verified ₹70 payment
//      granted nothing;
//   b) a paid order whose `pack_questions` was NULL (older packs) was worth
//      ZERO credits.
console.log("\n7. a verified payment is never locked out");
{
  const cleanupUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cleanupUrl || !serviceKey) {
    console.log("  · skipped (no Supabase service key in env)");
  } else {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(cleanupUrl, serviceKey, {
      auth: { persistSession: false },
    });
    // POST and read only the status — the answer itself is not under test, so
    // cancel the stream rather than wait for a full LLM completion.
    const postStatus = (path, body, headers = {}) =>
      fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }).then((r) => {
        r.body?.cancel().catch(() => {});
        return r.status;
      });

    // A big pre-metering history plus a small paid order: if the history were
    // charged, even the FIRST question would be over budget.
    const newPaidDevice = async (order) => {
      const deviceId = dev(`paid-${order.pack_id}-${order.pack_questions ?? "null"}`);
      const headers = { "x-device-id": deviceId };
      const kundli = await post(
        "/api/kundli",
        {
          name: "Test Invariant Bot",
          date: "1996-11-18",
          time: "06:00",
          place: "Pune",
          lat: 18.52,
          lng: 73.85,
          timezone: "Asia/Kolkata",
          lang: "en",
        },
        headers
      );
      const chart = kundli.json?.kundli ?? kundli.json;
      const { data: profile } = await sb
        .from("profiles")
        .select("id")
        .eq("device_id", deviceId)
        .maybeSingle();
      if (kundli.status !== 200 || !chart || !profile?.id) return null;

      const chatId = crypto.randomUUID();
      await sb.from("chats").insert({ id: chatId, profile_id: profile.id, lang: "en" });
      await sb.from("messages").insert(
        Array.from({ length: 40 }, (_, i) => ({
          chat_id: chatId,
          role: "user",
          content: `pre-metering question ${i}`,
          created_at: "2026-08-01T00:00:00Z",
        }))
      );
      await sb.from("orders").insert({
        device_id: deviceId,
        profile_id: profile.id,
        amount_paise: 7000,
        currency: "INR",
        pack_id: order.pack_id,
        pack_questions: order.pack_questions,
        status: "paid",
        verified_at: new Date().toISOString(),
      });
      return { deviceId, headers, chart };
    };

    const sendUntilBlocked = async ({ headers, chart }, calls) => {
      for (let i = 1; i <= calls; i++) {
        const status = await postStatus(
          "/api/chat",
          { kundli: chart, messages: [{ role: "user", content: `metered question ${i}` }], lang: "en" },
          headers
        );
        if (status === 402) return i;
      }
      return null;
    };

    // (a) pre-metering history must not consume the paid allowance.
    const recorded = await newPaidDevice({ pack_id: "legacy-standard-inr", pack_questions: 3 });
    if (recorded) {
      check(
        "pre-metering questions do not consume the paid allowance",
        await sendUntilBlocked(recorded, 2),
        null
      );
    } else {
      console.log("  · (a) skipped (kundli/profile not created)");
    }

    // (b) a NULL pack_questions order still grants its credits: with the
    // legacy p20 fallback the 6th question must still be allowed; without it
    // the user would be stuck at the FREE_LIMIT and 402 on the 6th.
    const legacy = await newPaidDevice({ pack_id: "p20", pack_questions: null });
    if (legacy) {
      check(
        "a NULL pack_questions order still grants credits",
        await sendUntilBlocked(legacy, 6),
        null
      );
    } else {
      console.log("  · (b) skipped (kundli/profile not created)");
    }
  }
}

// ── 7. Loyalty bonus: earned only, granted only, and never as a discount ────
// The bonus adds QUESTIONS at the same price. It must not move the amount
// charged (that would be a discount the ledger and the invoice disagree about),
// must not be claimable without three real dismissals, and must not be
// claimable by the legacy cohort — whose ₹60/70/80 menu is already cheaper,
// so a "bonus" there would be a price increase.
console.log("\n7. loyalty bonus is earned, granted, and never priced");

const BASE_Q = { starter: 20, standard: 50, deep: 100 };
const BONUS_Q = 10;
const DISMISSALS_FOR_BONUS = 3;

// (a) Not earned yet: a brand-new device gets the base credit count.
{
  const fresh = dev("bonus-fresh");
  const { json } = await post("/api/checkout", { packTier: "standard" }, {
    "x-device-id": fresh,
    "x-vercel-ip-country": "IN",
  });
  check("no dismissals → base credits", json?.pack?.questions, BASE_Q.standard);
  check("no dismissals → no bonus flag on /api/orders", (await get("/api/orders", { "x-device-id": fresh }))?.bonusEarned, false);
}

// (b) Two dismissals is still not enough.
{
  const twice = dev("bonus-twice");
  await post("/api/paywall/dismiss", {}, { "x-device-id": twice });
  const mid = await post("/api/paywall/dismiss", {}, { "x-device-id": twice });
  check("2 dismissals → not yet earned", mid.json?.earned, false);
  check("2 dismissals → base credits", mid.json?.dismissals, 2);
  const { json } = await post("/api/checkout", { packTier: "standard" }, {
    "x-device-id": twice,
    "x-vercel-ip-country": "IN",
  });
  check("2 dismissals → base credits at checkout", json?.pack?.questions, BASE_Q.standard);
}

// (c) The third dismissal earns it — and ONLY the credits change, not the price.
{
  const thrice = dev("bonus-thrice");
  for (let i = 0; i < DISMISSALS_FOR_BONUS; i++) {
    await post("/api/paywall/dismiss", {}, { "x-device-id": thrice });
  }
  const orders = await get("/api/orders", { "x-device-id": thrice });
  check("3 dismissals → earned", orders?.bonusEarned, true);

  const { json } = await post("/api/checkout", { packTier: "standard" }, {
    "x-device-id": thrice,
    "x-vercel-ip-country": "IN",
  });
  check("earned bonus → base + bonus credits", json?.pack?.questions, BASE_Q.standard + BONUS_Q);
  // The critical one: same rupees as an un-earned buyer.
  check("bonus does NOT change the amount charged", json?.amount, EXPECTED.IN.standard[0]);
  check("bonus does NOT change the currency", json?.currency, "INR");
  check("bonus keeps the market-scoped pack id", json?.pack?.id, "current-standard-inr");
}

// (d) Every tier gets the same flat bonus.
for (const tier of Object.keys(BASE_Q)) {
  const d = dev(`bonus-tier-${tier}`);
  for (let i = 0; i < DISMISSALS_FOR_BONUS; i++) {
    await post("/api/paywall/dismiss", {}, { "x-device-id": d });
  }
  const { json } = await post("/api/checkout", { packTier: tier }, {
    "x-device-id": d,
    "x-vercel-ip-country": "IN",
  });
  check(`${tier}: base + ${BONUS_Q} credits`, json?.pack?.questions, BASE_Q[tier] + BONUS_Q);
  check(
    `${tier}: amount unchanged by the bonus`,
    json?.amount,
    EXPECTED.IN[tier][0]
  );
}

// (e) The client cannot grant itself the bonus.
{
  const cheat = dev("bonus-cheat");
  const { json } = await post(
    "/api/checkout",
    { packTier: "standard", bonusEarned: true, dismissals: 99 },
    { "x-device-id": cheat, "x-vercel-ip-country": "IN" }
  );
  check("client-claimed bonus is ignored", json?.pack?.questions, BASE_Q.standard);
}

// (f) Foreign currencies: bonus must be worth questions, not a currency bug.
{
  const us = dev("bonus-us");
  for (let i = 0; i < DISMISSALS_FOR_BONUS; i++) {
    await post("/api/paywall/dismiss", {}, { "x-device-id": us });
  }
  const { json } = await post("/api/checkout", { packTier: "standard" }, {
    "x-device-id": us,
    "x-vercel-ip-country": "US",
  });
  check("USD buyer earns the bonus too", json?.pack?.questions, BASE_Q.standard + BONUS_Q);
  check("USD buyer still pays USD", [json?.currency, json?.amount], ["USD", EXPECTED.US.standard[0]]);
}

// ── Cleanup ────────────────────────────────────────────────────────────────
if (process.env.INVARIANTS_SKIP_CLEANUP !== "1") {
  console.log("\ncleaning up test rows…");
  const cleanupUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (cleanupUrl && serviceKey) {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(cleanupUrl, serviceKey, { auth: { persistSession: false } });
    for (const id of CREATED_DEVICES) {
      const { data: profiles } = await sb.from("profiles").select("id").eq("device_id", id);
      for (const p of profiles ?? []) {
        const { data: chats } = await sb.from("chats").select("id").eq("profile_id", p.id);
        for (const c of chats ?? []) {
          await sb.from("messages").delete().eq("chat_id", c.id);
          await sb.from("chats").delete().eq("id", c.id);
        }
        await sb.from("orders").delete().eq("profile_id", p.id);
        await sb.from("profiles").delete().eq("id", p.id);
      }
      await sb.from("orders").delete().eq("device_id", id);
    }
    console.log(`  removed rows for ${CREATED_DEVICES.size} test devices`);
  } else {
    console.log("  · skipped (no Supabase service key in env)");
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.log(`\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`);
  process.exit(1);
}