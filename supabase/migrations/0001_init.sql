-- ═══════════════════════════════════════════════════
-- Jyotish — initial schema (test build)
-- Kundli + Arya chat only. Payments/credits come later.
-- ═══════════════════════════════════════════════════

-- Device-first identity: no phone/OTP until payment (web-only MVP).
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  lang text not null default 'en',
  name text,
  mobile text,
  birth_date date,
  birth_time text,
  birth_place text,
  lat double precision,
  lng double precision,
  timezone text,
  kundli_json jsonb,
  signed_up_at timestamptz,
  paid20_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  lang text not null default 'en',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_profile_idx on public.chats (profile_id, created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  tokens integer,
  cost numeric(10, 6),
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_idx on public.messages (chat_id, created_at asc);

-- Lead source (UTM from Instagram ads) — captured at landing.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  device_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  referral text,
  landed_at timestamptz not null default now(),
  converted_at timestamptz
);

create index if not exists leads_device_idx on public.leads (device_id);

-- Simple RLS: each device only touches its own rows via a device_id claim.
alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;

-- (Client keys should be scoped per-device via a helper in v2.
--  The test build reads/writes through the API + localStorage only.)
