'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type MemoryFact = {
  id: string;
  type: string;
  title: string;
  content: string;
  evidence?: string | null;
  confidence_score: number;
  importance_score: number;
  occurrence_count: number;
};

type MemoryOverviewResponse = {
  memoryTier: 'locked' | 'essential' | 'extended' | 'permanent';
  tierLabel: string;
  memoryScore: number;
  analysesLearned: number;
  activeFactsCount: number;
  status: 'empty' | 'learning' | 'patterns' | 'active' | 'advanced' | 'locked';
  nextMilestone: { target: number; label: string; remaining: number } | null;
  profile: {
    creatorStyleSummary?: string;
    hookStyleSummary?: string;
    commonMistakesSummary?: string;
    strongestFormatsSummary?: string;
    weakPatternsSummary?: string;
    v2OpportunitiesSummary?: string;
  };
  topFacts: Record<string, MemoryFact[]>;
  locked: { memory: boolean; proSections: boolean; snapshots: boolean };
  snapshots: Array<{ id: string; title: string; summary: string; facts_included: number; created_at: string }>;
};

type MemoryIconName =
  | 'arrow'
  | 'bell'
  | 'brain'
  | 'chart'
  | 'clock'
  | 'grid'
  | 'hook'
  | 'lock'
  | 'play'
  | 'refresh'
  | 'sparkle'
  | 'warning';

const primaryButton =
  'inline-flex h-12 min-w-0 items-center justify-center gap-3 rounded-[15px] bg-[linear-gradient(135deg,#4d7cff_0%,#8b5cf6_48%,#f05ceb_100%)] px-5 text-sm font-black text-white shadow-[0_18px_46px_rgba(139,92,246,0.32),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-200/80 active:scale-[0.99]';

const secondaryButton =
  'inline-flex h-12 min-w-0 items-center justify-center gap-3 rounded-[15px] border border-white/[0.12] bg-white/[0.035] px-5 text-sm font-black text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/20 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70 active:scale-[0.99]';

const memoryCards: Array<{
  title: string;
  type: 'hook' | 'mistake' | 'format' | 'v2';
  icon: MemoryIconName;
  empty: string;
  lockedCopy?: string;
}> = [
  {
    title: 'Tes hooks',
    type: 'hook',
    icon: 'sparkle',
    empty: 'Aucun hook confirmé pour le moment.',
  },
  {
    title: 'Tes erreurs',
    type: 'mistake',
    icon: 'warning',
    empty: 'Aucune erreur récurrente confirmée.',
  },
  {
    title: 'Tes formats',
    type: 'format',
    icon: 'grid',
    empty: 'Aucun signal confirmé pour le moment.',
  },
  {
    title: 'Tes V2',
    type: 'v2',
    icon: 'refresh',
    empty: 'Aucune opportunité de repost confirmée.',
    lockedCopy: 'Débloqué avec une mémoire plus avancée.',
  },
];

const unlockChips = [
  { label: 'Hooks récurrents', icon: 'hook' as const, tone: 'text-fuchsia-200 border-fuchsia-300/20 bg-fuchsia-400/10' },
  { label: 'Erreurs fréquentes', icon: 'warning' as const, tone: 'text-rose-100 border-rose-300/20 bg-rose-400/10' },
  { label: 'Formats à retester', icon: 'grid' as const, tone: 'text-cyan-100 border-cyan-300/20 bg-cyan-400/10' },
];

const progressionSteps = [
  { value: 0, label: 'Mémoire vide' },
  { value: 3, label: 'Premiers patterns' },
  { value: 10, label: 'Profil actif' },
  { value: 25, label: 'Décisions personnalisées' },
  { value: 50, label: 'Snapshot long terme' },
];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusLabel(status: MemoryOverviewResponse['status']) {
  if (status === 'locked') return 'Verrouillée';
  if (status === 'empty') return 'Mémoire vide';
  if (status === 'learning') return 'En apprentissage';
  if (status === 'patterns') return 'Premiers patterns';
  if (status === 'advanced') return 'Mémoire avancée';
  return 'Mémoire active';
}

function learningHelp(overview: MemoryOverviewResponse | null, error: string) {
  if (error) return error;
  if (!overview) return 'La mémoire utilise uniquement tes analyses réelles.';
  if (!overview.nextMilestone) return 'La mémoire utilise uniquement tes analyses réelles.';
  const label = overview.nextMilestone.label.toLowerCase();
  const suffix = overview.nextMilestone.target === 3 ? ' détectés' : '';
  return `Encore ${overview.nextMilestone.remaining} analyses pour ${label}${suffix}.`;
}

function pluralizeAnalysis(count: number) {
  return `${count} analyse${count > 1 ? 's' : ''} apprise${count > 1 ? 's' : ''}`;
}

function Pill({
  children,
  tone = 'violet',
}: {
  children: ReactNode;
  tone?: 'violet' | 'cyan' | 'green' | 'slate';
}) {
  const tones = {
    violet: 'border-violet-300/40 bg-violet-400/10 text-violet-100 shadow-[0_0_22px_rgba(139,92,246,0.14)]',
    cyan: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.12)]',
    green: 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100',
    slate: 'border-white/[0.12] bg-white/[0.055] text-zinc-200',
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatusBadge({ real, locked }: { real: boolean; locked?: boolean }) {
  if (locked) {
    return <Pill tone="slate">Verrouillé</Pill>;
  }

  return <Pill tone={real ? 'green' : 'slate'}>{real ? 'Réel' : 'En attente'}</Pill>;
}

export default function MemoryPageClient() {
  const [overview, setOverview] = useState<MemoryOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/memory/overview', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Impossible de charger la mémoire.');
        return response.json() as Promise<MemoryOverviewResponse>;
      })
      .then((data) => {
        if (mounted) setOverview(data);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Erreur mémoire.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const facts = useMemo(() => overview?.topFacts ?? {}, [overview]);
  const analysesLearned = overview?.analysesLearned ?? 0;
  const activeFactsCount = overview?.activeFactsCount ?? 0;
  const score = clampScore(overview?.memoryScore ?? 0);
  const enoughForPatterns = analysesLearned >= 3;
  const heroTier = overview?.tierLabel ?? 'Mémoire étendue';

  return (
    <main className="relative isolate min-h-[calc(100dvh-4.25rem)] overflow-x-hidden bg-[#020611] px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 text-white sm:px-6 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_10%,rgba(139,92,246,0.24),transparent_31%),radial-gradient(circle_at_88%_20%,rgba(34,211,238,0.13),transparent_30%),radial-gradient(circle_at_72%_82%,rgba(236,72,153,0.13),transparent_34%),linear-gradient(180deg,#030714_0%,#02040b_58%,#030511_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.14] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:linear-gradient(to_bottom,black,transparent_86%)]"
      />

      <div className="mx-auto flex w-full max-w-[48rem] flex-col gap-4 min-[1180px]:max-w-5xl">
        <MemoryHero tierLabel={heroTier} />

        <MemoryStatusCard
          loading={loading}
          overview={overview}
          error={error}
          score={score}
          analysesLearned={analysesLearned}
          activeFactsCount={activeFactsCount}
        />

        {!enoughForPatterns ? <MemoryUnlockCard locked={overview?.locked.memory} /> : null}

        <MemoryInsightGrid facts={facts} overview={overview} enoughForPatterns={enoughForPatterns} />

        <MemoryProgressionCard analysesLearned={analysesLearned} />
      </div>

      <style jsx global>{`
        @keyframes memoryPulse {
          0%,
          100% {
            opacity: 0.68;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          [data-memory-animated='true'] {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function MemoryHero({ tierLabel }: { tierLabel: string }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-violet-200/[0.16] bg-[linear-gradient(145deg,rgba(22,19,50,0.88),rgba(4,9,22,0.9)_45%,rgba(4,8,18,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-7 min-[860px]:grid min-[860px]:min-h-[21rem] min-[860px]:grid-cols-[1.02fr_0.98fr] min-[860px]:items-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(236,72,153,0.15),transparent_30%),radial-gradient(circle_at_86%_48%,rgba(79,70,229,0.22),transparent_38%)]"
      />
      <AiMemoryVisual />

      <div className="relative z-10 flex max-w-[29rem] flex-col items-start">
        <div className="flex flex-wrap gap-2">
          <Pill tone="violet">Mémoire créateur</Pill>
          <Pill tone="cyan">{tierLabel}</Pill>
        </div>
        <p className="mt-6 text-[0.78rem] font-black uppercase tracking-[0.28em] text-violet-300">
          Mémoire IA
        </p>
        <h1 className="mt-3 text-[2.05rem] font-black leading-[1.04] tracking-[-0.055em] text-zinc-50 sm:text-5xl">
          Viralynz apprend ton
          <br />
          style à chaque analyse.
        </h1>
        <p className="mt-4 max-w-[24rem] text-[0.96rem] leading-7 text-zinc-300 sm:text-base">
          Analyse après analyse, Viralynz construit une mémoire de tes hooks, de tes erreurs et des formats à retester.
        </p>

        <div className="mt-6 flex w-full max-w-[30rem] flex-col gap-3 min-[520px]:flex-row">
          <Link href="/dashboard/analyze" className={`${primaryButton} min-[520px]:flex-1`}>
            Analyser une vidéo
            <MemoryIcon name="arrow" className="h-4 w-4" />
          </Link>
          <Link href="/dashboard/library?tab=analyses" className={`${secondaryButton} min-[520px]:flex-1`}>
            <MemoryIcon name="clock" className="h-4 w-4 text-zinc-300" />
            Voir mon historique
          </Link>
        </div>
      </div>
    </section>
  );
}

function MemoryStatusCard({
  loading,
  overview,
  error,
  score,
  analysesLearned,
  activeFactsCount,
}: {
  loading: boolean;
  overview: MemoryOverviewResponse | null;
  error: string;
  score: number;
  analysesLearned: number;
  activeFactsCount: number;
}) {
  const status = loading ? 'Chargement' : overview ? statusLabel(overview.status) : 'Indisponible';

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.1] bg-white/[0.04] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_8%_22%,rgba(59,130,246,0.13),transparent_32%),radial-gradient(circle_at_90%_20%,rgba(139,92,246,0.11),transparent_28%)]" />
      <div className="relative z-10 grid gap-5 min-[680px]:grid-cols-[minmax(0,1fr)_auto] min-[680px]:items-start">
        <div>
          <p className="text-[0.72rem] font-black uppercase tracking-[0.28em] text-zinc-400">État de la mémoire</p>
          <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-white sm:text-2xl">{status}</h2>
          <div className="mt-4 flex items-end gap-1">
            <span className="bg-[linear-gradient(135deg,#c084fc_0%,#8b5cf6_42%,#f472d0_100%)] bg-clip-text text-[3.45rem] font-black leading-none tracking-[-0.08em] text-transparent">
              {score}
            </span>
            <span className="pb-1 text-xl font-black text-zinc-500">/100</span>
          </div>
        </div>

        <div className="flex items-start justify-between gap-5 min-[680px]:min-w-[18rem]">
          <div className="mt-1 grid gap-3 text-sm font-semibold text-zinc-400">
            <p className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.65)]" />
              {pluralizeAnalysis(analysesLearned)}
            </p>
            <p className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.6)]" />
              {activeFactsCount} souvenirs actifs
            </p>
          </div>
          <div className="grid h-[4.15rem] w-[4.15rem] shrink-0 place-items-center rounded-[20px] border border-violet-200/25 bg-violet-300/[0.08] text-[1.45rem] font-black text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_34px_rgba(139,92,246,0.14)]">
            IA
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#8b5cf6_52%,#f472d0_100%)] shadow-[0_0_24px_rgba(139,92,246,0.58)]"
          style={{ width: `${Math.max(score, score > 0 ? 8 : 0)}%` }}
        />
      </div>
      <p className="relative z-10 mt-3 text-sm leading-6 text-zinc-400">{learningHelp(overview, error)}</p>
    </section>
  );
}

function MemoryUnlockCard({ locked }: { locked?: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.1] bg-white/[0.035] px-4 py-5 text-center shadow-[0_22px_70px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:px-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.16),transparent_34%)]" />
      <div className="relative z-10 mx-auto max-w-[42rem]">
        <Pill tone={locked ? 'slate' : 'violet'}>
          <MemoryIcon name="lock" className="h-3.5 w-3.5" />
          À débloquer
        </Pill>
        <h2 className="mx-auto mt-4 max-w-[34rem] text-xl font-black leading-tight tracking-[-0.035em] text-white sm:text-2xl">
          Analyse 3 vidéos pour débloquer ta Mémoire IA.
        </h2>
        <p className="mx-auto mt-2 max-w-[35rem] text-sm leading-6 text-zinc-400">
          La mémoire se construit uniquement à partir de tes vraies analyses. Aucun score inventé, aucun conseil générique.
        </p>
        <div className="mt-4 grid gap-2 min-[560px]:grid-cols-3">
          {unlockChips.map((chip) => (
            <span key={chip.label} className={`inline-flex h-10 items-center justify-center gap-2 rounded-[13px] border px-3 text-sm font-black ${chip.tone}`}>
              <MemoryIcon name={chip.icon} className="h-4 w-4" />
              {chip.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function MemoryInsightGrid({
  facts,
  overview,
  enoughForPatterns,
}: {
  facts: Record<string, MemoryFact[]>;
  overview: MemoryOverviewResponse | null;
  enoughForPatterns: boolean;
}) {
  return (
    <section className="grid gap-3 min-[720px]:grid-cols-2">
      {memoryCards.map((card) => {
        const visibleFacts = (facts[card.type] ?? []).slice(0, card.type === 'mistake' ? 2 : 1);
        const locked = card.type === 'v2' ? Boolean(overview?.locked.proSections && !enoughForPatterns) : Boolean(overview?.locked.memory);
        return (
          <MemoryFactCard
            key={card.type}
            title={card.title}
            icon={card.icon}
            facts={visibleFacts}
            empty={card.empty}
            locked={locked}
            lockedCopy={card.lockedCopy}
          />
        );
      })}
    </section>
  );
}

function MemoryFactCard({
  title,
  icon,
  facts,
  empty,
  locked,
  lockedCopy,
}: {
  title: string;
  icon: MemoryIconName;
  facts: MemoryFact[];
  empty: string;
  locked: boolean;
  lockedCopy?: string;
}) {
  const hasFacts = facts.length > 0;

  return (
    <article className="relative overflow-hidden rounded-[22px] border border-white/[0.1] bg-white/[0.035] p-3.5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition hover:border-violet-200/20 hover:bg-white/[0.05]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(139,92,246,0.08),transparent_32%)]" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <h3 className="text-lg font-black tracking-[-0.025em] text-white">{title}</h3>
        <StatusBadge real={hasFacts} locked={locked} />
      </div>

      <div className="relative z-10 mt-3 grid gap-2">
        {locked ? (
          <MemoryEmptyState icon={icon} copy={lockedCopy ?? 'Débloqué après plus d’analyses réelles.'} />
        ) : hasFacts ? (
          facts.map((fact) => <MemoryFactItem key={fact.id} fact={fact} icon={icon} />)
        ) : (
          <MemoryEmptyState icon={icon} copy={empty} />
        )}
      </div>
    </article>
  );
}

function MemoryFactItem({ fact, icon }: { fact: MemoryFact; icon: MemoryIconName }) {
  return (
    <div className="group flex items-start gap-3 rounded-[16px] border border-white/[0.08] bg-[#07101f]/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/[0.14] hover:bg-[#0a1324]/80">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-violet-200/20 bg-violet-400/10 text-violet-200">
        <MemoryIcon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-zinc-50">{fact.title}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{fact.content}</p>
      </div>
      <MemoryIcon name="arrow" className="mt-2 h-4 w-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" />
    </div>
  );
}

function MemoryEmptyState({ icon, copy }: { icon: MemoryIconName; copy: string }) {
  return (
    <div className="flex min-h-[4.85rem] items-center gap-3 rounded-[16px] border border-white/[0.07] bg-[#07101f]/50 p-3 text-sm leading-6 text-zinc-400">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-white/[0.035] text-zinc-500">
        <MemoryIcon name={icon} className="h-5 w-5" />
      </div>
      <p>{copy}</p>
    </div>
  );
}

function MemoryProgressionCard({ analysesLearned }: { analysesLearned: number }) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-violet-200/[0.16] bg-[linear-gradient(145deg,rgba(14,16,37,0.9),rgba(5,10,24,0.94)_55%,rgba(16,13,52,0.9))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:p-6">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_78%_42%,rgba(91,75,255,0.22),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(236,72,153,0.12),transparent_24%)]" />
      <MemoryHologram />

      <div className="relative z-10 max-w-[31rem]">
        <p className="text-[0.72rem] font-black uppercase tracking-[0.3em] text-violet-200/75">Progression mémoire</p>
        <div className="mt-4 grid gap-0">
          {progressionSteps.map((step, index) => (
            <ProgressStep
              key={step.value}
              value={step.value}
              label={step.label}
              active={analysesLearned >= step.value}
              last={index === progressionSteps.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProgressStep({ value, label, active, last }: { value: number; label: string; active: boolean; last: boolean }) {
  return (
    <div className="relative flex gap-4 pb-3 last:pb-0">
      {!last ? <span className="absolute left-[1.125rem] top-9 h-[calc(100%-2.25rem)] w-px bg-white/[0.1]" /> : null}
      <div className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm font-black ${
        active
          ? 'border-violet-200/40 bg-violet-400/20 text-white shadow-[0_0_24px_rgba(139,92,246,0.42)]'
          : 'border-white/[0.1] bg-white/[0.035] text-zinc-500'
      }`}>
        {value}
      </div>
      <p className={`pt-1.5 text-base font-black leading-6 sm:text-lg ${active ? 'text-white' : 'text-zinc-500'}`}>{label}</p>
    </div>
  );
}

function AiMemoryVisual() {
  return (
    <div className="pointer-events-none absolute -right-[6.4rem] top-11 z-0 h-[21rem] w-[21rem] opacity-78 sm:-right-8 sm:top-5 sm:h-[24rem] sm:w-[24rem] min-[860px]:relative min-[860px]:right-auto min-[860px]:top-auto min-[860px]:ml-auto min-[860px]:h-[24rem] min-[860px]:w-[24rem] min-[860px]:opacity-100">
      <svg aria-hidden="true" viewBox="0 0 360 360" className="h-full w-full">
        <defs>
          <radialGradient id="memoryBrainGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.78" />
            <stop offset="42%" stopColor="#7c3aed" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0" />
          </radialGradient>
          <filter id="memoryGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="190" cy="176" r="54" fill="url(#memoryBrainGlow)" />
        {[58, 84, 112, 142, 170].map((radius) => (
          <ellipse key={radius} cx="190" cy="176" rx={radius} ry={radius * 0.68} fill="none" stroke="rgba(139,92,246,0.22)" strokeWidth="1" transform="rotate(-12 190 176)" />
        ))}
        <path d="M76 185c38-52 76-68 114-40 34 25 69 14 100-28" stroke="rgba(96,165,250,0.25)" strokeWidth="1.2" fill="none" />
        <path d="M92 238c42-30 76-34 104-11 28 24 57 20 88-12" stroke="rgba(217,70,239,0.22)" strokeWidth="1.2" fill="none" />
        {[74, 105, 142, 235, 270, 302].map((x, index) => (
          <circle
            key={x}
            data-memory-animated="true"
            cx={x}
            cy={[184, 236, 146, 128, 215, 170][index]}
            r={index % 2 === 0 ? 3.6 : 2.8}
            fill={index % 3 === 0 ? '#60a5fa' : index % 3 === 1 ? '#a78bfa' : '#f472d0'}
            filter="url(#memoryGlow)"
            style={{ animation: `memoryPulse ${3.8 + index * 0.35}s ease-in-out infinite` }}
          />
        ))}
        <g transform="translate(190 176)" filter="url(#memoryGlow)">
          <circle r="42" fill="rgba(139,92,246,0.12)" stroke="rgba(167,139,250,0.8)" strokeWidth="1.5" />
          <MemoryBrainPath />
        </g>
        <MemoryOrbitIcon x={90} y={80} icon="play" />
        <MemoryOrbitIcon x={70} y={232} icon="hook" />
        <MemoryOrbitIcon x={275} y={105} icon="sparkle" />
        <MemoryOrbitIcon x={248} y={270} icon="chart" />
      </svg>
    </div>
  );
}

function MemoryOrbitIcon({ x, y, icon }: { x: number; y: number; icon: MemoryIconName }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="24" fill="rgba(15,23,42,0.62)" stroke="rgba(167,139,250,0.35)" />
      <foreignObject x="-10" y="-10" width="20" height="20">
        <div className="grid h-5 w-5 place-items-center text-violet-200">
          <MemoryIcon name={icon} className="h-4 w-4" />
        </div>
      </foreignObject>
    </g>
  );
}

function MemoryBrainPath() {
  return (
    <g fill="none" stroke="#c4b5fd" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <path d="M-20 7c-10 0-17-7-17-17 0-8 5-15 13-17 2-9 10-15 20-15 7 0 13 3 17 8 10 1 18 10 18 20 0 11-8 20-20 20" />
      <path d="M-16-22c7 1 11 6 11 13" />
      <path d="M9-27c-7 4-9 10-6 18" />
      <path d="M-27-3c8-4 17-2 24 5" />
      <path d="M6 3c8-6 17-5 24 1" />
      <path d="M-4 13c0 9 5 16 14 19" />
      <path d="M-18 8c2 9 9 14 19 14" />
    </g>
  );
}

function MemoryHologram() {
  return (
    <div className="pointer-events-none absolute bottom-2 right-1 h-48 w-48 opacity-80 sm:right-10 sm:h-56 sm:w-56">
      <svg aria-hidden="true" viewBox="0 0 220 220" className="h-full w-full">
        <defs>
          <radialGradient id="hologramGlow" cx="50%" cy="62%" r="48%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0" />
          </radialGradient>
          <filter id="hologramBlur" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ellipse cx="110" cy="156" rx="84" ry="25" fill="url(#hologramGlow)" stroke="rgba(139,92,246,0.45)" />
        <ellipse cx="110" cy="132" rx="68" ry="20" fill="none" stroke="rgba(96,165,250,0.5)" />
        <ellipse cx="110" cy="108" rx="54" ry="16" fill="none" stroke="rgba(139,92,246,0.45)" />
        <line x1="70" y1="76" x2="48" y2="155" stroke="rgba(96,165,250,0.16)" />
        <line x1="150" y1="76" x2="172" y2="155" stroke="rgba(96,165,250,0.16)" />
        <g transform="translate(110 64)" filter="url(#hologramBlur)">
          <circle r="28" fill="rgba(139,92,246,0.12)" stroke="rgba(196,181,253,0.62)" />
          <MemoryBrainPath />
        </g>
      </svg>
    </div>
  );
}

function MemoryIcon({ name, className }: { name: MemoryIconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  };

  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
        <path d="M13 6l6 6-6 6" />
      </svg>
    );
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    );
  }

  if (name === 'brain') {
    return (
      <svg {...common}>
        <path d="M9 3a4 4 0 0 0-4 4v1a4 4 0 0 0 0 8v1a4 4 0 0 0 7 2.65" />
        <path d="M15 3a4 4 0 0 1 4 4v1a4 4 0 0 1 0 8v1a4 4 0 0 1-7 2.65" />
        <path d="M12 3v18" />
        <path d="M8 9h4" />
        <path d="M12 15h4" />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </svg>
    );
  }

  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }

  if (name === 'grid') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="4" width="6" height="6" rx="1.5" />
        <rect x="4" y="14" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
      </svg>
    );
  }

  if (name === 'hook') {
    return (
      <svg {...common}>
        <path d="M9 18a3 3 0 1 1 0-6h3V5" />
        <path d="M12 5c2.8 0 5 1.8 5 4.2 0 1.6-.9 2.9-2.4 3.6" />
      </svg>
    );
  }

  if (name === 'lock') {
    return (
      <svg {...common}>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      </svg>
    );
  }

  if (name === 'play') {
    return (
      <svg {...common}>
        <path d="M8 5v14l11-7-11-7Z" />
      </svg>
    );
  }

  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M20 12a8 8 0 0 1-14.4 4.8" />
        <path d="M4 12A8 8 0 0 1 18.4 7.2" />
        <path d="M18 3v4h-4" />
        <path d="M6 21v-4h4" />
      </svg>
    );
  }

  if (name === 'sparkle') {
    return (
      <svg {...common}>
        <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8L18 16Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}
