-- ═══════════════════════════════════════════════════
-- Jyotish — persisted marriage reports.
-- Written only when the buyer downloads (or asks Arya
-- about) their paid report, so a re-visit re-serves the
-- same prose instead of paying for a second LLM run —
-- and so the chat can answer follow-ups consistently.
-- Keyed by device + pack; one row per buyer per report.
-- ═══════════════════════════════════════════════════

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  pack_id text not null,
  locale text not null default 'en',
  facts jsonb,
  sections jsonb not null,
  downloaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (device_id, pack_id)
);

create index if not exists reports_device_idx on public.reports (device_id);

alter table public.reports enable row level security;
