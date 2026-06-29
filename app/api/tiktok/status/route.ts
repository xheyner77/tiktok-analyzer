import { NextResponse } from 'next/server';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';
import { getTikTokDashboardState } from '@/lib/tiktok-accounts';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  return NextResponse.json(await getTikTokDashboardState(session.userId, plan));
}
