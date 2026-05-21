import { redirect } from 'next/navigation';
import LibraryPageClient, {
  type LibraryAnalysisItem,
  type LibraryHookItem,
  type LibraryRepostItem,
  type LibraryTab,
  type LibraryV2Item,
} from '@/components/dashboard-v2/library/LibraryPageClient';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getAnalyses, type AnalysisRow } from '@/lib/analyses';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { AnalysisResult, RepostVersion } from '@/lib/types';

export const dynamic = 'force-dynamic';

type HookHistoryRow = {
  id: string;
  hook_text: string;
  tone: string | null;
  scene: string | null;
  is_favorite: boolean | null;
  variant_of: string | null;
  created_at: string;
};

type LibraryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const tabs: LibraryTab[] = ['all', 'analyses', 'hooks', 'v2', 'repost', 'collections'];

function normalizeTab(value: string | string[] | undefined): LibraryTab {
  const raw = Array.isArray(value) ? value[0] : value;
  return tabs.includes(raw as LibraryTab) ? (raw as LibraryTab) : 'all';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function safeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function compactUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return value || 'Source non disponible';
  }
}

function scoreFromResult(result: AnalysisResult): number | null {
  const value = result.coachAnalysis?.weightedScore ?? result.viralityScore;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getAnalysisTitle(row: AnalysisRow): string {
  const result = row.result;
  return (
    safeText(result.detectedVideoMeta?.caption)
    || safeText(result.analyzerMeta?.fileName)
    || safeText(result.coachAnalysis?.shareables?.screenshotTitle)
    || safeText(result.finalVerdict)?.split('.')[0]?.trim()
    || 'Analyse TikTok'
  );
}

function getVerdict(result: AnalysisResult): string {
  return safeText(result.coachAnalysis?.verdict) || safeText(result.finalVerdict) || 'Diagnostic sauvegardé dans Viralynz.';
}

function getObjective(result: AnalysisResult): string {
  return safeText(result.analyzerMeta?.objectiveLabel) || safeText(result.analyzerMeta?.objective) || 'Objectif non renseigné';
}

function getNiche(result: AnalysisResult): string {
  return safeText(result.analyzerMeta?.nicheLabel) || safeText(result.analyzerMeta?.niche) || 'Niche non renseignée';
}

function createSearchText(values: Array<string | number | null | undefined>): string {
  return values.filter((value) => value !== null && value !== undefined).join(' ').toLowerCase();
}

function mapAnalyses(rows: AnalysisRow[]): LibraryAnalysisItem[] {
  return rows.map((row) => {
    const title = getAnalysisTitle(row);
    const score = scoreFromResult(row.result);
    const verdict = getVerdict(row.result);
    const objective = getObjective(row.result);
    const niche = getNiche(row.result);

    return {
      id: row.id,
      title,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      score,
      verdict,
      objective,
      niche,
      videoUrl: row.video_url,
      sourceLabel: compactUrl(row.video_url),
      href: `/analyses/${row.id}`,
      searchText: createSearchText([title, verdict, objective, niche, row.video_url, score]),
    };
  });
}

function uniquePush<T extends { textKey: string }>(items: T[], item: T) {
  if (!items.some((current) => current.textKey === item.textKey)) items.push(item);
}

function hooksFromAnalysis(row: AnalysisRow): LibraryHookItem[] {
  const result = row.result;
  const sourceTitle = getAnalysisTitle(row);
  const sourceHref = `/analyses/${row.id}`;
  const items: LibraryHookItem[] = [];
  const candidates: Array<{ hook: string; context: string }> = [];

  result.coachAnalysis?.hookVariants?.forEach((hook) => candidates.push({ hook, context: 'Hook alternatif issu de l’analyse' }));
  result.repostVersion?.hookVariants?.forEach((hook) => candidates.push({ hook, context: 'Variante de V2' }));
  if (result.repostVersion?.hook) candidates.push({ hook: result.repostVersion.hook, context: 'Hook de la V2 recommandée' });
  result.reconstructionIA?.alternativeHooks?.forEach((item) => candidates.push({ hook: item.hook, context: item.why || item.bestFor || 'Hook de reconstruction IA' }));
  if (result.coachAnalysis?.shareables?.correctedHookSnippet) {
    candidates.push({ hook: result.coachAnalysis.shareables.correctedHookSnippet, context: 'Correction du hook' });
  }

  candidates.forEach((candidate, index) => {
    const hook = safeText(candidate.hook);
    if (!hook) return;
    uniquePush(items, {
      id: `${row.id}-analysis-hook-${index}`,
      hook,
      context: candidate.context,
      sourceTitle,
      sourceHref,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      origin: 'Analyse',
      textKey: hook.toLowerCase(),
      searchText: createSearchText([hook, candidate.context, sourceTitle]),
    });
  });

  return items;
}

function mapHooks(rows: AnalysisRow[], hookRows: HookHistoryRow[]): LibraryHookItem[] {
  const items: LibraryHookItem[] = [];

  hookRows.forEach((hookRow) => {
    const hook = safeText(hookRow.hook_text);
    if (!hook) return;
    uniquePush(items, {
      id: hookRow.id,
      hook,
      context: hookRow.scene || hookRow.tone || 'Hook généré dans Viralynz',
      sourceTitle: hookRow.is_favorite ? 'Hook favori' : 'Générateur de hooks',
      sourceHref: '/dashboard/hooks',
      date: formatDate(hookRow.created_at),
      rawDate: hookRow.created_at,
      origin: hookRow.is_favorite ? 'Favori' : 'Générateur',
      textKey: hook.toLowerCase(),
      searchText: createSearchText([hook, hookRow.scene, hookRow.tone, hookRow.variant_of]),
    });
  });

  rows.flatMap(hooksFromAnalysis).forEach((item) => uniquePush(items, item));
  return items.sort((a, b) => Date.parse(b.rawDate) - Date.parse(a.rawDate));
}

function summarizeRepostVersion(version: RepostVersion): string {
  return safeText(version.angle)
    || safeText(version.structure?.[0])
    || safeText(version.shortVersion)
    || 'Structure V2 enregistrée.';
}

function v2FromAnalysis(row: AnalysisRow): LibraryV2Item[] {
  const result = row.result;
  const sourceTitle = getAnalysisTitle(row);
  const sourceHref = `/analyses/${row.id}`;
  const items: LibraryV2Item[] = [];

  if (result.repostVersion) {
    const structure = [
      result.repostVersion.hook,
      ...result.repostVersion.structure,
      ...result.repostVersion.onScreenText,
      result.repostVersion.cta,
    ].filter(Boolean).join('\n');

    items.push({
      id: `${row.id}-repost-version`,
      title: 'V2 recommandée',
      summary: summarizeRepostVersion(result.repostVersion),
      structureText: structure || null,
      sourceTitle,
      sourceHref,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      status: 'prête',
      score: scoreFromResult(result),
      searchText: createSearchText([sourceTitle, result.repostVersion.hook, result.repostVersion.angle, structure]),
    });
  }

  const reconstruction = row.reconstruction ?? result.reconstructionIA ?? null;
  if (reconstruction) {
    const steps = reconstruction.optimizedStructure?.map((step) => `${step.start}-${step.end} · ${step.goal}: ${step.recommendation}`) ?? [];
    items.push({
      id: `${row.id}-reconstruction`,
      title: 'Reconstruction IA',
      summary: safeText(reconstruction.whyThisStructureWorks?.changeJustification) || safeText(steps[0]) || 'Structure complète attachée à l’analyse.',
      structureText: steps.length > 0 ? steps.join('\n') : null,
      sourceTitle,
      sourceHref,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      status: 'prête',
      score: scoreFromResult(result),
      searchText: createSearchText([sourceTitle, reconstruction.aiReasoning?.join(' '), steps.join(' ')]),
    });
  }

  if (items.length === 0 && result.actionPlan && result.actionPlan.length > 0) {
    items.push({
      id: `${row.id}-action-plan`,
      title: 'Plan de V2 partiel',
      summary: result.actionPlan[0] || 'Plan d’action disponible dans l’analyse.',
      structureText: result.actionPlan.join('\n'),
      sourceTitle,
      sourceHref,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      status: 'partielle',
      score: scoreFromResult(result),
      searchText: createSearchText([sourceTitle, result.actionPlan.join(' ')]),
    });
  }

  if (items.length === 0 && result.reconstructionAccess?.status === 'locked') {
    items.push({
      id: `${row.id}-locked-v2`,
      title: 'Reconstruction IA',
      summary: result.reconstructionAccess.message || 'Reconstruction complète non disponible sur ce plan.',
      structureText: null,
      sourceTitle,
      sourceHref,
      date: formatDate(row.created_at),
      rawDate: row.created_at,
      status: 'pro requis',
      score: scoreFromResult(result),
      searchText: createSearchText([sourceTitle, result.reconstructionAccess.message, 'pro requis']),
    });
  }

  return items;
}

function mapV2(rows: AnalysisRow[]): LibraryV2Item[] {
  return rows.flatMap(v2FromAnalysis).sort((a, b) => Date.parse(b.rawDate) - Date.parse(a.rawDate));
}

function repostFromAnalysis(row: AnalysisRow): LibraryRepostItem | null {
  const result = row.result;
  const repostEngine = result.coachAnalysis?.repostEngine;
  const score = scoreFromResult(result);
  const priorityAction = result.coachAnalysis?.priorityActions?.critical?.[0]
    || result.coachAnalysis?.priorityActions?.important?.[0]
    || result.comparativePriority
    || result.improvements?.[0]?.tip;
  const reason = repostEngine?.bestOpportunity?.why
    || repostEngine?.dominantFailure?.cause
    || safeText(result.finalVerdict)
    || null;
  const action = repostEngine?.bestOpportunity?.action
    || priorityAction
    || result.actionPlan?.[0]
    || null;
  const hasReliableSignal = Boolean(repostEngine?.recommended || repostEngine?.bestOpportunity || reason || action);

  if (!hasReliableSignal) return null;

  const title = getAnalysisTitle(row);
  return {
    id: row.id,
    title,
    reason: reason || 'Signal de repost présent dans l’analyse.',
    action: action || 'Ouvre l’analyse pour préparer la V2.',
    sourceHref: `/analyses/${row.id}`,
    date: formatDate(row.created_at),
    rawDate: row.created_at,
    score,
    searchText: createSearchText([title, reason, action, score]),
  };
}

function mapRepost(rows: AnalysisRow[]): LibraryRepostItem[] {
  return rows
    .map(repostFromAnalysis)
    .filter((item): item is LibraryRepostItem => Boolean(item))
    .sort((a, b) => Date.parse(b.rawDate) - Date.parse(a.rawDate));
}

async function getHookHistory(userId: string): Promise<HookHistoryRow[]> {
  const { data, error } = await supabase
    .from('hooks_history')
    .select('id, hook_text, tone, scene, is_favorite, variant_of, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) {
    console.error('[dashboard/library] hooks_history failed:', error.message);
    return [];
  }

  return (data ?? []) as HookHistoryRow[];
}

export default async function DashboardLibraryPage({ searchParams }: LibraryPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/library');
  }

  const params = await searchParams;
  const activeTab = normalizeTab(params?.tab);
  const profile = await getUserById(session.userId);
  const plan = profile ? getEffectivePlan(profile) : 'free';
  const [analyses, hookRows] = await Promise.all([
    getAnalyses(session.userId, plan),
    getHookHistory(session.userId),
  ]);

  const analysisItems = mapAnalyses(analyses);
  const hookItems = mapHooks(analyses, hookRows);
  const v2Items = mapV2(analyses);
  const repostItems = mapRepost(analyses);

  return (
    <LibraryPageClient
      initialTab={activeTab}
      analysisItems={analysisItems}
      hookItems={hookItems}
      v2Items={v2Items}
      repostItems={repostItems}
      collectionsAvailable={false}
    />
  );
}
