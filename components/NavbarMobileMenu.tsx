'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import BrandLogo from './BrandLogo';
import LanguageSwitcher from './LanguageSwitcher';
import type { AppPlan } from '@/lib/plans';

type Plan = AppPlan;

interface NavbarMobileMenuProps {
  isLoggedIn: boolean;
  email?: string;
  plan?: Plan;
}

const PLAN_COLORS: Record<Plan, string> = {
  free: 'border-white/[0.1] bg-white/[0.045] text-slate-300',
  starter: 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.08] text-fuchsia-100',
  creator: 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.08] text-fuchsia-100',
  pro: 'border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100',
  lifetime: 'border-vn-violet/24 bg-vn-violet/[0.1] text-violet-100',
  scale: 'border-vn-violet/24 bg-vn-violet/[0.1] text-violet-100',
};

const PLAN_SHORT_LABELS: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  creator: 'Starter',
  pro: 'Pro',
  lifetime: 'Lifetime',
  scale: 'Lifetime',
};

const navLinks = [
  {
    href: '/#fonctionnalites',
    label: 'Fonctionnalités',
    description: 'Découvre le coach de repost et les analyses IA',
  },
  {
    href: '/#comment-ca-marche',
    label: 'Comment ça marche',
    description: 'Transforme tes vidéos en décisions de montage',
  },
  {
    href: '/pricing',
    label: 'Tarifs',
    description: 'Choisis le plan adapté à ton volume',
  },
  {
    href: '/#faq',
    label: 'FAQ',
    description: 'Les réponses avant de démarrer',
  },
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

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3.5 8h8.2" strokeLinecap="round" />
      <path d="m8.7 4.6 3.4 3.4-3.4 3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getInitials(email?: string) {
  if (!email) return 'VN';

  const [name] = email.split('@');
  const parts = name.split(/[._-]/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return initials.toUpperCase();
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

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  function closeMenu() {
    setOpen(false);
    document.body.style.overflow = '';
  }

  function handleAnchorClick(href: string, event: MouseEvent<HTMLAnchorElement>) {
    closeMenu();

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
        className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={closeMenu}
        aria-label="Fermer le menu"
      />

      <aside
        data-mobile-menu-panel="true"
        role="dialog"
        aria-modal="true"
        aria-label="Menu mobile Viralynz"
        className="fixed inset-0 z-[81] overflow-y-auto bg-[#03040a] px-5 pb-5 pt-3 text-white motion-safe:animate-[fadeUp_0.28s_cubic-bezier(0.22,1,0.36,1)_both] sm:px-6"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/36 to-transparent" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-4 h-64 w-64 rounded-full bg-vn-fuchsia/[0.105] blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-28 top-28 h-72 w-72 rounded-full bg-cyan-300/[0.075] blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_105%,rgba(99,102,241,0.12),transparent_44%)]" aria-hidden />

        <div className="relative mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-[27rem] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-3">
            <div className="min-w-0">
              <BrandLogo href="/" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <LanguageSwitcher compact />
              <button
                type="button"
                onClick={closeMenu}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_42px_-34px_rgba(232,121,249,0.95)] backdrop-blur-xl transition hover:border-white/18 hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60"
                aria-label="Fermer le menu"
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <nav className="mt-5" aria-label="Navigation mobile">
            <p className="mb-2 px-1 text-[0.66rem] font-black uppercase tracking-[0.2em] text-slate-500">Navigation</p>
            <div className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-white/[0.055] shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_22px_70px_-58px_rgba(34,211,238,0.75)] backdrop-blur-xl">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(item.href, event)}
                  className="group grid grid-cols-[1fr_auto] items-center gap-3 border-b border-white/[0.07] px-4 py-3.5 transition last:border-b-0 hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block text-[0.95rem] font-black leading-5 text-zinc-50">{item.label}</span>
                    <span className="mt-0.5 block text-[0.76rem] font-semibold leading-5 text-slate-400">{item.description}</span>
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-full text-white/45 transition group-hover:translate-x-0.5 group-hover:bg-white/[0.06] group-hover:text-white/80" aria-hidden>
                    <ArrowIcon className="h-3.5 w-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </nav>

          <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-vn-fuchsia/15 bg-[radial-gradient(circle_at_10%_0%,rgba(232,121,249,0.16),transparent_38%),radial-gradient(circle_at_100%_18%,rgba(34,211,238,0.12),transparent_36%),rgba(255,255,255,0.045)] p-4 shadow-[0_28px_90px_-70px_rgba(232,121,249,0.9)] backdrop-blur-xl">
            <p className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-vn-fuchsia/78">Cockpit créateur</p>
            <h3 className="mt-1.5 text-[1.12rem] font-black leading-6 text-white">Prêt à booster tes reposts ?</h3>
            <p className="mt-2 text-[0.8rem] font-semibold leading-5 text-slate-400">
              Accède à ton cockpit Viralynz et retrouve tes analyses, insights et contenus à republier.
            </p>

            {isLoggedIn ? (
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.95)_0%,rgba(124,58,237,0.96)_48%,rgba(34,211,238,0.9)_100%)] px-5 text-sm font-black text-white shadow-[0_20px_54px_-32px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/70"
              >
                <span>Ouvrir le dashboard</span>
                <ArrowIcon />
              </Link>
            ) : (
              <div className="mt-4 grid gap-2.5">
                <Link
                  href="/signup"
                  onClick={closeMenu}
                  className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.95)_0%,rgba(124,58,237,0.96)_48%,rgba(34,211,238,0.9)_100%)] px-5 text-sm font-black text-white shadow-[0_20px_54px_-32px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/70"
                >
                  <span>Essayer Viralynz</span>
                  <ArrowIcon />
                </Link>
                <Link
                  href="/pricing"
                  onClick={closeMenu}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 text-sm font-black text-zinc-300 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60"
                >
                  Voir les tarifs
                </Link>
              </div>
            )}
          </section>

          {isLoggedIn ? (
            <section className="mt-4 rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan-200/16 bg-cyan-300/[0.08] text-[0.68rem] font-black text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {getInitials(email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.82rem] font-bold leading-5 text-zinc-100">{email}</p>
                  <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.12em] ${PLAN_COLORS[plan]}`}>
                    {PLAN_SHORT_LABELS[plan]}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.065] pt-3">
                <Link
                  href="/dashboard/billing"
                  onClick={closeMenu}
                  className="text-[0.76rem] font-black text-zinc-300 underline-offset-4 transition hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60"
                >
                  Gérer mon plan
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[0.76rem] font-bold text-slate-500 transition hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300/60"
                >
                  Se déconnecter
                </button>
              </div>
            </section>
          ) : (
            <section className="mt-4 grid grid-cols-2 gap-2.5">
              <Link
                href="/login"
                onClick={closeMenu}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-black text-zinc-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60"
              >
                Se connecter
              </Link>
              <Link
                href="/signup"
                onClick={closeMenu}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-vn-fuchsia/16 bg-vn-fuchsia/[0.08] px-4 text-sm font-black text-fuchsia-100 transition hover:bg-vn-fuchsia/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60"
              >
                Essayer Viralynz
              </Link>
            </section>
          )}

          <p className="px-2 pb-1 pt-4 text-center text-[0.72rem] font-semibold leading-5 text-slate-500">
            Transforme tes vidéos en décisions de montage.
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
