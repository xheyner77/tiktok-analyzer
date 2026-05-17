import type { RepostPriorityInput } from './repost-priority-engine';
import { dailyInsightEngine } from './daily-insight-engine';
import { videoPerformanceHistory } from './video-performance-history';
import { buildHookTestGroups } from './multi-hook-test-engine';
import { creatorProfileEngine } from './creator-profile-engine';
import { contentPrioritizationAI } from './content-prioritization-ai';
import { platformAdapters } from './platform-adapters';
import { agencyWorkspaceBlueprint } from './team-agency-foundations';
import { buildContentCalendar } from './content-calendar-engine';
import { trendOpportunityEngine } from './trend-opportunity-engine';
import { buildCreatorWorkspace } from './creator-workspace-engine';
import { buildAgencyModeFoundation } from './agency-mode-engine';
import { buildContentBoard } from './content-board-engine';
import { buildHookLibrary } from './hook-library-engine';
import { contentTemplates } from './template-system';
import { buildAdvancedAnalytics } from './advanced-analytics-engine';
import { aiRecommendationEngineV2 } from './ai-recommendation-engine-v2';
import { buildSmartRepostPipelines } from './smart-repost-pipeline';
import { contentAssistantEngine } from './content-assistant-engine';
import { platformSignals, platformBenchmarks, platformRecommendations } from './shorts-intelligence';
import { buildVideoKnowledgeGraph } from './video-knowledge-graph';
import { notificationAlertEngine } from './notification-alert-engine';
import { buildRetentionSystem } from './retention-system-engine';
import { scaleFoundations } from './scale-foundations';
import { advancedVideoSignals } from './advanced-video-signals';
import { performancePredictionEngine } from './performance-prediction-engine';
import { aiRewriteEngine } from './ai-rewrite-engine';
import { contentStrategyEngine } from './content-strategy-engine';
import { aiFeedbackLoopEngine } from './ai-feedback-loop-engine';
import { teamCollaborationEngine } from './team-collaboration-engine';
import { advancedReportsEngine } from './advanced-reports-engine';
import { trendDetectionEngine } from './trend-detection-engine';
import { aiCreatorProfileEngine } from './ai-creator-profile-engine';
import { advancedRepostSystem } from './advanced-repost-system';
import { dailyUseMechanics } from './daily-use-mechanics';
import { scalabilityArchitecture } from './scalability-architecture';
import { premiumPositioning } from './premium-positioning';
import { contentBrainEngine } from './content-brain-engine';
import { performanceDNAEngine } from './performance-dna-engine';
import { videoDecisionEngine } from './video-decision-engine';
import { aiContentCoachEngine } from './ai-content-coach-engine';
import { contentClusterSystem } from './content-cluster-system';
import { trendIntelligenceEngine } from './trend-intelligence-engine';
import { aiRepostVariantsEngine } from './ai-repost-variants-engine';
import { creatorEvolutionTracking } from './creator-evolution-tracking';
import { aiExperimentEngine } from './ai-experiment-engine';
import { teamModeV2Engine } from './team-mode-v2-engine';
import { advancedAIReportsV2 } from './advanced-ai-reports-v2';
import { multiPlatformIntelligence } from './multi-platform-intelligence';
import { retentionSystemsV2 } from './retention-systems-v2';
import { scaleInfrastructureEngine } from './scale-infrastructure-engine';
import { aiCreatorOperatingSystem } from './ai-creator-os-engine';
import { contentMemoryGraph } from './content-memory-graph';
import { advancedVideoReasoning } from './advanced-video-reasoning';
import { contentSuccessPrediction } from './content-success-prediction';
import { aiContentRewriteStudio } from './ai-content-rewrite-studio';
import { contentExperimentationSystem } from './content-experimentation-system';
import { advancedTrendEngine } from './advanced-trend-engine';
import { aiStrategyLayer } from './ai-strategy-layer';
import { advancedTeamAgencyMode } from './advanced-team-agency-mode';
import { aiDailyFeedEngine } from './ai-daily-feed-engine';
import { advancedAnalyticsDashboardEngine } from './advanced-analytics-dashboard-engine';
import { platformStrategyEngine } from './platform-strategy-engine';
import { aiKnowledgeBaseEngine } from './ai-knowledge-base-engine';
import { aaaProductExperienceV2 } from './aaa-product-experience-v2';
import { dailyRetentionSystems } from './daily-retention-systems';
import { advancedScaleFoundations } from './advanced-scale-foundations';
import { enterpriseFoundations } from './enterprise-foundations';
import { productPositioningEngine } from './product-positioning-engine';
import { conversionRetentionOptimization } from './conversion-retention-optimization';
import { finalPolishScaling } from './final-polish-scaling';

export function buildGrowthOperatingSystem(items: RepostPriorityInput[]) {
  const daily = dailyInsightEngine(items);
  const profile = creatorProfileEngine(items);
  const history = videoPerformanceHistory(items);
  const hookTests = buildHookTestGroups(items);
  const priorities = contentPrioritizationAI(items);
  const calendar = buildContentCalendar(items);
  const trends = trendOpportunityEngine(items, profile);
  const workspace = buildCreatorWorkspace(items);
  const agencyMode = buildAgencyModeFoundation(items);
  const contentBoard = buildContentBoard(items);
  const hookLibrary = buildHookLibrary(items);
  const analytics = buildAdvancedAnalytics(items);
  const recommendationsV2 = aiRecommendationEngineV2(items);
  const repostPipelines = buildSmartRepostPipelines(items);
  const assistant = contentAssistantEngine(items);
  const knowledgeGraph = buildVideoKnowledgeGraph(items);
  const notificationEngine = notificationAlertEngine(items);
  const retention = buildRetentionSystem(items);
  const videoSignals = advancedVideoSignals(items);
  const predictions = performancePredictionEngine(items, videoSignals);
  const rewrites = aiRewriteEngine(items);
  const contentStrategy = contentStrategyEngine(items, profile);
  const feedbackLoop = aiFeedbackLoopEngine(items, predictions);
  const collaboration = teamCollaborationEngine(contentBoard);
  const reports = advancedReportsEngine(items, profile, analytics);
  const trendDetection = trendDetectionEngine(items);
  const aiCreatorProfile = aiCreatorProfileEngine(items, profile);
  const repostExperiments = advancedRepostSystem(repostPipelines);
  const dailyMechanics = dailyUseMechanics(notificationEngine, trendDetection, hookLibrary.map((hook) => hook.hook));
  const contentBrain = contentBrainEngine(items);
  const performanceDNA = performanceDNAEngine(items, contentBrain);
  const videoDecisions = videoDecisionEngine(items, predictions);
  const aiCoach = aiContentCoachEngine(items, performanceDNA, videoDecisions);
  const contentClusters = contentClusterSystem(items);
  const trendIntelligence = trendIntelligenceEngine(trendDetection, contentClusters);
  const aiRepostVariants = aiRepostVariantsEngine(items);
  const creatorEvolution = creatorEvolutionTracking(items);
  const experiments = aiExperimentEngine(performanceDNA, contentClusters);
  const teamModeV2 = teamModeV2Engine(collaboration, agencyMode);
  const reportsV2 = advancedAIReportsV2(reports, contentClusters, creatorEvolution);
  const platformIntelligence = multiPlatformIntelligence(platformAdapters);
  const retentionV2 = retentionSystemsV2(dailyMechanics, trendIntelligence);
  const scaleInfrastructure = scaleInfrastructureEngine(scalabilityArchitecture);
  const creatorOS = aiCreatorOperatingSystem(items, daily, videoDecisions, contentClusters);
  const memoryGraph = contentMemoryGraph(items);
  const videoReasoning = advancedVideoReasoning(items);
  const successPredictions = contentSuccessPrediction(predictions, videoReasoning);
  const rewriteStudio = aiContentRewriteStudio(rewrites);
  const experimentSystem = contentExperimentationSystem(experiments);
  const advancedTrends = advancedTrendEngine(trendIntelligence, trendDetection);
  const strategyLayer = aiStrategyLayer(contentStrategy, performanceDNA);
  const teamAgencyAdvanced = advancedTeamAgencyMode(teamModeV2, reportsV2);
  const aiDailyFeed = aiDailyFeedEngine(aiCoach, videoDecisions, trendIntelligence);
  const analyticsDashboard = advancedAnalyticsDashboardEngine(contentClusters, hookLibrary, analytics, creatorEvolution);
  const platformStrategy = platformStrategyEngine(platformIntelligence);
  const knowledgeBase = aiKnowledgeBaseEngine(memoryGraph, strategyLayer);
  const dailyRetention = dailyRetentionSystems(retentionV2, aiDailyFeed);
  const advancedScale = advancedScaleFoundations(scaleInfrastructure);

  return {
    daily,
    profile,
    history,
    hookTests,
    priorities,
    calendar,
    trends,
    workspace,
    agencyMode,
    contentBoard,
    hookLibrary,
    templates: contentTemplates,
    analytics,
    recommendationsV2,
    repostPipelines,
    assistant,
    shortsIntelligence: {
      platformSignals,
      platformBenchmarks,
      platformRecommendations,
    },
    knowledgeGraph,
    notificationEngine,
    retention,
    videoSignals,
    predictions,
    rewrites,
    contentStrategy,
    feedbackLoop,
    collaboration,
    reports,
    trendDetection,
    aiCreatorProfile,
    repostExperiments,
    dailyMechanics,
    scalabilityArchitecture,
    premiumPositioning,
    contentBrain,
    performanceDNA,
    videoDecisions,
    aiCoach,
    contentClusters,
    trendIntelligence,
    aiRepostVariants,
    creatorEvolution,
    experiments,
    teamModeV2,
    reportsV2,
    platformIntelligence,
    retentionV2,
    scaleInfrastructure,
    creatorOS,
    memoryGraph,
    videoReasoning,
    successPredictions,
    rewriteStudio,
    experimentSystem,
    advancedTrends,
    strategyLayer,
    teamAgencyAdvanced,
    aiDailyFeed,
    analyticsDashboard,
    platformStrategy,
    knowledgeBase,
    aaaProductExperienceV2,
    dailyRetention,
    advancedScale,
    enterpriseFoundations,
    productPositioningEngine,
    conversionRetentionOptimization,
    finalPolishScaling,
    scaleFoundations,
    platformAdapters,
    agencyWorkspaceBlueprint,
  };
}
