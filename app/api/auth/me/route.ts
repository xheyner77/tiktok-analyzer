import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserById } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(session.userId);

  // If no profile row yet (e.g. signup DB insert failed), return safe defaults
  // so the frontend treats the user as authenticated with plan=free / count=0
  // instead of falling back to guest mode with a stale localStorage counter.
  if (!user) {
    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        plan: 'free',
        analyses_count: 0,
        hooks_count: 0,
        created_at: new Date().toISOString(),
      },
    });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      analyses_count: user.analyses_count,
      hooks_count: user.hooks_count,
      created_at: user.created_at,
    },
  });
}
