import Link from 'next/link';
import CheckoutButton from '@/components/CheckoutButton';
import PricingFAQ from '@/components/PricingFAQ';
import FloatingParticles from '@/components/FloatingParticles';
import { HISTORY_LIMITS } from '@/lib/plan-limits';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

/* ── Icons ───────────────────────────────────────────────────────────────── */
function CheckFuchsia() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 text-vn-fuchsia">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CheckViolet() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 text-violet-400">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CheckGray() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 text-gray-600">
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-gray-700">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

/* ── Comparison helpers ──────────────────────────────────────────────────── */
const comparisonRows: {
  label: string;
  mobileLabel: string;
  free: boolean | string;
  pro: boolean | string;
  elite: boolean | string;
  /** Texte court pour cellules texte sur très petit écran */
  mobileFree?: string;
  mobilePro?: string;
  mobileElite?: string;
}[] = [
  { label: 'Analyses / mois', mobileLabel: 'Analyses', free: `${MAX_ANALYSES_FREE}`, pro: `${MAX_ANALYSES_PRO}`, elite: `${MAX_ANALYSES_ELITE}` },
  { label: 'Score de viralité', mobileLabel: 'Score', free: true, pro: true, elite: true },
  { label: 'Hook · Montage · Rétention', mobileLabel: 'H·M·R', free: true, pro: true, elite: true },
  { label: 'Recommandations IA', mobileLabel: 'Reco. IA', free: 'Basiques', pro: 'Avancées', elite: 'Complètes', mobileFree: 'Bas.', mobilePro: 'Av.', mobileElite: 'Compl.' },
  { label: 'Dashboard coach IA', mobileLabel: 'Dashboard', free: true, pro: true, elite: true },
  { label: "Plan d'action personnalisé", mobileLabel: 'Plan act.', free: false, pro: true, elite: true },
  { label: 'Générateur de hooks', mobileLabel: 'Hooks', free: false, pro: `${MAX_HOOKS_PRO}/mois`, elite: `${MAX_HOOKS_ELITE}/mois`, mobilePro: `${MAX_HOOKS_PRO}/m`, mobileElite: `${MAX_HOOKS_ELITE}/m` },
  { label: 'Historique', mobileLabel: 'Historique', free: false, pro: `${HISTORY_LIMITS.pro} analyses`, elite: 'Illimité', mobilePro: `${HISTORY_LIMITS.pro}`, mobileElite: '∞' },
  { label: 'Stratégie Elite & Insights', mobileLabel: 'Strat. Elite', free: false, pro: false, elite: true },
  { label: 'Support', mobileLabel: 'Support', free: 'Email', pro: 'Email', elite: 'Prioritaire', mobileElite: 'Prior.' },
];

function CellVal({
  v,
  accent,
  mobileText,
}: {
  v: boolean | string;
  accent?: 'fuchsia' | 'violet';
  /** Libellé court sur mobile (masqué à partir de sm) */
  mobileText?: string;
}) {
  if (v === false) return <CrossIcon />;
  if (v === true) {
    if (accent === 'violet') return <CheckViolet />;
    if (accent === 'fuchsia') return <CheckFuchsia />;
    return <CheckGray />;
  }
  const cls = accent === 'violet' ? 'text-violet-300' : accent === 'fuchsia' ? 'text-vn-fuchsia' : 'text-gray-400';
  const short = mobileText ?? v;
  return (
    <>
      <span className={`sm:hidden font-semibold leading-[1.15] text-center block max-w-full break-words ${cls} text-[8px]`}>
        {short}
      </span>
      <span className={`hidden sm:block font-semibold leading-tight text-center ${cls} text-[12px]`}>
        {v}
      </span>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function PricingPage() {
  return (
    <main className="relative min-h-screen bg-vn-void overflow-x-hidden">

      {/* Particles — top section only */}
      <div className="absolute top-0 inset-x-0 h-[520px] pointer-events-none overflow-hidden" aria-hidden>
        <FloatingParticles count={40} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10 pb-16 space-y-16">

        {/* ═══════════════════════════════════════════════ */}
        {/* HERO                                           */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="text-center space-y-7">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold px-4 py-1.5 rounded-full bg-vn-fuchsia/10 text-vn-fuchsia border border-vn-fuchsia/20 tracking-wide">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
              Tarifs simples · Sans engagement
            </span>
          </div>

          <div className="space-y-4">
            <h1 className="text-[2.1rem] sm:text-[2.8rem] md:text-[3.75rem] font-black text-white tracking-tight leading-[1.05]">
              Arrête de deviner.
              <br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">
                Commence à performer.
              </span>
            </h1>
            <p className="text-base sm:text-lg text-gray-400 max-w-lg mx-auto leading-relaxed">
              Viralynz analyse tes vidéos TikTok et t&apos;explique exactement quoi corriger.
              Comprends ce qui bloque — avant de publier à nouveau.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {[
              'Commence gratuitement',
              'Sans carte bancaire',
              'Annulation à tout moment',
            ].map((t) => (
              <span key={t} className="flex items-center gap-2 text-[11px] sm:text-[12px] text-gray-500">
                <span className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 text-emerald-500">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                </span>
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* PRICING CARDS                                  */}
        {/* ═══════════════════════════════════════════════ */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:items-end">

            {/* ── STARTER ── */}
            <div className="md:pr-3">
              <div className="rounded-2xl border border-white/[0.07] bg-[#09090f] p-7 h-full flex flex-col">

                <div className="mb-6">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-white/[0.04] text-gray-600 border border-white/[0.05]">
                    Starter
                  </span>
                  <div className="mt-5 mb-1">
                    <span className="text-[2.6rem] font-black text-white leading-none">Gratuit</span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">
                    Découvre Viralynz sans risque. Vois exactement ce que l&apos;IA repère sur tes vidéos.
                  </p>
                </div>

                <Link
                  href="/analyzer"
                  className="w-full text-center py-3.5 rounded-xl font-semibold text-[13px] text-gray-300 bg-white/[0.05] border border-white/[0.09] hover:bg-white/[0.09] hover:text-white transition-all mb-7 block"
                >
                  Essayer gratuitement
                </Link>

                {/* Groupe Analyse */}
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-700 mb-3">Ce que tu obtiens</p>
                <ul className="space-y-2.5 flex-1">
                  {[
                    { text: `${MAX_ANALYSES_FREE} analyses complètes`, sub: 'Score + Hook + Montage + Rétention', ok: true },
                    { text: 'Recommandations IA', sub: 'Plan de correction basique', ok: true },
                    { text: 'Dashboard de progression', sub: 'Visualise tes scores', ok: true },
                    { text: 'Générateur de hooks', sub: null, ok: false },
                    { text: "Plan d'action priorisé", sub: null, ok: false },
                    { text: 'Historique des analyses', sub: null, ok: false },
                  ].map((f, i) => (
                    <li key={i} className={`flex items-start gap-2.5 ${!f.ok ? 'opacity-35' : ''}`}>
                      {f.ok
                        ? <CheckGray />
                        : <CrossIcon />
                      }
                      <div>
                        <span className={`text-[12.5px] leading-snug block ${f.ok ? 'text-gray-400' : 'text-gray-700'}`}>{f.text}</span>
                        {f.sub && <span className="text-[10px] text-gray-700 leading-none">{f.sub}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── PRO — ELEVATED ── */}
            <div className="md:-mt-10 md:z-10 relative">
              <div className="flex justify-center mb-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-4 py-1.5 rounded-full bg-vn-fuchsia text-white shadow-lg shadow-vn-fuchsia/50">
                  ⭐ Le plus populaire
                </span>
              </div>

              <div className="relative flex flex-col rounded-[1.2rem] border border-vn-fuchsia/35 bg-gradient-to-b from-[#130916] to-[#0a0810] p-7 shadow-[0_16px_60px_-16px_rgba(232,121,249,0.35)] z-10 overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/80 to-transparent" />
                <FloatingParticles count={28} className="opacity-50" />

                <div className="relative mb-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/35">Pro</span>
                    <span className="text-[10px] text-vn-fuchsia/70 font-semibold">Recommandé</span>
                  </div>

                  {/* Price + anchor */}
                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[3rem] font-black text-white leading-none">{DISPLAY_CATALOG_PRO_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-2">/ mois</span>
                  </div>
                  {/* ROI anchor */}
                  <div className="mt-2 mb-4 px-3 py-2 rounded-lg bg-vn-fuchsia/[0.08] border border-vn-fuchsia/15">
                    <p className="text-[11px] text-vn-fuchsia/80 leading-snug">
                      💡 <span className="font-semibold">1 vidéo mieux optimisée</span> = des dizaines de milliers de vues supplémentaires.
                    </p>
                  </div>

                  {/* Social proof */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-2">
                      {[
                        'https://i.pravatar.cc/40?img=11',
                        'https://i.pravatar.cc/40?img=47',
                        'https://i.pravatar.cc/40?img=12',
                        'https://i.pravatar.cc/40?img=44',
                        'https://i.pravatar.cc/40?img=15',
                      ].map((src, i) => (
                        <img key={i} src={src} alt="" width={24} height={24}
                          className="w-6 h-6 rounded-full border-2 border-[#0a0810] object-cover" />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-500">Choisi par <span className="text-gray-300 font-semibold">80% des créateurs</span> Viralynz</span>
                  </div>
                </div>

                <CheckoutButton
                  plan="pro"
                  className="relative w-full text-center py-4 rounded-xl font-bold text-[14px] text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_32px_-8px_rgba(232,121,249,0.55)] mb-2 block"
                >
                  Commencer avec Pro →
                </CheckoutButton>
                <p className="text-[10px] text-gray-700 text-center mb-6">Sans engagement · Annule en 1 clic</p>

                <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/25 to-transparent mb-5" />

                {/* Feature groups */}
                <div className="space-y-5 flex-1">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia/50 mb-2.5">Analyse IA</p>
                    <ul className="space-y-2">
                      {[
                        { text: `${MAX_ANALYSES_PRO} analyses / mois`, bold: true },
                        { text: 'Score de viralité + Hook / Montage / Rétention', bold: false },
                        { text: 'Plan d\'action IA priorisé', bold: false },
                        { text: 'Recommandations avancées', bold: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckFuchsia />
                          <span className={`text-[12.5px] leading-snug ${f.bold ? 'text-white font-bold' : 'text-gray-300'}`}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-vn-fuchsia/50 mb-2.5">Création</p>
                    <ul className="space-y-2">
                      {[
                        { text: `${MAX_HOOKS_PRO} hooks générés / mois`, bold: true },
                        { text: `Historique ${HISTORY_LIMITS.pro} analyses`, bold: false },
                        { text: 'Dashboard coach personnalisé', bold: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckFuchsia />
                          <span className={`text-[12.5px] leading-snug ${f.bold ? 'text-white font-bold' : 'text-gray-300'}`}>{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── ELITE ── */}
            <div className="md:pl-3">
              <div className="relative flex flex-col rounded-2xl border border-violet-500/25 bg-gradient-to-b from-[#0e0b16] to-[#080810] p-7 h-full overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_50%_0%,rgba(139,92,246,0.08),transparent)] pointer-events-none" />

                <div className="relative mb-6">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-widest bg-violet-500/15 text-violet-300 border border-violet-500/25">Elite</span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2.5 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20">
                      🔥 Volume max
                    </span>
                  </div>

                  <div className="flex items-end gap-2 mb-1">
                    <span className="text-[2.6rem] font-black text-white leading-none">{DISPLAY_CATALOG_ELITE_EUR}€</span>
                    <span className="text-gray-500 text-sm pb-1.5">/ mois</span>
                  </div>
                  {/* ROI anchor Elite */}
                  <div className="mt-2 mb-4 px-3 py-2 rounded-lg bg-violet-500/[0.07] border border-violet-500/15">
                    <p className="text-[11px] text-violet-300/80 leading-snug">
                      ⚡ Pour les <span className="font-semibold">agences, studios & créateurs à 100k+</span> qui publient chaque semaine.
                    </p>
                  </div>
                </div>

                <CheckoutButton
                  plan="elite"
                  className="relative w-full text-center py-4 rounded-xl font-bold text-[13px] text-white bg-gradient-to-r from-violet-600 to-vn-fuchsia hover:opacity-90 active:scale-[0.98] transition-all shadow-[0_8px_32px_-8px_rgba(139,92,246,0.4)] mb-2 block ring-1 ring-white/10"
                >
                  Passer en Elite →
                </CheckoutButton>
                <p className="text-[10px] text-gray-700 text-center mb-6">Sans engagement · Annule en 1 clic</p>

                <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent mb-5" />

                <div className="space-y-5 flex-1">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-violet-400/50 mb-2.5">Volume & Analyse</p>
                    <ul className="space-y-2">
                      {[
                        { text: `${MAX_ANALYSES_ELITE} analyses / mois`, elite: true },
                        { text: 'Score + Hook / Montage / Rétention', elite: false },
                        { text: 'Recommandations IA complètes', elite: false },
                        { text: 'Plan d\'action IA priorisé', elite: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckViolet />
                          <span className={`text-[12.5px] leading-snug flex-1 ${f.elite ? 'text-violet-100 font-bold' : 'text-gray-400'}`}>{f.text}</span>
                          {f.elite && <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wide ml-1 self-center">Elite</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-violet-400/50 mb-2.5">Exclusif Elite</p>
                    <ul className="space-y-2">
                      {[
                        { text: `${MAX_HOOKS_ELITE} hooks / mois`, elite: true },
                        { text: 'Historique illimité', elite: true },
                        { text: 'Stratégie & Insights viraux exclusifs', elite: true },
                        { text: 'Support prioritaire', elite: false },
                      ].map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckViolet />
                          <span className={`text-[12.5px] leading-snug flex-1 ${f.elite ? 'text-violet-100 font-bold' : 'text-gray-400'}`}>{f.text}</span>
                          {f.elite && <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 uppercase tracking-wide ml-1 self-center">Elite</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust bar */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-8 text-[11px] text-gray-600">
            {[
              { icon: '🔒', label: 'Paiement sécurisé Stripe' },
              { icon: '↩', label: 'Remboursement 7 jours' },
              { icon: '∞', label: 'Sans engagement' },
              { icon: '🔄', label: 'Quotas rechargés le 1er du mois' },
            ].map((t) => (
              <span key={t.label} className="flex items-center gap-2">
                <span className="text-base leading-none">{t.icon}</span>
                {t.label}
              </span>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* VALEUR                                         */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Pourquoi Viralynz vaut</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">l&apos;investissement.</span>
            </h2>
            <p className="text-[14px] text-gray-500 max-w-md mx-auto">
              Chaque analyse te donne des décisions concrètes — pas des métriques à interpréter seul.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: '🧠',
                accent: 'fuchsia',
                title: 'Comprends pourquoi ça performe',
                desc: "Fini l'intuition. Viralynz décompose chaque vidéo en Hook, Montage et Rétention — et t'explique exactement pourquoi elle cartonne ou reste invisible.",
                stat: '3 dimensions analysées',
              },
              {
                icon: '🎯',
                accent: 'violet',
                title: 'Identifie quoi corriger en premier',
                desc: "Un score, des priorités claires, un plan d'action en 3 étapes. Tu sais exactement où concentrer ton énergie avant de repost.",
                stat: 'Plan d\'action personnalisé',
              },
              {
                icon: '⚡',
                accent: 'indigo',
                title: 'Gagne du temps sur tes tests',
                desc: "Moins d'essais/erreurs, plus de décisions éclairées. Chaque vidéo devient un test intelligent avec un retour immédiat.",
                stat: 'Retour immédiat après analyse',
              },
              {
                icon: '📈',
                accent: 'fuchsia',
                title: 'Un coach IA dans ta poche',
                desc: "Viralynz ne te donne pas juste un score. Il te dit ce qui bloque, pourquoi, et comment le corriger pour performer sur la prochaine vidéo.",
                stat: 'Conseils actionnables',
              },
            ].map((v) => (
              <div key={v.title} className={`rounded-2xl border p-6 space-y-4 ${
                v.accent === 'fuchsia' ? 'border-vn-fuchsia/15 bg-vn-fuchsia/[0.03]'
                : v.accent === 'violet' ? 'border-violet-500/15 bg-violet-500/[0.03]'
                : 'border-vn-indigo/15 bg-vn-indigo/[0.03]'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    v.accent === 'fuchsia' ? 'bg-vn-fuchsia/10 border border-vn-fuchsia/20'
                    : v.accent === 'violet' ? 'bg-violet-500/10 border border-violet-500/20'
                    : 'bg-vn-indigo/10 border border-vn-indigo/20'
                  }`}>
                    {v.icon}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border mt-0.5 ${
                    v.accent === 'fuchsia' ? 'bg-vn-fuchsia/10 text-vn-fuchsia border-vn-fuchsia/20'
                    : v.accent === 'violet' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                    : 'bg-vn-indigo/10 text-indigo-400 border-vn-indigo/20'
                  }`}>
                    {v.stat}
                  </span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white mb-1.5 leading-snug">{v.title}</p>
                  <p className="text-[12px] text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* COMPARISON TABLE                               */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              <span className="text-white">Ce que comprend</span>{' '}
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">chaque plan.</span>
            </h2>
          </div>

          {/* Tableau fluide pleine largeur (sans scroll horizontal) */}
          <div className="w-full min-w-0 -mx-1 px-1 sm:mx-0 sm:px-0">
            <div className="w-full min-w-0 rounded-2xl border border-white/[0.07] overflow-hidden">
              {/* Header */}
              <div className="grid w-full min-w-0 grid-cols-[minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.72fr)] sm:grid-cols-4">
                <div className="min-w-0 p-2 sm:p-5 bg-white/[0.02] border-b border-r border-white/[0.06] flex items-center">
                  <p className="text-[7px] sm:text-[10px] font-bold uppercase tracking-[0.08em] sm:tracking-widest text-gray-600 leading-tight">
                    <span className="sm:hidden">Fonct.</span>
                    <span className="hidden sm:inline">Fonctionnalité</span>
                  </p>
                </div>
                <div className="min-w-0 p-2 sm:p-5 bg-white/[0.02] border-b border-r border-white/[0.06] text-center flex flex-col justify-center">
                  <p className="text-[10px] sm:text-[12px] font-bold text-gray-500 leading-tight">Starter</p>
                  <p className="text-[8px] sm:text-[10px] text-gray-700 mt-0.5 leading-tight">Gratuit</p>
                </div>
                <div className="min-w-0 p-2 sm:p-5 border-b border-r border-vn-fuchsia/20 text-center bg-gradient-to-b from-vn-fuchsia/[0.07] to-vn-fuchsia/[0.03] relative flex flex-col justify-center">
                  <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-vn-fuchsia/60 to-transparent" />
                  <p className="text-[10px] sm:text-[12px] font-bold text-vn-fuchsia leading-tight">Pro</p>
                  <p className="text-[8px] text-vn-fuchsia/50 mt-0.5 leading-tight tabular-nums sm:text-[10px]">
                    <span className="sm:hidden">{DISPLAY_CATALOG_PRO_EUR}€/m</span>
                    <span className="hidden sm:inline">{DISPLAY_CATALOG_PRO_EUR}€/mois</span>
                  </p>
                </div>
                <div className="min-w-0 p-2 sm:p-5 bg-white/[0.02] border-b border-white/[0.06] text-center flex flex-col justify-center">
                  <p className="text-[10px] sm:text-[12px] font-bold text-violet-300 leading-tight">Elite</p>
                  <p className="text-[8px] text-gray-600 mt-0.5 leading-tight tabular-nums sm:text-[10px]">
                    <span className="sm:hidden">{DISPLAY_CATALOG_ELITE_EUR}€/m</span>
                    <span className="hidden sm:inline">{DISPLAY_CATALOG_ELITE_EUR}€/mois</span>
                  </p>
                </div>
              </div>

              {/* Rows */}
              {comparisonRows.map((row, i) => (
                <div
                  key={i}
                  className={`grid w-full min-w-0 grid-cols-[minmax(0,1.05fr)_minmax(0,0.72fr)_minmax(0,0.72fr)_minmax(0,0.72fr)] sm:grid-cols-4 ${i < comparisonRows.length - 1 ? 'border-b border-white/[0.04]' : ''} ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}
                >
                  <div className="min-w-0 px-1.5 sm:px-5 py-2 sm:py-3.5 text-[8px] sm:text-[12px] text-gray-400 border-r border-white/[0.04] flex items-center font-medium leading-snug">
                    <span className="sm:hidden">{row.mobileLabel}</span>
                    <span className="hidden sm:inline">{row.label}</span>
                  </div>
                  <div className="min-w-0 px-1 sm:px-5 py-2 sm:py-3.5 flex items-center justify-center border-r border-white/[0.04]">
                    <CellVal v={row.free} mobileText={row.mobileFree} />
                  </div>
                  <div className="min-w-0 px-1 sm:px-5 py-2 sm:py-3.5 flex items-center justify-center border-r border-vn-fuchsia/[0.08] bg-vn-fuchsia/[0.03]">
                    <CellVal v={row.pro} accent="fuchsia" mobileText={row.mobilePro} />
                  </div>
                  <div className="min-w-0 px-1 sm:px-5 py-2 sm:py-3.5 flex items-center justify-center">
                    <CellVal v={row.elite} accent="violet" mobileText={row.mobileElite} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* POUR QUI                                       */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              <span className="text-white">Quel plan</span>{' '}
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">te correspond ?</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                plan: 'Starter', planColor: 'gray', emoji: '👋',
                who: 'Tu découvres Viralynz',
                profile: 'Créateur curieux qui veut tester sans risque',
                points: ['Tu publies de temps en temps', 'Tu veux comprendre le concept', "Tu veux tester avant d'investir"],
                cta: 'Commencer gratuitement', isLink: true, href: '/analyzer',
                cardClass: 'border-white/[0.07] bg-white/[0.01]',
                ctaClass: 'bg-white/[0.05] border border-white/[0.08] text-gray-300 hover:bg-white/[0.08]',
                arrowColor: 'text-gray-600',
              },
              {
                plan: 'Pro', planColor: 'fuchsia', emoji: '🚀',
                who: 'Tu publies avec méthode',
                profile: 'Créateur régulier, e-com, UGC, agence social media',
                points: ['Tu publies plusieurs fois par semaine', "Tu veux comprendre ce qui performe", 'Tu veux progresser vidéo après vidéo'],
                cta: 'Choisir Pro', isLink: false, checkout: 'pro' as const,
                cardClass: 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.04]',
                ctaClass: 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 shadow-md shadow-vn-fuchsia/20',
                arrowColor: 'text-vn-fuchsia',
              },
              {
                plan: 'Elite', planColor: 'violet', emoji: '⚡',
                who: 'Tu veux scaler fort',
                profile: 'Créateur pro, agence, studio de contenu ou marque',
                points: ["Tu analyses beaucoup de contenus", 'Tu veux la stratégie complète', 'Tu optimises à grande échelle'],
                cta: 'Passer en Elite', isLink: false, checkout: 'elite' as const,
                cardClass: 'border-violet-500/15 bg-violet-500/[0.03]',
                ctaClass: 'bg-gradient-to-r from-violet-600 to-vn-fuchsia text-white hover:opacity-90 shadow-md shadow-violet-500/20',
                arrowColor: 'text-violet-400',
              },
            ].map((p) => (
              <div key={p.plan} className={`rounded-2xl border p-6 space-y-5 ${p.cardClass}`}>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xl">{p.emoji}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${p.planColor === 'fuchsia' ? 'text-vn-fuchsia' : p.planColor === 'violet' ? 'text-violet-400' : 'text-gray-600'}`}>
                      {p.plan}
                    </span>
                  </div>
                  <p className="text-[15px] font-bold text-white leading-tight">{p.who}</p>
                  <p className="text-[11px] text-gray-600 mt-1">{p.profile}</p>
                </div>

                <ul className="space-y-2">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className={`text-[10px] font-black mt-0.5 shrink-0 ${p.arrowColor}`}>→</span>
                      <span className="text-[12px] text-gray-400 leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>

                {p.isLink ? (
                  <Link href={(p as { href: string }).href} className={`w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all block ${p.ctaClass}`}>
                    {p.cta}
                  </Link>
                ) : (
                  <CheckoutButton plan={(p as { checkout: 'pro' | 'elite' }).checkout} className={`w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all block ${p.ctaClass}`}>
                    {p.cta}
                  </CheckoutButton>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* FAQ                                            */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="space-y-8 max-w-2xl mx-auto w-full">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
              <span className="text-white">Tout ce que tu</span>{' '}
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">veux savoir.</span>
            </h2>
            <p className="text-[13px] text-gray-600">Des réponses claires, sans bullshit.</p>
          </div>
          <PricingFAQ />
        </section>

        {/* ═══════════════════════════════════════════════ */}
        {/* CTA FINAL                                      */}
        {/* ═══════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.09] p-10 sm:p-16 text-center">
          {/* Background layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/[0.09] via-transparent to-vn-indigo/[0.07] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(232,121,249,0.12),transparent)] pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/60 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

          <div className="relative space-y-6">
            <div className="inline-flex items-center gap-2 text-[10px] font-bold px-4 py-1.5 rounded-full bg-vn-fuchsia/10 text-vn-fuchsia border border-vn-fuchsia/20">
              Prêt à passer à la vitesse supérieure ?
            </div>
            <h2 className="text-3xl sm:text-5xl font-black leading-[1.05] tracking-tight">
              <span className="text-white">Passe de l&apos;intuition</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">
                à une vraie méthode.
              </span>
            </h2>
            <p className="text-[14px] text-gray-400 max-w-md mx-auto leading-relaxed">
              Analyse ta première vidéo gratuitement. Comprends ce qui bloque.
              Corrige avant de reposter.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-vn-fuchsia/30"
              >
                Analyser ma première vidéo
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm text-gray-400 bg-white/[0.04] border border-white/[0.09] hover:bg-white/[0.07] hover:text-gray-200 transition-all"
              >
                Créer un compte gratuit
              </Link>
            </div>

            <p className="text-[11px] text-gray-700">
              Sans carte bancaire · 3 analyses gratuites · Annulable à tout moment
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
