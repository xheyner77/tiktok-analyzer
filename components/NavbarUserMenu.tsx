'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Plan = 'free' | 'pro' | 'elite';

const PLAN_LABELS: Record<Plan, string> = {
  free:  'Plan Free',
  pro:   'Plan Pro',
  elite: 'Plan Elite',
};

const PLAN_COLORS: Record<Plan, string> = {
  free:  'bg-[#1a1a1a] text-gray-500',
  pro:   'bg-vn-fuchsia/10 text-vn-fuchsia border border-vn-fuchsia/20',
  elite: 'bg-vn-violet/15 text-vn-glow border border-vn-violet/25',
};

interface NavbarUserMenuProps {
  email: string;
  plan: Plan;
}

export default function NavbarUserMenu({ email, plan }: NavbarUserMenuProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = email.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-vn-fuchsia to-vn-indigo flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {initials}
        </div>
        <span className="text-sm text-gray-300 hidden sm:block max-w-[120px] truncate">
          {email.split('@')[0]}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-52 bg-[#111] border border-[#1f1f1f] rounded-xl shadow-xl shadow-black/50 z-50 overflow-hidden animate-fade-in">
            {/* User info */}
            <div className="px-3.5 py-3 border-b border-[#1a1a1a]">
              <p className="text-xs font-medium text-white truncate">{email}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${PLAN_COLORS[plan]}`}>
                {PLAN_LABELS[plan]}
              </span>
            </div>

            {/* Menu items */}
            <div className="p-1.5 space-y-0.5">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-500">
                  <path d="M8.543 2.232a.75.75 0 0 0-1.085 0l-5.25 5.5A.75.75 0 0 0 2.75 9H4v4.75A.25.25 0 0 0 4.25 14h2.5a.25.25 0 0 0 .25-.25v-3.5a.25.25 0 0 1 .25-.25h1.5a.25.25 0 0 1 .25.25v3.5c0 .138.112.25.25.25h2.5a.25.25 0 0 0 .25-.25V9h1.25a.75.75 0 0 0 .543-1.268l-5.25-5.5Z" />
                </svg>
                Dashboard
              </Link>

              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-500">
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
                </svg>
                Analyser
              </Link>

              {plan !== 'elite' && (
                <Link
                  href="/pricing"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-vn-glow hover:text-violet-200 hover:bg-vn-violet/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-vn-violet">
                    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                  </svg>
                  {plan === 'pro' ? 'Passer à Elite' : 'Passer à Pro'}
                </Link>
              )}
            </div>

            {/* Logout */}
            <div className="p-1.5 pt-0 border-t border-[#1a1a1a] mt-0.5">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 0 1 4.75 2h3a2.75 2.75 0 0 1 2.75 2.75v.5a.75.75 0 0 1-1.5 0v-.5c0-.69-.56-1.25-1.25-1.25h-3c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h3c.69 0 1.25-.56 1.25-1.25v-.5a.75.75 0 0 1 1.5 0v.5A2.75 2.75 0 0 1 7.75 14h-3A2.75 2.75 0 0 1 2 11.25v-6.5Zm9.47.47a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06l-2.25 2.25a.75.75 0 1 1-1.06-1.06l.97-.97H6.75a.75.75 0 0 1 0-1.5h5.69l-.97-.97a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                )}
                {isLoggingOut ? 'Déconnexion...' : 'Se déconnecter'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
