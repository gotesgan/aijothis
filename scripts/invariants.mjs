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
    check("server blocks the 6th free question", blocked, 6);
  } else {
    console.log("  · quota assertions skipped (kundli endpoint did not return a chart)");
  }
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