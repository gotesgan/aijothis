-- ═══════════════════════════════════════════════════
-- Jyotish — conversation memory (tier 3)
-- A short situational summary of a long thread, refreshed
-- periodically, so heavy chats stay cheap. Timing windows are
-- NOT stored here (they're kept verbatim via prior-window
-- extraction so they can never be contradicted).
-- ═══════════════════════════════════════════════════

alter table public.profiles
  add column if not exists chat_summary text;

alter table public.profiles
  add column if not exists chat_summary_count integer;
