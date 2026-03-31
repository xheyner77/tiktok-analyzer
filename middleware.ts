import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cookie presence check only — no network call, works on Edge runtime.
  // Real JWT validation happens in getSession() inside server components.
  const hasCookie = !!request.cookies.get(COOKIE_NAME)?.value;

  // Protect /dashboard — redirect to /login if cookie is completely absent.
  // If the cookie is present but the token is expired, getSession() returns null
  // and dashboard/page.tsx handles the redirect to /login.
  if (pathname.startsWith('/dashboard') && !hasCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // IMPORTANT: we do NOT redirect /login or /signup based on cookie presence.
  // The cookie can be stale (token expired). Redirecting here would create an
  // infinite loop: stale cookie → /dashboard → getSession() null → /login →
  // middleware redirects to /dashboard → /login → loop → black screen.
  // Real session validation happens in server components only.

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
