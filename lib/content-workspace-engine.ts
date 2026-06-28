import type { RepostPriorityInput } from './repost-priority-engine';
import type { ContentOperatingSystem } from './content-operating-system';
import { isLifetimePlan } from './plans';
import type { Plan } from './supabase';

export type WorkspaceProjectStatus = 'active' | 'learning' | 'needs_repost';
export type WorkspaceExperimentType = 'hook_test' | 'intro_test' | 'cta_test' | 'structure_test';
export type WorkspaceRole = 'owner' | 'strategist' | 'creator' | 'editor' | 'client_viewer';
export type FeedType = 'pattern' | 'hook' | 'repost' | 'progress' | 'experiment' | 'team';

export interface ContentWorkspaceProject {
  id: string;
  name: string;
  niche: string;
  status: WorkspaceProjectStatus;
  videosCount: number;
  hooksCount: number;
  repostsCount: number;
  patternsCount: number;
  experimentsCount: number;
  progressionScore: number;
  memory: {
    summary: string;
    frequentHooks: string[];
    structures: string[];
    benchmarks: string[];
    recurringErrors: string[];
  };
  nextAction: string;
}

export interface WorkspaceExperiment {
  id: string;
  projectId: string;
  title: string;
  type: WorkspaceExperimentType;
  variants: Array<{
    id: string;
    label: string;
    score: number;
    status: 'winner' | 'testing' | 'candidate';
  }>;
  learning: string;
  nextAction: string;
}

export interface WorkspaceTeamRole {
  role: WorkspaceRole;
  label: string;
  focus: string;
  unlocked: boolean;
}

export interface ViralynzFeedItem {
  id: string;
  type: FeedType;
  title: string;
  body: string;
  projectName: string;
  confidence: number;
}

export interface ContentWorkspaceState {
  projects: ContentWorkspaceProject[];
  activeProject: ContentWorkspaceProject;
  experiments: WorkspaceExperiment[];
  teamRoles: WorkspaceTeamRole[];
  feed: ViralynzFeedItem[];
  summary: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));
}

function average(values: number[]) {
  const safe = values.filter((value) => Number.isFinite(value));
  if (!safe.length) return 0;
  return Math.round(safe.reduce((sum, value) => sum + value, 0) / safe.length);
}

function countTop(values: string[], limit: number) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'project';
}

function projectNameFor(niche: string, format: string) {
  const cleanNiche = niche || 'TikTok';
  if (cleanNiche.toLowerCase().includes('business')) return 'Business Motivation';
  if (cleanNiche.toLowerCase().includes('ugc')) return 'UGC Skincare';
  if (cleanNiche.toLowerCase().includes('fitness')) return 'Storytelling Fitness';
  if (cleanNiche.toLowerCase().includes('agency')) return 'TikTok Agency Client';
  return `${cleanNiche} ${format || 'Content'}`.trim();
}

function groupItems(items: RepostPriorityInput[]) {
  const groups = new Map<string, RepostPriorityInput[]>();
  for (const item of items) {
    const niche = item.result.analyzerMeta?.nicheLabel ?? item.result.analyzerMeta?.niche ?? 'TikTok';
    const format = item.result.coachAnalysis?.patternLabel ?? 'Short-form';
    const key = `${niche}::${format}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()];
}

function buildProject(key: string, groupItemsForProject: RepostPriorityInput[], contentOS: ContentOperatingSystem, index: number): ContentWorkspaceProject {
  const [niche, format] = key.split('::');
  const results = groupItemsForProject.map((item) => item.result);
  const hooks = countTop(results.flatMap((result) => [result.repostVersion?.hook, ...(result.coachAnalysis?.hookVariants ?? [])].filter(Boolean) as string[]), 4);
  const structures = countTop(results.flatMap((result) => result.repostVersion?.structure ?? result.coachAnalysis?.videoSegments?.map((segment) => segment.mainProblem) ?? []), 4);
  const recurringErrors = countTop(results.flatMap((result) => result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? result.hook.weaknesses), 4);
  const avgScore = average(results.map((result) => result.viralityScore));
  const avgHook = average(results.map((result) => result.hook.score));
  const avgRetention = average(results.map((result) => result.retention.score));
  const repostsCount = results.filter((result) => result.repostVersion || result.coachAnalysis?.repostEngine.recommended).length;
  const experimentsCount = contentOS.experiments.filter((experiment) => groupItemsForProject.some((item) => experiment.id.includes(item.id))).length || Math.min(3, Math.max(1, hooks.length));
  const progressionScore = clamp(avgScore * 0.35 + avgHook * 0.3 + avgRetention * 0.25 + Math.min(20, groupItemsForProject.length * 4));
  const name = projectNameFor(niche ?? 'TikTok', format ?? 'Short-form');
  const status: WorkspaceProjectStatus = groupItemsForProject.length < 2 ? 'learning' : repostsCount > 0 ? 'active' : 'needs_repost';

  return {
    id: `project_${slug(name)}_${index}`,
    name,
    niche: niche ?? 'TikTok',
    status,
    videosCount: groupItemsForProject.length,
    hooksCount: hooks.length,
    repostsCount,
    patternsCount: recurringErrors.length + structures.length,
    experimentsCount,
    progressionScore,
    memory: {
      summary: recurringErrors[0]
        ? `${recurringErrors[0]} revient dans ce projet. Viralynz garde ce contexte pour les prochains reposts.`
        : `Memoire en construction sur ${name}. Les prochains TikToks affineront hooks, rythme et CTA.`,
      frequentHooks: hooks.length ? hooks : ['Hook direct en calibration'],
      structures: structures.length ? structures : [format ?? 'Short-form'],
      benchmarks: [
        avgHook >= 70 ? 'Hooks deja assez clairs pour tester des variantes plus tendues.' : 'Hooks a rendre plus directs dans ce projet.',
        avgRetention >= 70 ? 'Structure retention stable sur les analyses recentes.' : 'Rythme et payoff a surveiller dans ce projet.',
      ],
      recurringErrors,
    },
    nextAction: repostsCount
      ? 'Preparer une variante repost et noter le retour createur.'
      : 'Creer un test hook + intro avant la prochaine publication.',
  };
}

function fallbackProject(): ContentWorkspaceProject {
  return {
    id: 'project_learning',
    name: 'Premier projet TikTok',
    niche: 'TikTok',
    status: 'learning',
    videosCount: 0,
    hooksCount: 0,
    repostsCount: 0,
    patternsCount: 0,
    experimentsCount: 0,
    progressionScore: 0,
    memory: {
      summary: 'Analyse une video pour creer automatiquement un projet avec sa memoire, ses hooks et ses patterns.',
      frequentHooks: ['En attente de hooks'],
      structures: ['En attente de structure'],
      benchmarks: ['Aucun benchmark sans donnees projet.'],
      recurringErrors: [],
    },
    nextAction: 'Uploader une video dans le workspace.',
  };
}

function buildWorkspaceExperiments(projects: ContentWorkspaceProject[], contentOS: ContentOperatingSystem): WorkspaceExperiment[] {
  const osExperiments = contentOS.experiments.slice(0, 5);
  if (osExperiments.length) {
    return osExperiments.map((experiment, index) => {
      const project = projects[index % projects.length] ?? fallbackProject();
      return {
        id: `workspace_${experiment.id}`,
        projectId: project.id,
        title: experiment.title,
        type: experiment.type,
        variants: experiment.variants.map((variant) => ({
          id: variant.id,
          label: variant.label,
          score: variant.score,
          status: variant.status === 'winner' ? 'winner' : variant.status === 'saved' ? 'testing' : 'candidate',
        })),
        learning: `Ce test alimente la memoire du projet ${project.name}.`,
        nextAction: experiment.nextAction,
      };
    });
  }

  return projects.slice(0, 3).map((project, index) => ({
    id: `experiment_${project.id}`,
    projectId: project.id,
    title: index === 0 ? 'Test hook preuve vs hook direct' : index === 1 ? 'Test intro courte vs contexte' : 'Test CTA question vs action',
    type: index === 0 ? 'hook_test' : index === 1 ? 'intro_test' : 'cta_test',
    variants: [
      { id: 'a', label: project.memory.frequentHooks[0] ?? 'Version directe', score: Math.max(42, project.progressionScore), status: 'testing' },
      { id: 'b', label: 'Version plus tendue', score: Math.max(38, project.progressionScore - 4), status: 'candidate' },
    ],
    learning: 'Le gagnant sera priorise dans les prochaines recommandations du projet.',
    nextAction: 'Publier une variante et ajouter un feedback apres repost.',
  }));
}

function buildTeamRoles(plan: Plan): WorkspaceTeamRole[] {
  const lifetime = isLifetimePlan(plan);
  return [
    { role: 'owner', label: 'Owner', focus: 'Priorites, projets, benchmarks et progression globale.', unlocked: true },
    { role: 'strategist', label: 'Strategist', focus: 'Choix des hooks, angles et experiments.', unlocked: lifetime },
    { role: 'creator', label: 'Créateur', focus: 'Hook, CTA et validation avant publication.', unlocked: lifetime },
    { role: 'editor', label: 'Editor', focus: 'Rythme, cuts, captions et pattern interrupts.', unlocked: lifetime },
    { role: 'client_viewer', label: 'Client viewer', focus: 'Vue agence: progression client sans details sensibles.', unlocked: lifetime },
  ];
}

function buildFeed(projects: ContentWorkspaceProject[], experiments: WorkspaceExperiment[]): ViralynzFeedItem[] {
  const active = projects[0] ?? fallbackProject();
  const feed: ViralynzFeedItem[] = [
    {
      id: 'feed_pattern',
      type: 'pattern',
      title: active.memory.recurringErrors[0] ? 'Nouveau pattern detecte' : 'Memoire projet en apprentissage',
      body: active.memory.recurringErrors[0] ?? active.memory.summary,
      projectName: active.name,
      confidence: active.patternsCount ? clamp(48 + active.patternsCount * 7) : 42,
    },
    {
      id: 'feed_hook',
      type: 'hook',
      title: 'Hook performant identifie',
      body: active.memory.frequentHooks[0] ?? 'Aucun hook gagnant sans analyse supplementaire.',
      projectName: active.name,
      confidence: active.hooksCount ? clamp(52 + active.hooksCount * 8) : 38,
    },
    {
      id: 'feed_repost',
      type: 'repost',
      title: active.repostsCount ? 'Repost ameliore pret' : 'Repost a preparer',
      body: active.nextAction,
      projectName: active.name,
      confidence: active.repostsCount ? 74 : 46,
    },
    {
      id: 'feed_progress',
      type: 'progress',
      title: 'Progression projet',
      body: `${active.progressionScore}/100 sur qualite hook, retention et structure.`,
      projectName: active.name,
      confidence: active.videosCount ? 68 : 35,
    },
  ];

  if (experiments[0]) {
    feed.push({
      id: 'feed_experiment',
      type: 'experiment',
      title: 'Experiment a lancer',
      body: experiments[0].nextAction,
      projectName: active.name,
      confidence: 62,
    });
  }

  return feed;
}

export function buildContentWorkspace(items: RepostPriorityInput[], contentOS: ContentOperatingSystem, plan: Plan): ContentWorkspaceState {
  const projects = groupItems(items).map(([key, grouped], index) => buildProject(key, grouped, contentOS, index));
  const safeProjects = projects.length ? projects.sort((a, b) => b.progressionScore - a.progressionScore) : [fallbackProject()];
  const experiments = buildWorkspaceExperiments(safeProjects, contentOS);
  const activeProject = safeProjects[0];
  return {
    projects: safeProjects,
    activeProject,
    experiments,
    teamRoles: buildTeamRoles(plan),
    feed: buildFeed(safeProjects, experiments),
    summary: activeProject.videosCount
      ? `${safeProjects.length} projet${safeProjects.length > 1 ? 's' : ''} actif${safeProjects.length > 1 ? 's' : ''}. Viralynz organise analyses, hooks, reposts et experiments par contexte.`
      : 'Le workspace se construit automatiquement a partir des premieres analyses.',
  };
}
