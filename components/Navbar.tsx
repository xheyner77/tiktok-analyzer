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

  const linkCls =
    'text-[13px] font-medium text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-vn-bg/75 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-vn-bg/65">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-[4.25rem] flex items-center justify-between gap-3">
        <BrandLogo href="/" />

        <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center max-w-3xl mx-4">
          <Link href="/#produit" className={linkCls}>
            Produit
          </Link>
          <Link href="/#fonctions" className={linkCls}>
            Fonctionnalités
          </Link>
          <Link href="/#gains" className={linkCls}>
            Bénéfices
          </Link>
          <Link href="/#roadmap" className={linkCls}>
            Roadmap
          </Link>
          <Link href="/#tarifs" className={linkCls}>
            Tarifs
          </Link>
          {session && (
            <Link href="/dashboard" className={linkCls}>
              Dashboard
            </Link>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-1 shrink-0">
          <Link href="/analyzer" className={`${linkCls} text-gray-300`}>
            Analyser
          </Link>
          <Link href="/hook-generator" className={linkCls}>
            Hooks
          </Link>
          <div className="mx-2 w-px h-4 bg-white/10 shrink-0" aria-hidden />
          <FeedbackButton />

          {session ? (
            <div className="ml-1 pl-1">
              <NavbarUserMenu email={session.email} plan={plan} />
            </div>
          ) : (
            <>
              <Link href="/login" className={linkCls}>
                Connexion
              </Link>
              <Link
                href="/analyzer"
                className="ml-2 text-[13px] font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/25"
              >
                Essayer l’analyse
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
