import Link from 'next/link';
import { getSession } from '@/lib/session';
import { getUserById, getEffectivePlan } from '@/lib/auth';
import NavbarUserMenu from './NavbarUserMenu';
import NavbarMobileMenu from './NavbarMobileMenu';
import BrandLogo from './BrandLogo';

export default async function Navbar() {
  const session = await getSession();
  const userProfile = session ? await getUserById(session.userId) : null;
  const plan = userProfile ? getEffectivePlan(userProfile) : 'free';

  const linkCls =
    'text-[13px] font-semibold text-gray-400 hover:text-white transition-colors px-3.5 py-2 rounded-full hover:bg-white/[0.055]';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-vn-bg/75 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-vn-bg/65">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-[4.25rem] flex items-center justify-between gap-3">
        <BrandLogo href="/" />

        <div className="hidden lg:flex flex-1 justify-center px-4">
          <div className="flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.025] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
            <a href="/#fonctionnalites" className={linkCls}>
              Fonctionnalités
            </a>
            <a href="/#comment-ca-marche" className={linkCls}>
              Comment ça marche
            </a>
            <a href="/#tarifs" className={linkCls}>
              Tarifs
            </a>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="ml-2 text-[13px] font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/25"
              >
                Ouvrir le dashboard
              </Link>
              <div className="ml-1 pl-1">
                <NavbarUserMenu email={session.email} plan={plan} />
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className={linkCls}>
                Se connecter
              </Link>
              <Link
                href="/signup"
                className="ml-2 text-[13px] font-semibold px-5 py-2.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/25"
              >
                Commencer
              </Link>
            </>
          )}
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <NavbarMobileMenu isLoggedIn={!!session} email={session?.email} plan={plan} />
        </div>
      </div>
    </nav>
  );
}
