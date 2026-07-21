import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSql(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8').toLowerCase();
}

function expectServerOnlyTable(sql: string, table: string): void {
  expect(sql).toMatch(new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
  ));
  expect(sql).toMatch(new RegExp(
    `revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public,\\s*anon,\\s*authenticated`,
  ));
  expect(sql).toMatch(new RegExp(
    `grant\\s+select,\\s*insert,\\s*update,\\s*delete\\s+on\\s+table\\s+public\\.${table}\\s+to\\s+service_role`,
  ));
}

describe('Supabase server-only table hardening', () => {
  const usersMigration = readSql(
    'supabase/migrations/20260713120522_harden_users_table_privileges.sql',
  );
  const tiktokMigration = readSql(
    'supabase/migrations/20260713121629_harden_tiktok_account_privileges.sql',
  );
  const analysesAndStripeMigration = readSql(
    'supabase/migrations/20260713170000_harden_analyses_and_stripe_privileges.sql',
  );
  const schema = readSql('supabase/schema.sql');

  it('removes direct browser access to billing entitlements in users', () => {
    expectServerOnlyTable(usersMigration, 'users');
    expectServerOnlyTable(schema, 'users');
  });

  it('keeps analyses owner-readable without browser write privileges', () => {
    expect(analysesAndStripeMigration).toMatch(
      /alter\s+table\s+public\.analyses\s+enable\s+row\s+level\s+security/,
    );
    expect(analysesAndStripeMigration).toMatch(
      /revoke\s+all\s+on\s+table\s+public\.analyses\s+from\s+public,\s*anon,\s*authenticated/,
    );
    expect(analysesAndStripeMigration).toMatch(
      /grant\s+select\s+on\s+table\s+public\.analyses\s+to\s+authenticated/,
    );
    expect(analysesAndStripeMigration).toMatch(
      /grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.analyses\s+to\s+service_role/,
    );
  });

  it('keeps Stripe webhook idempotency data server-only', () => {
    expectServerOnlyTable(analysesAndStripeMigration, 'stripe_webhook_events');
  });

  it('keeps encrypted TikTok OAuth rows server-only in the forward migration', () => {
    expectServerOnlyTable(tiktokMigration, 'tiktok_accounts');
    expect(tiktokMigration).not.toContain("to_regclass('public.tiktok_accounts')");

    expect(tiktokMigration).toContain('from pg_catalog.pg_policies');
    expect(tiktokMigration).toContain("tablename = 'tiktok_accounts'");
    expect(tiktokMigration).toContain(
      "'drop policy %i on public.tiktok_accounts'",
    );
    expect(tiktokMigration.match(/create\s+policy/g)).toHaveLength(1);
    expect(tiktokMigration).toMatch(
      /create\s+policy\s+"service role full access"[\s\S]+?on\s+public\.tiktok_accounts[\s\S]+?to\s+service_role/,
    );

    expect(tiktokMigration).toContain(
      "'revoke all on sequence %i.%i from public, anon, authenticated'",
    );
    expect(tiktokMigration).toContain(
      "'grant usage, select, update on sequence %i.%i to service_role'",
    );

    expect(tiktokMigration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.handle_updated_at\(\)\s+from\s+public,\s*anon,\s*authenticated/,
    );
    expect(tiktokMigration).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.handle_updated_at\(\)\s+to\s+service_role/,
    );
    expect(tiktokMigration).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.upsert_tiktok_account_with_limit\([\s\S]+?\)\s+from\s+public,\s*anon,\s*authenticated/,
    );
    expect(tiktokMigration).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.upsert_tiktok_account_with_limit\([\s\S]+?\)\s+to\s+service_role/,
    );
  });
});
