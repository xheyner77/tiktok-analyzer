import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATION = 'supabase/migrations/20260713114835_atomic_tiktok_account_limit.sql';

function migrationSql(): string {
  return readFileSync(resolve(process.cwd(), MIGRATION), 'utf8').toLowerCase();
}

describe('migration TikTok account limit atomique', () => {
  it('serialise les connexions par utilisateur dans la transaction RPC', () => {
    const sql = migrationSql();

    expect(sql).toContain('create or replace function public.upsert_tiktok_account_with_limit');
    expect(sql).toMatch(/from\s+public\.users\s+as\s+u[\s\S]*?where\s+u\.id\s*=\s*p_user_id[\s\S]*?for\s+update/);
    expect(sql).toMatch(/a\.status\s*=\s*'active'[\s\S]*?a\.tiktok_open_id\s+is\s+distinct\s+from\s+p_tiktok_open_id/);
    expect(sql).toContain('on conflict (user_id, tiktok_open_id) do update');
  });

  it('borne les privileges du SECURITY DEFINER au service role', () => {
    const sql = migrationSql();

    expect(sql).toMatch(/security\s+definer\s+set\s+search_path\s*=\s*''/);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.upsert_tiktok_account_with_limit[\s\S]*?from\s+public,\s*anon,\s*authenticated/);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.upsert_tiktok_account_with_limit[\s\S]*?to\s+service_role/);
  });

  it('supporte explicitement une limite illimitee sans modifier les quotas produit', () => {
    const sql = migrationSql();

    expect(sql).toContain('p_account_limit is not null and v_current >= p_account_limit');
    expect(sql).not.toMatch(/p_plan|starter|lifetime|scale/);
  });
});
