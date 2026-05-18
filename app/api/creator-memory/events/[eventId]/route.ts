import { NextRequest, NextResponse } from 'next/server';
import { ignoreCreatorMemoryEvent } from '@/lib/creator-memory';
import { getSession } from '@/lib/session';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { eventId } = await params;
  if (!eventId) {
    return NextResponse.json({ error: 'Apprentissage introuvable.' }, { status: 400 });
  }

  const ok = await ignoreCreatorMemoryEvent(session.userId, eventId);
  if (!ok) {
    return NextResponse.json({ error: 'Impossible d ignorer cet apprentissage.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
