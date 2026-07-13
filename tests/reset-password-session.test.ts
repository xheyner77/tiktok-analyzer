import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('password recovery session continuity', () => {
  it('reuses the Supabase client that exchanged the recovery code', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'app/reset-password/page.tsx'),
      'utf8',
    );

    expect(source.match(/createBrowserSupabaseClient\(\)/g)).toHaveLength(1);
    expect(source).toContain('supabaseRef.current = supabase');
    expect(source).toContain('const supabase = supabaseRef.current;');
    expect(source).toContain('supabase.auth.updateUser({ password })');
  });
});
