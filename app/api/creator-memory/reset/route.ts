import { NextResponse } from 'next/server';
import { resetCreatorMemory } from '@/lib/creator-memory';
import { getSession } from '@/lib/session';

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const ok = await resetCreatorMemory(session.userId);
  if (!ok) {
    return NextResponse.json({ error: 'Impossible de reinitialiser la memoire.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
