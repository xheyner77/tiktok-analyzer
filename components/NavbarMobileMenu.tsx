'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';

type Plan = 'free' | 'pro' | 'elite';

interface NavbarMobileMenuProps {
  isLoggedIn: boolean;
  email?: string;
  plan?: Plan;
}

const PLAN_COLORS: Record<Plan, string> = {
  free: 'bg-[#1a1a1a] text-gray-400',
  pro: 'bg-vn-fuchsia/10 text-vn-fuchsia',
  elite: 'bg-vn-violet/15 text-vn-glow',
};

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Plan Free',
  pro: 'Plan Pro',
  elite: 'Plan Elite',
};

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

  const navLinks = [
    { href: '/', label: 'Accueil', icon: '⌂' },
    { href: '/#produit', label: 'Produit', icon: '◆' },
    { href: '/#fonctions', label: 'Comment ça marche', icon: '◇' },
    { href: '/pricing', label: 'Tarifs', icon: '€' },
    { href: '/changelog', label: 'Nouveautés ✦', icon: '🚀' },
    { href: '/analyzer', label: 'Analyser', icon: '🎯' },
    { href: '/hook-generator', label: 'Hooks', icon: '⚡' },
    ...(isLoggedIn ? [{ href: '/dashboard', label: 'Dashboard', icon: '📊' }] : []),
  ];

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <div className="fixed top-[4.25rem] left-0 right-0 z-[81] bg-vn-bg/98 backdrop-blur-lg border-b border-white/[0.08] shadow-2xl">
        <div className="px-4 py-3 space-y-1">
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </Link>
          ))}

          <div className="h-px bg-[#1a1a1a] my-2" />

          {isLoggedIn ? (
            <>
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vn-fuchsia to-vn-indigo flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {email?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{email}</p>
                  <span
                    className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}
                  >
                    {PLAN_LABELS[plan]}
                  </span>
                </div>
              </div>

              {plan !== 'elite' && (
                <Link
                  href="/pricing"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-vn-glow hover:bg-vn-violet/10 transition-colors"
                >
                  <span className="text-base w-5 text-center">⭐</span>
                  {plan === 'pro' ? 'Passer à Elite' : 'Passer à Pro'}
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-500/5 hover:text-red-400 transition-colors text-left"
              >
                <span className="text-base w-5 text-center">🚪</span>
                Se déconnecter
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 pb-1">
              <Link
                href="/analyzer"
                className="w-full py-3 rounded-full text-center text-sm font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:opacity-95 transition-opacity shadow-md shadow-vn-fuchsia/20"
              >
                Essayer l’analyse
              </Link>
              <div className="flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 py-2.5 rounded-xl text-center text-sm font-semibold text-gray-300 bg-[#111] border border-[#1e1e1e] hover:bg-[#181818] transition-all"
                >
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  className="flex-1 py-2.5 rounded-full text-center text-sm font-semibold text-white border border-white/15 hover:bg-white/5 transition-colors"
                >
                  S’inscrire
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
      >
        {open ? (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M1 3.75A.75.75 0 0 1 1.75 3h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 3.75ZM1 8a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 8Zm0 4.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 12.25Z" />
          </svg>
        )}
      </button>

      {open && domReady && createPortal(panel, document.body)}
    </>
  );
}
