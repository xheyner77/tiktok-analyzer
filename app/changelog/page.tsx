import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Nouveaut\u00e9s Viralynz',
  description: 'Les derni\u00e8res releases Viralynz, publi\u00e9es chaque semaine pour construire le TikTok Growth OS.',
};

type BadgeTone = 'neutral' | 'accent' | 'cyan' | 'success' | 'warning';

interface Release {
  version: string;
  date: string;
  isoDate: string;
  category: string;
  status: 'live' | 'next' | 'planned';
  impact: 'Analyse' | 'Dashboard' | 'Growth' | 'Billing' | 'Radar' | 'Hooks';
  title: string;
  summary: string;
  bullets: string[];
}

const heroBadges = ['Weekly updates', 'Content OS', 'Analyse structurée', 'Reconstruction Engine'];

const heroStats = [
  { value: '7', label: 'releases' },
  { value: '1', label: 'update / semaine' },
  { value: '24', label: 'améliorations' },
  { value: 'v1.6.0', label: 'live' },
];

const shippingCards = [
  {
    date: 'Dimanche 5 avril',
    title: 'Dashboard V2 premium',
    text: 'Le cockpit de reconstruction commence à centraliser analyses, opportunités et mémoire créateur.',
  },
  {
    date: 'Dimanche 12 avril',
    title: 'Lecture vidéo plus fine',
    text: 'Viralynz lit mieux le texte visible, le rythme et les moments qui font décrocher.',
  },
  {
    date: 'Dimanche 3 mai',
    title: 'Dashboard + plans',
    text: 'L’expérience s’adapte mieux au statut Free, Creator, Pro ou Scale.',
  },
  {
    date: 'Dimanche 10 mai',
    title: 'Growth OS alignment',
    text: 'Plans, quotas, Stripe et dashboard avancent dans la même direction produit.',
  },
];

const releases: Release[] = [
  {
    version: 'v1.6.0',
    date: 'Dimanche 10 mai 2026',
    isoDate: '2026-05-10',
    category: 'Plans & Growth OS',
    status: 'live',
    impact: 'Billing',
    title: 'Plans, quotas et dashboard alignés',
    summary: 'Creator, Pro et Scale deviennent plus lisibles, avec des limites produit cohérentes et une expérience plus fiable.',
    bullets: [
      'Creator, Pro et Scale cohérents avec Stripe.',
      'Limites TikTok prêtes par plan.',
      'Dashboard adapté au statut Free ou paid.',
    ],
  },
  {
    version: 'v1.5.0',
    date: 'Dimanche 3 mai 2026',
    isoDate: '2026-05-03',
    category: 'Dashboard V2',
    status: 'live',
    impact: 'Dashboard',
    title: 'Dashboard V2 devient ton cockpit',
    summary: 'Le dashboard aide à choisir la prochaine action au lieu de simplement afficher des modules.',
    bullets: [
      'Prochaine meilleure action visible.',
      'Connexion TikTok intégrée au dashboard.',
      'Workflow analyse -> hook -> structure clarifié.',
    ],
  },
  {
    version: 'v1.4.0',
    date: 'Dimanche 26 avril 2026',
    isoDate: '2026-04-26',
    category: 'Growth Loop',
    status: 'live',
    impact: 'Radar',
    title: 'Radar Tendances et Growth Loop',
    summary: 'Viralynz transforme les signaux d’analyse en opportunités de hooks, formats et structures.',
    bullets: [
      'Opportunités de hooks et formats.',
      'Actions prioritaires selon tes analyses.',
      'Integration Radar -> Hook Studio.',
    ],
  },
  {
    version: 'v1.3.0',
    date: 'Dimanche 19 avril 2026',
    isoDate: '2026-04-19',
    category: 'AI Quality',
    status: 'live',
    impact: 'Analyse',
    title: 'Analyse plus stricte',
    summary: 'L’analyse évite les réponses génériques et force des recommandations plus concrètes.',
    bullets: [
      'Quality gate anti-réponses génériques.',
      'Scoring plus cohérent.',
      'Hooks et plan de remontage plus actionnables.',
    ],
  },
  {
    version: 'v1.2.0',
    date: 'Dimanche 12 avril 2026',
    isoDate: '2026-04-12',
    category: 'Analyzer V2',
    status: 'live',
    impact: 'Analyse',
    title: 'Lecture vidéo étape par étape',
    summary: 'Viralynz comprend mieux ce qui apparaît à l’écran et où l’attention baisse.',
    bullets: [
      'OCR du texte visible dans tes vidéos.',
      'Timeline des moments clés.',
      'Diagnostic hook, rythme et CTA.',
    ],
  },
  {
    version: 'v1.1.0',
    date: 'Dimanche 5 avril 2026',
    isoDate: '2026-04-05',
    category: 'Creator OS',
    status: 'live',
    impact: 'Dashboard',
    title: 'Dashboard V2 premium',
    summary: 'La base du cockpit créateur arrive pour organiser analyses, opportunités et décisions de reconstruction.',
    bullets: ['Cockpit de reconstruction.', 'Mémoire créateur.', 'Modules d’opportunités.'],
  },
  {
    version: 'v1.0.0',
    date: 'Dimanche 29 mars 2026',
    isoDate: '2026-03-29',
    category: 'Launch',
    status: 'live',
    impact: 'Hooks',
    title: 'Lancement public de Viralynz',
    summary: 'La première version aide à comprendre pourquoi une vidéo TikTok bloque et quoi retester.',
    bullets: ['Analyse TikTok structurée.', 'Score vidéo expliqué.', 'Plan de remontage priorisé.'],
  },
];

const latestHighlights = [
  {
    title: 'Billing propre',
    text: 'Les plans affichés, les prix et le checkout racontent enfin la même histoire.',
  },
  {
    title: 'Quotas cohérents',
    text: 'Chaque plan a une place claire: démarrer, progresser, puis scaler avec plus de volume.',
  },
  {
    title: 'Dashboard adapté au plan',
    text: 'L’interface devient plus claire selon le statut Free, Creator, Pro ou Scale.',
  },
  {
    title: 'Scale prêt',
    text: 'Les fondations sont posées pour les comptes TikTok, les équipes et les usages plus intensifs.',
  },
];

const roadmapCards = [
  {
    title: 'Radar Concurrent / Radar de Niche',
    status: 'En construction',
    plan: 'Pro',
    text: 'Repérer les angles et formats à tester dans une niche sans inventer de fausses tendances.',
  },
  {
    title: 'Connexion TikTok multi-comptes',
    status: 'En cours',
    plan: 'Scale',
    text: 'Centraliser plusieurs comptes pour les créateurs avancés, agences et équipes.',
  },
  {
    title: 'Suivi résultats après remontage',
    status: 'Prochain',
    plan: 'Creator',
    text: 'Comparer la version corrigée à la vidéo initiale pour apprendre ce qui a vraiment marché.',
  },
  {
    title: 'Bibliothèque de hooks',
    status: 'Prochain',
    plan: 'Pro',
    text: 'Conserver les meilleurs hooks, les classer par format et les réutiliser plus vite.',
  },
  {
    title: 'Comparaison vidéo vs vidéo',
    status: 'En exploration',
    plan: 'Pro',
    text: 'Comprendre pourquoi une vidéo gagne plus d’attention qu’une autre sur le même sujet.',
  },
  {
    title: 'Rapports hebdomadaires',
    status: 'Vision',
    plan: 'Scale',
    text: 'Recevoir une synthèse claire des blocages, progrès et priorités de contenu.',
  },
];

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3.2 8.3 6.4 11.4 12.8 4.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: BadgeTone }) {
  const tones: Record<BadgeTone, string> = {
    neutral: 'border-white/[0.09] bg-white/[0.04] text-gray-300',
    accent: 'border-vn-fuchsia/25 bg-vn-fuchsia/10 text-fuchsia-100',
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    success: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    warning: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  };

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

function StatusBadge({ status }: { status: Release['status'] }) {
  const label = status === 'live' ? 'Live' : status === 'next' ? 'Next' : 'Planned';
  const tone: BadgeTone = status === 'live' ? 'success' : status === 'next' ? 'cyan' : 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06] px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden>
        <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[70rem] -translate-x-1/2 rounded-full bg-vn-fuchsia/[0.12] blur-3xl" />
        <div className="absolute right-[8%] top-28 h-64 w-64 rounded-full bg-cyan-300/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="flex flex-wrap gap-2">
              {heroBadges.map((badge, index) => (
                <Badge key={badge} tone={index === 0 ? 'accent' : index === 1 ? 'cyan' : 'neutral'}>
                  {badge}
                </Badge>
              ))}
            </div>

            <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl">
              Viralynz &eacute;volue chaque semaine.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-gray-400 sm:text-lg">
              Chaque dimanche, on am&eacute;liore l&apos;analyse, les hooks, le dashboard et les outils qui t&apos;aident
              &agrave; transformer tes TikToks rat&eacute;s en structures pr&ecirc;tes &agrave; remonter.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-6 text-sm font-black text-white shadow-lg shadow-vn-fuchsia/20 transition hover:scale-[1.01] hover:brightness-110 active:scale-[0.98]"
              >
                Tester l&apos;analyse
                <ArrowIcon />
              </Link>
              <a
                href="#latest-release"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] px-6 text-sm font-black text-white transition hover:border-cyan-300/25 hover:bg-cyan-300/10"
              >
                Voir la derni&egrave;re release
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-white/[0.035] shadow-[0_30px_100px_-70px_rgba(168,85,247,0.9)] backdrop-blur-xl">
            {heroStats.map((stat, index) => (
              <div
                key={stat.label}
                className={`border-white/[0.08] p-5 sm:p-6 ${index % 2 === 0 ? 'border-r' : ''} ${index < 2 ? 'border-b' : ''}`}
              >
                <p className="text-3xl font-black tracking-tight text-white sm:text-4xl">{stat.value}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ShippingEverySunday() {
  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div>
          <Badge tone="cyan">Shipping every Sunday</Badge>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Une mise &agrave; jour chaque dimanche.</h2>
          <p className="mt-4 text-sm leading-7 text-gray-400">
            Viralynz ne reste pas fig&eacute;. Chaque semaine, le produit devient plus pr&eacute;cis, plus rapide et plus
            utile pour d&eacute;cider quoi corriger avant de remonter.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {shippingCards.map((card, index) => (
            <article key={card.date} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="absolute right-4 top-4 text-4xl font-black text-white/[0.035]">0{index + 1}</div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-vn-fuchsia/80">{card.date}</p>
              <h3 className="mt-3 text-lg font-black text-white">{card.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestRelease() {
  const latest = releases[0];
  const impact = ['Plus clair', 'Plus fiable', 'Plus premium'];

  return (
    <section id="latest-release" className="border-y border-white/[0.06] px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Badge tone="success">Derni&egrave;re release live</Badge>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">v1.6.0 — Plans & Growth OS alignment</h2>
          </div>
          <time dateTime={latest.isoDate} className="text-sm font-bold text-gray-400">
            Dimanche 10 mai 2026
          </time>
        </div>

        <article className="overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0b0b10] shadow-[0_28px_110px_-78px_rgba(99,102,241,0.9)]">
          <div className="grid lg:grid-cols-[1fr_22rem]">
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap gap-2">
                <Badge tone="accent">{latest.version}</Badge>
                <StatusBadge status={latest.status} />
                <Badge tone="cyan">{latest.impact}</Badge>
              </div>

              <h3 className="mt-6 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">
                Plans Creator, Pro et Scale align&eacute;s avec le vrai produit.
              </h3>
              <p className="mt-5 max-w-2xl text-base leading-8 text-gray-400">
                Les quotas, Stripe, le dashboard et les limites TikTok sont maintenant coh&eacute;rents pour pr&eacute;parer
                le lancement public.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {latestHighlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-100">
                        <CheckIcon />
                      </span>
                      <h4 className="text-sm font-black text-white">{item.title}</h4>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-gray-400">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="border-t border-white/[0.08] bg-white/[0.018] p-6 sm:p-8 lg:border-l lg:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">Impact produit</p>
              <div className="mt-5 space-y-4">
                {impact.map((label, index) => (
                  <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black text-white">{label}</span>
                      <span className="text-xs font-black text-cyan-200">{90 + index * 3}%</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/[0.07]">
                      <div className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia to-cyan-300" style={{ width: `${90 + index * 3}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </article>
      </div>
    </section>
  );
}

function WeeklyTimeline() {
  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <Badge tone="accent">Weekly releases</Badge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Une progression lisible, semaine apr&egrave;s semaine.</h2>
          <p className="mt-4 text-sm leading-7 text-gray-400">
            Chaque release renforce une partie du syst&egrave;me: analyse, dashboard, hooks, radar, billing ou boucle de croissance.
          </p>
        </div>

        <div className="space-y-4">
          {releases.map((release, index) => (
            <article key={release.version} className="group grid gap-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-white/[0.15] hover:bg-white/[0.04] sm:grid-cols-[11rem_1fr] sm:p-5">
              <div className="flex items-start gap-3 sm:block">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 text-xs font-black text-fuchsia-100 sm:mb-4">
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-black text-white">{release.version}</p>
                  <time dateTime={release.isoDate} className="mt-1 block text-xs font-semibold leading-5 text-gray-500">
                    {release.date}
                  </time>
                </div>
              </div>

              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{release.category}</Badge>
                  <StatusBadge status={release.status} />
                  <Badge tone={release.impact === 'Analyse' ? 'cyan' : release.impact === 'Billing' ? 'warning' : 'accent'}>{release.impact}</Badge>
                </div>
                <h3 className="mt-4 text-xl font-black tracking-tight text-white">{release.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{release.summary}</p>
                <div className="mt-5 grid gap-2 lg:grid-cols-3">
                  {release.bullets.map((bullet) => (
                    <p key={bullet} className="flex gap-2 rounded-xl border border-white/[0.06] bg-black/15 p-3 text-sm leading-6 text-gray-300">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" aria-hidden />
                      {bullet}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="border-y border-white/[0.06] px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto max-w-6xl">
        <div className="mb-9 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <Badge tone="cyan">Product roadmap</Badge>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Ce qui arrive ensuite.</h2>
            <p className="mt-4 text-sm leading-7 text-gray-400">
              La roadmap reste prudente: on construit les fondations du Growth OS sans promettre des automatisations magiques.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roadmapCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone={card.status === 'En cours' || card.status === 'En construction' ? 'success' : card.status === 'Prochain' ? 'cyan' : 'neutral'}>
                  {card.status}
                </Badge>
                <Badge tone="accent">{card.plan}</Badge>
              </div>
              <h3 className="mt-5 text-lg font-black text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-6 text-gray-400">{card.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuiltInPublic() {
  const points = [
    'Des releases datées, lisibles et cohérentes.',
    'Des bénéfices utilisateur plutôt que du jargon technique.',
    'Une direction produit claire: TikTok Growth OS.',
  ];

  return (
    <section className="px-5 py-14 sm:px-8 sm:py-18">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.35rem] border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
          <Badge tone="success">Built in public</Badge>
          <h2 className="mt-5 text-3xl font-black tracking-tight text-white">Un produit qui avance en public.</h2>
          <p className="mt-4 text-sm leading-7 text-gray-400">
            La page nouveaut&eacute;s n&apos;est pas l&agrave; pour empiler des tickets. Elle montre que Viralynz apprend,
            se renforce, et transforme chaque semaine plus de signaux TikTok en actions concr&egrave;tes.
          </p>
        </div>
        <div className="rounded-[1.35rem] border border-white/[0.08] bg-[#0b0b10] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-500">Pourquoi c&apos;est rassurant</p>
          <div className="mt-5 space-y-3">
            {points.map((point) => (
              <div key={point} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-100">
                  <CheckIcon />
                </span>
                <p className="text-sm font-semibold leading-6 text-gray-200">{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-16 sm:px-8 sm:pb-20">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-vn-fuchsia/[0.08] p-7 text-center shadow-[0_30px_120px_-82px_rgba(232,121,249,0.95)] sm:p-10">
        <Badge tone="accent">Derni&egrave;re version disponible</Badge>
        <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-black tracking-tight text-white sm:text-5xl">Teste la derni&egrave;re version de Viralynz.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
          Analyse une vid&eacute;o gratuitement et repars avec un diagnostic, un hook corrig&eacute; et un plan de remontage.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-7 text-sm font-black text-white shadow-lg shadow-vn-fuchsia/20 transition hover:scale-[1.01] hover:brightness-110 active:scale-[0.98]"
        >
          Analyser une vid&eacute;o gratuite
          <ArrowIcon />
        </Link>
        <p className="mt-4 text-xs font-semibold text-gray-500">3 analyses gratuites &middot; sans carte bancaire</p>
      </div>
    </section>
  );
}

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-vn-bg">
      <Hero />
      <ShippingEverySunday />
      <LatestRelease />
      <WeeklyTimeline />
      <Roadmap />
      <BuiltInPublic />
      <FinalCta />
    </main>
  );
}
