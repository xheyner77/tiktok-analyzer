import Link from 'next/link';
import CheckoutButton from '@/components/CheckoutButton';
import PricingFAQ from '@/components/PricingFAQ';
import { HISTORY_LIMITS } from '@/lib/analyses';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

/* ── Check / Cross icons ─────────────────────────────────────────────────── */
function Check({ color = 'fuchsia' }: { color?: 'fuchsia' | 'violet' | 'gray' }) {
  const cls =
    color === 'violet' ? 'text-violet-400' : color === 'gray' ? 'text-gray-600' : 'text-vn-fuchsia';
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={`w-4 h-4 shrink-0 ${cls}`}>
      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 shrink-0 text-gray-700">
      <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
    </svg>
  );
}

/* ── Pricing cards ───────────────────────────────────────────────────────── */
function StarterCard() {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-white/[0.07] bg-[#0a0a10] p-6">
      <div className="mb-6">
        <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-widest mb-4 bg-white/[0.05] text-gray-500 border border-white/[0.06]">
          Starter
        </span>
        <div className="flex items-end gap-1 mb-3">
          <span className="text-4xl font-black text-white leading-none">Gratuit</span>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed">
          Pour découvrir Viralynz et analyser tes premières vidéos sans risque.
        </p>
      </div>

      <Link
        href="/analyzer"
        className="w-full text-center py-3 rounded-xl font-semibold text-sm text-gray-300 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] hover:text-white transition-all mb-6 block"
      >
        Commencer gratuitement
      </Link>

      <div className="h-px bg-white/[0.05] mb-5" />

      <ul className="space-y-3 flex-1">
        {[
          { label: `${MAX_ANALYSES_FREE} analyses offertes`, ok: true },
          { label: 'Score de viralité complet', ok: true },
          { label: 'Analyse Hook, Montage, Rétention', ok: true },
          { label: 'Recommandations IA', ok: true },
          { label: 'Dashboard coach', ok: true },
          { label: 'Générateur de hooks', ok: false },
          { label: 'Historique des analyses', ok: false },
          { label: 'Plan d\'action personnalisé', ok: false },
        ].map((f, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {f.ok ? <Check /> : <Cross />}
            <span className={`text-[13px] leading-snug ${f.ok ? 'text-gray-400' : 'text-gray-700'}`}>
              {f.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProCard() {
  return (
    <div className="flex flex-col h-full relative">
      {/* Popular badge above card */}
      <div className="flex justify-center mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/30">
          ⭐ Le plus populaire
        </span>
      </div>

      <div className="relative flex flex-col flex-1 rounded-2xl border border-vn-fuchsia/30 bg-gradient-to-b from-vn-fuchsia/[0.07] to-vn-indigo/[0.04] p-6 shadow-[0_0_40px_-8px_rgba(232,121,249,0.2)]">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/60 to-transparent rounded-t-2xl" />

        <div className="mb-6">
          <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-widest mb-4 bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/25">
            Pro
          </span>
          <div className="flex items-end gap-1.5 mb-3">
            <span className="text-4xl font-black text-white leading-none">{DISPLAY_CATALOG_PRO_EUR}€</span>
            <span className="text-gray-400 text-sm pb-1">/ mois</span>
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed">
            Pour les créateurs sérieux qui publient avec méthode et veulent des résultats constants.
          </p>
        </div>

        <CheckoutButton
          plan="pro"
          className="w-full text-center py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:opacity-90 transition-all shadow-md shadow-vn-fuchsia/20 mb-6 block"
        >
          Commencer avec Pro
        </CheckoutButton>

        <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/25 to-transparent mb-5" />

        <ul className="space-y-3 flex-1">
          {[
            { label: `${MAX_ANALYSES_PRO} analyses / mois`, ok: true },
            { label: 'Score de viralité complet', ok: true },
            { label: 'Analyse Hook, Montage, Rétention', ok: true },
            { label: 'Recommandations IA avancées', ok: true },
            { label: 'Dashboard coach personnalisé', ok: true },
            { label: `${MAX_HOOKS_PRO} hooks générés / mois`, ok: true },
            { label: `Historique ${HISTORY_LIMITS.pro} analyses`, ok: true },
            { label: 'Stratégie Elite & Insights viraux', ok: false },
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-2.5">
              {f.ok ? <Check /> : <Cross />}
              <span className={`text-[13px] leading-snug ${f.ok ? 'text-gray-200' : 'text-gray-700'}`}>
                {f.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EliteCard() {
  return (
    <div className="flex flex-col h-full relative">
      {/* Badge placeholder to align with Pro */}
      <div className="flex justify-center mb-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-gradient-to-r from-vn-violet/30 to-vn-indigo/30 text-vn-glow border border-vn-violet/30">
          🔥 Volume & Performance
        </span>
      </div>

      <div className="relative flex flex-col flex-1 rounded-2xl border border-vn-violet/25 bg-gradient-to-b from-vn-violet/[0.09] to-transparent p-6 ring-1 ring-vn-violet/10">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-violet/50 to-transparent rounded-t-2xl" />

        <div className="mb-6">
          <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-widest mb-4 bg-vn-violet/20 text-vn-glow border border-vn-violet/30">
            Elite
          </span>
          <div className="flex items-end gap-1.5 mb-3">
            <span className="text-5xl font-black text-white leading-none">{DISPLAY_CATALOG_ELITE_EUR}€</span>
            <span className="text-gray-400 text-sm pb-1">/ mois</span>
          </div>
          <p className="text-[13px] text-gray-300 leading-relaxed">
            Pour scaler plus fort — plus de volume, analyses approfondies et stratégie avancée.
          </p>
        </div>

        <CheckoutButton
          plan="elite"
          className="w-full text-center py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-vn-violet to-vn-fuchsia hover:opacity-90 transition-all shadow-lg shadow-vn-violet/25 ring-1 ring-white/10 mb-6 block"
        >
          Passer en Elite
        </CheckoutButton>

        <div className="h-px bg-gradient-to-r from-transparent via-vn-violet/30 to-transparent mb-5" />

        <ul className="space-y-3 flex-1">
          {[
            { label: `${MAX_ANALYSES_ELITE} analyses / mois`, ok: true },
            { label: 'Score de viralité complet', ok: true },
            { label: 'Analyse Hook, Montage, Rétention', ok: true },
            { label: 'Recommandations IA avancées', ok: true },
            { label: 'Dashboard coach personnalisé', ok: true },
            { label: `${MAX_HOOKS_ELITE} hooks générés / mois`, ok: true },
            { label: 'Historique illimité', ok: true },
            { label: 'Stratégie Elite & Insights viraux', ok: true },
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-2.5">
              {f.ok ? <Check color="violet" /> : <Cross />}
              <span className={`text-[13px] leading-snug ${f.ok ? 'text-gray-200' : 'text-gray-700'}`}>
                {f.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Comparison table ────────────────────────────────────────────────────── */
const comparisonRows = [
  { label: 'Analyses / mois', free: `${MAX_ANALYSES_FREE}`, pro: `${MAX_ANALYSES_PRO}`, elite: `${MAX_ANALYSES_ELITE}`, type: 'text' as const },
  { label: 'Score de viralité', free: true, pro: true, elite: true, type: 'bool' as const },
  { label: 'Hook · Montage · Rétention', free: true, pro: true, elite: true, type: 'bool' as const },
  { label: 'Recommandations IA', free: 'Basiques', pro: 'Avancées', elite: 'Complètes', type: 'text' as const },
  { label: 'Dashboard coach IA', free: true, pro: true, elite: true, type: 'bool' as const },
  { label: 'Plan d\'action personnalisé', free: false, pro: true, elite: true, type: 'bool' as const },
  { label: 'Générateur de hooks', free: false, pro: `${MAX_HOOKS_PRO}/mois`, elite: `${MAX_HOOKS_ELITE}/mois`, type: 'text' as const },
  { label: 'Historique', free: false, pro: `${HISTORY_LIMITS.pro} analyses`, elite: 'Illimité', type: 'text' as const },
  { label: 'Stratégie Elite & Insights viraux', free: false, pro: false, elite: true, type: 'bool' as const },
  { label: 'Support', free: 'Standard', pro: 'Standard', elite: 'Prioritaire', type: 'text' as const },
];

function CellValue({ val, isPro, isElite }: { val: boolean | string; isPro?: boolean; isElite?: boolean }) {
  if (val === false) return <Cross />;
  if (val === true) return <Check color={isElite ? 'violet' : isPro ? 'fuchsia' : 'gray'} />;
  return (
    <span className={`text-[12px] font-semibold ${isElite ? 'text-violet-300' : isPro ? 'text-vn-fuchsia' : 'text-gray-400'}`}>
      {val}
    </span>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function PricingPage() {
  return (
    <main className="min-h-screen bg-vn-void overflow-x-hidden">

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[700px] h-[600px] rounded-full bg-vn-fuchsia/[0.07] blur-[120px]" />
        <div className="absolute -top-20 right-1/4 w-[600px] h-[500px] rounded-full bg-vn-indigo/[0.08] blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-vn-violet/[0.04] blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-16 pb-28 space-y-24">

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HERO */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="text-center space-y-6">
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold px-4 py-1.5 rounded-full bg-vn-fuchsia/10 text-vn-fuchsia border border-vn-fuchsia/20">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
              Tarifs simples · Sans engagement
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.05]">
            Arrête de deviner.
            <br />
            <span className="bg-gradient-to-r from-vn-fuchsia to-vn-indigo bg-clip-text text-transparent">
              Commence à performer.
            </span>
          </h1>

          <p className="text-[15px] sm:text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Viralynz analyse tes vidéos TikTok et t&apos;explique exactement quoi corriger.
            <br className="hidden sm:block" />
            Comprends ce qui bloque — avant de publier à nouveau.
          </p>

          {/* Trust micro-badges */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-2">
            {[
              { icon: '✓', label: 'Commence gratuitement' },
              { icon: '✓', label: 'Sans carte bancaire' },
              { icon: '✓', label: 'Annulation à tout moment' },
            ].map((t) => (
              <span key={t.label} className="flex items-center gap-1.5 text-[12px] text-gray-500">
                <span className="text-emerald-500 font-bold">{t.icon}</span>
                {t.label}
              </span>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PRICING CARDS */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-end">
            <StarterCard />
            <ProCard />
            <EliteCard />
          </div>

          {/* Trust bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[11px] text-gray-600">
            {['Paiement sécurisé via Stripe', 'Remboursement 7 jours', 'Sans engagement', 'Quotas rechargés chaque mois'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-emerald-600 shrink-0">
                  <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* POURQUOI ÇA VAUT LE COÛT */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-vn-fuchsia/70">La valeur</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Pourquoi Viralynz vaut l&apos;investissement
            </h2>
            <p className="text-[14px] text-gray-500 max-w-lg mx-auto">
              Chaque analyse te donne des décisions concrètes — pas des données brutes à interpréter seul.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                emoji: '🧠',
                title: 'Comprends pourquoi ça performe',
                desc: "Fini l'intuition. Viralynz dissèque chaque vidéo et t'explique exactement pourquoi elle cartonne — ou non.",
              },
              {
                emoji: '🎯',
                title: 'Identifie quoi corriger en premier',
                desc: 'Un score, des priorités, un plan d\'action. Tu sais exactement où agir avant de repost.',
              },
              {
                emoji: '⚡',
                title: 'Gagne du temps sur tes tests',
                desc: "Moins d'essais / erreurs, plus de décisions éclairées. Chaque vidéo devient un test intelligent.",
              },
              {
                emoji: '📈',
                title: 'Un coach IA dans ta poche',
                desc: "Viralynz ne te dit pas juste ton score — il t'explique ce qui bloque et comment le corriger concrètement.",
              },
            ].map((v) => (
              <div key={v.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-vn-fuchsia/10 border border-vn-fuchsia/20 flex items-center justify-center text-xl">
                  {v.emoji}
                </div>
                <p className="text-[13px] font-bold text-white leading-snug">{v.title}</p>
                <p className="text-[12px] text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* COMPARISON TABLE */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Comparaison</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Ce que comprend chaque plan</h2>
          </div>

          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 bg-white/[0.03] border-b border-white/[0.07]">
              <div className="p-4 text-[11px] font-bold uppercase tracking-widest text-gray-600">Fonctionnalité</div>
              <div className="p-4 text-center">
                <span className="text-[12px] font-bold text-gray-500">Starter</span>
                <p className="text-[11px] text-gray-700 mt-0.5">Gratuit</p>
              </div>
              <div className="p-4 text-center bg-vn-fuchsia/[0.05] border-x border-vn-fuchsia/[0.12]">
                <span className="text-[12px] font-bold text-vn-fuchsia">Pro</span>
                <p className="text-[11px] text-vn-fuchsia/60 mt-0.5">{DISPLAY_CATALOG_PRO_EUR}€/mois</p>
              </div>
              <div className="p-4 text-center">
                <span className="text-[12px] font-bold text-violet-300">Elite</span>
                <p className="text-[11px] text-gray-600 mt-0.5">{DISPLAY_CATALOG_ELITE_EUR}€/mois</p>
              </div>
            </div>

            {/* Rows */}
            {comparisonRows.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-4 border-b border-white/[0.05] last:border-0 ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
              >
                <div className="p-4 text-[12px] text-gray-400 font-medium flex items-center">{row.label}</div>
                <div className="p-4 flex items-center justify-center">
                  <CellValue val={row.free} />
                </div>
                <div className="p-4 flex items-center justify-center bg-vn-fuchsia/[0.03] border-x border-vn-fuchsia/[0.08]">
                  <CellValue val={row.pro} isPro />
                </div>
                <div className="p-4 flex items-center justify-center">
                  <CellValue val={row.elite} isElite />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* POUR QUI */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-8">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Pour qui</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Quel plan te correspond ?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                plan: 'Starter',
                color: 'gray',
                emoji: '👋',
                title: 'Tu découvres Viralynz',
                profile: 'Créateur curieux, premier contact avec l\'analyse vidéo IA',
                points: [
                  'Tu veux tester sans risque',
                  'Tu publies encore peu souvent',
                  'Tu veux comprendre le concept',
                ],
                cta: 'Commencer gratuitement',
                ctaHref: '/analyzer',
                ctaStyle: 'bg-white/[0.05] border border-white/[0.08] text-gray-300 hover:bg-white/[0.09]',
              },
              {
                plan: 'Pro',
                color: 'fuchsia',
                emoji: '🚀',
                title: 'Tu publies avec méthode',
                profile: 'Créateur régulier, e-com, UGC ou agence social media',
                points: [
                  'Tu publies plusieurs fois par semaine',
                  'Tu veux comprendre ce qui performe',
                  'Tu veux progresser vidéo après vidéo',
                ],
                cta: 'Choisir Pro',
                checkout: 'pro' as const,
                ctaStyle: 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90',
              },
              {
                plan: 'Elite',
                color: 'violet',
                emoji: '⚡',
                title: 'Tu veux scaler fort',
                profile: 'Créateur pro, agence, studio de contenu ou marque active',
                points: [
                  'Tu analyses beaucoup de contenus',
                  'Tu veux la stratégie complète',
                  'Tu optimises à grande échelle',
                ],
                cta: 'Passer en Elite',
                checkout: 'elite' as const,
                ctaStyle: 'bg-gradient-to-r from-vn-violet to-vn-fuchsia text-white hover:opacity-90',
              },
            ].map((p) => (
              <div
                key={p.plan}
                className={`rounded-2xl border p-6 space-y-4 ${
                  p.color === 'fuchsia'
                    ? 'border-vn-fuchsia/25 bg-vn-fuchsia/[0.05]'
                    : p.color === 'violet'
                    ? 'border-vn-violet/20 bg-vn-violet/[0.04]'
                    : 'border-white/[0.07] bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${p.color === 'fuchsia' ? 'text-vn-fuchsia' : p.color === 'violet' ? 'text-violet-400' : 'text-gray-600'}`}>
                      {p.plan}
                    </p>
                    <p className="text-[14px] font-bold text-white">{p.title}</p>
                  </div>
                </div>
                <p className="text-[12px] text-gray-500 italic">{p.profile}</p>
                <ul className="space-y-2">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2">
                      <span className={`text-[10px] font-black mt-0.5 ${p.color === 'fuchsia' ? 'text-vn-fuchsia' : p.color === 'violet' ? 'text-violet-400' : 'text-gray-600'}`}>→</span>
                      <span className="text-[12px] text-gray-400 leading-snug">{pt}</span>
                    </li>
                  ))}
                </ul>
                {'checkout' in p && p.checkout ? (
                  <CheckoutButton plan={p.checkout} className={`w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all block ${p.ctaStyle}`}>
                    {p.cta}
                  </CheckoutButton>
                ) : (
                  <Link href={(p as { ctaHref: string }).ctaHref} className={`w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all block ${p.ctaStyle}`}>
                    {p.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* FAQ */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="space-y-8 max-w-2xl mx-auto">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">FAQ</p>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Questions fréquentes</h2>
          </div>
          <PricingFAQ />
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CTA FINAL */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-vn-fuchsia/[0.08] to-vn-indigo/[0.06] p-10 sm:p-14 text-center">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/50 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,121,249,0.08),transparent_60%)] pointer-events-none" />

          <div className="relative space-y-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-vn-fuchsia/70">Prêt à commencer ?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
              Passe de l&apos;intuition
              <br />à une vraie méthode.
            </h2>
            <p className="text-[14px] text-gray-400 max-w-md mx-auto leading-relaxed">
              Analyse ta première vidéo gratuitement. Comprends ce qui bloque.
              <br />Corrige avant de reposter.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/analyzer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 transition-all shadow-lg shadow-vn-fuchsia/25"
              >
                Analyser ma première vidéo
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-gray-300 bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] transition-all"
              >
                Créer un compte gratuit
              </Link>
            </div>

            <p className="text-[11px] text-gray-600 pt-1">
              Sans carte bancaire · 3 analyses gratuites · Annulable à tout moment
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
