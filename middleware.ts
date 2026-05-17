import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/session';

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === '/analyses') {
    const dashboardUrl = new URL('/dashboard/analyze', request.url);
    dashboardUrl.search = search;
    return NextResponse.redirect(dashboardUrl);
  }

  const legacyDashboardRoutes: Record<string, string> = {
    '/dashboard-v2': '/dashboard',
    '/analyzer': '/dashboard/analyze',
    '/hook-generator': '/dashboard/hooks',
    '/hooks': '/dashboard/hooks',
    '/hook-rewrite': '/dashboard/rewrite',
    '/rewrite': '/dashboard/rewrite',
    '/share': '/dashboard/share',
    '/share-cards': '/dashboard/share',
    '/radar-tendances': '/dashboard/radar',
    '/settings': '/dashboard/settings',
    '/billing': '/dashboard/billing',
  };

  const legacyRoute = Object.entries(legacyDashboardRoutes).find(
    ([legacyPath]) => pathname === legacyPath || pathname.startsWith(`${legacyPath}/`),
  );

  if (legacyRoute) {
    const [legacyPath, targetPath] = legacyRoute;
    const suffix = pathname.slice(legacyPath.length);
    const dashboardUrl = new URL(`${targetPath}${suffix}`, request.url);
    dashboardUrl.search = search;
    return NextResponse.redirect(dashboardUrl);
  }

  // Cookie presence check only — no network call, works on Edge runtime.
  // Real JWT validation happens in getSession() inside server components.
  const hasCookie = !!request.cookies.get(COOKIE_NAME)?.value;

  // Protect /dashboard — redirect to /login if cookie is completely absent.
  // If the cookie is present but the token is expired, getSession() returns null
  // and dashboard/page.tsx handles the redirect to /login.
  if (pathname.startsWith('/dashboard') && !hasCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', `${pathname}${search}`);
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
  matcher: [
    '/dashboard/:path*',
    '/dashboard-v2/:path*',
    '/analyzer/:path*',
    '/hook-generator/:path*',
    '/hooks/:path*',
    '/hook-rewrite/:path*',
    '/rewrite/:path*',
    '/share/:path*',
    '/share-cards/:path*',
    '/radar-tendances/:path*',
    '/settings/:path*',
    '/billing/:path*',
    '/analyses',
  ],
};
