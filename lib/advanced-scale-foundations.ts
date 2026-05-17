import type { ScaleInfrastructure } from './scale-infrastructure-engine';

export interface AdvancedScaleFoundations {
  vectorSearch: string[];
  embeddings: string[];
  aiMemoryStorage: string[];
  queues: string[];
  cronOrchestration: string[];
  analyticsPipelines: string[];
  aiCaching: string[];
  retries: string[];
  monitoring: string[];
  observability: string[];
}

export function advancedScaleFoundations(scale: ScaleInfrastructure): AdvancedScaleFoundations {
  return {
    vectorSearch: scale.vectorSearch,
    embeddings: scale.embeddings,
    aiMemoryStorage: ['creator_memory_vectors', 'content_graph_edges', 'rewrite_cache_records'],
    queues: scale.queues,
    cronOrchestration: scale.cronJobs,
    analyticsPipelines: scale.analyticsPipelines,
    aiCaching: scale.aiCaching,
    retries: scale.retries,
    monitoring: scale.monitoring,
    observability: ['structured_logs', 'workspace_cost_metering', 'sync_health_dashboard'],
  };
}
