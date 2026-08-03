import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
