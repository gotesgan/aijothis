-- ═══════════════════════════════════════════════════
-- Jyotish — order records (real payment amounts)
-- Fix: paid20_at was only a timestamp; we could not tell
-- what was actually paid (₹10 vs ₹20 vs ₹30) or match
-- the Razorpay order/payment ids. Orders captures it.
-- ═══════════════════════════════════════════════════

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  amount_paise integer not null,
  currency text not null default 'INR',
  pack_id text,
  pack_questions integer,
  order_id text,
  payment_id text,
  signature text,
  status text not null default 'created'
    check (status in ('created', 'paid', 'simulated', 'failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_device_idx on public.orders (device_id, created_at desc);
create index if not exists orders_order_idx on public.orders (order_id);

alter table public.orders enable row level security;
