import { NextRequest, NextResponse } from 'next/server';
import { consolidateMemoryForUser } from '@/lib/memory/consolidate-memory';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function authorize(request: NextRequest): boolean {
  const secret = process.env.MEMORY_CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function runConsolidation(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .select('user_id, plan, analyses_learned, last_consolidated_at')
    .neq('memory_tier', 'locked')
    .order('last_learned_at', { ascending: true, nullsFirst: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let processed = 0;
  for (const profile of data ?? []) {
    const row = profile as { user_id: string; plan: string };
    const ok = await consolidateMemoryForUser({ userId: row.user_id, plan: row.plan });
    if (ok) processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}

export async function GET(request: NextRequest) {
  return runConsolidation(request);
}

export async function POST(request: NextRequest) {
  return runConsolidation(request);
}
