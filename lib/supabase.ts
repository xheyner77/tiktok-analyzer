import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Disable Next.js 14 automatic fetch() cache for all Supabase queries.
// Without this, DB reads can return stale data after a write (e.g. plan change).
const noStoreFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  fetch(input, { ...init, cache: 'no-store' });

function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required server env var: ${name}.`);
  }
  return value;
}

export function getSupabaseAuth(): SupabaseClient {
  return createClient(
    requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: noStoreFetch },
    }
  );
}

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      requireServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
      requireServerEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { fetch: noStoreFetch },
      }
    );
  }
  return supabaseAdmin;
}

// Server-only clients. The service-role client must never be imported by client components.
export const supabaseAuth = getSupabaseAuth();
export const supabase = getSupabaseAdmin();

export type Plan = 'free' | 'creator' | 'pro' | 'scale';
