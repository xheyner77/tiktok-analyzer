import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const QUOTA_FUNCTIONS = [
  'quota_analysis_limit_for_plan',
  'quota_hook_limit_for_plan',
  'quota_reconstruction_limit_for_plan',
] as const;

function readProjectFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function functionDefinition(sql: string, functionName: string): string {
  const startPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`,
    'i',
  );
  const start = sql.search(startPattern);
  if (start < 0) throw new Error(`Définition SQL absente: ${functionName}`);

  const end = sql.indexOf('$$;', start);
  if (end < 0) throw new Error(`Fin de définition SQL absente: ${functionName}`);
  return sql.slice(start, end + 3).toLowerCase();
}

function expectRecurringScaleGuard(definition: string): void {
  expect(definition).not.toContain("p_plan in ('lifetime', 'scale')");
  expect(definition).toMatch(
    /when\s+p_plan\s*=\s*'lifetime'[\s\S]*?p_subscription_status\s*=\s*'lifetime'[\s\S]*?then\s+\d+/,
  );
  expect(definition).toMatch(
    /when\s+p_plan\s*=\s*'scale'[\s\S]*?nullif\(btrim\(p_stripe_subscription_id\),\s*''\)\s+is\s+not\s+null[\s\S]*?p_subscription_status\s+in\s*\('active',\s*'trialing'\)[\s\S]*?then\s+\d+/,
  );
}

describe('SQL quota entitlement parity', () => {
  const schema = readProjectFile('supabase/schema.sql');
  const migration = readProjectFile(
    'supabase/migrations/20260713113106_harden_scale_quota_entitlements.sql',
  );

  for (const functionName of QUOTA_FUNCTIONS) {
    it(`requires canonical Lifetime and active recurring Scale in ${functionName}`, () => {
      expectRecurringScaleGuard(functionDefinition(schema, functionName));
      expectRecurringScaleGuard(functionDefinition(migration, functionName));
    });
  }
});
