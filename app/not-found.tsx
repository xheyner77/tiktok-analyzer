import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[60dvh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-vn-fuchsia/80 mb-3">404</p>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Page introuvable</h1>
      <p className="text-sm text-gray-500 max-w-md mb-8">
        Ce lien n&apos;existe pas ou a &eacute;t&eacute; d&eacute;plac&eacute;. V&eacute;rifie l&apos;URL ou reviens &agrave; l&apos;accueil.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 transition-all"
        >
          Accueil
        </Link>
        <Link
          href="/analyzer"
          className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold text-gray-300 border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all"
        >
          Analyser une vid&eacute;o
        </Link>
      </div>
    </main>
  );
}
