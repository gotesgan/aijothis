-- ═══════════════════════════════════════════════════
-- 0002 — RLS policies for authenticated users
-- ═══════════════════════════════════════════════════
-- APPLY THIS ONLY WHEN REAL AUTH LANDS (Supabase Auth / Google).
-- Current architecture is server-only (service-role key) and anon is
-- deliberately blocked by RLS-with-no-policies — that is correct and safe.
-- ═══════════════════════════════════════════════════

-- 1) Link profiles to auth.users (one profile per authenticated user).
alter table public.profiles add column if not exists user_id uuid
  references auth.users (id) on delete cascade;

create unique index if not exists profiles_user_id_idx
  on public.profiles (user_id) where user_id is not null;

-- 2) Own-data policies. `authenticated` can only touch their own rows —
--    BOLA/IDOR-safe: every policy pairs `TO authenticated` with an ownership
--    predicate, and UPDATE has both USING and WITH CHECK.
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (user_id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "chats_select_own" on public.chats
  for select to authenticated
  using (profile_id in (
    select id from public.profiles where user_id = auth.uid()
  ));

create policy "messages_select_own" on public.messages
  for select to authenticated
  using (chat_id in (
    select c.id
    from public.chats c
    join public.profiles p on p.id = c.profile_id
    where p.user_id = auth.uid()
  ));

-- 3) Anon stays denied by default: RLS is on and there are NO anon policies.
--    The publishable key therefore has zero table access — keep it that way.
