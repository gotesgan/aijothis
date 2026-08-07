# Deferred migrations

Migrations in this folder are **not** auto-applied by the GitHub Actions
migration step. They are intentionally held back until their precondition
lands.

## `0002_auth_rls.sql` — apply only when real auth lands
Adds `profiles.user_id` (link to `auth.users`) and RLS policies for the
`authenticated` role. The app is currently **server-only** (service-role key);
anon is deliberately blocked by RLS-with-no-policies. Applying these before
Supabase Auth / Google login is wired would be premature.

To apply manually when the time comes:
1. Move it back: `git mv supabase/deferred-migrations/0002_auth_rls.sql supabase/migrations/0002_auth_rls.sql`
2. Push to main — the migration workflow applies it, or run `supabase db push` locally.
