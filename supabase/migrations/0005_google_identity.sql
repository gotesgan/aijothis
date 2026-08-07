-- ═══════════════════════════════════════════════════
-- Jyotish — Google identity on profiles
-- The Google credential (ID token) is now verified server-side on signup
-- and the user's Google identity is saved so we know who signed up.
-- ═══════════════════════════════════════════════════

alter table public.profiles
  add column if not exists google_sub text;

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  add column if not exists google_name text;

create unique index if not exists profiles_google_sub_idx
  on public.profiles (google_sub)
  where google_sub is not null;
