'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export type LibraryTab = 'all' | 'analyses' | 'hooks' | 'v2' | 'repost' | 'collections';

export type LibraryAnalysisItem = {
  id: string;
  title: string;
  date: string;
  rawDate: string;
  score: number | null;
  verdict: string;
  objective: string;
  niche: string;
  videoUrl: string;
  sourceLabel: string;
  href: string;
  searchText: string;
};

export type LibraryHookItem = {
  id: string;
  hook: string;
  context: string;
  sourceTitle: string;
  sourceHref: string;
  date: string;
  rawDate: string;
  origin: string;
  textKey: string;
  searchText: string;
};

export type LibraryV2Item = {
  id: string;
  title: string;
  summary: string;
  structureText: string | null;
  sourceTitle: string;
  sourceHref: string;
  date: string;
  rawDate: string;
  status: 'prête' | 'partielle' | 'pro requis';
  score: number | null;
  searchText: string;
};

export type LibraryRepostItem = {
  id: string;
  title: string;
  reason: string;
  action: string;
  sourceHref: string;
  date: string;
  rawDate: string;
  score: number | null;
  searchText: string;
};

type LibraryPageClientProps = {
  initialTab: LibraryTab;
  analysisItems: LibraryAnalysisItem[];
  hookItems: LibraryHookItem[];
  v2Items: LibraryV2Item[];
  repostItems: LibraryRepostItem[];
  collectionsAvailable: boolean;
};

type TypeFilter = 'all' | 'analysis' | 'hook' | 'v2' | 'repost';
type ScoreFilter = 'all' | 'high' | 'low';
type DateFilter = 'all' | 'recent';

const tabLabels: Record<LibraryTab, string> = {
  all: 'Tout',
  analyses: 'Analyses',
  hooks: 'Hooks',
  v2: 'V2',
  repost: 'À republier',
  collections: 'Collections',
};

const tabs = Object.keys(tabLabels) as LibraryTab[];

function isLibraryTab(value: string | null): value is LibraryTab {
  return Boolean(value && tabs.includes(value as LibraryTab));
}

function isRecent(rawDate: string): boolean {
  const timestamp = Date.parse(rawDate);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= 1000 * 60 * 60 * 24 * 30;
}

function matchesScore(score: number | null, scoreFilter: ScoreFilter): boolean {
  if (scoreFilter === 'all') return true;
  if (score === null) return false;
  if (scoreFilter === 'high') return score >= 70;
  return score < 55;
}

function scoreTone(score: number | null): string {
  if (score === null) return 'border-white/[0.08] bg-white/[0.04] text-slate-300';
  if (score >= 70) return 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100';
  if (score >= 55) return 'border-amber-300/18 bg-amber-300/10 text-amber-100';
  return 'border-red-300/18 bg-red-400/10 text-red-100';
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function applyTextFilter<T extends { searchText: string; rawDate: string; score?: number | null }>(
  items: T[],
  query: string,
  scoreFilter: ScoreFilter,
  dateFilter: DateFilter
): T[] {
  const cleanQuery = normalize(query);
  return items.filter((item) => {
    const queryOk = cleanQuery.length === 0 || item.searchText.includes(cleanQuery);
    const dateOk = dateFilter === 'all' || isRecent(item.rawDate);
    const scoreOk = matchesScore(item.score ?? null, scoreFilter);
    return queryOk && dateOk && scoreOk;
  });
}

function ButtonLink({ href, children, variant = 'secondary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  const styles = variant === 'primary'
    ? 'bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] text-white shadow-[0_18px_42px_-24px_rgba(139,92,246,0.95)] hover:brightness-110'
    : 'border border-white/[0.09] bg-white/[0.045] text-slate-100 hover:bg-white/[0.075]';

  return (
    <Link href={href} className={`inline-flex min-h-[42px] items-center justify-center rounded-[11px] px-4 text-[13px] font-black transition ${styles}`}>
      {children}
    </Link>
  );
}

function CopyButton({ value, label = 'Copier' }: { value: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      disabled={!value}
      onClick={copy}
      className="inline-flex min-h-[38px] items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.045] px-3 text-[12px] font-black text-slate-200 transition hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:text-slate-600"
    >
      {copied ? 'Copié' : label}
    </button>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <p className="mt-3 text-[27px] font-black tracking-[-0.05em] text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function EmptyState({ title, body, cta = true }: { title: string; body: string; cta?: boolean }) {
  return (
    <div className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5">
      <div className="space-y-3" aria-hidden="true">
        <div className="h-2.5 w-2/3 rounded-full bg-white/[0.08]" />
        <div className="h-2.5 w-full rounded-full bg-white/[0.055]" />
        <div className="h-2.5 w-4/5 rounded-full bg-white/[0.04]" />
      </div>
      <h3 className="mt-5 text-[16px] font-black tracking-[-0.02em] text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-6 text-slate-400">{body}</p>
      {cta ? (
        <div className="mt-4">
          <ButtonLink href="/dashboard/analyze" variant="primary">Analyser une vidéo</ButtonLink>
        </div>
      ) : null}
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.985))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5">
      <div>
        <h2 className="text-[21px] font-black tracking-[-0.04em] text-white">{title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-400">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AnalysisCards({ items }: { items: LibraryAnalysisItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Tu n’as pas encore d’analyse sauvegardée." body="Analyse une première vidéo pour sauvegarder ton diagnostic, tes hooks et ta V2 recommandée." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-black tracking-[-0.02em] text-white">{item.title}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${scoreTone(item.score)}`}>
                  {item.score === null ? 'Score —' : `${item.score}/100`}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-300">{item.verdict}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                <span>{item.date}</span>
                <span>{item.objective}</span>
                <span>{item.niche}</span>
                <span>{item.sourceLabel}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink href={item.href}>Voir l’analyse</ButtonLink>
              <ButtonLink href={`${item.href}#v2-recommandee`}>Préparer une V2</ButtonLink>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function HookCards({ items }: { items: LibraryHookItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Tes hooks sauvegardés apparaîtront ici après tes premières analyses." body="Viralynz rangera les hooks générés ou extraits de tes analyses quand ils existent réellement." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-black leading-6 text-white">"{item.hook}"</p>
              <p className="mt-2 text-[12px] leading-5 text-slate-400">{item.context}</p>
              <p className="mt-2 text-[11px] font-bold text-slate-500">{item.origin} · {item.sourceTitle} · {item.date}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <CopyButton value={item.hook} />
              <ButtonLink href={item.sourceHref}>Ouvrir</ButtonLink>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function V2Cards({ items }: { items: LibraryV2Item[] }) {
  if (items.length === 0) {
    return <EmptyState title="Les V2 recommandées apparaîtront ici après analyse." body="Aucune reconstruction ou structure V2 réelle n’est disponible pour le moment." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-black text-white">{item.title}</h3>
                <span className="rounded-full border border-violet-300/18 bg-violet-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-100">
                  {item.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-300">{item.summary}</p>
              <p className="mt-2 text-[11px] font-bold text-slate-500">{item.sourceTitle} · {item.date}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink href={item.sourceHref}>Voir l’analyse</ButtonLink>
              <CopyButton value={item.structureText} label="Copier la structure" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RepostCards({ items }: { items: LibraryRepostItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="Viralynz identifiera les contenus à republier quand tu auras plusieurs analyses." body="Aucune piste fiable de repost n’est disponible pour l’instant. Rien n’est inventé." />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[16px] font-black text-white">{item.title}</h3>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${scoreTone(item.score)}`}>
                  {item.score === null ? 'Signal' : `${item.score}/100`}
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">{item.reason}</p>
              <p className="mt-2 rounded-[13px] border border-cyan-300/12 bg-cyan-300/[0.055] px-3 py-2 text-[12px] font-bold leading-5 text-cyan-50">{item.action}</p>
              <p className="mt-2 text-[11px] font-bold text-slate-500">{item.date}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <ButtonLink href={item.sourceHref}>Voir l’analyse</ButtonLink>
              <ButtonLink href={`${item.sourceHref}#v2-recommandee`}>Préparer la V2</ButtonLink>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CollectionsPanel({ available }: { available: boolean }) {
  if (available) {
    return <EmptyState title="Aucune collection créée pour l’instant." body="Crée une collection pour regrouper tes analyses par angle, format ou série." cta={false} />;
  }

  const examples = ['Hooks à tester', 'V2 à republier', 'Formats facecam', 'Idées business'];

  return (
    <div className="rounded-[18px] border border-violet-300/12 bg-[linear-gradient(180deg,rgba(88,28,135,0.16),rgba(7,10,22,0.96))] p-5">
      <span className="inline-flex rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">
        Bientôt disponible
      </span>
      <h3 className="mt-4 text-[22px] font-black tracking-[-0.04em] text-white">Collections</h3>
      <p className="mt-2 text-[13px] leading-6 text-slate-400">
        Les collections te permettront de classer tes angles, formats et séries sans disperser ton travail Viralynz.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {examples.map((example) => (
          <span key={example} className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1.5 text-[11px] font-bold text-slate-300">
            {example}
          </span>
        ))}
      </div>
      <button disabled className="mt-5 inline-flex min-h-[42px] cursor-not-allowed items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.045] px-4 text-[13px] font-black text-slate-500">
        Créer une collection · Bientôt disponible
      </button>
    </div>
  );
}

export default function LibraryPageClient({
  initialTab,
  analysisItems,
  hookItems,
  v2Items,
  repostItems,
  collectionsAvailable,
}: LibraryPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useEffect(() => {
    const tab = searchParams?.get('tab') ?? null;
    setActiveTab(isLibraryTab(tab) ? tab : 'all');
  }, [searchParams]);

  function selectTab(tab: LibraryTab) {
    setActiveTab(tab);
    router.push(`/dashboard/library?tab=${tab}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const analyses = applyTextFilter(analysisItems, query, scoreFilter, dateFilter);
    const hooks = applyTextFilter(hookItems, query, scoreFilter, dateFilter);
    const v2 = applyTextFilter(v2Items, query, scoreFilter, dateFilter);
    const repost = applyTextFilter(repostItems, query, scoreFilter, dateFilter);

    return {
      analyses: typeFilter === 'all' || typeFilter === 'analysis' ? analyses : [],
      hooks: typeFilter === 'all' || typeFilter === 'hook' ? hooks : [],
      v2: typeFilter === 'all' || typeFilter === 'v2' ? v2 : [],
      repost: typeFilter === 'all' || typeFilter === 'repost' ? repost : [],
    };
  }, [analysisItems, hookItems, v2Items, repostItems, query, scoreFilter, dateFilter, typeFilter]);

  const hasAnyData = analysisItems.length + hookItems.length + v2Items.length + repostItems.length > 0;
  const hasFilteredData = filtered.analyses.length + filtered.hooks.length + filtered.v2.length + filtered.repost.length > 0;
  const showAll = activeTab === 'all';

  return (
    <section className="mx-auto w-full max-w-[1460px] pb-10 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(11,18,35,0.96),rgba(3,7,18,0.99)_56%,rgba(22,16,50,0.94))] p-5 shadow-[0_34px_116px_-78px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_10%,rgba(34,211,238,0.13),transparent_32%),radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.18),transparent_34%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-end">
          <div>
            <span className="inline-flex w-fit rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
              Library
            </span>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.055em] text-white sm:text-[52px]">Bibliothèque contenu</h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Retrouve tes analyses, hooks, V2 et contenus à republier au même endroit.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/dashboard/analyze" variant="primary">Analyser une vidéo</ButtonLink>
              <button disabled className="inline-flex min-h-[42px] cursor-not-allowed items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.04] px-4 text-[13px] font-black text-slate-500">
                Collections bientôt disponibles
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <MetricCard label="Analyses" value={String(analysisItems.length)} detail="Vidéos sauvegardées" />
            <MetricCard label="Hooks" value={String(hookItems.length)} detail="Générés ou extraits" />
            <MetricCard label="V2" value={v2Items.length > 0 ? String(v2Items.length) : '—'} detail={v2Items.length > 0 ? 'Structures disponibles' : 'À construire'} />
            <MetricCard label="À republier" value={repostItems.length > 0 ? String(repostItems.length) : '—'} detail={repostItems.length > 0 ? 'Signaux détectés' : 'À confirmer'} />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-white/[0.075] bg-white/[0.035] p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_150px_150px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une analyse, un hook ou une V2…"
            className="min-h-[44px] rounded-[13px] border border-white/[0.08] bg-black/25 px-4 text-[13px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/25"
          />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)} className="min-h-[44px] rounded-[13px] border border-white/[0.08] bg-black/25 px-3 text-[13px] font-bold text-slate-200 outline-none">
            <option value="all">Tous les types</option>
            <option value="analysis">Analyse</option>
            <option value="hook">Hook</option>
            <option value="v2">V2</option>
            <option value="repost">Repost</option>
          </select>
          <select value={scoreFilter} onChange={(event) => setScoreFilter(event.target.value as ScoreFilter)} className="min-h-[44px] rounded-[13px] border border-white/[0.08] bg-black/25 px-3 text-[13px] font-bold text-slate-200 outline-none">
            <option value="all">Tous scores</option>
            <option value="high">Score haut</option>
            <option value="low">Score faible</option>
          </select>
          <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)} className="min-h-[44px] rounded-[13px] border border-white/[0.08] bg-black/25 px-3 text-[13px] font-bold text-slate-200 outline-none">
            <option value="all">Toutes dates</option>
            <option value="recent">Date récente</option>
          </select>
        </div>

        <nav className="mt-3 flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectTab(tab)}
              className={`shrink-0 rounded-[12px] px-4 py-2.5 text-[12px] font-black transition ${
                activeTab === tab ? 'bg-white text-[#080d19]' : 'text-slate-400 hover:bg-white/[0.055] hover:text-white'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </nav>
      </div>

      {!hasAnyData ? (
        <div className="mt-5">
          <EmptyState
            title="Ta bibliothèque est prête à se remplir."
            body="Analyse une première vidéo pour sauvegarder ton diagnostic, tes hooks et ta V2 recommandée."
          />
        </div>
      ) : !hasFilteredData && activeTab !== 'collections' ? (
        <div className="mt-5">
          <EmptyState title="Aucun résultat pour cette recherche." body="Change le filtre ou lance une nouvelle analyse pour enrichir ta bibliothèque." />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            {(showAll || activeTab === 'analyses') && (
              <SectionCard title="Dernières analyses" description="Toutes les analyses sauvegardées dans ton historique Viralynz.">
                <AnalysisCards items={filtered.analyses} />
              </SectionCard>
            )}
            {(showAll || activeTab === 'hooks') && (
              <SectionCard title="Hooks récents" description="Hooks générés, favoris ou extraits de tes analyses réelles.">
                <HookCards items={filtered.hooks} />
              </SectionCard>
            )}
            {(showAll || activeTab === 'v2') && (
              <SectionCard title="V2 recommandées" description="Rewrites, reconstructions ou plans V2 réellement présents dans tes résultats.">
                <V2Cards items={filtered.v2} />
              </SectionCard>
            )}
            {(showAll || activeTab === 'repost') && (
              <SectionCard title="À republier" description="Analyses avec signal de repost ou action de V2 identifiable.">
                <RepostCards items={filtered.repost} />
              </SectionCard>
            )}
            {(showAll || activeTab === 'collections') && (
              <SectionCard title="Collections" description="La future sous-section pour classer tes angles, formats et séries.">
                <CollectionsPanel available={collectionsAvailable} />
              </SectionCard>
            )}
          </main>

          <aside className="space-y-5">
            <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(12,18,34,0.92),rgba(4,8,18,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <h2 className="text-[22px] font-black tracking-[-0.04em] text-white">Tout ton travail Viralynz au même endroit.</h2>
              <p className="mt-3 text-[13px] leading-6 text-slate-400">
                Chaque analyse peut devenir un hook, une V2 ou une piste à republier. La bibliothèque se construit uniquement avec tes vraies analyses.
              </p>
              <div className="mt-5 space-y-2.5">
                {['Analyses sauvegardées', 'Hooks générés', 'V2 existantes', 'Collections futures'].map((item) => (
                  <div key={item} className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 text-[12px] font-black text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-[22px] border border-cyan-300/12 bg-cyan-300/[0.045] p-5">
              <h2 className="text-[18px] font-black tracking-[-0.03em] text-white">Aucun contenu inventé</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">
                Si une catégorie est vide, Viralynz affiche un état vide. Pas de faux hooks, fausses V2 ou faux contenus à republier.
              </p>
              <div className="mt-5">
                <ButtonLink href="/dashboard/analyze" variant="primary">Analyser une vidéo</ButtonLink>
              </div>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
