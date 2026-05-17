import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { disconnectTikTokAccount } from '@/lib/tiktok-accounts';

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const { id } = await params;
  const result = await disconnectTikTokAccount(session.userId, id);
  if (!result.ok) {
    return NextResponse.json({ error: 'Déconnexion impossible pour le moment.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
