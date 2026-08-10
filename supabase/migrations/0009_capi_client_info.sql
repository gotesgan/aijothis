-- ═══════════════════════════════════════════════════
-- Jyotish — CAPI match-quality columns on orders
-- Store the CUSTOMER's real IP + User-Agent at checkout
-- time (captured from the browser's request), so the
-- Meta Conversions API event sent from the Razorpay
-- webhook can carry real matching data instead of
-- Razorpay's server IP. Improves CAPI match rate.
-- ═══════════════════════════════════════════════════

alter table public.orders
  add column if not exists client_ip text;

alter table public.orders
  add column if not exists client_ua text;
