import Link from 'next/link';
import {
  MAX_ANALYSES_ELITE,
  MAX_ANALYSES_FREE,
  MAX_ANALYSES_PRO,
  MAX_HOOKS_ELITE,
  MAX_HOOKS_PRO,
} from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

const capabilityPills = [
  'Vision IA sur ta vidéo',
  'Hook · Montage · Rétention',
  'Hooks générés au ton de ta marque',
  'Historique & comparaisons',
];

const diagnosticFrictions = [
  {
    t: 'Tu publies dans le flou',
    d: 'Sans lecture claire de ce qui retient ou fait fuir, chaque post est une loterie.',
  },
  {
    t: 'Tu brûles du temps sur les hooks',
    d: 'Les idées d’accroche tournent en rond pendant que le vrai problème est peut‑être le rythme ou l’ouverture.',
  },
  {
    t: 'Tu manques de langage commun',
    d: 'Entre toi, ton monteur ou ton client, les retours restent vagues (« refais plus dynamique »).',
  },
];

const shifts = [
  {
    t: 'Une grille de lecture unique',
    d: 'Scores et commentaires structurés : tu sais quoi tester en priorité sur la prochaine version.',
  },
  {
    t: 'Des hooks prêts à challenger',
    d: 'Variations courtes, adaptées au contexte — pour itérer vite, pas pour remplacer ta voix.',
  },
  {
    t: 'Une méthode qui scale avec toi',
    d: 'Même cadre pour une vidéo ou pour dix créas : idéal équipes, agences et marques qui produisent en volume.',
  },
];

/** Grille bento : index = placement responsive */
const bentoBlocks: {
  title: string;
  body: string;
  icon: React.ReactNode;
  className: string;
}[] = [
  {
    title: 'Analyse qui parle créatif',
    body:
      'Vision IA + contexte (durée, fichier, stats TikTok quand le lien est dispo). Tu obtiens une lecture honnête du hook, du montage et de la rétention — pas un jugement flou.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    className:
      'lg:col-span-7 lg:row-span-2 min-h-[280px] flex flex-col justify-between p-8 sm:p-10 rounded-3xl border border-white/[0.09] bg-gradient-to-br from-vn-surface/90 via-vn-bg/80 to-vn-indigo/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  },
  {
    title: 'Hooks qui arrêtent le scroll',
    body: 'Contexte, ton, scène : le générateur propose des phrases courtes testables tout de suite sur le tournage ou le brief.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    className:
      'lg:col-span-5 p-6 sm:p-8 rounded-3xl border border-white/[0.08] bg-vn-surface/40 hover:border-vn-fuchsia/20 hover:bg-vn-elevated/50 transition-all duration-300',
  },
  {
    title: 'Axes faibles, vite repérés',
    body: 'Où l’attention risque de chuter, où le rythme s’alourdit : tu sais quoi recouper avant de remettre en ligne.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    className:
      'lg:col-span-5 p-6 sm:p-8 rounded-3xl border border-white/[0.08] bg-vn-surface/40 hover:border-vn-violet/25 hover:bg-vn-elevated/50 transition-all duration-300',
  },
  {
    title: 'Conseils actionnables',
    body: 'Pistes concrètes sur structure, CTA et cadence — applicables sur ta prochaine prise, pas un PDF de 40 pages.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586L11.42 15.17z" />
      </svg>
    ),
    className:
      'lg:col-span-4 p-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors',
  },
  {
    title: 'Itérations & historique',
    body: 'Compare des versions, épingle ce qui compte : pensé pour les boucles courtes créateur / social / e‑com.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0A9 9 0 11a9 9 0 0118 0z" />
      </svg>
    ),
    className:
      'lg:col-span-4 p-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors',
  },
  {
    title: 'TikTok aujourd’hui, le reste demain',
    body: 'On commence fort sur le format vertical le plus exigeant ; Reels, Shorts et autres formats suivent la même exigence produit.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    className:
      'lg:col-span-4 p-6 rounded-3xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors',
  },
];

const steps = [
  {
    n: '01',
    title: 'Importe & contextualise',
    body: 'Fichier vidéo (MP4 recommandé) + lien TikTok fortement conseillé pour croiser avec les stats publiques.',
  },
  {
    n: '02',
    title: 'Reçois la lecture IA',
    body: 'Hook, montage, rétention et priorités : un fil direct pour ta prochaine décision créative.',
  },
  {
    n: '03',
    title: 'Itère avec des hooks',
    body: 'Génère des accroches alignées sur ton ton, puis retourne sur le plateau ou le brief avec des angles neufs.',
  },
];

const audiences = [
  {
    title: 'Créateurs & personal brands',
    desc: 'Moins de tâtonnements, plus de formats qui retiennent — avec une méthode reproductible.',
  },
  {
    title: 'E‑commerce & UGC',
    desc: 'Aligne preuves sociales, démos produit et angles paid sur une même grille de lecture.',
  },
  {
    title: 'Freelances & studios',
    desc: 'Brief visuel partagé : moins de cycles « j’aime / j’aime pas » sans critères.',
  },
  {
    title: 'Agences social & growth',
    desc: 'Standardise la qualité des retours quand tu pilotes plusieurs comptes et créatifs.',
  },
  {
    title: 'Marques en scaling contenu',
    desc: 'Passe de l’intuition à une logique claire : ce qui est testé, pourquoi, et quoi en faire après.',
  },
  {
    title: 'Marketeurs multi-canaux',
    desc: 'Un socle pour le court format ; la roadmap étend la même discipline à d’autres surfaces.',
  },
];

const roadmap = [
  {
    phase: 'Shippé',
    items: ['Analyse upload + vision', 'Enrichissement lien TikTok', 'Générateur de hooks', 'Dashboard & quotas'],
  },
  {
    phase: 'En construction',
    items: ['Reels & Shorts (même cadre d’analyse)', 'Exports & partage équipe', 'Parcours onboarding guidé'],
  },
  {
    phase: 'Vision',
    items: ['Autres plateformes', 'Workflows marque ↔ créateur', 'Intégrations stack marketing'],
  },
];

const faq = [
  {
    q: 'Viralynz remplace‑il un stratège ou un monteur ?',
    a: 'Non. C’est un copilote : il structure le feedback et accélère les itérations. La direction créative et le craft restent les tiens.',
  },
  {
    q: 'Faut‑il être expert TikTok ?',
    a: 'Non. Les analyses sont rédigées pour être comprises sans jargon. Tu peux les transmettre telles quelles à un prestataire.',
  },
  {
    q: 'Pourquoi TikTok en premier ?',
    a: 'C’est le format le plus exigeant sur l’attention : si la logique tient là, elle se transpose bien aux autres courts formats. La roadmap couvre Reels, Shorts, etc.',
  },
  {
    q: 'Dois‑je uploader un fichier ?',
    a: 'Oui, l’analyse visuelle repose sur ta vidéo (~90 s max recommandé). Le lien TikTok améliore le contexte quand les stats sont accessibles.',
  },
  {
    q: 'Comment l’analyse est‑elle produite ?',
    a: 'Des images clés sont extraites et interprétées par un modèle de vision, combiné aux métadonnées et aux stats publiques si disponibles. Tu reçois scores, forces, limites et conseils ordonnés.',
  },
  {
    q: 'Les hooks : à quoi m’attendre ?',
    a: 'Des phrases courtes, adaptées au contexte que tu décris — pour tester des angles, pas pour figer ta voix de marque.',
  },
];

function FaqChevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5 text-gray-500 shrink-0 transition-transform duration-200 group-open:rotate-180"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HomeLanding() {
  return (
    <div className="relative min-h-screen bg-vn-bg overflow-x-hidden">
      <div className="fixed inset-0 landing-mesh pointer-events-none opacity-[0.85]" aria-hidden />
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[min(1000px,220vw)] h-[520px] rounded-full bg-vn-radial blur-2xl opacity-80" />
      </div>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="relative pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-28" id="top">
        <div className="landing-section">
          <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-12 lg:gap-16 xl:gap-20 items-center">
            <div className="order-2 lg:order-1">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-4 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-gray-300 mb-6 sm:mb-8">
                <span className="flex items-center gap-1.5 normal-case tracking-normal text-vn-violet font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vn-fuchsia opacity-35" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-vn-fuchsia" />
                  </span>
                  Viralynz
                </span>
                <span className="text-white/20 hidden sm:inline">|</span>
                <span className="text-gray-400 font-normal normal-case tracking-normal">
                  Copilote IA · contenu court
                </span>
              </div>

              <h1 className="landing-heading-xl text-[2.25rem] leading-[1.05] sm:text-5xl lg:text-[3.5rem] xl:text-[3.75rem]">
                Chaque seconde de ta vidéo
                <br className="hidden sm:block" />
                <span className="sm:ml-2">mérite une </span>
                <span className="gradient-text-hero">décision</span>
                <span className="text-white"> claire.</span>
              </h1>

              <p className="mt-6 sm:mt-8 text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed">
                Viralynz décode hook, montage et rétention comme le ferait un lead créatif — avec la vitesse d’un outil SaaS.
                Génère des hooks prêts à tourner. Construis une méthode, pas seulement un calendrier editorial.
              </p>

              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row flex-wrap gap-3">
                <Link
                  href="/analyzer"
                  className="inline-flex justify-center items-center min-h-[48px] rounded-full px-8 text-sm font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-vn-fuchsia/25"
                >
                  Lancer une analyse
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex justify-center items-center min-h-[48px] rounded-full px-8 text-sm font-semibold text-gray-200 border border-white/15 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/25 transition-all"
                >
                  Voir les offres
                </Link>
              </div>

              <ul className="mt-8 sm:mt-10 space-y-3 text-sm text-gray-500 max-w-lg">
                {[
                  'Pensé pour les équipes qui veulent une logique de contenu, pas un score opaque.',
                  'TikTok en première ligne — Reels, Shorts & suite dans la roadmap.',
                  `${MAX_ANALYSES_FREE} analyses gratuites pour valider le produit sur ton workflow.`,
                ].map((line) => (
                  <li key={line} className="flex gap-3 items-start">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo shrink-0" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Mockup produit */}
            <div className="order-1 lg:order-2 relative">
              <div
                className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-vn-fuchsia/25 via-transparent to-vn-indigo/20 blur-xl opacity-90"
                aria-hidden
              />
              <div className="relative rounded-[1.25rem] ring-1 ring-white/10 bg-vn-surface/90 backdrop-blur-2xl shadow-[0_24px_80px_-20px_rgba(0,0,0,0.75)] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-black/40">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/90" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/90" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/90" />
                  </div>
                  <span className="text-[11px] text-gray-500 font-medium truncate ml-1">app.viralynz.com · Analyse</span>
                </div>
                <div className="p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2">Score global</p>
                      <p className="font-display text-5xl sm:text-6xl font-bold gradient-text-hero tabular-nums leading-none">
                        84
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { l: 'Hook', v: 88 },
                        { l: 'Montage', v: 76 },
                        { l: 'Rétention', v: 81 },
                      ].map((x) => (
                        <div
                          key={x.l}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 min-w-[5.5rem]"
                        >
                          <p className="text-[10px] text-gray-500 font-medium">{x.l}</p>
                          <p className="text-base font-bold text-white tabular-nums">{x.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo" />
                      </div>
                      <p className="mt-3 text-xs sm:text-sm text-gray-400 leading-relaxed">
                        <span className="text-vn-violet font-semibold">Priorité :</span> tension visuelle dans les 2
                        premières secondes — renforcer le contraste sujet / fond pour l’early retention.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['IA vision', 'Structure narrative', 'CTA'].map((t) => (
                        <span
                          key={t}
                          className="text-[11px] font-medium px-3 py-1 rounded-full border border-white/10 text-gray-400 bg-white/[0.02]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bande capacités */}
          <div className="mt-14 sm:mt-20 flex flex-wrap justify-center gap-2 sm:gap-3">
            {capabilityPills.map((label) => (
              <span
                key={label}
                className="text-xs sm:text-[13px] font-medium text-gray-400 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diagnostic ─────────────────────────────────── */}
      <section id="diagnostic" className="relative py-20 sm:py-24 lg:py-28 border-t border-white/[0.06]">
        <div className="landing-section">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-vn-fuchsia mb-4">Pourquoi Viralynz</p>
          <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem] max-w-3xl mb-12 sm:mb-16">
            Le volume de contenu a explosé.
            <span className="text-gray-500"> La clarté, pas encore.</span>
          </h2>

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
            <div className="rounded-3xl border border-red-500/15 bg-red-500/[0.04] p-8 sm:p-10">
              <h3 className="font-display text-xl font-bold text-white mb-6">Sans cadre, tu optimises au hasard</h3>
              <ul className="space-y-6">
                {diagnosticFrictions.map((item) => (
                  <li key={item.t}>
                    <p className="font-semibold text-red-200/90 text-sm sm:text-base">{item.t}</p>
                    <p className="mt-1 text-sm text-gray-400 leading-relaxed">{item.d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-vn-violet/25 bg-gradient-to-br from-vn-fuchsia/[0.08] via-vn-surface/60 to-vn-indigo/[0.08] p-8 sm:p-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <h3 className="font-display text-xl font-bold text-white mb-6">Avec Viralynz, tu arbitrages</h3>
              <ul className="space-y-6">
                {shifts.map((item) => (
                  <li key={item.t}>
                    <p className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                      <span className="text-emerald-400">✓</span>
                      {item.t}
                    </p>
                    <p className="mt-1 text-sm text-gray-300 leading-relaxed pl-6">{item.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bento capacités ────────────────────────────── */}
      <section id="capacites" className="relative py-20 sm:py-24 lg:py-28">
        <div className="landing-section">
          <div className="max-w-3xl mb-12 sm:mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-vn-violet mb-4">Capacités</p>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.75rem]">
              Une plateforme, plusieurs leviers
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-400 leading-relaxed">
              Bento pensé comme un produit mature : le module principal respire, les satellites complètent sans bruit
              visuel.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 auto-rows-fr">
            {bentoBlocks.map((b) => (
              <div key={b.title} className={`${b.className} group`}>
                <div className="flex flex-col h-full">
                  <div className="w-11 h-11 rounded-2xl bg-vn-fuchsia/10 text-vn-fuchsia flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                    {b.icon}
                  </div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-white mb-3">{b.title}</h3>
                  <p className="text-sm sm:text-[15px] text-gray-400 leading-relaxed flex-1">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Parcours 3 étapes ───────────────────────────── */}
      <section
        id="workflow"
        className="relative py-20 sm:py-24 lg:py-28 border-y border-white/[0.06] bg-black/25"
      >
        <div className="landing-section">
          <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-20">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-vn-fuchsia mb-4">Parcours</p>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl">De l’upload à l’itération en trois temps</h2>
            <p className="mt-4 text-gray-400 text-sm sm:text-base">
              Pas de friction inutile : un flux lineaire pour passer vite de la vidéo au plan d’action.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6 relative">
            <div
              className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
              aria-hidden
            />
            {steps.map((s) => (
              <div key={s.n} className="relative text-center md:text-left pt-2">
                <span className="inline-flex font-display text-4xl font-bold gradient-text opacity-90 mb-4">{s.n}</span>
                <h3 className="font-display text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto md:mx-0">{s.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 text-center">
            <Link
              href="/analyzer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-vn-violet hover:text-white transition-colors"
            >
              Ouvrir l’outil d’analyse
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pipeline produit ───────────────────────────── */}
      <section id="pipeline" className="relative py-20 sm:py-24">
        <div className="landing-section">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-vn-violet mb-4">Dans le produit</p>
            <h2 className="landing-heading-xl text-3xl sm:text-4xl">Interface sombre, lisibilité maximale</h2>
            <p className="mt-4 text-gray-400">
              Chaque écran sert le travail : import, résultats, hooks — sans chrome inutile.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 overflow-hidden bg-vn-surface/50 shadow-2xl shadow-black/50">
            <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
              {[
                {
                  k: 'Import',
                  v: 'Vidéo + lien TikTok optionnel pour croiser avec les métriques publiques.',
                },
                {
                  k: 'Lecture',
                  v: 'Cartes Hook, Montage, Rétention et conseils priorisés — prêts à partager.',
                },
                {
                  k: 'Hooks',
                  v: 'Génération guidée par contexte, ton et scène pour alimenter tes prochains tournages.',
                },
              ].map((cell, i) => (
                <div key={cell.k} className="p-8 sm:p-10 text-left relative">
                  <span className="absolute top-8 right-8 text-[10px] font-bold text-white/10 sm:hidden">{i + 1}</span>
                  <p className="text-xs font-bold text-vn-fuchsia uppercase tracking-wider mb-3">{cell.k}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{cell.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Profils ────────────────────────────────────── */}
      <section id="profils" className="relative py-20 sm:py-24 lg:py-28 border-t border-white/[0.06]">
        <div className="landing-section">
          <h2 className="landing-heading-xl text-3xl sm:text-4xl text-center mb-4">Qui scale avec Viralynz ?</h2>
          <p className="text-center text-gray-400 max-w-xl mx-auto mb-12 sm:mb-14 text-sm sm:text-base">
            Du solo creator aux équipes growth : même exigence sur la clarté et la vitesse d’exécution.
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {audiences.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-7 hover:border-vn-violet/30 hover:bg-white/[0.04] hover:-translate-y-0.5 transition-all duration-300"
              >
                <h3 className="font-display font-bold text-white mb-2 text-[15px] sm:text-base">{a.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Manifeste ──────────────────────────────────── */}
      <section className="relative py-16 sm:py-20 bg-gradient-to-b from-transparent to-vn-indigo/[0.04]">
        <div className="landing-section">
          <div className="max-w-3xl mx-auto text-center px-2">
            <p className="text-vn-violet/80 text-4xl sm:text-5xl font-serif leading-none mb-6 select-none" aria-hidden>
              “
            </p>
            <blockquote className="font-display text-2xl sm:text-3xl lg:text-[2rem] font-bold text-white leading-snug tracking-tight">
              On ne vend pas la viralité garantie. On vend le calme de savoir quoi tester ensuite.
            </blockquote>
            <p className="mt-8 text-sm sm:text-base text-gray-500 leading-relaxed max-w-xl mx-auto">
              Viralynz est bâti pour les créateurs et marques qui refusent le bullshit algorithmique : analyses
              vérifiables, langage clair, actions priorisées — sans promesse de chiffres magiques.
            </p>
          </div>
        </div>
      </section>

      {/* ── Roadmap ────────────────────────────────────── */}
      <section id="roadmap" className="relative py-20 sm:py-24 border-t border-white/[0.06]">
        <div className="landing-section">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="landing-heading-xl text-3xl sm:text-4xl">Roadmap produit</h2>
            <p className="mt-3 text-gray-400 text-sm sm:text-base max-w-lg mx-auto">
              Qualité d’abord sur TikTok — puis extension méthodique aux autres surfaces courtes.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {roadmap.map((col) => (
              <div
                key={col.phase}
                className="rounded-3xl border border-white/[0.08] bg-vn-surface/30 p-7 sm:p-8 relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-vn-fuchsia/50 via-vn-violet/50 to-vn-indigo/50"
                  aria-hidden
                />
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-vn-fuchsia mb-6">{col.phase}</p>
                <ul className="space-y-4">
                  {col.items.map((item) => (
                    <li key={item} className="text-sm text-gray-400 flex gap-3 leading-relaxed">
                      <span className="text-vn-violet shrink-0 mt-0.5">▸</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tarifs preview ───────────────────────────── */}
      <section id="tarifs" className="relative py-20 sm:py-24 lg:py-28">
        <div className="landing-section">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="landing-heading-xl text-3xl sm:text-4xl">Tarification</h2>
            <p className="mt-3 text-gray-400">Commence gratuitement. Monte en puissance quand le produit est dans ton rythme.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:p-8 flex flex-col order-2 md:order-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Free</p>
              <p className="font-display text-4xl font-bold text-white mt-3">0€</p>
              <p className="text-sm text-gray-500 mt-2 mb-8">{MAX_ANALYSES_FREE} analyses pour valider le fit</p>
              <ul className="text-sm text-gray-400 space-y-3 mb-10 flex-1">
                <li className="flex gap-2"><span className="text-gray-600">·</span> Scores & conseils essentiels</li>
                <li className="flex gap-2"><span className="text-gray-600">·</span> Sans carte bancaire</li>
              </ul>
              <Link
                href="/analyzer"
                className="block text-center rounded-full py-3.5 text-sm font-semibold border border-white/15 hover:bg-white/[0.05] transition-colors min-h-[48px] flex items-center justify-center"
              >
                Commencer
              </Link>
            </div>

            <div className="rounded-3xl pro-pricing-card p-7 sm:p-8 flex flex-col relative order-1 md:order-2 md:-mt-2 md:mb-2 md:shadow-2xl">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg">
                Le plus choisi
              </span>
              <p className="text-xs font-bold text-vn-fuchsia uppercase tracking-wider mt-2">Pro</p>
              <p className="font-display text-4xl font-bold text-white mt-2">
                {DISPLAY_CATALOG_PRO_EUR}€<span className="text-lg font-normal text-gray-500">/mois</span>
              </p>
              <p className="text-sm text-gray-400 mt-2 mb-8">
                {MAX_ANALYSES_PRO} analyses · {MAX_HOOKS_PRO} hooks / mois
              </p>
              <ul className="text-sm text-gray-300 space-y-3 mb-10 flex-1">
                <li className="flex gap-2"><span className="text-vn-fuchsia">·</span> Historique étendu</li>
                <li className="flex gap-2"><span className="text-vn-fuchsia">·</span> Générateur de hooks</li>
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3.5 text-sm font-semibold bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all min-h-[48px] flex items-center justify-center shadow-lg shadow-vn-fuchsia/20"
              >
                Choisir Pro
              </Link>
            </div>

            <div className="rounded-3xl elite-pricing-card p-7 sm:p-8 flex flex-col order-3">
              <p className="text-xs font-bold text-vn-glow uppercase tracking-wider">Elite</p>
              <p className="font-display text-4xl font-bold text-white mt-3">
                {DISPLAY_CATALOG_ELITE_EUR}€<span className="text-lg font-normal text-gray-500">/mois</span>
              </p>
              <p className="text-sm text-gray-400 mt-2 mb-8">
                {MAX_ANALYSES_ELITE} analyses · {MAX_HOOKS_ELITE} hooks / mois
              </p>
              <ul className="text-sm text-gray-300 space-y-3 mb-10 flex-1">
                <li className="flex gap-2"><span className="text-vn-glow">·</span> Recommandations avancées</li>
                <li className="flex gap-2"><span className="text-vn-glow">·</span> Support prioritaire</li>
              </ul>
              <Link
                href="/pricing"
                className="block text-center rounded-full py-3.5 text-sm font-semibold border border-vn-violet/45 text-vn-glow hover:bg-vn-violet/10 transition-colors min-h-[48px] flex items-center justify-center"
              >
                Choisir Elite
              </Link>
            </div>
          </div>
          <p className="text-center mt-10">
            <Link href="/pricing" className="text-sm text-gray-500 hover:text-white transition-colors inline-flex items-center gap-1">
              Comparer le détail des plans
              <span aria-hidden>→</span>
            </Link>
          </p>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────── */}
      <section id="faq" className="relative py-20 sm:py-24 border-t border-white/[0.06]">
        <div className="landing-section max-w-3xl">
          <h2 className="landing-heading-xl text-3xl sm:text-4xl text-center mb-4">Questions fréquentes</h2>
          <p className="text-center text-gray-500 text-sm mb-10 sm:mb-12">Transparence sur le produit — comme on aime l’utiliser nous‑mêmes.</p>
          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-white/[0.08] bg-vn-surface/20 open:bg-vn-elevated/40 open:border-vn-fuchsia/20 transition-colors"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 sm:px-6 py-4 sm:py-5 text-left min-h-[56px] [&::-webkit-details-marker]:hidden">
                  <span className="text-sm sm:text-[15px] font-semibold text-white pr-2">{item.q}</span>
                  <FaqChevron />
                </summary>
                <p className="px-5 sm:px-6 pb-5 sm:pb-6 pt-0 text-sm text-gray-400 leading-relaxed border-t border-transparent group-open:border-white/[0.05] group-open:pt-4 -mt-1 group-open:mt-0">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 px-5 sm:px-8">
        <div className="landing-section max-w-4xl">
          <div className="relative rounded-[2rem] border border-white/10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/15 via-vn-surface to-vn-indigo/15" aria-hidden />
            <div className="absolute inset-0 landing-mesh opacity-40 mix-blend-overlay" aria-hidden />
            <div className="relative px-8 sm:px-12 lg:px-16 py-14 sm:py-16 lg:py-20 text-center">
              <h2 className="landing-heading-xl text-3xl sm:text-4xl lg:text-[2.5rem] mb-5">
                Ta prochaine vidéo mérite mieux que l’intuition seule.
              </h2>
              <p className="text-gray-400 max-w-lg mx-auto mb-10 text-sm sm:text-base leading-relaxed">
                Crée un compte ou lance une analyse : en quelques minutes tu as une grille de lecture — et des hooks à
                tester sur le terrain.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center max-w-md sm:max-w-none mx-auto">
                <Link
                  href="/signup"
                  className="inline-flex justify-center items-center min-h-[52px] rounded-full px-10 text-sm font-semibold bg-white text-vn-bg hover:bg-gray-100 transition-colors"
                >
                  Créer mon compte
                </Link>
                <Link
                  href="/analyzer"
                  className="inline-flex justify-center items-center min-h-[52px] rounded-full px-10 text-sm font-semibold border border-white/25 text-white hover:bg-white/10 transition-colors"
                >
                  Analyser sans attendre
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="relative border-t border-white/[0.08] py-12 sm:py-14">
        <div className="landing-section">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
            <div>
              <p className="font-display text-xl font-bold text-white">
                Viral<span className="gradient-text">ynz</span>
              </p>
              <p className="mt-2 text-sm text-gray-500 max-w-xs leading-relaxed">
                Intelligence virale pour le contenu court — analyse, hooks, itérations plus rapides.
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-gray-500">
              <Link href="/analyzer" className="hover:text-white transition-colors">
                Analyser
              </Link>
              <Link href="/hook-generator" className="hover:text-white transition-colors">
                Hooks
              </Link>
              <Link href="/pricing" className="hover:text-white transition-colors">
                Tarifs
              </Link>
              <Link href="/login" className="hover:text-white transition-colors">
                Connexion
              </Link>
              <a href="https://viralynz.com" className="hover:text-white transition-colors">
                viralynz.com
              </a>
            </nav>
          </div>
          <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between gap-4 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Viralynz. Tous droits réservés.</p>
            <p className="text-gray-600">Conçu pour créateurs, marques et équipes growth.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
