import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type JobStatus = 'uploading' | 'queued' | 'validation' | 'completed' | 'failed';
type QuotaState = 'not_reserved' | 'reserved' | 'consumed' | 'refunded';

interface State {
  job: { id: string; status: JobStatus; quota: QuotaState; workflowRunId: string | null; analysisId: string | null };
  counter: number;
  analyses: string[];
}

function reserve(state: State, limit = 3): boolean {
  if (state.job.quota === 'reserved' || state.job.quota === 'consumed') return true;
  if (state.job.status !== 'uploading' || state.job.quota === 'refunded' || state.counter >= limit) return false;
  state.counter += 1;
  state.job.quota = 'reserved';
  state.job.status = 'queued';
  return true;
}

function claimStart(state: State, claim: string): boolean {
  if (state.job.status !== 'queued' || state.job.quota !== 'reserved' || state.job.workflowRunId !== null) return false;
  state.job.workflowRunId = claim;
  return true;
}

function complete(state: State): string {
  if (state.job.status === 'completed' && state.job.analysisId) return state.job.analysisId;
  if (state.job.quota !== 'reserved' || state.job.status !== 'validation') throw new Error('invalid completion');
  const id = state.job.id;
  state.analyses.push(id);
  state.job.analysisId = id;
  state.job.quota = 'consumed';
  state.job.status = 'completed';
  return id;
}

function fail(state: State): boolean {
  if (state.job.status === 'completed') return false;
  const refunded = state.job.quota === 'reserved';
  if (refunded) {
    state.counter = Math.max(0, state.counter - 1);
    state.job.quota = 'refunded';
  }
  state.job.status = 'failed';
  return refunded;
}

function fresh(): State {
  return {
    job: {
      id: '33333333-3333-4333-8333-333333333333',
      status: 'uploading',
      quota: 'not_reserved',
      workflowRunId: null,
      analysisId: null,
    },
    counter: 0,
    analyses: [],
  };
}

describe('analysis job exactly-once state model', () => {
  it('a second start neither reserves quota nor claims another workflow', () => {
    const state = fresh();
    expect(reserve(state)).toBe(true);
    expect(claimStart(state, 'starting:first')).toBe(true);
    expect(reserve(state)).toBe(true);
    expect(claimStart(state, 'starting:second')).toBe(false);
    expect(state.counter).toBe(1);
    expect(state.job.workflowRunId).toBe('starting:first');
  });

  it('a second completion returns the same analysis without inserting another row', () => {
    const state = fresh();
    reserve(state);
    state.job.status = 'validation';
    expect(complete(state)).toBe(state.job.id);
    expect(complete(state)).toBe(state.job.id);
    expect(state.analyses).toEqual([state.job.id]);
    expect(state.counter).toBe(1);
  });

  it('a second failure never refunds the same reservation twice', () => {
    const state = fresh();
    reserve(state);
    expect(fail(state)).toBe(true);
    expect(fail(state)).toBe(false);
    expect(state.counter).toBe(0);
    expect(state.job.quota).toBe('refunded');
  });

  it('serializes complete/fail races into one terminal accounting result', () => {
    const completedFirst = fresh();
    reserve(completedFirst);
    completedFirst.job.status = 'validation';
    complete(completedFirst);
    expect(fail(completedFirst)).toBe(false);
    expect(completedFirst).toMatchObject({ counter: 1, analyses: [completedFirst.job.id] });

    const failedFirst = fresh();
    reserve(failedFirst);
    failedFirst.job.status = 'validation';
    expect(fail(failedFirst)).toBe(true);
    expect(() => complete(failedFirst)).toThrow('invalid completion');
    expect(failedFirst).toMatchObject({ counter: 0, analyses: [] });
  });
});

describe('Supabase migration exact-once and ownership invariants', () => {
  const sql = readFileSync(
    'supabase/migrations/20260713180000_video_analysis_jobs.sql',
    'utf8',
  ).toLowerCase();

  it('locks both job and user while reserving, completing or refunding', () => {
    expect(sql.match(/for update/g)?.length).toBeGreaterThanOrEqual(5);
    expect(sql).toContain("v_job.quota_state in ('reserved', 'consumed')");
    expect(sql).toContain("v_job.quota_state = 'reserved'");
    expect(sql).toContain("v_job.status = 'completed' and v_job.analysis_id is not null");
    expect(sql).toContain("v_job.status <> 'completed' and v_job.quota_state = 'reserved'");
    expect(sql).toContain('quota_used = coalesce(v_used, quota_used)');
    expect(sql).toContain("jsonb_typeof(p_legacy_result) is distinct from 'object'");
    expect(sql).toContain("jsonb_typeof(p_engine_result) is distinct from 'object'");
    expect(sql).toContain("p_engine_result ->> 'analysisid' is distinct from p_job_id::text");
    expect(sql).toMatch(/insert into public\.analyses \(\s*id,\s*user_id,/);
    expect(sql).toMatch(/\) values \(\s*p_job_id,\s*p_user_id,/);
  });

  it('never refunds an old reservation into a newly reset quota period', () => {
    expect(sql).toContain('quota_period_started_at timestamptz');
    expect(sql).toContain('quota_period_started_at = v_quota_period_started_at');
    expect(sql).toContain('v_job.quota_period_started_at is not distinct from v_current_quota_period_started_at');
    expect(sql).toMatch(/if v_job\.quota_period_started_at[\s\S]+?set analyses_count = greatest\(analyses_count - 1, 0\)[\s\S]+?end if/);
  });

  it('provides a reclaimable workflow-start lease without exposing the RPC publicly', () => {
    expect(sql).toContain('claim_analysis_job_workflow_start');
    expect(sql).toContain("workflow_run_id like 'starting:%'");
    expect(sql).toContain("updated_at < now() - interval '2 minutes'");
    expect(sql).toMatch(/revoke all on function public\.claim_analysis_job_workflow_start[\s\S]+?from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function public\.claim_analysis_job_workflow_start[\s\S]+?to service_role/);
  });

  it('serializes and caps active jobs to bound abandoned-upload abuse', () => {
    expect(sql).toContain('enforce_analysis_job_active_limit');
    expect(sql).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(sql).toContain("status not in ('completed', 'failed')");
    expect(sql).toContain('if v_active_count >= 3 then');
    expect(sql).toContain("raise exception 'analysis_job_active_limit'");
    expect(sql).toMatch(/revoke all on function public\.enforce_analysis_job_active_limit\(\) from public, anon, authenticated/);
  });

  it('ties artifact ownership to the parent job and constrains private paths and buckets', () => {
    expect(sql).toContain('foreign key (job_id, user_id)');
    expect(sql).toContain('references public.analysis_jobs (id, user_id)');
    expect(sql).toContain("check (storage_bucket = 'analysis-inputs')");
    expect(sql).toContain("storage_bucket = 'analysis-evidence'");
    expect(sql).toContain("storage_path like user_id::text || '/' || job_id::text || '/%'");
    expect(sql).toContain("check (idempotency_key ~ '^[a-za-z0-9:_-]+$')");
    expect(sql).toContain("check (content_type in (");
  });

  it('keeps job tables server-only behind RLS and explicit 2026 Data API grants', () => {
    for (const table of ['analysis_jobs', 'analysis_artifacts']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`));
      expect(sql).toMatch(new RegExp(`grant select, insert, update, delete on table public\\.${table} to service_role`));
    }
  });
});

describe('completion RPC wrapper contract', () => {
  const source = readFileSync('lib/video-analysis/jobs.ts', 'utf8');

  it('passes ownership, both results and every version to the atomic RPC', () => {
    expect(source).toContain("supabase.rpc('complete_analysis_job'");
    for (const field of [
      'p_job_id: input.jobId',
      'p_user_id: input.userId',
      'p_video_url: input.videoUrl',
      'p_legacy_result: input.legacyResult',
      'p_engine_result: input.engineResult',
      'p_schema_version: input.schemaVersion',
      'p_prompt_version: input.promptVersion',
      'p_pipeline_version: input.pipelineVersion',
      'p_model_version: input.modelVersion',
    ]) expect(source).toContain(field);
    expect(source).toContain('input.engineResult.analysisId !== input.jobId');
    expect(source).toContain('return parseAnalysisCompletionId(data)');
  });
});

describe('analyses baseline ownership', () => {
  const sql = readFileSync(
    'supabase/migrations/20260515120000_core_tables_baseline.sql',
    'utf8',
  ).toLowerCase();

  it('exposes only owner-scoped reads to authenticated clients', () => {
    expect(sql).toContain('alter table public.analyses enable row level security');
    expect(sql).toContain('revoke all on table public.analyses from public, anon, authenticated');
    expect(sql).toContain('grant select on table public.analyses to authenticated');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete)[^;]+authenticated/);
    expect(sql).toMatch(/for select\s+to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/);
    expect(sql).toContain('grant select, insert, update, delete on table public.analyses to service_role');
  });
});
