'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import BrandLogo from './BrandLogo';
import type { AppPlan } from '@/lib/plans';

type Plan = AppPlan;

interface NavbarMobileMenuProps {
  isLoggedIn: boolean;
  email?: string;
  plan?: Plan;
}

const PLAN_COLORS: Record<Plan, string> = {
  free: 'border-white/[0.1] bg-white/[0.04] text-gray-300',
  creator: 'border-vn-fuchsia/25 bg-vn-fuchsia/10 text-fuchsia-100',
  pro: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
  scale: 'border-vn-violet/30 bg-vn-violet/15 text-violet-100',
};

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Plan Free',
  creator: 'Plan Creator',
  pro: 'Plan Pro',
  scale: 'Plan Scale',
};

const PLAN_SHORT_LABELS: Record<Plan, string> = {
  free: 'Free',
  creator: 'Creator',
  pro: 'Pro',
  scale: 'Scale',
};

const navLinks = [
  { href: '/#fonctionnalites', label: 'Fonctionnalités' },
  { href: '/#comment-ca-marche', label: 'Comment ça marche' },
  { href: '/#tarifs', label: 'Tarifs' },
];

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M1.75 3.25h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5ZM1.75 7.25h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5ZM1.75 11.25h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z" />
    </svg>
  );
}

export default function NavbarMobileMenu({ isLoggedIn, email, plan = 'free' }: NavbarMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const [domReady, setDomReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDomReady(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function handleAnchorClick(href: string, event: MouseEvent<HTMLAnchorElement>) {
    setOpen(false);
    document.body.style.overflow = '';

    if (!href.startsWith('/#') || window.location.pathname !== '/') {
      return;
    }

    event.preventDefault();
    const id = href.slice(2);
    window.history.pushState(null, '', href);
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  const panel = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-black/76"
        onClick={() => setOpen(false)}
        aria-label="Fermer le menu"
      />

      <aside
        data-mobile-menu-panel="true"
        className="fixed inset-0 z-[81] overflow-y-auto bg-[#05060b] px-4 pb-5 pt-3 text-white"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute left-0 top-0 h-48 w-44 bg-vn-violet/[0.07] [mask-image:radial-gradient(circle,black,transparent_68%)]" aria-hidden />
        <div className="pointer-events-none absolute bottom-10 right-0 h-52 w-44 bg-cyan-300/[0.055] [mask-image:radial-gradient(circle,black,transparent_70%)]" aria-hidden />

        <div className="relative mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-md flex-col">
          <header className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <BrandLogo href="/" />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.11] bg-white/[0.045] text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-cyan-200/25 hover:bg-white/[0.075] hover:text-white"
              aria-label="Fermer le menu"
            >
              <CloseIcon />
            </button>
          </header>

          <nav className="mt-5" aria-label="Navigation mobile">
            <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Navigation</p>
            <div className="overflow-hidden rounded-[1.15rem] border border-white/[0.085] bg-white/[0.026] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(item.href, event)}
                  className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.065] px-3.5 py-3.5 transition last:border-b-0 hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block text-[15px] font-black leading-5 text-white">{item.label}</span>
                  </span>
                  <span className="text-base font-light text-gray-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" aria-hidden>
                    →
                  </span>
                </a>
              ))}
            </div>
          </nav>

          <section className="mt-4 overflow-hidden rounded-[1.2rem] border border-vn-fuchsia/18 bg-[radial-gradient(circle_at_0%_0%,rgba(232,121,249,0.14),transparent_38%),radial-gradient(circle_at_100%_0%,rgba(34,211,238,0.13),transparent_36%),rgba(255,255,255,0.028)] p-3.5 shadow-[0_28px_90px_-72px_rgba(232,121,249,0.9)]">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-vn-fuchsia/78">
              {isLoggedIn ? PLAN_SHORT_LABELS[plan] : 'Espace créateur'}
            </p>
            <h3 className="mt-1 text-[1.08rem] font-black leading-6 text-white">
              {isLoggedIn ? 'Ouvre ton cockpit Viralynz' : 'Entre dans Viralynz'}
            </h3>
            <p className="mt-1.5 text-xs font-semibold leading-5 text-gray-400">
              {isLoggedIn
                ? 'Retrouve tes analyses, tes insights et tes V2 à republier.'
                : 'Analyse une vidéo, lis le diagnostic, repars avec une V2.'}
            </p>

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d946ef_0%,#7c3aed_45%,#22d3ee_100%)] px-5 text-sm font-black text-white shadow-[0_18px_52px_-28px_rgba(34,211,238,0.85)] transition hover:-translate-y-0.5"
              >
                Ouvrir le dashboard →
              </Link>
            ) : (
              <div className="mt-3 grid gap-2">
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#d946ef_0%,#7c3aed_45%,#22d3ee_100%)] px-5 text-sm font-black text-white shadow-[0_18px_52px_-28px_rgba(34,211,238,0.85)] transition hover:-translate-y-0.5"
                >
                  Commencer →
                </Link>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-[40px] w-full items-center justify-center rounded-full border border-white/[0.09] bg-black/20 px-5 text-sm font-black text-gray-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  Se connecter
                </Link>
              </div>
            )}

          </section>

          {isLoggedIn && (
            <section className="mt-4 rounded-[1.1rem] border border-white/[0.08] bg-white/[0.024] px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan-300/14 bg-cyan-300/[0.07] text-[11px] font-black text-cyan-50">
                  {email?.slice(0, 2).toUpperCase() || 'VN'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-5 text-white">{email}</p>
                  <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${PLAN_COLORS[plan]}`}>
                    {PLAN_LABELS[plan]}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.065] pt-3">
                <Link
                  href="/dashboard/billing"
                  onClick={() => setOpen(false)}
                  className="text-xs font-black text-gray-300 underline-offset-4 transition hover:text-white hover:underline"
                >
                  Gérer mon plan
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-bold text-gray-600 transition hover:text-red-200"
                >
                  Se déconnecter
                </button>
              </div>
            </section>
          )}

          <p className="mt-auto pt-4 text-center text-[11px] font-semibold leading-4 text-gray-600">
            Viralynz transforme une vidéo en décisions de montage.
          </p>
        </div>
      </aside>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition hover:border-white/15 hover:bg-white/[0.065] hover:text-white"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open && domReady && createPortal(panel, document.body)}
    </>
  );
}
