import { describe, expect, it } from 'vitest';
import { dailyInsightEngine } from '@/lib/daily-insight-engine';
import { buildCreatorMemory, creatorMemoryEngine } from '@/lib/creator-memory-engine';
import { rankRepostPriorities, scoreRepostPriority } from '@/lib/repost-priority-engine';
import { buildGrowthOperatingSystem } from '@/lib/growth-operating-system';
import { videoPerformanceHistory } from '@/lib/video-performance-history';
import { buildHookTestGroups } from '@/lib/multi-hook-test-engine';
import { creatorProfileEngine } from '@/lib/creator-profile-engine';
import { contentPrioritizationAI } from '@/lib/content-prioritization-ai';
import { platformAdapters } from '@/lib/platform-adapters';
import { agencyWorkspaceBlueprint } from '@/lib/team-agency-foundations';
import { getTikTokAccountLimitForPlan } from '@/lib/tiktok-plan-limits';
import type { AnalysisResult } from '@/lib/types';

function result(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    viralityScore: 68,
    hook: {
      score: 58,
      rating: 'Moyen',
      analysis: 'Sujet clair mais hook trop lent.',
      strengths: ['Sujet clair'],
      weaknesses: ['Promesse tardive'],
    },
    editing: {
      score: 70,
      rating: 'Bon',
      analysis: 'Rythme correct.',
      strengths: ['Cuts propres'],
      weaknesses: ['Rupture faible'],
    },
    retention: {
      score: 61,
      rating: 'Moyen',
      analysis: 'Payoff tardif.',
      strengths: ['Sujet exploitable'],
      weaknesses: ['Drop avant la preuve'],
    },
    improvements: [{ priority: 'haute', tip: 'Avancer la preuve avant 0:05.' }],
    coachAnalysis: {
      videoPattern: 'facecam_tiktok',
      patternLabel: 'Facecam',
      subScores: {
        hook: 56,
        retention: 60,
        clarity: 64,
        tension: 58,
        cta: 52,
        repostPotential: 82,
        engagementPotential: 66,
        rewatchPotential: 72,
      },
      weightedScore: 68,
      verdict: 'Fort potentiel de repost',
      coachSummary: 'Le sujet est bon, le hook doit etre plus direct.',
      detectedProblems: [{
        id: 'hook_too_slow',
        severity: 'critique',
        title: 'Hook trop lent',
        explanation: 'La promesse arrive apres le contexte.',
        impact: 'Drop probable avant 0:05.',
        action: 'Commencer par la preuve ou le resultat.',
      }],
      criticalErrors: [],
      benchmarks: [],
      hookVariants: ['STOP DE FAIRE CETTE ERREUR'],
      optimizedCtas: ['Tu veux la version courte ?'],
      priorityActions: { critical: ['Commencer par la preuve.'], important: [], optimization: [] },
      repostEngine: {
        recommended: true,
        estimatedGain: 18,
        improvementProbability: 78,
        priorityChanges: ['Commencer par la preuve.'],
        scoreBefore: 68,
        scoreAfter: 84,
        repostPotentialCeiling: 86,
      },
      memory: {
        recurrentWeaknesses: ['Hook trop lent'],
        favoritePatterns: ['Facecam'],
        creatorEvolution: 'Pattern recurrent.',
        nextRecommendation: 'Tester un hook plus court.',
      },
    },
    repostVersion: {
      hook: 'STOP DE FAIRE CETTE ERREUR',
      structure: ['Hook', 'Preuve', 'CTA'],
      onScreenText: ['Erreur a corriger'],
      cta: 'Tu veux la version courte ?',
      angle: 'Angle direct.',
    },
    ...overrides,
  };
}

const items = [
  { id: 'a', created_at: '2026-05-10T10:00:00.000Z', video_url: 'https://tiktok.com/a', result: result() },
  { id: 'b', created_at: '2026-05-09T10:00:00.000Z', video_url: 'https://tiktok.com/b', result: result({ viralityScore: 52, hook: { ...result().hook, score: 46 } }) },
];

describe('growth engines', () => {
  it('scores repost priorities with actionable dimensions', () => {
    const scored = scoreRepostPriority(items[0]);

    expect(scored.repostScore).toBeGreaterThan(65);
    expect(scored.watchtimePotential).toBeGreaterThan(60);
    expect(scored.recommendedFix).toContain('preuve');
  });

  it('ranks the strongest repost opportunity first', () => {
    const ranked = rankRepostPriorities(items);

    expect(ranked[0].id).toBe('b');
    expect(ranked[0].label).toBeTruthy();
  });

  it('builds creator memory from repeated real analysis signals', () => {
    const memory = buildCreatorMemory(items);

    expect(memory.weaknesses).toContain('Hook trop lent');
    expect(memory.bestFormats).toContain('Facecam');
    expect(memory.creatorScore).toBeGreaterThan(0);
    expect(creatorMemoryEngine(items).level).toBe(memory.level);
  });

  it('generates a daily insight without inventing TikTok metrics', () => {
    const daily = dailyInsightEngine(items);

    expect(daily.sourceLabel).toBe('Base sur tes analyses Viralynz disponibles');
    expect(daily.todayTasks).toHaveLength(3);
    expect(daily.repostPriorities[0].id).toBe('b');
  });

  it('creates video performance history and repost workflow states', () => {
    const history = videoPerformanceHistory(items);

    expect(history[0].hookVersions.length).toBeGreaterThan(0);
    expect(history[0].modificationHistory.map((entry) => entry.label)).toContain('Plan repost');
    expect(['draft_repost', 'hook_selectionne', 'repost_pret']).toContain(history[0].workflowState);
  });

  it('builds multi-hook test groups with a winner candidate', () => {
    const groups = buildHookTestGroups(items);

    expect(groups[0].variants.length).toBeGreaterThan(0);
    expect(groups[0].winnerId).toBeTruthy();
  });

  it('builds advanced creator profile and content priority decisions', () => {
    const profile = creatorProfileEngine(items);
    const decisions = contentPrioritizationAI(items);

    expect(profile.advancedInsights.length).toBeGreaterThanOrEqual(3);
    expect(decisions[0].nextAction).toBeTruthy();
  });

  it('prepares platform and agency architecture', () => {
    expect(platformAdapters.tiktok.adaptHook('STOP maintenant')).toBe('STOP maintenant');
    expect(platformAdapters.instagram_reels.adaptHook('STOP maintenant')).toContain('Regarde');
    expect(agencyWorkspaceBlueprint.roles).toContain('editor');
  });

  it('enforces TikTok account limits by plan tier', () => {
    expect(getTikTokAccountLimitForPlan('free')).toBe(0);
    expect(getTikTokAccountLimitForPlan('creator')).toBe(1);
    expect(getTikTokAccountLimitForPlan('pro')).toBe(3);
    expect(getTikTokAccountLimitForPlan('scale')).toBe(8);
  });

  it('aggregates the full growth operating system', () => {
    const os = buildGrowthOperatingSystem(items);

    expect(os.daily.todayTasks).toHaveLength(3);
    expect(os.history.length).toBe(items.length);
    expect(os.calendar.length).toBeGreaterThan(0);
    expect(os.trends.length).toBeGreaterThan(0);
    expect(os.workspace.tables).toContain('workspaces');
    expect(os.agencyMode.clients[0].analyticsSummary).toBeTruthy();
    expect(os.contentBoard.columns.map((column) => column.id)).toContain('a_repost');
    expect(os.hookLibrary[0].tags).toContain('repost');
    expect(os.templates.map((template) => template.kind)).toContain('cta');
    expect(os.analytics.comparisons.length).toBeGreaterThan(0);
    expect(os.recommendationsV2[0].estimatedImpact).toBeGreaterThan(0);
    expect(os.repostPipelines[0].versionWatchtime).toBeTruthy();
    expect(os.assistant.map((item) => item.type)).toContain('hook');
    expect(os.shortsIntelligence.platformSignals.length).toBe(3);
    expect(os.knowledgeGraph.creatorGraphMemory.length).toBeGreaterThan(0);
    expect(os.notificationEngine.map((item) => item.type)).toContain('daily_update');
    expect(os.retention.returningReasons).toContain('Insight quotidien');
    expect(os.scaleFoundations.queueJobs).toContain('video_analysis');
    expect(os.videoSignals[0].pacingAnalysis).toBeTruthy();
    expect(os.predictions[0].disclaimer).toContain('garantie');
    expect(os.rewrites.map((rewrite) => rewrite.mode)).toContain('plus_watchtime');
    expect(os.contentStrategy.strategySuggestions.length).toBeGreaterThan(0);
    expect(os.feedbackLoop[0].learning).toBeTruthy();
    expect(os.collaboration.assignments.length).toBeGreaterThan(0);
    expect(os.reports.exportReadiness.pdfFuture).toBe(true);
    expect(os.trendDetection[0].velocity).toBeGreaterThan(0);
    expect(os.aiCreatorProfile.strategicRecommendations.length).toBeGreaterThan(0);
    expect(os.repostExperiments.trackingFields).toContain('watchtime_proxy');
    expect(os.dailyMechanics.returningReasons).toContain('Insight quotidien');
    expect(os.scalabilityArchitecture.vectorStorage).toContain('hook_embeddings');
    expect(os.premiumPositioning.headline).toContain('AI Content');
    expect(os.contentBrain.reasoningSummary).toBeTruthy();
    expect(os.performanceDNA.summary).toBeTruthy();
    expect(os.videoDecisions[0].reason).toBeTruthy();
    expect(os.aiCoach.length).toBeGreaterThan(0);
    expect(os.contentClusters[0].watchtimeSignal).toBeGreaterThan(0);
    expect(os.trendIntelligence.trendingPacing).toContain('Preuve avant 0:05');
    expect(os.aiRepostVariants[0].estimatedScore).toBeGreaterThan(0);
    expect(os.creatorEvolution.summary).toContain('Hooks');
    expect(os.experiments.map((experiment) => experiment.type)).toContain('hook');
    expect(os.teamModeV2.validationWorkflows).toContain('hook_approval');
    expect(os.reportsV2.formats).toContain('dashboard');
    expect(os.platformIntelligence.length).toBe(3);
    expect(os.retentionV2.dailyOpportunities).toContain('Insight quotidien');
    expect(os.scaleInfrastructure.vectorSearch).toContain('hook_embeddings');
    expect(os.creatorOS.dailyCommandCenter.length).toBeGreaterThan(0);
    expect(os.memoryGraph.nodes.length).toBeGreaterThan(0);
    expect(os.videoReasoning[0].rootCause).toBeTruthy();
    expect(os.successPredictions[0].confidence).toBeGreaterThan(0);
    expect(os.rewriteStudio[0].hooks.length).toBeGreaterThan(0);
    expect(os.experimentSystem[0].performanceTracking).toContain('prediction_score');
    expect(os.advancedTrends.momentum[0].velocity).toBeGreaterThan(0);
    expect(os.strategyLayer.postingFrequency).toBeTruthy();
    expect(os.teamAgencyAdvanced.validationWorkflows).toContain('hook_approval');
    expect(os.aiDailyFeed.length).toBeGreaterThan(0);
    expect(os.analyticsDashboard.pacingPatterns).toContain('Opening court');
    expect(os.platformStrategy.length).toBe(3);
    expect(os.knowledgeBase.antiPatterns.length).toBeGreaterThan(0);
    expect(os.aaaProductExperienceV2.cinematicFeel).toContain('AI cockpit');
    expect(os.dailyRetention.opportunities.length).toBeGreaterThan(0);
    expect(os.advancedScale.observability).toContain('structured_logs');
    expect(os.enterpriseFoundations.advancedRoles).toContain('client_viewer');
    expect(os.productPositioningEngine.primaryCategory).toBe('AI Creator OS');
    expect(os.conversionRetentionOptimization.ahaMoments).toContain('best_video_to_repost');
    expect(os.finalPolishScaling.reasoning).toContain('decision_engine');
  });
});
