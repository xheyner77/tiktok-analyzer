'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavbarUserMenu from './NavbarUserMenu';
import NavbarMobileMenu from './NavbarMobileMenu';
import BrandLogo from './BrandLogo';
import LanguageSwitcher from './LanguageSwitcher';
import type { AppPlan } from '@/lib/plans';

type PublicAuthUser = {
  email: string;
  plan: AppPlan;
};

const APP_PATH_PREFIXES = [
  '/dashboard',
  '/analyses',
  '/account',
  '/onboarding',
  '/review',
  '/settings',
];

const VALID_PLANS = new Set<AppPlan>(['free', 'starter', 'creator', 'pro', 'lifetime', 'scale']);

function asAppPlan(value: unknown): AppPlan {
  return typeof value === 'string' && VALID_PLANS.has(value as AppPlan)
    ? value as AppPlan
    : 'free';
}

export default function Navbar() {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<PublicAuthUser | null | undefined>(undefined);
  const hiddenOnAppRoute = APP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(`${prefix}/`),
  );

  useEffect(() => {
    if (hiddenOnAppRoute) return undefined;

    const controller = new AbortController();
    fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ user?: unknown }> : { user: null })
      .then((payload) => {
        const user = payload.user;
        if (!user || typeof user !== 'object') {
          setAuthUser(null);
          return;
        }
        const candidate = user as { email?: unknown; plan?: unknown };
        if (typeof candidate.email !== 'string' || candidate.email.length === 0) {
          setAuthUser(null);
          return;
        }
        setAuthUser({ email: candidate.email, plan: asAppPlan(candidate.plan) });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAuthUser(null);
      });

    return () => controller.abort();
  }, [hiddenOnAppRoute, pathname]);

  if (hiddenOnAppRoute) return null;

  const isLoggedIn = Boolean(authUser);
  const plan = authUser?.plan ?? 'free';
  const linkCls =
    'text-[13px] font-semibold text-gray-400 hover:text-white transition-colors px-3.5 py-2 rounded-full hover:bg-white/[0.055]';

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-vn-bg/75 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-vn-bg/65">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <BrandLogo href="/" />

        <div className="hidden flex-1 justify-center px-4 lg:flex">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
            <a href="/#fonctionnalites" className={linkCls}>Fonctionnalités</a>
            <a href="/#comment-ca-marche" className={linkCls}>Comment ça marche</a>
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 lg:flex">
          <LanguageSwitcher />
          {authUser === undefined ? (
            <span className="ml-2 h-10 w-44 animate-pulse rounded-full bg-white/[0.05]" aria-label="Vérification de la session" />
          ) : isLoggedIn && authUser ? (
            <>
              <Link href="/dashboard" className="ml-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-vn-fuchsia/25 transition-all hover:brightness-110">
                Ouvrir le dashboard
              </Link>
              <div className="ml-1 pl-1">
                <NavbarUserMenu email={authUser.email} plan={plan} />
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={linkCls}>Se connecter</Link>
              <Link href="/signup" className="ml-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-vn-fuchsia/25 transition-all hover:brightness-110">
                Commencer
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          {authUser === undefined ? (
            <span className="h-10 w-10 animate-pulse rounded-full bg-white/[0.05]" aria-label="Vérification de la session" />
          ) : (
            <NavbarMobileMenu isLoggedIn={isLoggedIn} email={authUser?.email} plan={plan} />
          )}
        </div>
      </div>
    </nav>
  );
}
