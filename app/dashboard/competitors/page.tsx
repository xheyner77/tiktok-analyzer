import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const previewCards = [
  {
    title: 'Créateurs suivis',
    description: 'Ajoute les comptes qui t’inspirent pour suivre leurs formats et leurs angles.',
    status: 'En préparation',
  },
  {
    title: 'Formats repérés',
    description: 'Viralynz regroupera les patterns observés : facecam, storytime, preuve rapide, avant/après, réaction, tuto.',
    status: 'Bientôt',
  },
  {
    title: 'Opportunités à confirmer',
    description: 'Chaque signal devra être validé par tes propres analyses avant d’être transformé en V2.',
    status: 'À vérifier',
  },
];

const workflowSteps = [
  {
    number: '01',
    title: 'Ajoute des créateurs',
    description: 'Sélectionne les comptes TikTok à surveiller dans ta niche.',
  },
  {
    number: '02',
    title: 'Viralynz repère les formats',
    description: 'Le moteur classe les hooks, structures et répétitions de format.',
  },
  {
    number: '03',
    title: 'Tu confirmes par analyse',
    description: 'Les signaux ne deviennent utiles que lorsqu’ils sont testés sur tes propres vidéos.',
  },
  {
    number: '04',
    title: 'Tu testes une V2',
    description: 'Transforme un signal en hook, structure ou angle à republier.',
  },
];

const valueCards = [
  {
    title: 'Trouver des angles',
    description: 'Repère les sujets qui reviennent souvent dans ta niche.',
  },
  {
    title: 'Comprendre les formats',
    description: 'Identifie les structures qui accrochent sans copier le contenu.',
  },
  {
    title: 'Préparer tes V2',
    description: 'Transforme un signal en version à tester avec ton propre style.',
  },
];

const principles = ['Aucun faux chiffre concurrent', 'Aucun score inventé', 'Chaque signal doit être testé'];
const futureItems = ['Créateurs à suivre', 'Formats récurrents', 'Angles à tester'];
const feedbackSignals = ['hooks', 'formats', 'tendances', 'concurrents directs', 'idées de V2'];

function StatusBadge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'cyan' | 'slate' }) {
  const tones = {
    violet: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
    slate: 'border-white/[0.1] bg-white/[0.045] text-slate-200',
  };

  return (
    <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function SkeletonStack() {
  return (
    <div className="mt-5 space-y-3" aria-hidden="true">
      <div className="h-2.5 w-2/3 rounded-full bg-white/[0.08]" />
      <div className="h-2.5 w-full rounded-full bg-white/[0.06]" />
      <div className="h-2.5 w-4/5 rounded-full bg-white/[0.045]" />
    </div>
  );
}

export default async function DashboardCompetitorsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/competitors');
  }

  return (
    <section className="mx-auto w-full max-w-[1460px] pb-10 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(11,18,35,0.96),rgba(3,7,18,0.99)_55%,rgba(32,13,60,0.94))] p-5 shadow-[0_34px_116px_-78px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_10%_0%,rgba(168,85,247,0.18),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(139,92,246,.11)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center">
          <div>
            <StatusBadge tone="violet">Bientôt disponible</StatusBadge>
            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200/75">Concurrents</p>
            <h1 className="mt-3 max-w-4xl text-[34px] font-black tracking-[-0.055em] text-white sm:text-[52px]">
              Surveille les créateurs qui inspirent tes prochaines V2
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Ajoute des comptes à suivre, repère les formats qui reviennent et transforme les signaux de ta niche en angles à tester.
            </p>
            <p className="mt-4 max-w-2xl text-[13px] leading-6 text-slate-400">
              Ne copie pas. Comprends ce qui capte l’attention.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-24px_rgba(139,92,246,0.95)] transition hover:brightness-110">
                Me prévenir au lancement
              </Link>
              <Link href="/dashboard" className="inline-flex min-h-[46px] items-center justify-center rounded-[12px] border border-white/[0.1] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
                Retour au dashboard
              </Link>
            </div>
          </div>

          <aside className="rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_26px_74px_-62px_rgba(34,211,238,0.65)] sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ce que cette vue préparera</p>
            <div className="mt-4 space-y-3">
              {futureItems.map((item) => (
                <div key={item} className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.07] bg-black/20 px-4 py-3">
                  <span className="text-[13px] font-black text-white">{item}</span>
                  <span className="h-2 w-2 rounded-full bg-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.45)]" />
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-[14px] border border-cyan-300/12 bg-cyan-300/[0.055] px-4 py-3">
              <p className="text-[12px] leading-5 text-cyan-50/85">
                Les signaux concurrents deviennent utiles seulement quand tu les transformes en test.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main className="space-y-5">
          <section className="rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.985))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Aperçu</p>
                <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">Aperçu de la future vue</h2>
              </div>
              <p className="max-w-md text-[12px] leading-5 text-slate-500">
                Aucun faux benchmark : Viralynz prépare des pistes, pas des certitudes.
              </p>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {previewCards.map((card) => (
                <article key={card.title} className="min-h-[220px] rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[16px] font-black tracking-[-0.02em] text-white">{card.title}</h3>
                    <StatusBadge tone="slate">{card.status}</StatusBadge>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-slate-400">{card.description}</p>
                  <SkeletonStack />
                  <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">Preview verrouillée</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-white/[0.075] bg-white/[0.035] p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/70">Workflow futur</p>
            <h2 className="mt-2 text-[24px] font-black tracking-[-0.04em] text-white">Comment ça fonctionnera</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => (
                <article key={step.number} className="rounded-[17px] border border-white/[0.07] bg-black/18 p-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-200/75">{step.number}</span>
                  <h3 className="mt-3 text-[14px] font-black text-white">{step.title}</h3>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-3">
            {valueCards.map((card) => (
              <article key={card.title} className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.022))] p-4">
                <h3 className="text-[15px] font-black text-white">{card.title}</h3>
                <p className="mt-2 text-[12px] leading-5 text-slate-400">{card.description}</p>
              </article>
            ))}
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(12,18,34,0.92),rgba(4,8,18,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <StatusBadge tone="cyan">Confiance</StatusBadge>
            <h2 className="mt-4 text-[22px] font-black tracking-[-0.04em] text-white">Pas de fausses métriques. Pas de copie aveugle.</h2>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">
              Viralynz ne t’affichera pas de benchmarks inventés ni de scores concurrents impossibles à vérifier. La vue Concurrents servira à repérer des signaux, puis à les valider avec tes propres analyses.
            </p>
            <div className="mt-5 space-y-2.5">
              {principles.map((principle) => (
                <div key={principle} className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 text-[12px] font-black text-slate-200">
                  {principle}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-violet-300/12 bg-[linear-gradient(180deg,rgba(88,28,135,0.18),rgba(7,10,22,0.96))] p-5 shadow-[0_26px_82px_-66px_rgba(168,85,247,0.85),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100/75">Priorisation</p>
            <h2 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">Aide-nous à prioriser cette feature</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-[14px] border border-white/[0.07] bg-black/20 p-3">
                <p className="text-[12px] font-black text-white">Quels créateurs veux-tu surveiller ?</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">Envoie les comptes via Support pour joindre le contexte de ton workspace.</p>
              </div>
              <div className="rounded-[14px] border border-white/[0.07] bg-black/20 p-3">
                <p className="text-[12px] font-black text-white">Quelle niche veux-tu suivre ?</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">Le feedback aide à prioriser les premiers cas d’usage.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {feedbackSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1.5 text-[11px] font-bold text-slate-300">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/dashboard/support" className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] bg-white text-[13px] font-black text-[#090d18] transition hover:bg-cyan-50">
              Proposer une idée
            </Link>
          </section>
        </aside>
      </div>
    </section>
  );
}
