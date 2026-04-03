import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME } from '@/lib/session';

export async function POST() {
  // Specify path to ensure the cookie is deleted even if browser path scoping varies
  cookies().delete({ name: COOKIE_NAME, path: '/' });
  return NextResponse.json({ success: true });
}
