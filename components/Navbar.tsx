import Link from 'next/link';
import { getSession } from '@/lib/session';
import NavbarUserMenu from './NavbarUserMenu';

export default async function Navbar() {
  const session = await getSession();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#141414] bg-[#080808]/85 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff0050] to-[#7928ca] flex items-center justify-center shadow-sm shadow-[#ff0050]/30 group-hover:opacity-90 transition-opacity">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            TikTok<span className="gradient-text">Analyzer</span>
          </span>
        </Link>

        {/* Nav */}
        <div className="flex items-center gap-1">
          {session && (
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Analyser
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Tarifs
          </Link>

          {session ? (
            /* Authenticated — show user menu */
            <div className="ml-2">
              <NavbarUserMenu email={session.email} />
            </div>
          ) : (
            /* Guest — show login + subscribe */
            <>
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="ml-1 text-xs font-semibold px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 transition-opacity shadow-sm shadow-[#ff0050]/20"
              >
                S&apos;inscrire
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
