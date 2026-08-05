import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Non-production environments (e.g. `next dev`, browser tests) use a SEPARATE
 * test Supabase project when the *_TEST env vars are set, so automated tests
 * never pollute production data. Production builds always use the real project.
 *
 * To enable: create a second Supabase project, run the migrations on it, and
 * set (in .env.local / Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL_TEST / NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST
 *   SUPABASE_SERVICE_ROLE_KEY_TEST
 */
const useTestProject = process.env.NODE_ENV !== "production";

const url = useTestProject
  ? process.env.NEXT_PUBLIC_SUPABASE_URL_TEST || process.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL;

const anon = useTestProject
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_TEST || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceRole = useTestProject
  ? process.env.SUPABASE_SERVICE_ROLE_KEY_TEST || process.env.SUPABASE_SERVICE_ROLE_KEY
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (useTestProject && process.env.NEXT_PUBLIC_SUPABASE_URL_TEST) {
  console.log("[supabase] non-production → using TEST project");
}

/**
 * Browser-safe Supabase client (publishable key).
 * Returns null unless the URL + anon key are configured.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anon) return null;
  return createClient(url, anon);
}

/**
 * Server-only admin client (service-role key) — bypasses RLS.
 * Never import this into client components.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false },
  });
}
