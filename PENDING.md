# Pending changes & notes

Tracked for future sessions. Follow the branch-first workflow in AGENTS.md.

## Declined / don't re-propose without asking
- **Auto-paywall nudge** (open the paywall automatically when free credits hit 5) — user asked to revert. Keep paywall as-is: it only opens when the user tries to send a question past their free limit.

## Backlog (proposed, not started)
- [ ] **Supabase CLI + Vercel migration step** — install CLI, `supabase login` (needs user), link project, add `vercel-build` step running `supabase db push`. User deferred ("tomorrow").
- [ ] **Create test Supabase project** — second project + `*_TEST` env vars (code already supports the switch in `src/lib/supabase.ts`). Then all dev/browser tests route away from prod.
- [ ] **Google OAuth** — publish consent screen + add `https://www.hiarya.in` to OAuth origins (code already degrades gracefully via 12s timeout).
- [ ] **Razorpay webhook** — confirm active in dashboard (secret is set).
- [ ] **Re-engagement loop** — zero returning users. Ideas: daily reading reminder, resume-last-chat.
- [ ] **Restore-chat UX** — returning users currently start blank (no thread restore on the client).
- [ ] **Clean up stray committed file** — `6 Aug 2026, 00_32.csv` (a Meta export) got committed in `72fa16e`; decide whether to gitignore/remove it.

## Watch-list
- **Hanuman sahay saini** (Aug 6, Hindi) — signed up, asked exactly 5 questions (free limit), left at the paywall boundary. Closest unpaid user to conversion; good re-engagement target.
- **RLS** — zero policies on all tables (0002 staged). Fine while single-device; revisit before real auth.
- **Crisis guard** — active in `/api/chat`; helplines (KIRAN/iCall) returned without LLM call.
