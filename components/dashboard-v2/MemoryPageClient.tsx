'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

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

const shellCard =
  'relative overflow-hidden rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,15,30,0.94),rgba(4,8,18,0.99))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_34px_96px_-74px_rgba(0,0,0,0.98)]';

const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#f36cff_0%,#8b5cf6_52%,#2563eb_100%)] px-5 text-[13px] font-black text-white shadow-[0_24px_58px_-28px_rgba(139,92,246,1),inset_0_1px_0_rgba(255,255,255,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110';

const secondaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-white/[0.10] bg-white/[0.045] px-5 text-[13px] font-black text-slate-100 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-white/[0.075]';

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate' }) {
  const tones = {
    violet: 'border-violet-300/22 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/22 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/22 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/22 bg-amber-400/10 text-amber-100',
    slate: 'border-white/[0.12] bg-white/[0.055] text-slate-200',
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone]}`}>{children}</span>;
}

function statusLabel(status: MemoryOverviewResponse['status']) {
  if (status === 'locked') return 'Verrouillée';
  if (status === 'empty') return 'Mémoire vide';
  if (status === 'learning') return 'En apprentissage';
  if (status === 'patterns') return 'Premiers patterns';
  if (status === 'advanced') return 'Mémoire avancée';
  return 'Mémoire active';
}

function FactList({ title, facts, locked }: { title: string; facts: MemoryFact[]; locked?: boolean }) {
  const visibleFacts = facts.slice(0, 3);
  return (
    <article className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4 transition duration-200 hover:-translate-y-1 hover:border-violet-200/18 hover:bg-white/[0.055]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-black text-white">{title}</h3>
        <Badge tone={locked ? 'slate' : visibleFacts.length ? 'green' : 'violet'}>{locked ? 'Verrouillé' : visibleFacts.length ? 'Réel' : 'En attente'}</Badge>
      </div>
      <div className="mt-4 grid gap-2.5">
        {locked ? (
          <p className="text-[13px] leading-6 text-slate-500">Débloqué avec une mémoire plus avancée.</p>
        ) : visibleFacts.length ? (
          visibleFacts.map((fact) => (
            <div key={fact.id} className="rounded-[14px] border border-white/[0.07] bg-black/20 p-3">
              <p className="text-[13px] font-black text-slate-100">{fact.title}</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-400">{fact.content}</p>
            </div>
          ))
        ) : (
          <p className="text-[13px] leading-6 text-slate-500">Aucun signal confirmé pour le moment.</p>
        )}
      </div>
    </article>
  );
}

function ProgressStep({ value, label, active }: { value: number; label: string; active: boolean }) {
  return (
    <div className="flex gap-3 md:block">
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[11px] font-black ${active ? 'border-cyan-200/35 bg-cyan-300/12 text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.28)]' : 'border-white/[0.09] bg-white/[0.04] text-slate-500'}`}>
        {value}
      </div>
      <p className={`md:mt-3 text-[13px] font-black leading-5 ${active ? 'text-white' : 'text-slate-500'}`}>{label}</p>
    </div>
  );
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
  const enoughForPatterns = (overview?.analysesLearned ?? 0) >= 3;
  const score = overview?.memoryScore ?? 0;

  return (
    <section className="mx-auto w-full max-w-[1180px] pb-10 pt-3 text-white">
      <section className={`${shellCard} p-5 sm:p-6 lg:p-7`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_12%,rgba(217,70,239,0.23),transparent_30%),radial-gradient(circle_at_86%_18%,rgba(34,211,238,0.16),transparent_34%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="cyan">Mémoire créateur</Badge>
              <Badge tone={overview?.memoryTier === 'permanent' ? 'amber' : 'green'}>{overview?.tierLabel ?? 'Mémoire IA'}</Badge>
            </div>
            <p className="mt-5 text-[13px] font-black uppercase tracking-[0.18em] text-slate-500">Mémoire IA</p>
            <h1 className="mt-3 max-w-3xl text-[34px] font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-[48px] lg:text-[56px]">
              Viralynz apprend ton style à chaque analyse.
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-[16px]">
              Analyse après analyse, Viralynz construit une mémoire de tes hooks, de tes erreurs et des formats à retester.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/analyze" className={primaryButton}>Analyser une vidéo</Link>
              <Link href="/dashboard/library?tab=analyses" className={secondaryButton}>Voir mon historique</Link>
            </div>
          </div>

          <aside className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_76px_-58px_rgba(34,211,238,0.75)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">État de la mémoire</p>
                <p className="mt-2 text-[16px] font-black text-white">{loading ? 'Chargement' : overview ? statusLabel(overview.status) : 'Indisponible'}</p>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-[14px] border border-cyan-200/18 bg-cyan-300/10 text-cyan-100">IA</div>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div className="text-[48px] font-black leading-none tracking-[-0.07em] text-white">
                {score}<span className="text-[18px] text-slate-500">/100</span>
              </div>
              <div className="text-right text-[12px] font-semibold text-slate-400">
                <p>{overview?.analysesLearned ?? 0} analyses apprises</p>
                <p className="mt-1">{overview?.activeFactsCount ?? 0} souvenirs actifs</p>
              </div>
            </div>
            <div className="mt-5 h-[7px] overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#f0abfc)] shadow-[0_0_22px_rgba(139,92,246,0.65)]" style={{ width: `${Math.max(4, score)}%` }} />
            </div>
            <p className="mt-4 text-[13px] leading-6 text-slate-400">
              {error || (overview?.nextMilestone ? `Encore ${overview.nextMilestone.remaining} analyses pour ${overview.nextMilestone.label.toLowerCase()}.` : 'La mémoire utilise uniquement tes analyses réelles.')}
            </p>
          </aside>
        </div>
      </section>

      {!enoughForPatterns ? (
        <section className={`${shellCard} mt-5 p-6 text-center`}>
          <Badge tone={overview?.locked.memory ? 'slate' : 'violet'}>{overview?.locked.memory ? 'Plan Free' : 'À débloquer'}</Badge>
          <h2 className="mx-auto mt-4 max-w-2xl text-[28px] font-black leading-tight tracking-[-0.05em] text-white sm:text-[34px]">
            Analyse 3 vidéos pour débloquer ta Mémoire IA.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-slate-400">
            La mémoire se construit uniquement à partir de tes vraies analyses. Aucun score inventé, aucun conseil générique.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {['Hooks récurrents', 'Erreurs fréquentes', 'Formats à retester'].map((proof) => (
              <span key={proof} className="rounded-full border border-white/[0.09] bg-white/[0.045] px-3 py-2 text-[12px] font-black text-slate-200">{proof}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FactList title="Tes hooks" facts={facts.hook ?? []} locked={overview?.locked.memory} />
        <FactList title="Tes erreurs" facts={facts.mistake ?? []} locked={overview?.locked.memory} />
        <FactList title="Tes formats" facts={facts.format ?? []} locked={overview?.locked.memory} />
        <FactList title="Tes V2" facts={facts.v2 ?? []} locked={overview?.locked.proSections && !enoughForPatterns} />
      </section>

      <section className={`${shellCard} mt-5 p-5 sm:p-6`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200/75">Progression mémoire</p>
        <div className="mt-5 grid gap-5 md:grid-cols-5 md:gap-3">
          <ProgressStep value={0} label="Mémoire vide" active />
          <ProgressStep value={3} label="Premiers patterns" active={(overview?.analysesLearned ?? 0) >= 3} />
          <ProgressStep value={10} label="Profil actif" active={(overview?.analysesLearned ?? 0) >= 10} />
          <ProgressStep value={25} label="Décisions personnalisées" active={(overview?.analysesLearned ?? 0) >= 25} />
          <ProgressStep value={50} label="Snapshot long terme" active={(overview?.analysesLearned ?? 0) >= 50} />
        </div>
      </section>

      {overview?.snapshots.length ? (
        <section className={`${shellCard} mt-5 p-5 sm:p-6`}>
          <Badge tone="amber">Lifetime</Badge>
          <h2 className="mt-4 text-[24px] font-black tracking-[-0.04em] text-white">Snapshots long terme</h2>
          <div className="mt-4 grid gap-3">
            {overview.snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded-[14px] border border-white/[0.075] bg-white/[0.035] p-4">
                <p className="text-[14px] font-black text-white">{snapshot.title}</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-400">{snapshot.summary}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
