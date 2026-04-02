'use client';

import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';

const YEAR = new Date().getFullYear();

function IconTiktok() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.73a4.85 4.85 0 01-1.01-.04z" />
    </svg>
  );
}

function IconTwitter() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconInstagram() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}


export default function Footer() {
  return (
    <footer className="relative bg-vn-void border-t border-white/[0.07]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10 py-10 sm:py-14 lg:py-16">

        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="flex flex-col gap-5">
            <BrandLogo />
            <p className="text-[22px] font-black text-white leading-tight tracking-tight max-w-[200px]">
              Lance-toi<br />dès maintenant.
            </p>
            <p className="text-[13px] text-gray-500 leading-relaxed max-w-[210px]">
              Analyse ta première vidéo gratuitement, sans carte bancaire.
            </p>
            <div>
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 hover:scale-[1.02] transition-all shadow-lg"
              >
                Commencer gratuitement
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Viralynz column */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white mb-5">Viralynz</p>
            <ul className="space-y-3">
              {[
                { label: 'Fonctionnalités', href: '/features' },
                { label: 'Tarifs',          href: '/pricing' },
                { label: 'FAQ',             href: '/pricing#faq' },
                { label: 'Nouveautés',      href: '/changelog' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-contact'))}
                  className="text-[13px] text-gray-500 hover:text-white transition-colors text-left"
                >
                  Nous contacter
                </button>
              </li>
            </ul>
          </div>

          {/* Outils column */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white mb-5">Outils</p>
            <ul className="space-y-3">
              {[
                { label: 'Analyser une vidéo', href: '/analyzer' },
                { label: 'Hook Generator',     href: '/hook-generator' },
                { label: 'Dashboard',          href: '/dashboard' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Légal column */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white mb-5">Légal</p>
            <ul className="space-y-3">
              {[
                { label: 'CGU',               href: '/legal/cgu' },
                { label: 'CGV',               href: '/legal/cgv' },
                { label: 'Confidentialité',   href: '/legal/confidentialite' },
                { label: 'Mentions légales',  href: '/legal/mentions-legales' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-[13px] text-gray-500 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-7 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div />
          {/* Copyright */}
          <p className="text-[11.5px] text-gray-700">
            Copyright &copy; {YEAR} Viralynz. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
