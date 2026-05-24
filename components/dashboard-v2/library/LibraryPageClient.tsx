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

type LibraryContentKind = 'analysis' | 'hook' | 'v2' | 'repost';

type UnifiedLibraryItem = {
  id: string;
  kind: LibraryContentKind;
  title: string;
  description: string;
  meta: string;
  href: string;
  score: number | null;
  rawDate: string;
  badge: string;
  signal: string;
  action: string;
  searchText: string;
};

function averageScore(items: LibraryAnalysisItem[]): number | null {
  const scores = items.map((item) => item.score).filter((score): score is number => typeof score === 'number');
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function kindTone(kind: LibraryContentKind): string {
  if (kind === 'repost') return 'border-fuchsia-300/18 bg-fuchsia-400/10 text-fuchsia-100';
  if (kind === 'v2') return 'border-violet-300/18 bg-violet-400/10 text-violet-100';
  if (kind === 'hook') return 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100';
  return 'border-white/[0.09] bg-white/[0.045] text-slate-200';
}

function contentThumbnailTone(kind: LibraryContentKind): string {
  if (kind === 'repost') return 'from-fuchsia-500/34 via-violet-500/20 to-[#06101d]';
  if (kind === 'v2') return 'from-violet-500/34 via-blue-500/18 to-[#06101d]';
  if (kind === 'hook') return 'from-cyan-500/28 via-violet-500/18 to-[#06101d]';
  return 'from-violet-500/24 via-fuchsia-500/14 to-[#06101d]';
}

function buildUnifiedItems(
  analyses: LibraryAnalysisItem[],
  hooks: LibraryHookItem[],
  v2: LibraryV2Item[],
  repost: LibraryRepostItem[]
): UnifiedLibraryItem[] {
  const analysisList: UnifiedLibraryItem[] = analyses.map((item) => ({
    id: `analysis-${item.id}`,
    kind: 'analysis',
    title: item.title,
    description: item.verdict,
    meta: `${item.date} · ${item.sourceLabel}`,
    href: item.href,
    score: item.score,
    rawDate: item.rawDate,
    badge: 'Analysée',
    signal: item.score !== null && item.score < 55 ? 'Hook à renforcer' : 'Diagnostic prêt',
    action: 'Ouvrir',
    searchText: item.searchText,
  }));

  const hookList: UnifiedLibraryItem[] = hooks.map((item) => ({
    id: `hook-${item.id}`,
    kind: 'hook',
    title: item.hook,
    description: item.context,
    meta: `${item.origin} · ${item.date}`,
    href: item.sourceHref,
    score: null,
    rawDate: item.rawDate,
    badge: 'Hook',
    signal: item.sourceTitle,
    action: 'Ouvrir',
    searchText: item.searchText,
  }));

  const v2List: UnifiedLibraryItem[] = v2.map((item) => ({
    id: `v2-${item.id}`,
    kind: 'v2',
    title: item.sourceTitle,
    description: item.summary,
    meta: `${item.title} · ${item.date}`,
    href: item.sourceHref,
    score: item.score,
    rawDate: item.rawDate,
    badge: item.status === 'prête' ? 'V2 prête' : item.status,
    signal: 'Version à retravailler',
    action: 'Voir la V2',
    searchText: item.searchText,
  }));

  const repostList: UnifiedLibraryItem[] = repost.map((item) => ({
    id: `repost-${item.id}`,
    kind: 'repost',
    title: item.title,
    description: item.reason,
    meta: `${item.date}`,
    href: item.sourceHref,
    score: item.score,
    rawDate: item.rawDate,
    badge: 'À republier',
    signal: item.action,
    action: 'Préparer',
    searchText: item.searchText,
  }));

  return [...repostList, ...v2List, ...analysisList, ...hookList].sort((a, b) => Date.parse(b.rawDate) - Date.parse(a.rawDate));
}

function buildPriorityItems(unifiedItems: UnifiedLibraryItem[]): UnifiedLibraryItem[] {
  const priority = [
    ...unifiedItems.filter((item) => item.kind === 'repost'),
    ...unifiedItems.filter((item) => item.kind === 'v2'),
    ...unifiedItems.filter((item) => item.kind === 'analysis' && item.score !== null && item.score < 55),
    ...unifiedItems.filter((item) => item.score !== null && item.score >= 70),
  ];

  const unique: UnifiedLibraryItem[] = [];
  priority.forEach((item) => {
    if (!unique.some((current) => current.id === item.id)) unique.push(item);
  });
  return unique.slice(0, 3);
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function MobileFilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full border px-3 text-[12px] font-black transition ${
        active
          ? 'border-violet-200/20 bg-[linear-gradient(135deg,rgba(232,121,249,0.22),rgba(139,92,246,0.22),rgba(34,211,238,0.12))] text-white shadow-[0_10px_30px_-20px_rgba(139,92,246,0.9)]'
          : 'border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.07] hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function MobileLibraryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[15px] border border-white/[0.075] bg-white/[0.04] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-[21px] font-black leading-none tracking-[-0.05em] text-white">{value}</p>
    </div>
  );
}

function MobilePriorityCard({ item }: { item: UnifiedLibraryItem }) {
  return (
    <article className="rounded-[18px] border border-violet-200/[0.13] bg-[linear-gradient(145deg,rgba(30,20,62,0.78),rgba(6,12,25,0.95))] p-3 shadow-[0_16px_44px_-32px_rgba(124,58,237,0.9)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-fuchsia-200/16 bg-fuchsia-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.13em] text-fuchsia-100">Priorité</span>
          <h3 className="mt-2 line-clamp-1 text-[14px] font-black leading-5 text-white">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-[12px] leading-4 text-slate-400">{item.signal}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-black ${scoreTone(item.score)}`}>
          {item.score === null ? 'Signal' : `${item.score}/100`}
        </span>
      </div>
      <Link href={item.href} className="mt-3 inline-flex h-8 items-center rounded-[10px] border border-white/[0.08] bg-white/[0.055] px-3 text-[11px] font-black text-white">
        {item.action}
      </Link>
    </article>
  );
}

function MobileContentRow({ item }: { item: UnifiedLibraryItem }) {
  return (
    <Link
      href={item.href}
      className="group flex gap-3 rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-3 transition hover:border-violet-200/18 hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-violet-300/25"
    >
      <div className={`relative h-[74px] w-[58px] shrink-0 overflow-hidden rounded-[13px] border border-white/[0.08] bg-gradient-to-br ${contentThumbnailTone(item.kind)}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_18%,rgba(255,255,255,0.2),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.36))]" />
        <div className="absolute inset-x-2 bottom-2 h-1 rounded-full bg-white/20" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[13.5px] font-black leading-5 text-white">{item.title}</h3>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10.5px] font-black ${scoreTone(item.score)}`}>
            {item.score === null ? '—' : `${item.score}`}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-bold text-slate-500">{item.meta}</p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.09em] ${kindTone(item.kind)}`}>{item.badge}</span>
          <span className="min-w-0 truncate rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[10px] font-bold text-slate-400">{item.signal}</span>
        </div>
      </div>
    </Link>
  );
}

function MobileLibraryEmpty({ hasAnyData }: { hasAnyData: boolean }) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(12,19,36,0.92),rgba(4,8,18,0.98))] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
      <h2 className="text-[20px] font-black tracking-[-0.04em] text-white">{hasAnyData ? 'Aucun contenu trouvé' : 'Ta bibliothèque est vide'}</h2>
      <p className="mx-auto mt-2 max-w-[310px] text-[13px] leading-6 text-slate-400">
        {hasAnyData
          ? 'Change la recherche ou les filtres pour retrouver tes contenus.'
          : 'Analyse ta première vidéo pour créer tes premiers insights, hooks et recommandations de repost.'}
      </p>
      <div className="mt-4 flex justify-center">
        <ButtonLink href="/dashboard/analyze" variant="primary">Analyser une vidéo</ButtonLink>
      </div>
    </section>
  );
}

function MobileLibraryView({
  query,
  setQuery,
  activeTab,
  selectQuickFilter,
  scoreFilter,
  dateFilter,
  hasAnyData,
  hasFilteredData,
  analysisItems,
  hookItems,
  v2Items,
  repostItems,
  unifiedItems,
}: {
  query: string;
  setQuery: (value: string) => void;
  activeTab: LibraryTab;
  selectQuickFilter: (filter: 'all' | 'repost' | 'top' | 'hook' | 'v2' | 'low' | 'recent') => void;
  scoreFilter: ScoreFilter;
  dateFilter: DateFilter;
  hasAnyData: boolean;
  hasFilteredData: boolean;
  analysisItems: LibraryAnalysisItem[];
  hookItems: LibraryHookItem[];
  v2Items: LibraryV2Item[];
  repostItems: LibraryRepostItem[];
  unifiedItems: UnifiedLibraryItem[];
}) {
  const [visibleCount, setVisibleCount] = useState(8);

  useEffect(() => {
    setVisibleCount(8);
  }, [query, activeTab, scoreFilter, dateFilter, unifiedItems.length]);

  const avg = averageScore(analysisItems);
  const priorities = buildPriorityItems(unifiedItems);
  const visibleItems = unifiedItems.slice(0, visibleCount);
  const canLoadMore = visibleCount < unifiedItems.length;

  return (
    <div className="grid gap-3 min-[1280px]:hidden">
      <section className="relative overflow-hidden rounded-[22px] border border-violet-200/[0.13] bg-[linear-gradient(145deg,rgba(15,22,42,0.9),rgba(4,8,18,0.98)_58%,rgba(20,13,45,0.92))] p-4 shadow-[0_22px_60px_-42px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.2),transparent_36%),radial-gradient(circle_at_88%_8%,rgba(34,211,238,0.11),transparent_32%)]" />
        <div className="relative">
          <span className="inline-flex rounded-full border border-cyan-300/18 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100">Contenu analysé</span>
          <h1 className="mt-3 text-[30px] font-black leading-none tracking-[-0.06em] text-white">Bibliothèque</h1>
          <p className="mt-2 max-w-[330px] text-[13px] leading-5 text-slate-300">Retrouve tes vidéos analysées, tes V2, tes hooks et les contenus à republier.</p>
          <div className="mt-4">
            <ButtonLink href="/dashboard/analyze" variant="primary">Analyser une vidéo</ButtonLink>
          </div>
        </div>
      </section>

      <section className="sticky top-[66px] z-30 -mx-3 border-y border-white/[0.055] bg-[#020611]/88 px-3 py-3 backdrop-blur-xl">
        <label className="sr-only" htmlFor="library-mobile-search">Rechercher dans la bibliothèque</label>
        <div className="relative">
          <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            <SearchIcon />
          </div>
          <input
            id="library-mobile-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une vidéo, un hook, une V2…"
            className="h-12 w-full rounded-[15px] border border-white/[0.085] bg-white/[0.045] pl-10 pr-4 text-[13px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/10"
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MobileFilterChip active={activeTab === 'all' && scoreFilter === 'all' && dateFilter === 'all'} onClick={() => selectQuickFilter('all')}>Tous</MobileFilterChip>
          <MobileFilterChip active={activeTab === 'repost'} onClick={() => selectQuickFilter('repost')}>À republier</MobileFilterChip>
          <MobileFilterChip active={scoreFilter === 'high'} onClick={() => selectQuickFilter('top')}>Top perf</MobileFilterChip>
          <MobileFilterChip active={activeTab === 'hooks'} onClick={() => selectQuickFilter('hook')}>Hooks</MobileFilterChip>
          <MobileFilterChip active={activeTab === 'v2'} onClick={() => selectQuickFilter('v2')}>V2</MobileFilterChip>
          <MobileFilterChip active={scoreFilter === 'low'} onClick={() => selectQuickFilter('low')}>À améliorer</MobileFilterChip>
          <MobileFilterChip active={dateFilter === 'recent'} onClick={() => selectQuickFilter('recent')}>Récents</MobileFilterChip>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <MobileLibraryMetric label="Analyses" value={String(analysisItems.length)} />
        <MobileLibraryMetric label="V2 prêtes" value={String(v2Items.filter((item) => item.status === 'prête').length)} />
        <MobileLibraryMetric label="À republier" value={String(repostItems.length)} />
        <MobileLibraryMetric label="Score moyen" value={avg === null ? '—' : `${avg}/100`} />
      </section>

      {!hasAnyData || (!hasFilteredData && activeTab !== 'collections') ? (
        <MobileLibraryEmpty hasAnyData={hasAnyData} />
      ) : (
        <>
          {priorities.length > 0 ? (
            <section className="grid gap-2.5">
              <div>
                <h2 className="text-[17px] font-black tracking-[-0.03em] text-white">À traiter en priorité</h2>
                <p className="mt-1 text-[12px] text-slate-500">Les contenus avec le meilleur potentiel d’action.</p>
              </div>
              {priorities.map((item) => <MobilePriorityCard key={item.id} item={item} />)}
            </section>
          ) : null}

          <section className="grid gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-black tracking-[-0.03em] text-white">Tous les contenus</h2>
                <p className="mt-1 text-[12px] text-slate-500">{unifiedItems.length} élément{unifiedItems.length > 1 ? 's' : ''} filtré{unifiedItems.length > 1 ? 's' : ''}</p>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400">Plus récents</span>
            </div>
            {visibleItems.map((item) => <MobileContentRow key={item.id} item={item} />)}
            {canLoadMore ? (
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 8)}
                className="h-11 rounded-[14px] border border-white/[0.085] bg-white/[0.045] text-[13px] font-black text-white transition hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-violet-300/25"
              >
                Charger plus
              </button>
            ) : null}
          </section>

          <section className="rounded-[20px] border border-white/[0.075] bg-white/[0.035] p-4">
            <h2 className="text-[16px] font-black text-white">Modules secondaires</h2>
            <div className="mt-3 grid gap-2">
              {['Collections', 'Archives', 'Tags avancés'].map((item) => (
                <div key={item} className="flex h-10 items-center justify-between rounded-[12px] border border-white/[0.065] bg-white/[0.035] px-3">
                  <span className="text-[12px] font-bold text-slate-300">{item}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Bientôt</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
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

  function selectQuickFilter(filter: 'all' | 'repost' | 'top' | 'hook' | 'v2' | 'low' | 'recent') {
    if (filter === 'all') {
      setTypeFilter('all');
      setScoreFilter('all');
      setDateFilter('all');
      selectTab('all');
      return;
    }

    setScoreFilter(filter === 'top' ? 'high' : filter === 'low' ? 'low' : 'all');
    setDateFilter(filter === 'recent' ? 'recent' : 'all');

    if (filter === 'repost') {
      setTypeFilter('repost');
      selectTab('repost');
      return;
    }
    if (filter === 'hook') {
      setTypeFilter('hook');
      selectTab('hooks');
      return;
    }
    if (filter === 'v2') {
      setTypeFilter('v2');
      selectTab('v2');
      return;
    }

    setTypeFilter('all');
    selectTab('all');
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

  const unifiedItems = useMemo(
    () => buildUnifiedItems(filtered.analyses, filtered.hooks, filtered.v2, filtered.repost),
    [filtered.analyses, filtered.hooks, filtered.v2, filtered.repost]
  );
  const hasAnyData = analysisItems.length + hookItems.length + v2Items.length + repostItems.length > 0;
  const hasFilteredData = filtered.analyses.length + filtered.hooks.length + filtered.v2.length + filtered.repost.length > 0;
  const showAll = activeTab === 'all';

  return (
    <section className="mx-auto w-full max-w-[1460px] pb-10 pt-4 text-white">
      <MobileLibraryView
        query={query}
        setQuery={setQuery}
        activeTab={activeTab}
        selectQuickFilter={selectQuickFilter}
        scoreFilter={scoreFilter}
        dateFilter={dateFilter}
        hasAnyData={hasAnyData}
        hasFilteredData={hasFilteredData}
        analysisItems={analysisItems}
        hookItems={hookItems}
        v2Items={v2Items}
        repostItems={repostItems}
        unifiedItems={unifiedItems}
      />
      <div className="hidden min-[1280px]:block">
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
      </div>
    </section>
  );
}
