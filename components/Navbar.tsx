import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import NavbarUserMenu from './NavbarUserMenu';
import NavbarMobileMenu from './NavbarMobileMenu';
import FeedbackButton from './FeedbackButton';
import BrandLogo from './BrandLogo';

export default async function Navbar() {
  const session = await getSession();
  const userProfile = session ? await getUserById(session.userId) : null;
  const plan = userProfile ? getEffectivePlan(userProfile) : 'free';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.07] bg-vn-bg/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <BrandLogo href="/" />

        <div className="hidden lg:flex items-center gap-1">
          <Link
            href="/"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Accueil
          </Link>
          <Link
            href="/#capacites"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Capacités
          </Link>
          <Link
            href="/#workflow"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Parcours
          </Link>
          {session && (
            <Link
              href="/dashboard"
              className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
            >
              Dashboard
            </Link>
          )}
          <Link
            href="/analyzer"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Analyser
          </Link>
          <Link
            href="/hook-generator"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Hooks
          </Link>
          <Link
            href="/pricing"
            className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
          >
            Tarifs
          </Link>

          <div className="mx-2 w-px h-4 bg-white/10 shrink-0" aria-hidden />
          <FeedbackButton />

          {session ? (
            <div className="ml-1 pl-1">
              <NavbarUserMenu email={session.email} plan={plan} />
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
              >
                Connexion
              </Link>
              <Link
                href="/signup"
                className="ml-1 text-[13px] font-semibold px-4 py-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-95 transition-opacity shadow-md shadow-vn-fuchsia/20"
              >
                Commencer
              </Link>
            </>
          )}
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <FeedbackButton />
          <NavbarMobileMenu isLoggedIn={!!session} email={session?.email} plan={plan} />
        </div>
      </div>
    </nav>
  );
}
