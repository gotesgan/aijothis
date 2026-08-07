-- ═══════════════════════════════════════════════════
-- Jyotish — drop unique constraint on google_sub
-- 0005 made google_sub UNIQUE, but the model is device-first: one Google
-- user signs in from multiple devices, each with its own profile. A second
-- device's signup tried to write the same google_sub → duplicate key
-- violation → identity silently not saved. Recreate as a plain (non-unique)
-- index so every device profile can carry the same Google identity.
-- ═══════════════════════════════════════════════════

drop index if exists public.profiles_google_sub_idx;

create index if not exists profiles_google_sub_idx
  on public.profiles (google_sub)
  where google_sub is not null;
