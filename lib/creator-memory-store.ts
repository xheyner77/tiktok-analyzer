import { supabase, type Plan } from './supabase';
import type { AnalysisResult, RepostVersion, StructuredDiagnostic } from './types';
import { getCreatorMemoryLimit, CREATOR_MEMORY_DEPTH } from './plan-limits';
import { buildCreatorMemory, type CreatorMemory } from './creator-memory-engine';
import type { RepostPriorityInput } from './repost-priority-engine';
import { buildTikTokGraphRecord } from './tiktok-graph-engine';
import { getRecommendationLearningContext } from './repost-feedback-engine';

export interface VideoAnalysisSnapshot {
  videoId: string;
  userId: string;
  createdAt: string;
  plan: Plan;
  niche?: string;
  objective?: string;
  duration?: number;
  transcript?: string;
  detectedHook?: string;
  detectedCTA?: string;
  detectedPayoff?: string;
  weakMoments: StructuredDiagnostic[];
  dropMoments: StructuredDiagnostic[];
  rhythmIssues: StructuredDiagnostic[];
  retentionRisks: StructuredDiagnostic[];
  score: number;
  verdict: string;
  recommendations: string[];
  repostVersion?: RepostVersion;
  hooksSuggestions: string[];
  creatorMemoryUsed?: string;
  confidenceScore: number;
  source: 'vision_upload' | 'url';
}

export interface StoredCreatorMemory {
  userId: string;
  plan: Plan;
  memory: CreatorMemory;
  summary: string;
  promptContext: string;
  sourceAnalysisCount: number;
  updatedAt: string;
}

function clampConfidence(value: number) {
  return Math.max(0.05, Math.min(1, Math.round(value * 100) / 100));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function firstText(values: Array<string | undefined>) {
  return values.find((value) => value && value.trim())?.trim();
}

function slugifyProject(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'project';
}

function anonymizedHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function diagnosticsFromResult(result: AnalysisResult): StructuredDiagnostic[] {
  if (result.structuredDiagnostics?.length) return result.structuredDiagnostics;
  const fromCoach = result.coachAnalysis?.detectedProblems?.map((item) => ({
    title: item.title,
    explanation: item.explanation,
    timestamp: item.timecode,
    evidence: item.impact,
    impact: item.impact,
    fix: item.action,
    confidence: item.severity === 'critique' ? 0.82 : item.severity === 'important' ? 0.7 : 0.58,
  })) ?? [];
  if (fromCoach.length) return fromCoach;
  return [
    {
      title: 'Hook a clarifier',
      explanation: result.hook.weaknesses?.[0] ?? result.hook.analysis,
      timestamp: '0:00-0:03',
      evidence: result.videoIntelligence?.transcript.text ? 'Base sur la transcription et le diagnostic hook.' : 'Base sur les signaux disponibles, confiance limitee.',
      impact: 'Le viewer peut comprendre le sujet avant de comprendre pourquoi rester.',
      fix: result.improvements?.[0]?.tip ?? 'Avancer la promesse ou la preuve dans les deux premieres secondes.',
      confidence: result.videoIntelligence?.confidence.score ? clampConfidence(result.videoIntelligence.confidence.score / 100) : 0.52,
    },
  ];
}

function filterDiagnostics(items: StructuredDiagnostic[], terms: string[]) {
  const lowerTerms = terms.map((term) => term.toLowerCase());
  return items.filter((item) => {
    const haystack = `${item.title} ${item.explanation} ${item.evidence} ${item.impact} ${item.fix}`.toLowerCase();
    return lowerTerms.some((term) => haystack.includes(term));
  });
}

function buildMemoryPrompt(memory: CreatorMemory, snapshots: VideoAnalysisSnapshot[], plan: Plan) {
  const depth = CREATOR_MEMORY_DEPTH[plan] ?? CREATOR_MEMORY_DEPTH.free;
  const recurring = memory.recurringPatterns.slice(0, depth === 'short' ? 2 : 5);
  const patterns = memory.detectedPatterns.slice(0, depth === 'short' ? 2 : depth === 'simple' ? 3 : 5);
  const style = memory.styleTraits.slice(0, depth === 'short' ? 3 : 6);
  const recent = snapshots.slice(0, Math.min(5, snapshots.length));
  const summary = [
    `Memoire ${memory.level} (${memory.streakLabel}, ${memory.signalsCount} signaux).`,
    style.length ? `Style detecte: ${style.map((item) => item.label).join(', ')}.` : undefined,
    recurring.length ? `Erreurs/patterns recurrents: ${recurring.join(', ')}.` : undefined,
    patterns[0]?.insight,
  ].filter(Boolean).join(' ');

  const promptContext = [
    'MEMOIRE CREATEUR PERSISTANTE',
    `Plan=${plan} | profondeur=${depth} | analyses_utilisees=${snapshots.length}`,
    summary,
    patterns.length ? `Patterns verifies: ${patterns.map((item) => `${item.insight} (conf ${item.confidence}%, preuve: ${item.evidence})`).join(' | ')}` : undefined,
    recent.length ? `Dernieres analyses: ${recent.map((item) => `${item.createdAt.slice(0, 10)} score=${item.score}/100 objectif=${item.objective ?? '?'} verdict=${item.verdict}`).join(' | ')}` : undefined,
    'Regle: utilise cette memoire uniquement comme contexte. Si un pattern est incertain, formule "revient probablement" et baisse la confiance.',
  ].filter(Boolean).join('\n');

  return { summary, promptContext };
}

export function buildVideoAnalysisSnapshot(input: {
  userId: string;
  plan: Plan;
  videoId: string;
  result: AnalysisResult;
  duration?: number;
  transcript?: string;
  creatorMemoryUsed?: string;
}): VideoAnalysisSnapshot {
  const { result } = input;
  const diagnostics = diagnosticsFromResult(result);
  const dropMoments = filterDiagnostics(diagnostics, ['drop', 'retention', 'quitte', 'reste', 'watch']);
  const rhythmIssues = filterDiagnostics(diagnostics, ['rythme', 'montage', 'cut', 'plan', 'zoom']);
  const retentionRisks = filterDiagnostics(diagnostics, ['retention', 'drop', 'payoff', 'preuve', 'valeur']);
  const confidenceScore = clampConfidence(
    (result.videoIntelligence?.confidence.score ?? result.coachAnalysis?.formatConfidence?.score ?? 58) / 100
  );
  return {
    videoId: input.videoId,
    userId: input.userId,
    createdAt: new Date().toISOString(),
    plan: input.plan,
    niche: result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche,
    objective: result.analyzerMeta?.objectiveLabel ?? result.analyzerMeta?.objective,
    duration: input.duration ?? result.videoIntelligence?.metadata.durationSec ?? result.detectedVideoMeta?.durationSec,
    transcript: input.transcript?.slice(0, 4000) ?? result.videoIntelligence?.transcript.text?.slice(0, 4000),
    detectedHook: firstText([
      result.coachAnalysis?.openingAnalysis?.vocalHook,
      result.coachAnalysis?.openingAnalysis?.newHook,
      result.repostVersion?.hook,
      result.hook.analysis,
    ]),
    detectedCTA: firstText([result.repostVersion?.cta, result.coachAnalysis?.optimizedCtas?.[0]]),
    detectedPayoff: firstText([
      result.coachAnalysis?.openingAnalysis?.promise,
      result.coachAnalysis?.repostEngine.bestOpportunity?.why,
      result.comparativePriority,
    ]),
    weakMoments: diagnostics,
    dropMoments: dropMoments.length ? dropMoments : diagnostics.slice(0, 1),
    rhythmIssues,
    retentionRisks: retentionRisks.length ? retentionRisks : diagnostics.slice(0, 2),
    score: result.viralityScore,
    verdict: result.coachAnalysis?.verdict ?? result.analyzerMeta?.verdictShort ?? result.finalVerdict ?? 'Diagnostic Viralynz',
    recommendations: [
      ...(result.coachAnalysis?.priorityActions.critical ?? []),
      ...(result.coachAnalysis?.priorityActions.important ?? []),
      ...(result.actionPlan ?? []),
      ...(result.improvements ?? []).map((item) => item.tip),
    ].slice(0, 8),
    repostVersion: result.repostVersion,
    hooksSuggestions: [
      ...(result.coachAnalysis?.hookVariants ?? []),
      result.repostVersion?.hook,
      ...(result.repostVersion?.hookVariants ?? []),
    ].filter(Boolean) as string[],
    creatorMemoryUsed: input.creatorMemoryUsed,
    confidenceScore,
    source: result.analysisSource ?? 'vision_upload',
  };
}

export async function getCreatorMemoryForAnalysis(userId: string, plan: Plan): Promise<StoredCreatorMemory | null> {
  const limit = getCreatorMemoryLimit(plan);
  const { data: snapshotRows, error: snapshotsError } = await supabase
    .from('video_analysis_snapshots')
    .select('snapshot_json, result_json, video_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (snapshotsError) {
    console.warn('[creator-memory] snapshots unavailable:', snapshotsError.message);
    return null;
  }

  const snapshots = (snapshotRows ?? [])
    .map((row) => (row as { snapshot_json?: VideoAnalysisSnapshot }).snapshot_json)
    .filter(Boolean) as VideoAnalysisSnapshot[];

  if (!snapshots.length) return null;

  const inputs: RepostPriorityInput[] = snapshots.map((snapshot, index) => ({
    id: snapshot.videoId || `memory_${index}`,
    created_at: snapshot.createdAt,
    video_url: snapshot.videoId,
    result: ((snapshotRows?.[index] as { result_json?: AnalysisResult } | undefined)?.result_json ?? {
      viralityScore: snapshot.score,
      hook: { score: snapshot.score, rating: 'Moyen', analysis: snapshot.detectedHook ?? '', strengths: [], weaknesses: snapshot.weakMoments.map((item) => item.title) },
      editing: { score: snapshot.score, rating: 'Moyen', analysis: '', strengths: [], weaknesses: snapshot.rhythmIssues.map((item) => item.title) },
      retention: { score: snapshot.score, rating: 'Moyen', analysis: '', strengths: [], weaknesses: snapshot.retentionRisks.map((item) => item.title) },
      improvements: snapshot.recommendations.map((tip) => ({ priority: 'moyenne', tip })),
      repostVersion: snapshot.repostVersion,
    }) as AnalysisResult,
  }));
  const memory = buildCreatorMemory(inputs);
  const built = buildMemoryPrompt(memory, snapshots, plan);
  const learning = await getRecommendationLearningContext(userId);
  const promptContext = [
    built.promptContext,
    learning?.summary ? `\nBOUCLE FEEDBACK REPOST\nRecommandations qui ont ete appliquees/jugees utiles: ${learning.summary}\nRegle: augmente la priorite des recommandations avec priority_score eleve, mais garde une formulation prudente si confidence_score < 55.` : undefined,
  ].filter(Boolean).join('\n');
  return {
    userId,
    plan,
    memory,
    summary: built.summary,
    promptContext,
    sourceAnalysisCount: snapshots.length,
    updatedAt: new Date().toISOString(),
  };
}

export async function getStoredCreatorMemoryProfile(userId: string, plan: Plan): Promise<StoredCreatorMemory | null> {
  const { data, error } = await supabase
    .from('creator_memory_profiles')
    .select('memory_json, summary, prompt_context, source_analysis_count, updated_at, plan')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[creator-memory] profile read failed:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as {
    memory_json?: CreatorMemory;
    summary?: string;
    prompt_context?: string;
    source_analysis_count?: number;
    updated_at?: string;
    plan?: Plan;
  };
  if (!row.memory_json) return null;
  return {
    userId,
    plan: row.plan ?? plan,
    memory: row.memory_json,
    summary: row.summary ?? '',
    promptContext: row.prompt_context ?? '',
    sourceAnalysisCount: row.source_analysis_count ?? 0,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

export async function persistAnalysisSnapshotAndMemory(input: {
  userId: string;
  plan: Plan;
  analysisId?: string | null;
  videoUrl: string;
  result: AnalysisResult;
  snapshot: VideoAnalysisSnapshot;
}): Promise<void> {
  const { error: snapshotError } = await supabase
    .from('video_analysis_snapshots')
    .upsert({
      user_id: input.userId,
      analysis_id: input.analysisId,
      video_id: input.snapshot.videoId,
      video_url: input.videoUrl,
      plan: input.plan,
      result_json: input.result,
      snapshot_json: input.snapshot,
      confidence_score: input.snapshot.confidenceScore,
      created_at: input.snapshot.createdAt,
    }, { onConflict: 'user_id,video_id' });

  if (snapshotError) {
    console.warn('[creator-memory] snapshot save failed:', snapshotError.message);
    return;
  }

  const memory = await getCreatorMemoryForAnalysis(input.userId, input.plan);
  if (!memory) return;

  const { error: memoryError } = await supabase
    .from('creator_memory_profiles')
    .upsert({
      user_id: input.userId,
      plan: input.plan,
      memory_json: memory.memory,
      summary: memory.summary,
      prompt_context: memory.promptContext,
      source_analysis_count: memory.sourceAnalysisCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (memoryError) {
    console.warn('[creator-memory] profile upsert failed:', memoryError.message);
  }

  await persistProprietaryEngineRows(input.userId, input.analysisId, input.snapshot.videoId, input.result);
}

async function persistProprietaryEngineRows(
  userId: string,
  analysisId: string | null | undefined,
  videoId: string,
  result: AnalysisResult,
) {
  const technical = result.videoIntelligence?.technicalSignals;
  const graph = buildTikTokGraphRecord({ userId, videoId, result });
  const scoreBreakdown = result.coachAnalysis?.subScores;
  const confidence = clampConfidence((result.videoIntelligence?.confidence.score ?? 55) / 100);

  const writes: Array<PromiseLike<unknown>> = [];
  const projectNiche = graph.structuredSignals.niche ?? result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche ?? 'TikTok';
  const projectFormat = graph.structuredSignals.format_type ?? result.coachAnalysis?.patternLabel ?? 'Short-form';
  const projectName = projectNiche.toLowerCase().includes('business')
    ? 'Business Motivation'
    : projectNiche.toLowerCase().includes('ugc')
      ? 'UGC Skincare'
      : projectNiche.toLowerCase().includes('fitness')
        ? 'Storytelling Fitness'
        : projectNiche.toLowerCase().includes('agency')
          ? 'TikTok Agency Client'
          : `${projectNiche} ${projectFormat}`.trim();
  const projectSlug = slugifyProject(projectName);
  const projectProgression = clampScore((result.viralityScore + result.hook.score + result.retention.score + result.editing.score) / 4);
  const projectStatus = result.coachAnalysis?.repostEngine.recommended ? 'needs_repost' : projectProgression >= 68 ? 'active' : 'learning';
  const projectUpsert = await supabase
    .from('content_projects')
    .upsert({
      user_id: userId,
      name: projectName,
      slug: projectSlug,
      niche: projectNiche,
      format_type: projectFormat,
      status: projectStatus,
      progression_score: projectProgression,
      settings: {
        ai_memory_enabled: true,
        experiments_enabled: true,
        scale_collaboration_ready: true,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,slug' })
    .select('id')
    .single();

  if (projectUpsert.error) {
    console.warn('[content-workspace] project upsert failed:', projectUpsert.error.message);
  }
  const projectId = projectUpsert.data?.id as string | undefined;

  if (technical) {
    writes.push(
      supabase.from('analysis_technical_signals').insert({
        user_id: userId,
        analysis_id: analysisId,
        video_id: videoId,
        technical_json: technical,
        signal_quality: technical.metadata.signalQuality,
        source: technical.source,
      }).then(({ error }) => {
        if (error) console.warn('[proprietary-engine] technical signal save failed:', error.message);
      })
    );

    const retentionRows = technical.structure.retentionRisks.map((risk) => ({
      user_id: userId,
      analysis_id: analysisId,
      timestamp: risk.timestamp,
      risk_level: risk.risk,
      reason: risk.reason,
      evidence: risk.evidence,
      confidence: risk.confidence,
      source: 'technical_pipeline',
    }));
    if (retentionRows.length) {
      writes.push(
        supabase.from('retention_signals').insert(retentionRows).then(({ error }) => {
          if (error) console.warn('[proprietary-engine] retention save failed:', error.message);
        })
      );
    }
  }

  writes.push(
    supabase.from('video_signals').upsert({
      user_id: userId,
      analysis_id: analysisId,
      video_id: videoId,
      niche: graph.structuredSignals.niche,
      format_type: graph.structuredSignals.format_type,
      hook_type: graph.structuredSignals.hook_type,
      cta_type: graph.structuredSignals.cta_type,
      structured_signals: graph.structuredSignals,
      tags: graph.tags,
      signal_quality: result.videoIntelligence?.technicalSignals?.metadata.signalQuality ?? result.videoIntelligence?.confidence.score ?? 45,
    }, { onConflict: 'user_id,video_id' }).then(({ error }) => {
      if (error) console.warn('[tiktok-graph] video signals save failed:', error.message);
    })
  );

  writes.push(
    supabase.from('hook_types').insert({
      hook_type: graph.structuredSignals.hook_type,
      hook_text: result.repostVersion?.hook ?? result.hook.analysis,
      niche: graph.structuredSignals.niche,
      format_type: graph.structuredSignals.format_type,
      score: clampScore(result.hook.score),
      evidence: {
        tags: graph.tags.filter((tag) => tag.key.includes('hook') || tag.key === 'proof_based'),
        graphNode: graph.nodes.find((node) => node.type === 'hook'),
      },
    }).then(({ error }) => {
      if (error) console.warn('[tiktok-graph] hook type save failed:', error.message);
    })
  );

  writes.push(
    supabase.from('structure_types').insert({
      structure_type: `${graph.structuredSignals.hook_type}_${graph.structuredSignals.visual_density}_${graph.structuredSignals.speech_speed}`,
      niche: graph.structuredSignals.niche,
      format_type: graph.structuredSignals.format_type,
      intro_duration: graph.structuredSignals.intro_duration,
      payoff_position: graph.structuredSignals.payoff_position,
      visual_density: graph.structuredSignals.visual_density,
      speech_speed: graph.structuredSignals.speech_speed,
      evidence: graph.structuredSignals,
    }).then(({ error }) => {
      if (error) console.warn('[tiktok-graph] structure type save failed:', error.message);
    })
  );

  const benchmarkKey = [
    graph.structuredSignals.niche ?? 'unknown',
    graph.structuredSignals.format_type ?? 'unknown',
    graph.structuredSignals.hook_type,
    graph.structuredSignals.cta_type,
  ].join(':').toLowerCase();
  const globalCohortKey = benchmarkKey;
  const anonymizedUserHash = anonymizedHash(`${userId}:${globalCohortKey}`);

  writes.push(
    supabase.from('benchmark_patterns').upsert({
      pattern_key: benchmarkKey,
      niche: graph.structuredSignals.niche,
      format_type: graph.structuredSignals.format_type,
      hook_type: graph.structuredSignals.hook_type,
      sample_size: 1,
      avg_score: clampScore(result.viralityScore),
      avg_hook_score: clampScore(result.hook.score),
      avg_retention_score: clampScore(result.retention.score),
      internal_observations: graph.benchmarkInsights,
      confidence,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'pattern_key' }).then(({ error }) => {
      if (error) console.warn('[tiktok-graph] benchmark pattern save failed:', error.message);
    })
  );

  writes.push(
    supabase.from('global_pattern_cohorts').upsert({
      cohort_key: globalCohortKey,
      niche: graph.structuredSignals.niche,
      format_type: graph.structuredSignals.format_type,
      hook_type: graph.structuredSignals.hook_type,
      cta_type: graph.structuredSignals.cta_type,
      style_type: graph.structuredSignals.facecam === true ? 'facecam' : graph.structuredSignals.hook_type,
      sample_size: 1,
      avg_hook_score: clampScore(result.hook.score),
      avg_retention_score: clampScore(result.retention.score),
      avg_cta_score: clampScore(scoreBreakdown?.cta ?? result.viralityScore),
      avg_repost_score: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
      confidence,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cohort_key' }).then(({ error }) => {
      if (error) console.warn('[global-network] cohort save failed:', error.message);
    })
  );

  const globalObservations = [
    {
      pattern_type: 'hook',
      signal_json: {
        hook_type: graph.structuredSignals.hook_type,
        proof_based: graph.structuredSignals.hook_type === 'proof',
        score: result.hook.score,
      },
      quality_score: clampScore(result.hook.score),
    },
    {
      pattern_type: 'structure',
      signal_json: {
        visual_density: graph.structuredSignals.visual_density,
        speech_speed: graph.structuredSignals.speech_speed,
        pattern_interrupts: graph.structuredSignals.pattern_interrupts,
      },
      quality_score: clampScore(result.editing.score),
    },
    {
      pattern_type: 'cta',
      signal_json: {
        cta_type: graph.structuredSignals.cta_type,
        cta_score: scoreBreakdown?.cta ?? result.viralityScore,
      },
      quality_score: clampScore(scoreBreakdown?.cta ?? result.viralityScore),
    },
    {
      pattern_type: 'retention',
      signal_json: {
        risk_drop: graph.structuredSignals.risk_drop,
        retention_score: result.retention.score,
      },
      quality_score: clampScore(result.retention.score),
    },
  ].map((row) => ({
    cohort_key: globalCohortKey,
    analysis_id: analysisId,
    anonymized_user_hash: anonymizedUserHash,
    confidence: clampScore(confidence * 100),
    ...row,
  }));

  writes.push(
    supabase.from('global_pattern_observations').insert(globalObservations).then(({ error }) => {
      if (error) console.warn('[global-network] observations save failed:', error.message);
    })
  );

  const anonymousBenchmarks = [
    {
      compare_on: 'hooks',
      benchmark_json: {
        user_signal: `${clampScore(result.hook.score)}/100 hook quality`,
        network_signal: graph.structuredSignals.hook_type === 'proof' ? 'proof hooks cohort' : 'test proof/tension hook',
        privacy: 'anonymous_aggregate',
      },
    },
    {
      compare_on: 'structures',
      benchmark_json: {
        user_signal: graph.structuredSignals.visual_density,
        network_signal: graph.structuredSignals.pattern_interrupts > 0 ? 'pattern interrupts present' : 'pattern interrupt opportunity',
        privacy: 'anonymous_aggregate',
      },
    },
    {
      compare_on: 'cta',
      benchmark_json: {
        user_signal: graph.structuredSignals.cta_type,
        network_signal: 'cta compared by type, niche and format',
        privacy: 'anonymous_aggregate',
      },
    },
    {
      compare_on: 'payoff',
      benchmark_json: {
        user_signal: graph.structuredSignals.payoff_position ?? 'unknown',
        network_signal: 'faster payoff tends to lower structural risk',
        privacy: 'anonymous_aggregate',
      },
    },
  ].map((row) => ({
    cohort_key: globalCohortKey,
    confidence: clampScore(confidence * 100),
    updated_at: new Date().toISOString(),
    ...row,
  }));

  writes.push(
    supabase.from('anonymous_benchmark_network').upsert(anonymousBenchmarks, { onConflict: 'cohort_key,compare_on' }).then(({ error }) => {
      if (error) console.warn('[global-network] anonymous benchmark save failed:', error.message);
    })
  );

  writes.push(
    supabase.from('community_pattern_signals').insert({
      cohort_key: globalCohortKey,
      title: graph.structuredSignals.hook_type === 'proof'
        ? `Les hooks preuve courts montent en ${graph.structuredSignals.niche ?? 'TikTok'}`
        : `Pattern ${graph.structuredSignals.hook_type} a surveiller`,
      body: graph.benchmarkInsights[0]?.insight ?? 'Signal communautaire en apprentissage.',
      trend: clampScore(result.hook.score) >= 70 ? 'rising' : 'learning',
      confidence: clampScore(confidence * 100),
      source_counts: {
        sample_size: 1,
        hook_type: graph.structuredSignals.hook_type,
        cta_type: graph.structuredSignals.cta_type,
      },
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn('[global-network] community signal save failed:', error.message);
    })
  );

  if (graph.structuredSignals.niche) {
    writes.push(
      supabase.from('niche_patterns').upsert({
        niche: graph.structuredSignals.niche,
        pattern_key: benchmarkKey,
        format_type: graph.structuredSignals.format_type,
        hook_type: graph.structuredSignals.hook_type,
        observations: graph.benchmarkInsights,
        sample_size: 1,
        confidence,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'niche,pattern_key' }).then(({ error }) => {
        if (error) console.warn('[tiktok-graph] niche pattern save failed:', error.message);
      })
    );
  }

  if (result.repostVersion) {
    writes.push(
      supabase.from('repost_patterns').insert({
        user_id: userId,
        analysis_id: analysisId,
        pattern_key: benchmarkKey,
        hook_type: graph.structuredSignals.hook_type,
        cta_type: graph.structuredSignals.cta_type,
        structure_json: result.repostVersion,
        source_signals: {
          structuredSignals: graph.structuredSignals,
          benchmarkInsights: graph.benchmarkInsights,
          graphEdges: graph.edges,
        },
        confidence,
      }).then(({ error }) => {
        if (error) console.warn('[tiktok-graph] repost pattern save failed:', error.message);
      })
    );
  }

  const hookVaultRows = [
    result.repostVersion?.hook,
    ...(result.repostVersion?.hookVariants ?? []),
    ...(result.coachAnalysis?.hookVariants ?? []),
  ].filter(Boolean).slice(0, 8).map((hook, index) => ({
    user_id: userId,
    analysis_id: analysisId,
    hook_text: hook as string,
    status: index === 0 ? 'reposted' : clampScore(result.hook.score) >= 74 ? 'performant' : 'saved',
    niche: graph.structuredSignals.niche,
    format_type: graph.structuredSignals.format_type,
    score: clampScore(result.hook.score + (index === 0 ? 8 : 3)),
    tags: graph.tags.filter((tag) => tag.key === 'hook_type' || tag.key === 'proof_based' || tag.key === 'niche' || tag.key === 'format_type'),
    favorite: index === 0,
    updated_at: new Date().toISOString(),
  }));

  if (hookVaultRows.length) {
    writes.push(
      supabase.from('hook_vault').insert(hookVaultRows).then(({ error }) => {
        if (error) console.warn('[content-os] hook vault save failed:', error.message);
      })
    );
  }

  writes.push(
    supabase.from('repost_queue').insert({
      user_id: userId,
      analysis_id: analysisId,
      priority_score: clampScore(result.coachAnalysis?.repostEngine.improvementProbability ?? result.viralityScore),
      repost_potential: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
      main_problem: result.coachAnalysis?.detectedProblems?.[0]?.title ?? result.hook.weaknesses?.[0] ?? 'Hook a optimiser',
      status: (scoreBreakdown?.repostPotential ?? result.viralityScore) >= 72 ? 'repost_conseille' : 'a_retravailler',
      last_analysis_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).then(({ error }) => {
      if (error) console.warn('[content-os] repost queue save failed:', error.message);
    })
  );

  if (result.repostVersion?.hookVariants?.length) {
    writes.push(
      supabase.from('content_experiments').insert({
        user_id: userId,
        analysis_id: analysisId,
        experiment_type: 'hook_test',
        title: result.coachAnalysis?.verdict ?? 'Test hooks repost',
        variants: result.repostVersion.hookVariants.slice(0, 5).map((hook, index) => ({
          id: `hook_${index + 1}`,
          label: hook,
          score: clampScore(result.hook.score + (index === 0 ? 8 : 2)),
          status: index === 0 ? 'winner' : 'candidate',
        })),
        winner_variant_id: 'hook_1',
        status: 'draft',
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[content-os] experiment save failed:', error.message);
      })
    );
  }

  if (projectId) {
    const projectHooks = [
      result.repostVersion?.hook,
      ...(result.repostVersion?.hookVariants ?? []),
      ...(result.coachAnalysis?.hookVariants ?? []),
    ].filter(Boolean).slice(0, 8);
    const projectStructures = [
      ...(result.repostVersion?.structure ?? []),
      ...(result.coachAnalysis?.videoSegments?.map((segment) => segment.mainProblem) ?? []),
    ].filter(Boolean).slice(0, 8);
    const projectErrors = [
      ...(result.coachAnalysis?.detectedProblems?.map((problem) => problem.title) ?? []),
      ...(result.hook.weaknesses ?? []),
      ...(result.retention.weaknesses ?? []),
    ].filter(Boolean).slice(0, 8);

    writes.push(
      supabase.from('project_memory').upsert({
        project_id: projectId,
        user_id: userId,
        summary: projectErrors[0]
          ? `${projectErrors[0]} revient dans le projet ${projectName}.`
          : `Memoire projet ${projectName} mise a jour depuis la derniere analyse.`,
        hooks: projectHooks,
        structures: projectStructures,
        benchmarks: graph.benchmarkInsights,
        recurring_errors: projectErrors,
        patterns: graph.tags,
        source_analysis_count: 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' }).then(({ error }) => {
        if (error) console.warn('[content-workspace] project memory save failed:', error.message);
      })
    );

    const projectItems = [
      {
        project_id: projectId,
        user_id: userId,
        analysis_id: analysisId,
        item_type: 'analysis',
        title: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Analyse Viralynz',
        payload: { score: result.viralityScore, diagnostics: result.structuredDiagnostics?.slice(0, 4), graph: graph.structuredSignals },
      },
      ...(projectHooks[0] ? [{
        project_id: projectId,
        user_id: userId,
        analysis_id: analysisId,
        item_type: 'hook',
        title: projectHooks[0] as string,
        payload: { hooks: projectHooks, hook_score: result.hook.score },
      }] : []),
      ...(result.repostVersion ? [{
        project_id: projectId,
        user_id: userId,
        analysis_id: analysisId,
        item_type: 'repost',
        title: result.repostVersion.hook,
        payload: result.repostVersion,
      }] : []),
    ];

    writes.push(
      supabase.from('project_items').insert(projectItems).then(({ error }) => {
        if (error) console.warn('[content-workspace] project items save failed:', error.message);
      })
    );

    if (projectHooks.length > 1) {
      writes.push(
        supabase.from('workspace_experiments').insert({
          project_id: projectId,
          user_id: userId,
          analysis_id: analysisId,
          experiment_type: 'hook_test',
          title: 'Test hook direct vs hook preuve',
          variants: projectHooks.slice(0, 4).map((hook, index) => ({
            id: `variant_${index + 1}`,
            label: hook,
            score: clampScore(result.hook.score + (index === 0 ? 8 : 2)),
            status: index === 0 ? 'winner' : 'candidate',
          })),
          learning: `Ce test nourrit la memoire du projet ${projectName}.`,
          status: 'draft',
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[content-workspace] workspace experiment save failed:', error.message);
        })
      );
    }

    const feedRows = [
      {
        project_id: projectId,
        user_id: userId,
        event_type: 'pattern',
        title: projectErrors[0] ? 'Nouveau pattern detecte' : 'Memoire projet mise a jour',
        body: projectErrors[0] ?? `Viralynz a enrichi le contexte ${projectName}.`,
        confidence,
        payload: { projectName, projectErrors },
      },
      {
        project_id: projectId,
        user_id: userId,
        event_type: 'hook',
        title: 'Hook sauvegarde dans le projet',
        body: projectHooks[0] ?? 'Hook en attente de signal fiable.',
        confidence,
        payload: { hooks: projectHooks, hook_score: result.hook.score },
      },
      {
        project_id: projectId,
        user_id: userId,
        event_type: result.repostVersion ? 'repost' : 'progress',
        title: result.repostVersion ? 'Repost workspace enrichi' : 'Progression projet',
        body: result.repostVersion?.angle ?? `${projectName} atteint ${projectProgression}/100 en qualite structurelle.`,
        confidence,
        payload: { projectProgression, repost: result.repostVersion },
      },
    ];

    writes.push(
      supabase.from('workspace_feed_events').insert(feedRows).then(({ error }) => {
        if (error) console.warn('[content-workspace] feed save failed:', error.message);
      })
    );

    const ctaScore = clampScore(scoreBreakdown?.cta ?? result.viralityScore);
    const hookGap = Math.max(0, 78 - clampScore(result.hook.score));
    const ctaGap = Math.max(0, 72 - ctaScore);
    const retentionGap = Math.max(0, 74 - clampScore(result.retention.score));
    const estimatedGain = result.coachAnalysis?.repostEngine.estimatedGain ?? Math.max(4, Math.round((hookGap + ctaGap + retentionGap) / 4));
    const opportunity = clampScore(
      Math.max(result.viralityScore, scoreBreakdown?.repostPotential ?? 0) * 0.3
        + hookGap * 0.18
        + ctaGap * 0.14
        + retentionGap * 0.14
        + estimatedGain * 1.2
        + confidence * 100 * 0.12,
    );
    const strategicRows = [
      {
        action_type: result.coachAnalysis?.repostEngine.recommended ? 'repost_video' : hookGap >= ctaGap ? 'test_hook' : 'fix_cta',
        title: result.coachAnalysis?.repostEngine.recommended ? 'Repost cette video' : hookGap >= ctaGap ? 'Tester un hook preuve' : 'Corriger le CTA',
        action: result.coachAnalysis?.detectedProblems?.[0]?.action ?? result.actionPlan?.[0] ?? result.repostVersion?.hook ?? 'Prioriser la correction la plus simple avant repost.',
        reason: result.coachAnalysis?.detectedProblems?.[0]?.explanation ?? result.hook.analysis,
        decision_context: graph.benchmarkInsights[0] ?? `Decision rattachee au projet ${projectName}.`,
        opportunity_score: opportunity,
        impact_score: clampScore((scoreBreakdown?.repostPotential ?? result.viralityScore) + estimatedGain),
        confidence_score: clampScore(confidence * 100),
        effort: result.editing.score < 55 || result.retention.score < 50 ? 'eleve' : hookGap > 12 || ctaGap > 12 ? 'moyen' : 'faible',
        priority: opportunity >= 82 ? 'urgent' : opportunity >= 70 ? 'high' : opportunity >= 52 ? 'medium' : 'low',
        source_signals: {
          hookGap,
          ctaGap,
          retentionGap,
          estimatedGain,
          projectName,
          structuredSignals: graph.structuredSignals,
        },
        engine_version: 'strategic-decision-v1',
        status: 'open',
      },
      {
        action_type: 'prioritize_project',
        title: `Prioriser ${projectName}`,
        action: projectErrors[0] ?? 'Continuer les tests hooks et reposts sur ce projet.',
        reason: `Projet classe par progression, patterns detectes et potentiel de repost.`,
        decision_context: `Memoire projet: ${projectErrors[0] ?? 'pas encore assez de recurrence fiable'}.`,
        opportunity_score: clampScore(projectProgression + projectErrors.length * 4 + (result.repostVersion ? 8 : 0)),
        impact_score: projectProgression,
        confidence_score: clampScore(confidence * 100),
        effort: 'moyen',
        priority: projectProgression >= 72 ? 'high' : 'medium',
        source_signals: {
          projectProgression,
          projectErrors,
          projectHooks,
          benchmarkInsights: graph.benchmarkInsights,
        },
        engine_version: 'strategic-decision-v1',
        status: 'open',
      },
    ].map((row) => ({
      user_id: userId,
      analysis_id: analysisId,
      project_id: projectId,
      ...row,
    }));

    writes.push(
      supabase.from('strategic_decisions').insert(strategicRows).then(({ error }) => {
        if (error) console.warn('[strategic-decision] save failed:', error.message);
      })
    );

    const intelligenceScore = clampScore((projectProgression + opportunity + result.hook.score + result.retention.score) / 4);
    const dailyBriefingItems = [
      {
        id: 'brief_hook',
        type: 'hook',
        title: projectHooks[0] ? 'Hook a tester' : 'Hook en apprentissage',
        body: projectHooks[0] ?? 'Pas assez de hooks pour confirmer un pattern.',
        confidence: clampScore(result.hook.score),
      },
      {
        id: 'brief_pattern',
        type: 'pattern',
        title: projectErrors[0] ? 'Pattern faible recurrent' : 'Memoire en cours',
        body: projectErrors[0] ?? `Le projet ${projectName} accumule ses premiers signaux.`,
        confidence: clampScore(44 + projectErrors.length * 9),
      },
      {
        id: 'brief_repost',
        type: 'repost',
        title: result.repostVersion ? 'Repost disponible' : 'Repost a calibrer',
        body: result.repostVersion?.hook ?? result.actionPlan?.[0] ?? 'Aucune version repost complete sans signal suffisant.',
        confidence: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
      },
    ];
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

    writes.push(
      supabase.from('intelligence_snapshots').insert({
        user_id: userId,
        project_id: projectId,
        intelligence_score: intelligenceScore,
        summary: `Intelligence cumulative ${intelligenceScore}/100 pour ${projectName}.`,
        central_context: [
          projectErrors[0] ?? 'Pas encore de faiblesse recurrente fiable.',
          graph.benchmarkInsights[0] ?? 'Benchmark interne en apprentissage.',
          result.coachAnalysis?.memory?.nextRecommendation,
        ].filter(Boolean),
        source_counts: {
          hooks: projectHooks.length,
          structures: projectStructures.length,
          errors: projectErrors.length,
          benchmarks: graph.benchmarkInsights.length,
        },
        engine_version: 'cumulative-intelligence-v1',
      }).then(({ error }) => {
        if (error) console.warn('[intelligence-layer] snapshot save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('daily_briefings').upsert({
        user_id: userId,
        project_id: projectId,
        briefing_date: dateOnly(today),
        items: dailyBriefingItems,
        confidence: clampScore(confidence * 100),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,briefing_date' }).then(({ error }) => {
        if (error) console.warn('[intelligence-layer] daily briefing save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('weekly_reports').upsert({
        user_id: userId,
        project_id: projectId,
        week_start: dateOnly(weekStart),
        summary: `Rapport hebdo ${projectName}: hook ${clampScore(result.hook.score)}/100, retention ${clampScore(result.retention.score)}/100, CTA ${ctaScore}/100.`,
        metrics: [
          { id: 'hook', label: 'Progression hook', value: clampScore(result.hook.score), detail: result.hook.analysis },
          { id: 'structure', label: 'Progression structure', value: clampScore(result.editing.score), detail: result.editing.analysis },
          { id: 'repost', label: 'Meilleur repost', value: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore), detail: result.repostVersion?.hook },
          { id: 'cta', label: 'Evolution CTA', value: ctaScore, detail: result.repostVersion?.cta },
          { id: 'retention', label: 'Evolution retention', value: clampScore(result.retention.score), detail: result.retention.analysis },
        ],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_start' }).then(({ error }) => {
        if (error) console.warn('[intelligence-layer] weekly report save failed:', error.message);
      })
    );

    const predictiveRows = [
      {
        signal_type: 'hook',
        title: 'Hook probablement performant',
        prediction: projectHooks[0] ?? 'Pas assez de hooks pour predire un gagnant.',
        evidence: `Hook score interne ${clampScore(result.hook.score)}/100.`,
        confidence: clampScore(result.hook.score),
        impact_score: clampScore(result.hook.score),
      },
      {
        signal_type: 'repost',
        title: 'Video a potentiel repost',
        prediction: result.repostVersion?.hook ?? result.actionPlan?.[0] ?? 'Repost a confirmer.',
        evidence: `Repost potential interne ${clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore)}/100.`,
        confidence: clampScore(confidence * 100),
        impact_score: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
      },
      {
        signal_type: 'structure_risk',
        title: 'Structure a risque',
        prediction: projectErrors[0] ?? 'Aucun risque recurrent confirme.',
        evidence: 'Base sur diagnostics et patterns internes, pas sur analytics TikTok inventees.',
        confidence: clampScore(44 + projectErrors.length * 9),
        impact_score: clampScore(100 - result.retention.score),
      },
    ].map((row) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      source_signals: {
        projectName,
        structuredSignals: graph.structuredSignals,
        projectProgression,
      },
      ...row,
    }));

    writes.push(
      supabase.from('predictive_signals').insert(predictiveRows).then(({ error }) => {
        if (error) console.warn('[intelligence-layer] predictive signals save failed:', error.message);
      })
    );

    const expertWeights = {
      hook_importance: 20,
      retention_importance: 20,
      cta_importance: 20,
      storytelling_importance: 16,
      payoff_speed_importance: 24,
    };
    const hookWindow = result.videoIntelligence?.technicalSignals?.structure.hookWindow;
    const introDuration = hookWindow?.match(/(\d+(?:\.\d+)?)s/)?.[1] ? Number(hookWindow.match(/(\d+(?:\.\d+)?)s/)?.[1]) : undefined;
    const payoffPosition = result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec;
    const patternInterruptCount = result.videoIntelligence?.technicalSignals?.visual.patternInterrupts.length
      ?? result.videoIntelligence?.visualSignals.cutDensityEstimate
      ?? 0;
    const expertRules = [
      {
        rule_key: 'intro_gt_3s',
        triggered: typeof introDuration === 'number' ? introDuration > 3 : result.hook.score < 62,
        evidence: typeof introDuration === 'number' ? `Intro estimee a ${introDuration}s.` : 'Fallback score hook faible.',
        action: 'Avancer preuve, resultat ou promesse avant le contexte.',
      },
      {
        rule_key: 'cta_after_10s',
        triggered: ctaScore < 55,
        evidence: `CTA score interne ${ctaScore}/100.`,
        action: 'Tester une question courte avant ou juste apres le payoff.',
      },
      {
        rule_key: 'no_pattern_interrupt',
        triggered: patternInterruptCount === 0,
        evidence: `${patternInterruptCount} pattern interrupt detecte.`,
        action: 'Ajouter cut, zoom, texte ecran ou changement de plan.',
      },
      {
        rule_key: 'late_payoff',
        triggered: typeof payoffPosition === 'number' ? payoffPosition > 4 : result.retention.score < 62,
        evidence: typeof payoffPosition === 'number' ? `Payoff estime a ${payoffPosition}s.` : 'Fallback retention faible.',
        action: 'Faire arriver la recompense dans les 2 premieres secondes.',
      },
    ].map((rule) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      ...rule,
    }));

    writes.push(
      supabase.from('expert_mode_settings').upsert({
        user_id: userId,
        project_id: projectId,
        enabled: false,
        analysis_depth: 'standard',
        weight_profile: expertWeights,
        custom_prompt_preferences: {
          use_creator_memory: true,
          use_project_memory: true,
          use_custom_benchmarks: true,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,project_id' }).then(({ error }) => {
        if (error) console.warn('[expert-mode] settings save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('expert_rule_evaluations').insert(expertRules).then(({ error }) => {
        if (error) console.warn('[expert-mode] rule evaluation save failed:', error.message);
      })
    );

    const repostPotential = clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore);
    const autoRepostScore = clampScore(
      repostPotential * 0.42
        + opportunity * 0.28
        + estimatedGain * 1.1
        + (hookGap > 10 ? 8 : 0)
        - (result.editing.score < 48 ? 8 : 0),
    );
    const correctionEffort = result.editing.score < 52 || result.retention.score < 48 ? 'eleve' : hookGap > 14 || ctaGap > 14 ? 'moyen' : 'faible';
    const shouldAutoQueue = autoRepostScore >= 62 && correctionEffort !== 'eleve';
    const automationSourceSignals = {
      hookGap,
      ctaGap,
      retentionGap,
      estimatedGain,
      opportunity,
      repostPotential,
      autoRepostScore,
      correctionEffort,
      projectName,
      structuredSignals: graph.structuredSignals,
    };
    const automationEvents = [
      {
        automation_type: 'auto_repost_queue',
        title: 'Ajouter automatiquement a la queue A repost',
        trigger: 'repost_potential + opportunity + correction_effort',
        action: shouldAutoQueue
          ? (result.coachAnalysis?.detectedProblems?.[0]?.action ?? result.actionPlan?.[0] ?? 'Reposter avec hook plus direct et CTA plus court.')
          : 'Surveiller sans ajouter a la queue tant que le signal reste insuffisant.',
        reason: shouldAutoQueue
          ? (result.coachAnalysis?.repostEngine.bestOpportunity?.why ?? 'Bon potentiel repost avec correction suffisamment simple.')
          : 'Le moteur evite de forcer une automation sans signal clair.',
        priority: shouldAutoQueue ? 'high' : 'low',
        confidence: shouldAutoQueue ? autoRepostScore : clampScore(confidence * 100),
        status: shouldAutoQueue ? 'active' : 'learning',
      },
      {
        automation_type: 'weak_hook_alert',
        title: 'Detecter hooks faibles recurrents',
        trigger: 'hook_gap + project_errors',
        action: projectErrors[0] ?? 'Attendre plus de signaux avant d alerter.',
        reason: projectErrors[0] ? `Pattern observe dans ${projectName}.` : 'Memoire projet encore courte.',
        priority: hookGap >= 16 ? 'high' : 'medium',
        confidence: clampScore(44 + projectErrors.length * 8 + hookGap),
        status: projectErrors[0] || hookGap >= 16 ? 'active' : 'learning',
      },
      {
        automation_type: 'hook_suggestion',
        title: 'Proposer nouveaux hooks',
        trigger: 'hook_gap or repost_version_available',
        action: projectHooks[0] ?? 'Generer une variante plus preuve.',
        reason: 'Les suggestions utilisent hook vault, memoire projet et diagnostic courant.',
        priority: hookGap >= 12 ? 'high' : 'medium',
        confidence: clampScore(result.hook.score),
        status: projectHooks[0] ? 'suggested' : 'learning',
      },
      {
        automation_type: 'cta_alternative',
        title: 'Suggere CTA alternatif',
        trigger: 'cta_score_below_threshold',
        action: result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'Tester une question courte et concrete.',
        reason: `CTA score interne ${ctaScore}/100.`,
        priority: ctaScore < 58 ? 'high' : 'medium',
        confidence: clampScore(100 - ctaGap),
        status: ctaGap > 0 ? 'suggested' : 'learning',
      },
      {
        automation_type: 'auto_experiment',
        title: 'Creer un experiment automatiquement',
        trigger: 'variants_available + measurable_gap',
        action: projectHooks.length > 1 ? 'Creer un test hook A/B pour le prochain repost.' : 'Attendre une deuxieme variante fiable.',
        reason: 'Le moteur apprend mieux quand les recommandations sont testees puis notees.',
        priority: projectHooks.length > 1 ? 'high' : 'medium',
        confidence: projectHooks.length > 1 ? 68 : 42,
        status: projectHooks.length > 1 ? 'active' : 'learning',
      },
    ].map((row) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      source_signals: automationSourceSignals,
      ...row,
    }));

    writes.push(
      supabase.from('smart_automation_events').insert(automationEvents).then(({ error }) => {
        if (error) console.warn('[smart-automation] events save failed:', error.message);
      })
    );

    if (shouldAutoQueue) {
      writes.push(
        supabase.from('automation_repost_queue').insert({
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          title: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Video a repost',
          priority_score: autoRepostScore,
          reason: result.coachAnalysis?.repostEngine.bestOpportunity?.why ?? result.coachAnalysis?.detectedProblems?.[0]?.explanation ?? 'Potentiel repost clair detecte par Viralynz.',
          corrections: [
            result.coachAnalysis?.detectedProblems?.[0]?.action,
            result.repostVersion?.hook,
            result.repostVersion?.cta,
          ].filter(Boolean),
          effort: correctionEffort,
          status: 'queued',
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[smart-automation] repost queue save failed:', error.message);
        })
      );
    }

    const smartAlerts = [
      {
        alert_type: 'weak_hook_recurrence',
        title: projectErrors[0] ? 'Hook ou intro faible recurrent' : 'Hook en surveillance',
        body: projectErrors[0] ?? 'Pas encore assez de recurrence pour alerter fortement.',
        tone: projectErrors[0] ? 'warning' : 'system',
        confidence: clampScore(44 + projectErrors.length * 9),
      },
      {
        alert_type: 'cta_opportunity',
        title: 'CTA alternatif suggere',
        body: result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'Tester une question courte sur la prochaine video prioritaire.',
        tone: 'opportunity',
        confidence: clampScore(100 - ctaGap),
      },
      {
        alert_type: 'progress_signal',
        title: 'Progression detectee',
        body: `Projet ${projectName}: score structurel ${projectProgression}/100, opportunite ${opportunity}/100.`,
        tone: 'progress',
        confidence: clampScore(confidence * 100),
      },
    ].map((alert) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      ...alert,
    }));

    writes.push(
      supabase.from('smart_alerts').insert(smartAlerts).then(({ error }) => {
        if (error) console.warn('[smart-automation] alerts save failed:', error.message);
      })
    );

    if (projectHooks.length > 1) {
      writes.push(
        supabase.from('auto_experiments').insert({
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          experiment_type: hookGap >= ctaGap ? 'hook_ab' : 'cta_variant',
          title: hookGap >= ctaGap ? 'Test hook preuve vs hook direct' : 'Test CTA question vs CTA direct',
          variants: projectHooks.slice(0, 4).map((hook, index) => ({
            id: `auto_variant_${index + 1}`,
            label: hook,
            score: clampScore(result.hook.score + (index === 0 ? 8 : 2)),
          })),
          success_signal: 'Feedback createur, repost effectue, utilite percue et evolution du score interne.',
          next_step: 'Tester la variante prioritaire au prochain repost puis noter le resultat.',
          status: 'suggested',
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[smart-automation] auto experiment save failed:', error.message);
        })
      );
    }

    writes.push(
      supabase.from('automation_workflows').upsert([
        {
          user_id: userId,
          project_id: projectId,
          workflow_key: 'high_potential_repost',
          name: 'High potential repost workflow',
          if_signal: 'Score eleve + hook faible + fort potentiel repost',
          then_actions: ['Generer nouveau hook', 'Creer tache repost', 'Proposer CTA alternatif', 'Ajouter priorite elevee'],
          priority: shouldAutoQueue ? 'high' : 'medium',
          active: shouldAutoQueue,
          updated_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          project_id: projectId,
          workflow_key: 'cta_repair',
          name: 'CTA repair workflow',
          if_signal: 'CTA faible frequent ou gap CTA detecte',
          then_actions: ['Proposer CTA question', 'Creer experiment CTA', 'Surveiller feedback repost'],
          priority: ctaGap >= 14 ? 'high' : 'medium',
          active: ctaGap > 0,
          updated_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          project_id: projectId,
          workflow_key: 'intro_payoff',
          name: 'Intro payoff workflow',
          if_signal: 'Intro longue ou payoff tardif',
          then_actions: ['Raccourcir intro', 'Avancer preuve', 'Ajouter pattern interrupt'],
          priority: retentionGap >= 14 || hookGap >= 14 ? 'high' : 'medium',
          active: retentionGap > 8 || hookGap > 8,
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'user_id,project_id,workflow_key' }).then(({ error }) => {
        if (error) console.warn('[smart-automation] workflows save failed:', error.message);
      })
    );

    const publicationStatus = shouldAutoQueue
      ? 'repost_candidate'
      : result.repostVersion && result.hook.score >= 68
        ? 'ready'
        : result.hook.score < 58 || result.retention.score < 58
          ? 'editing'
          : 'idea';
    const publicationAction = publicationStatus === 'repost_candidate'
      ? 'repost_schedule'
      : publicationStatus === 'ready'
        ? 'schedule'
        : publicationStatus === 'editing'
          ? 'draft'
          : 'queue';
    const publishingHashtags = [
      `#${slugifyProject(result.analyzerMeta?.nicheLabel ?? result.analyzerMeta?.niche ?? 'tiktok').replace(/_/g, '')}`,
      '#contentcreator',
      '#tiktoktips',
      '#viralynz',
    ];
    const scheduleConfidence = clampScore(48 + projectErrors.length * 5 + (shouldAutoQueue ? 12 : 0) + Math.min(12, projectHooks.length * 3));
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + (shouldAutoQueue ? 1 : 2));
    scheduledDate.setHours(projectProgression >= 70 ? 18 : 12, projectProgression >= 70 ? 30 : 15, 0, 0);
    const prePublishIssues = [
      hookGap > 10 ? 'Hook a renforcer avant publication.' : undefined,
      ctaGap > 10 ? 'CTA a rendre plus court et plus concret.' : undefined,
      retentionGap > 12 ? 'Intro ou payoff a densifier.' : undefined,
    ].filter(Boolean);

    writes.push(
      supabase.from('content_publication_items').insert({
        user_id: userId,
        project_id: projectId,
        analysis_id: analysisId,
        platform: 'tiktok',
        status: publicationStatus,
        action: publicationAction,
        title: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'TikTok a preparer',
        hook: result.repostVersion?.hook ?? result.coachAnalysis?.hookVariants?.[0] ?? result.hook.analysis,
        caption: [
          result.repostVersion?.angle ?? result.coachAnalysis?.repostEngine.bestOpportunity?.title ?? result.finalVerdict,
          result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0],
        ].filter(Boolean).join(' '),
        hashtags: publishingHashtags,
        scheduled_for: publicationStatus === 'ready' || publicationStatus === 'repost_candidate' ? scheduledDate.toISOString() : null,
        schedule_reason: graph.benchmarkInsights[0] ?? 'Timing recommande par memoire projet et signaux internes, sans analytics TikTok inventees.',
        source_signals: {
          ...automationSourceSignals,
          publicationStatus,
          publicationAction,
          scheduleConfidence,
        },
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[publishing-engine] publication item save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('smart_schedule_recommendations').insert([
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          platform: 'tiktok',
          day_label: shouldAutoQueue ? 'Prochaine fenetre repost' : 'Prochaine fenetre forte',
          time_label: projectProgression >= 70 ? '18:30' : '12:15',
          window_label: 'Fenetre recommandee par memoire projet',
          confidence: scheduleConfidence,
          reason: graph.benchmarkInsights[0] ?? `Projet ${projectName}: timing calcule depuis patterns internes et readiness score.`,
          source_signals: [
            `Projet ${projectName}`,
            `Progression ${projectProgression}/100`,
            `Opportunity ${opportunity}/100`,
          ],
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          platform: 'tiktok',
          day_label: 'Apres correction hook',
          time_label: shouldAutoQueue ? '19:45' : '17:30',
          window_label: 'Fenetre repost intelligente',
          confidence: shouldAutoQueue ? autoRepostScore : clampScore(confidence * 100),
          reason: shouldAutoQueue ? 'Repost candidate detecte avec correction simple.' : 'Timing repost en calibration.',
          source_signals: [
            `Auto repost ${autoRepostScore}/100`,
            `Effort ${correctionEffort}`,
          ],
        },
      ]).then(({ error }) => {
        if (error) console.warn('[publishing-engine] schedule recommendations save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('pre_publish_checks').insert({
        user_id: userId,
        project_id: projectId,
        analysis_id: analysisId,
        hook_risk: hookGap,
        cta_risk: ctaGap,
        intro_risk: retentionGap,
        repost_potential: repostPotential,
        strength: result.hook.strengths[0] ?? result.retention.strengths[0] ?? 'Sujet exploitable avec structure a clarifier.',
        issues: prePublishIssues,
        next_fix: result.coachAnalysis?.detectedProblems?.[0]?.action ?? result.actionPlan?.[0] ?? result.repostVersion?.hook ?? 'Valider hook, CTA et payoff avant publication.',
        confidence: clampScore(confidence * 100),
      }).then(({ error }) => {
        if (error) console.warn('[publishing-engine] pre publish check save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('publication_workspace_drafts').insert({
        user_id: userId,
        project_id: projectId,
        analysis_id: analysisId,
        platform: 'tiktok',
        hook: result.repostVersion?.hook ?? projectHooks[0] ?? result.hook.analysis,
        caption: [
          result.repostVersion?.angle,
          result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0],
        ].filter(Boolean).join(' '),
        hashtags: publishingHashtags,
        cta: result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'CTA a confirmer.',
        structure: result.repostVersion?.structure ?? projectStructures,
        repost_version: result.repostVersion ?? null,
        readiness_score: clampScore((result.hook.score + result.retention.score + ctaScore) / 3),
        status: publicationStatus === 'ready' || publicationStatus === 'repost_candidate' ? 'ready' : 'draft',
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.warn('[publishing-engine] draft save failed:', error.message);
      })
    );

    if (shouldAutoQueue) {
      writes.push(
        supabase.from('auto_repost_suggestions').insert({
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          title: result.coachAnalysis?.verdict ?? result.finalVerdict ?? 'Repost candidate',
          priority_score: autoRepostScore,
          reason: result.coachAnalysis?.repostEngine.bestOpportunity?.why ?? 'Video a bon sujet avec hook ou CTA ameliorable.',
          generated_hook: result.repostVersion?.hook ?? projectHooks[0] ?? 'Tester un hook plus direct.',
          suggested_timing: `${projectProgression >= 70 ? '18:30' : '12:15'} apres correction`,
          scheduling_confidence: scheduleConfidence,
          status: 'suggested',
          updated_at: new Date().toISOString(),
        }).then(({ error }) => {
          if (error) console.warn('[publishing-engine] auto repost suggestion save failed:', error.message);
        })
      );
    }

    const baseExecutionHook = result.repostVersion?.hook ?? projectHooks[0] ?? result.hook.analysis;
    const proofSignal = result.hook.strengths[0] ?? projectStructures[0] ?? 'preuve rapide';
    const weakSignal = result.hook.weaknesses[0] ?? projectErrors[0] ?? 'intro trop descriptive';
    const executionHookVariants = [
      {
        variant_type: 'hook',
        mode: 'direct',
        content: `Voici ce que ${projectName} fait perdre en 3 secondes`,
        why: 'Rend le sujet immediat et actionnable.',
        based_on: [graph.benchmarkInsights[0], weakSignal].filter(Boolean),
        score: clampScore(result.hook.score + 12),
        confidence: clampScore(confidence * 100),
      },
      {
        variant_type: 'hook',
        mode: 'tension',
        content: 'Tu fais peut-etre cette erreur sans la voir',
        why: 'Cree une tension claire sans inventer de performance.',
        based_on: [weakSignal, projectName],
        score: clampScore(result.hook.score + 10),
        confidence: clampScore(confidence * 100),
      },
      {
        variant_type: 'hook',
        mode: 'proof',
        content: `J ai teste ca: ${proofSignal.toLowerCase()}`,
        why: 'Met une preuve ou un resultat avant le contexte.',
        based_on: [proofSignal, graph.structuredSignals.hook_type],
        score: clampScore(result.hook.score + 8),
        confidence: clampScore(confidence * 100),
      },
      {
        variant_type: 'hook',
        mode: 'storytelling',
        content: `Au debut je pensais que ${weakSignal.toLowerCase()} etait normal`,
        why: 'Ouvre une boucle narrative reliee a l erreur detectee.',
        based_on: [weakSignal, result.coachAnalysis?.patternLabel].filter(Boolean),
        score: clampScore(result.hook.score + 6),
        confidence: clampScore(confidence * 100 - 4),
      },
      {
        variant_type: 'hook',
        mode: 'short',
        content: baseExecutionHook.length > 58 ? baseExecutionHook.slice(0, 55).replace(/\s+\S*$/, '') : `Stop: ${projectName} change ici`,
        why: 'Version plus courte pour reduire la friction.',
        based_on: ['hook_length', weakSignal],
        score: clampScore(result.hook.score + 5),
        confidence: clampScore(confidence * 100 - 6),
      },
      {
        variant_type: 'hook',
        mode: 'aggressive',
        content: 'Arrete de commencer tes videos comme ca',
        why: 'Plus fort, utile si le style createur accepte plus de tension.',
        based_on: [weakSignal, 'tension'],
        score: clampScore(result.hook.score + 4),
        confidence: clampScore(confidence * 100 - 8),
      },
    ].map((row) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      status: 'generated',
      ...row,
    }));

    const executionCtaVariants = [
      ['comment', 'Commente "hook" et je te donne la version courte.', 'CTA commentaire simple, facile a executer.'],
      ['engagement', 'Lequel tu aurais garde: A ou B ?', 'Force une reponse comparative.'],
      ['emotion', 'Si tu t es reconnu, sauvegarde avant de poster.', 'Connecte le CTA au probleme detecte.'],
      ['short', result.repostVersion?.cta ?? 'Tu testes ca ?', 'Reduit la longueur du CTA.'],
      ['tension', 'La plupart corrigent le montage, pas le vrai probleme.', 'CTA plus tendu pour pousser la discussion.'],
    ].map(([mode, content, why], index) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      variant_type: 'cta',
      mode,
      content,
      why,
      based_on: [String(ctaScore), projectErrors[0]].filter(Boolean),
      score: clampScore(ctaScore + 8 - index),
      confidence: clampScore(confidence * 100 - index * 3),
      status: 'generated',
    }));

    const executionCaptionVariants = [
      {
        mode: 'clean',
        content: `${baseExecutionHook} ${result.repostVersion?.cta ?? result.coachAnalysis?.optimizedCtas?.[0] ?? 'Tu testerais quelle version ?'}`,
        why: 'Caption courte qui ne dilue pas le hook.',
      },
      {
        mode: 'curiosity',
        content: `Le probleme n est pas toujours le montage. Parfois c est ${weakSignal.toLowerCase()}.`,
        why: 'Cree une boucle ouverte reliee au diagnostic.',
      },
      {
        mode: 'proof',
        content: 'Avant de repost, regarde les 3 premieres secondes: c est souvent la que tout se joue.',
        why: 'Positionne la video comme preuve/action, sans fausses stats.',
      },
      {
        mode: 'community',
        content: 'Tu gardes quelle intro: directe, preuve ou storytelling ?',
        why: 'Invite une comparaison utile pour nourrir la feedback loop.',
      },
    ].map((row, index) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      variant_type: 'caption',
      based_on: [projectName, graph.structuredSignals.niche, graph.structuredSignals.format_type].filter(Boolean),
      score: clampScore(64 - index * 2),
      confidence: clampScore(confidence * 100 - index * 2),
      status: 'generated',
      ...row,
    }));

    writes.push(
      supabase.from('execution_variants').insert([
        ...executionHookVariants,
        ...executionCtaVariants,
        ...executionCaptionVariants,
      ]).then(({ error }) => {
        if (error) console.warn('[content-execution] variants save failed:', error.message);
      })
    );

    const currentOrder = result.coachAnalysis?.videoSegments?.slice(0, 4).map((segment) => segment.mainProblem) ?? ['contexte', 'explication', 'preuve', 'CTA'];
    const recommendedOrder = result.repostVersion?.structure ?? ['preuve', 'payoff', 'explication', 'CTA'];
    writes.push(
      supabase.from('structure_rewrites').insert({
        user_id: userId,
        project_id: projectId,
        analysis_id: analysisId,
        current_order: currentOrder,
        recommended_order: recommendedOrder,
        reason: result.coachAnalysis?.detectedProblems?.[0]?.explanation ?? 'Le payoff doit arriver avant que le contexte prenne trop de place.',
        expected_impact: 'Reduire le risque de scroll en donnant une raison de rester plus tot.',
        confidence: clampScore(confidence * 100),
      }).then(({ error }) => {
        if (error) console.warn('[content-execution] structure rewrite save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('auto_variant_sets').insert([
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          title: 'Hooks a comparer',
          variants: executionHookVariants.slice(0, 4).map((variant) => variant.content),
          test_suggestion: 'Tester direct vs preuve sur le prochain repost.',
          save_reason: 'Alimente Hook Vault et mémoire créateur.',
          updated_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          title: 'CTA a tester',
          variants: executionCtaVariants.slice(0, 4).map((variant) => variant.content),
          test_suggestion: 'Comparer question courte vs CTA commentaire.',
          save_reason: 'Permet au moteur de prioriser les CTA vraiment utiles.',
          updated_at: new Date().toISOString(),
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          title: 'Captions pretes',
          variants: executionCaptionVariants.slice(0, 3).map((variant) => variant.content),
          test_suggestion: 'Associer la caption curiosity au hook tension.',
          save_reason: 'Garde les angles reutilisables par niche/projet.',
          updated_at: new Date().toISOString(),
        },
      ]).then(({ error }) => {
        if (error) console.warn('[content-execution] auto variant sets save failed:', error.message);
      })
    );

    const firstTimelineTime = result.coachAnalysis?.timeline?.[0]?.time ?? '0:00-0:03';
    const weakTimelineTime = result.structuredDiagnostics?.[0]?.timestamp ?? result.coachAnalysis?.timeline?.[1]?.time ?? '0:03-0:06';
    const executionPatternInterruptCount = result.videoIntelligence?.technicalSignals?.visual.patternInterrupts.length
      ?? result.videoIntelligence?.visualSignals.cutDensityEstimate
      ?? 0;
    writes.push(
      supabase.from('editing_suggestions').insert([
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          suggestion_type: 'zoom',
          timestamp_label: firstTimelineTime,
          suggestion: 'Ajouter un zoom leger au moment ou la preuve arrive.',
          reason: 'Renforce le payoff sans transformer Viralynz en editeur video complet.',
          confidence: clampScore(confidence * 100),
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          suggestion_type: 'cut_speed',
          timestamp_label: weakTimelineTime,
          suggestion: 'Raccourcir le plan ou accelerer le cut avant la prochaine phrase.',
          reason: result.retention.weaknesses[0] ?? 'Risque de baisse de rythme detecte.',
          confidence: clampScore(100 - result.retention.score),
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          suggestion_type: 'on_screen_text',
          timestamp_label: firstTimelineTime,
          suggestion: 'Afficher la promesse en texte ecran sur une ligne courte.',
          reason: 'Aide le viewer a comprendre avant meme le son.',
          confidence: 62,
        },
        {
          user_id: userId,
          project_id: projectId,
          analysis_id: analysisId,
          suggestion_type: 'pattern_interrupt',
          timestamp_label: weakTimelineTime,
          suggestion: executionPatternInterruptCount === 0 ? 'Ajouter cut, zoom ou changement de cadrage.' : 'Placer le pattern interrupt plus proche du drop.',
          reason: `${executionPatternInterruptCount} pattern interrupt detecte dans les signaux disponibles.`,
          confidence: executionPatternInterruptCount === 0 ? 66 : 54,
        },
      ]).then(({ error }) => {
        if (error) console.warn('[content-execution] editing suggestions save failed:', error.message);
      })
    );

    const proofSpeedScore = clampScore(100 - (result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 5) * 10);
    const reputationGrade = (score: number) => score >= 82 ? 'Elite' : score >= 68 ? 'Strong' : score >= 52 ? 'Developing' : 'Weak';
    const dominantArchetype = proofSpeedScore >= Math.max(result.hook.score, ctaScore)
      ? {
          archetype_key: 'proof_builder',
          label: 'Proof Builder',
          description: 'Tu gagnes quand la video montre une preuve avant de trop expliquer.',
          recommendation_style: 'Prioriser hooks preuve, avant/apres, resultats visibles et payoff avance.',
          benchmark_lens: 'Comparer tes videos par vitesse de preuve et clarte du resultat.',
          confidence: proofSpeedScore,
        }
      : result.hook.score >= result.retention.score
        ? {
            archetype_key: 'fast_hooker',
            label: 'Fast Hooker',
            description: 'Tu performes mieux quand le hook est court, frontal et tres lisible.',
            recommendation_style: 'Raccourcir intro, supprimer contexte, garder une promesse par hook.',
            benchmark_lens: 'Comparer les hooks par densite et temps avant payoff.',
            confidence: clampScore(result.hook.score),
          }
        : {
            archetype_key: 'tension_creator',
            label: 'Tension créateur',
            description: 'Tu gagnes quand la video pose un conflit net des la premiere phrase.',
            recommendation_style: 'Tester hooks contradiction, erreur cachee et choix A/B.',
            benchmark_lens: 'Comparer par intensite du conflit et vitesse de comprehension.',
            confidence: clampScore(result.retention.score),
          };
    const viralynzConcepts = [
      {
        concept_key: 'slow_payoff',
        label: 'Slow Payoff',
        definition: 'La video explique avant de donner la recompense.',
        trigger: (result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 0) > 4 ? 'Payoff detecte apres la fenetre forte.' : 'A surveiller quand le contexte prend trop de place.',
        example: 'Avancer resultat, preuve ou transformation avant explication.',
        severity: (result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 0) > 4 ? 'critical' : 'watch',
        confidence: (result.videoIntelligence?.technicalSignals?.structure.timeToPayoffSec ?? 0) > 4 ? 76 : 44,
      },
      {
        concept_key: 'scroll_risk',
        label: 'Scroll Risk',
        definition: 'Moment ou le viewer comprend le sujet mais pas encore pourquoi rester.',
        trigger: result.retention.score < 62 ? 'Retention score interne faible.' : 'Risque faible sur le dernier diagnostic.',
        example: 'Ajouter pattern interrupt, preuve ou contraste.',
        severity: result.retention.score < 62 ? 'important' : 'watch',
        confidence: clampScore(100 - result.retention.score + 42),
      },
      {
        concept_key: 'dead_intro',
        label: 'Dead Intro',
        definition: 'Intro descriptive qui repousse la tension.',
        trigger: weakSignal,
        example: 'Remplacer contexte par preuve ou conflit.',
        severity: /intro|hook|debut/i.test(weakSignal) ? 'critical' : 'watch',
        confidence: clampScore(46 + projectErrors.length * 8),
      },
      {
        concept_key: 'weak_cta',
        label: 'Weak CTA',
        definition: 'CTA trop vague, trop tardif ou sans friction minimale.',
        trigger: ctaScore < 64 ? 'CTA score interne sous le niveau attendu.' : 'CTA stable, a optimiser par tests.',
        example: 'Transformer en question courte ou choix A/B.',
        severity: ctaScore < 64 ? 'important' : 'watch',
        confidence: clampScore(100 - ctaScore + 44),
      },
      {
        concept_key: 'retention_break',
        label: 'Retention Break',
        definition: 'Rupture de rythme ou segment faible dans la timeline.',
        trigger: result.retention.weaknesses[0] ?? projectErrors[0] ?? 'Pattern retention en calibration.',
        example: 'Couper plus vite, ajouter texte ecran ou changer de plan.',
        severity: result.retention.score < 58 ? 'critical' : 'important',
        confidence: clampScore(confidence * 100),
      },
      {
        concept_key: 'late_proof',
        label: 'Late Proof',
        definition: 'La preuve arrive apres la promesse au lieu de la porter.',
        trigger: result.hook.score < 66 ? 'Hook a besoin de preuve plus tot.' : 'Preuve deja assez visible dans certains hooks.',
        example: 'Commencer par resultat, screenshot, avant/apres ou demonstration.',
        severity: result.hook.score < 66 ? 'important' : 'strength',
        confidence: clampScore(100 - result.hook.score + 48),
      },
    ].map((concept) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      ...concept,
    }));

    writes.push(
      supabase.from('viralynz_vocabulary_events').insert(viralynzConcepts).then(({ error }) => {
        if (error) console.warn('[product-identity] vocabulary save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('creator_archetypes').upsert({
        user_id: userId,
        project_id: projectId,
        ...dominantArchetype,
        dominant_signals: [proofSignal, weakSignal, graph.benchmarkInsights[0]].filter(Boolean),
        active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,project_id,archetype_key' }).then(({ error }) => {
        if (error) console.warn('[product-identity] archetype save failed:', error.message);
      })
    );

    const reputationMetrics = [
      {
        metric_key: 'hook_precision',
        label: 'Hook Precision',
        score: clampScore(result.hook.score),
        evidence: 'Base sur score hook et variantes sauvegardees.',
      },
      {
        metric_key: 'retention_structure',
        label: 'Retention Structure',
        score: clampScore(result.retention.score),
        evidence: 'Base sur rythme, drops probables et structure.',
      },
      {
        metric_key: 'cta_timing',
        label: 'CTA Timing',
        score: ctaScore,
        evidence: 'Base sur clarte CTA, position et force engagement.',
      },
      {
        metric_key: 'proof_speed',
        label: 'Proof Speed',
        score: proofSpeedScore,
        evidence: 'Base sur temps estime avant payoff/preuve.',
      },
      {
        metric_key: 'execution_readiness',
        label: 'Execution Readiness',
        score: clampScore((result.hook.score + ctaScore + repostPotential) / 3),
        evidence: 'Base sur hooks, CTA, captions et suggestions montage pretes.',
      },
    ].map((metric) => ({
      user_id: userId,
      project_id: projectId,
      analysis_id: analysisId,
      grade: reputationGrade(metric.score),
      ...metric,
    }));

    writes.push(
      supabase.from('creator_reputation_metrics').insert(reputationMetrics).then(({ error }) => {
        if (error) console.warn('[product-identity] reputation save failed:', error.message);
      })
    );

    const identityScore = clampScore(
      dominantArchetype.confidence * 0.24
        + reputationMetrics.reduce((sum, metric) => sum + metric.score, 0) / Math.max(1, reputationMetrics.length) * 0.36
        + projectProgression * 0.2
        + clampScore((result.hook.score + result.retention.score + ctaScore) / 3) * 0.2,
    );
    writes.push(
      supabase.from('creator_identity_cards').upsert({
        user_id: userId,
        project_id: projectId,
        title: dominantArchetype.label,
        dominant_style: result.coachAnalysis?.patternLabel ?? graph.structuredSignals.format_type ?? 'Style en calibration',
        content_reputation: `${reputationMetrics[0].label}: ${reputationMetrics[0].grade}`,
        strengths: [
          ...(result.hook.strengths ?? []),
          ...(result.retention.strengths ?? []),
          proofSignal,
        ].filter(Boolean).slice(0, 4),
        weaknesses: [
          ...(result.hook.weaknesses ?? []),
          ...(result.retention.weaknesses ?? []),
          weakSignal,
        ].filter(Boolean).slice(0, 4),
        evolution: [
          `Projet ${projectName}: progression ${projectProgression}/100.`,
          result.coachAnalysis?.memory?.nextRecommendation ?? result.actionPlan?.[0],
          dominantArchetype.recommendation_style,
        ].filter(Boolean),
        identity_score: identityScore,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,project_id' }).then(({ error }) => {
        if (error) console.warn('[product-identity] identity card save failed:', error.message);
      })
    );

    writes.push(
      supabase.from('product_language_events').insert([
        {
          user_id: userId,
          project_id: projectId,
          phrase: 'Reduce the Scroll Risk',
          usage: 'Quand une video est claire mais ne donne pas encore assez de raison de rester.',
          language_scope: 'creator',
        },
        {
          user_id: userId,
          project_id: projectId,
          phrase: 'Payoff before context',
          usage: 'Regle de repost: preuve, resultat ou tension avant explication.',
          language_scope: 'creator',
        },
        {
          user_id: userId,
          project_id: projectId,
          phrase: `${dominantArchetype.label} Lens`,
          usage: dominantArchetype.benchmark_lens,
          language_scope: 'project',
        },
      ]).then(({ error }) => {
        if (error) console.warn('[product-identity] language save failed:', error.message);
      })
    );
  }

  writes.push(
    supabase.from('hook_history').insert({
      user_id: userId,
      analysis_id: analysisId,
      hook_text: result.repostVersion?.hook ?? result.hook.analysis,
      hook_score: clampScore(result.hook.score),
      hook_style: result.coachAnalysis?.dominantHookSource ?? result.coachAnalysis?.patternLabel,
      payoff_timestamp: technical?.speech.payoffTimestamp,
      evidence: {
        opening: result.coachAnalysis?.openingAnalysis,
        hookSources: result.coachAnalysis?.hookSources,
        technicalPayoff: technical?.structure.timeToPayoffSec,
      },
      confidence,
    }).then(({ error }) => {
      if (error) console.warn('[proprietary-engine] hook history save failed:', error.message);
    })
  );

  if (result.repostVersion) {
    writes.push(
      supabase.from('repost_history').insert({
        user_id: userId,
        analysis_id: analysisId,
        repost_json: result.repostVersion,
        source_signals: {
          diagnostics: result.structuredDiagnostics?.slice(0, 6),
          technical: technical?.structure,
          explainability: result.explainability,
          memory: result.coachAnalysis?.memory,
        },
        repost_score: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
        confidence,
      }).then(({ error }) => {
        if (error) console.warn('[proprietary-engine] repost history save failed:', error.message);
      })
    );
  }

  writes.push(
    supabase.from('score_history').insert({
      user_id: userId,
      analysis_id: analysisId,
      global_score: clampScore(result.viralityScore),
      hook_score: clampScore(scoreBreakdown?.hook ?? result.hook.score),
      retention_score: clampScore(scoreBreakdown?.retention ?? result.retention.score),
      cta_score: clampScore(scoreBreakdown?.cta ?? result.viralityScore),
      clarity_score: clampScore(scoreBreakdown?.clarity ?? result.viralityScore),
      repost_potential: clampScore(scoreBreakdown?.repostPotential ?? result.viralityScore),
      engine_version: result.explainability?.engineVersion,
      scoring_version: result.explainability?.scoringVersion,
      prompt_version: result.explainability?.promptVersion,
      rules_version: result.explainability?.rulesVersion,
      replay_key: result.explainability?.replayKey,
      scoring_json: {
        scoreBreakdown: result.coachAnalysis?.scoreBreakdown,
        detailedScores: result.coachAnalysis?.detailedScores,
        explainability: result.explainability,
        verdict: result.finalVerdict,
      },
    }).then(({ error }) => {
      if (error) console.warn('[proprietary-engine] score history save failed:', error.message);
    })
  );

  const leaderboardStructure = clampScore(((scoreBreakdown?.clarity ?? result.viralityScore) + result.editing.score) / 2);
  const leaderboardRepost = clampScore(
    ((result.coachAnalysis?.repostEngine.scoreAfter ?? result.viralityScore) - (result.coachAnalysis?.repostEngine.scoreBefore ?? result.viralityScore)) + 50,
  );
  const leaderboardConsistency = clampScore((result.viralityScore + result.hook.score + result.retention.score + leaderboardStructure) / 4);
  const leaderboardQuality = clampScore(
    result.hook.score * 0.18
      + leaderboardStructure * 0.16
      + result.retention.score * 0.18
      + leaderboardRepost * 0.16
      + result.viralityScore * 0.18
      + leaderboardConsistency * 0.14,
  );
  const leaderboardEvidence = result.coachAnalysis?.detectedProblems?.[0]?.action
    ?? result.actionPlan?.[0]
    ?? 'Classement base sur qualite hook, structure, retention, repost, progression et coherence.';

  writes.push(
    supabase.from('creator_leaderboard_entries').insert({
      user_id: userId,
      analysis_id: analysisId,
      scope: graph.structuredSignals.niche ? 'niche' : 'creator',
      category: 'main',
      niche: graph.structuredSignals.niche,
      quality_score: leaderboardQuality,
      hook_quality: clampScore(result.hook.score),
      structure_quality: leaderboardStructure,
      retention_signals: clampScore(result.retention.score),
      repost_improvement: leaderboardRepost,
      creator_progress: clampScore(result.viralityScore),
      consistency: leaderboardConsistency,
      movement: 'new',
      evidence: leaderboardEvidence,
      signal_weights: {
        hook_quality: 0.18,
        structure_quality: 0.16,
        retention_signals: 0.18,
        repost_improvement: 0.16,
        creator_progress: 0.18,
        consistency: 0.14,
      },
      source_signals: {
        structuredSignals: graph.structuredSignals,
        scoreBreakdown,
        confidence,
        diagnostics: result.structuredDiagnostics?.slice(0, 4),
      },
      engine_version: result.explainability?.engineVersion,
      scoring_version: result.explainability?.scoringVersion,
    }).then(({ error }) => {
      if (error) console.warn('[leaderboard] entry save failed:', error.message);
    })
  );

  const badgeRows = [
    {
      badge_key: 'hook_precision',
      label: 'Hook Precision',
      score: clampScore(result.hook.score),
      unlocked: clampScore(result.hook.score) >= 72,
      evidence: result.hook.strengths?.[0] ?? 'Hook plus clair et plus direct.',
    },
    {
      badge_key: 'retention_builder',
      label: 'Retention Builder',
      score: clampScore(result.retention.score),
      unlocked: clampScore(result.retention.score) >= 72,
      evidence: result.retention.strengths?.[0] ?? 'Structure avec de meilleurs signaux de retention.',
    },
    {
      badge_key: 'repost_specialist',
      label: 'Repost Specialist',
      score: leaderboardRepost,
      unlocked: leaderboardRepost >= 66,
      evidence: result.repostVersion?.angle ?? 'Transformation repost exploitable.',
    },
    {
      badge_key: 'pattern_expert',
      label: 'Pattern Expert',
      score: clampScore(42 + (result.coachAnalysis?.detectedProblems?.length ?? 0) * 8),
      unlocked: (result.coachAnalysis?.detectedProblems?.length ?? 0) >= 4,
      evidence: 'Patterns recurrents detectes dans les diagnostics Viralynz.',
    },
  ].map((badge) => ({
    user_id: userId,
    source_analysis_id: analysisId,
    updated_at: new Date().toISOString(),
    ...badge,
  }));

  writes.push(
    supabase.from('creator_badges').upsert(badgeRows, { onConflict: 'user_id,badge_key' }).then(({ error }) => {
      if (error) console.warn('[leaderboard] badge save failed:', error.message);
    })
  );

  const patternRows = [
    ...(result.coachAnalysis?.detectedProblems ?? []).slice(0, 4).map((item) => ({
      pattern_type: item.id.includes('cta') ? 'cta' : item.id.includes('hook') ? 'hook' : item.id.includes('retention') ? 'retention' : 'risk',
      label: item.title,
      evidence: item.impact,
      confidence: item.severity === 'critique' ? 0.78 : item.severity === 'important' ? 0.66 : 0.54,
    })),
    ...(result.coachAnalysis?.memory?.favoritePatterns ?? []).slice(0, 2).map((label) => ({
      pattern_type: 'style',
      label,
      evidence: 'Pattern extrait de la memoire createur Viralynz.',
      confidence: 0.58,
    })),
  ].map((row) => ({
    user_id: userId,
    analysis_id: analysisId,
    source: 'viralynz_engine',
    ...row,
  }));

  if (patternRows.length) {
    writes.push(
      supabase.from('creator_patterns').insert(patternRows).then(({ error }) => {
        if (error) console.warn('[proprietary-engine] pattern save failed:', error.message);
      })
    );
  }

  writes.push(
    supabase.from('creator_stats').upsert({
      user_id: userId,
      analysis_count: 1,
      avg_score: clampScore(result.viralityScore),
      avg_hook_score: clampScore(result.hook.score),
      avg_retention_score: clampScore(result.retention.score),
      avg_cta_score: clampScore(scoreBreakdown?.cta ?? result.viralityScore),
      recurring_patterns: result.coachAnalysis?.memory?.recurrentWeaknesses ?? [],
      style_evolution: result.coachAnalysis?.memory?.favoritePatterns ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }).then(({ error }) => {
      if (error) console.warn('[proprietary-engine] creator stats save failed:', error.message);
    })
  );

  writes.push(
    supabase.from('creator_dna_snapshots').insert({
      user_id: userId,
      dna_json: {
        dominantStyle: graph.structuredSignals.format_type,
        hookType: graph.structuredSignals.hook_type,
        ctaType: graph.structuredSignals.cta_type,
        visualDensity: graph.structuredSignals.visual_density,
        speechSpeed: graph.structuredSignals.speech_speed,
        recurringErrors: result.coachAnalysis?.memory?.recurrentWeaknesses ?? [],
        strengths: result.hook.strengths,
        weaknesses: result.hook.weaknesses,
      },
      source_analysis_count: 1,
    }).then(({ error }) => {
      if (error) console.warn('[content-os] creator dna save failed:', error.message);
    })
  );

  await Promise.allSettled(writes);
}
