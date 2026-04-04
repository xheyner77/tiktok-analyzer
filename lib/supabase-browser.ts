import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté navigateur — uniquement pour le flux recovery (reset password).
 * La session applicative principale reste le cookie JWT custom (/api/auth/login).
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis.');
  }
  return createClient(url, key, {
    auth: {
      detectSessionInUrl: true,
      persistSession: false,
      autoRefreshToken: true,
    },
  });
}
