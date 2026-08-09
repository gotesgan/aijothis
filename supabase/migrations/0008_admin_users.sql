-- ═══════════════════════════════════════════════════
-- Jyotish — admin users for the internal control center
-- Credentials live in the DB (not env vars): username +
-- scrypt-salted password hash. Never store plaintext.
-- ═══════════════════════════════════════════════════

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
