import type { ScalabilityArchitecture } from './scalability-architecture';

export interface ScaleInfrastructure {
  queues: string[];
  cronJobs: string[];
  embeddings: string[];
  vectorSearch: string[];
  aiCaching: string[];
  analyticsPipelines: string[];
  scalableStorage: string[];
  monitoring: string[];
  retries: string[];
  syncOrchestration: string[];
}

export function scaleInfrastructureEngine(architecture: ScalabilityArchitecture): ScaleInfrastructure {
  return {
    queues: architecture.queueWorkers,
    cronJobs: architecture.cronSyncs,
    embeddings: architecture.embeddings,
    vectorSearch: architecture.vectorStorage,
    aiCaching: architecture.aiCaching,
    analyticsPipelines: architecture.analyticsCache,
    scalableStorage: ['analysis_result_versions', 'compressed_transcripts', 'frame_retention_policy'],
    monitoring: architecture.monitoring,
    retries: architecture.retries,
    syncOrchestration: ['sync_budget', 'per_workspace_schedule', 'idempotent_jobs'],
  };
}
