import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTrendSourceStatus } from '@/lib/trends/repository';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });
  return NextResponse.json(await getTrendSourceStatus());
}
