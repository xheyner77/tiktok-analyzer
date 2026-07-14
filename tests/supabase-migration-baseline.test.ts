import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Supabase migration baseline ordering', () => {
  const directory = 'supabase/migrations';
  const migrations = readdirSync(directory).filter((name) => name.endsWith('.sql')).sort();
  const baselineName = '20260515120000_core_tables_baseline.sql';

  it('creates users and analyses before any dependent migration', () => {
    expect(migrations[0]).toBe(baselineName);
    const baseline = readFileSync(`${directory}/${baselineName}`, 'utf8');
    expect(baseline.indexOf('create table if not exists public.users')).toBeGreaterThanOrEqual(0);
    expect(baseline.indexOf('create table if not exists public.analyses')).toBeGreaterThan(
      baseline.indexOf('create table if not exists public.users'),
    );

    const firstAnalysesDependency = migrations.find((name) => (
      readFileSync(`${directory}/${name}`, 'utf8').includes('references public.analyses')
    ));
    expect(migrations.indexOf(baselineName)).toBeLessThan(
      migrations.indexOf(firstAnalysesDependency ?? baselineName),
    );
  });

  it('keeps the baseline idempotent and protected by RLS', () => {
    const baseline = readFileSync(`${directory}/${baselineName}`, 'utf8').toLowerCase();
    expect(baseline).toContain('create extension if not exists pgcrypto');
    expect(baseline.match(/create table if not exists public\./g)).toHaveLength(2);
    expect(baseline).toContain('alter table public.users enable row level security');
    expect(baseline).toContain('alter table public.analyses enable row level security');
    expect(baseline).toContain('using ((select auth.uid()) = user_id)');
  });

  it('reconciles nullable legacy columns before building dependent indexes', () => {
    const baseline = readFileSync(`${directory}/${baselineName}`, 'utf8').toLowerCase();
    const usersAlignment = baseline.indexOf('alter table public.users\n  add column if not exists stripe_subscription_id text');
    const usersIndex = baseline.indexOf('create unique index if not exists users_stripe_subscription_id_key');
    const analysesAlignment = baseline.indexOf('alter table public.analyses\n  add column if not exists reconstruction jsonb');
    const analysesIndex = baseline.indexOf('create index if not exists analyses_reconstruction_user_created_idx');

    expect(usersAlignment).toBeGreaterThanOrEqual(0);
    expect(usersAlignment).toBeLessThan(usersIndex);
    expect(baseline).toContain('add column if not exists stripe_price_id text');
    expect(analysesAlignment).toBeGreaterThanOrEqual(0);
    expect(analysesAlignment).toBeLessThan(analysesIndex);
    expect(baseline).toContain('add column if not exists reconstruction_created_at timestamptz');
    expect(baseline).not.toMatch(/\nupdate public\.(?:users|analyses)\b/u);
  });
});
