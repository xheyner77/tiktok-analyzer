export interface ScalabilityArchitecture {
  queueWorkers: string[];
  cronSyncs: string[];
  analyticsCache: string[];
  vectorStorage: string[];
  embeddings: string[];
  aiCaching: string[];
  batching: string[];
  rateLimits: string[];
  retries: string[];
  monitoring: string[];
}

export const scalabilityArchitecture: ScalabilityArchitecture = {
  queueWorkers: ['analysis_worker', 'sync_worker', 'report_worker', 'embedding_worker'],
  cronSyncs: ['daily_insights_cron', 'tiktok_refresh_cron', 'weekly_report_cron'],
  analyticsCache: ['creator_daily_summary', 'video_prediction_cache', 'platform_signal_cache'],
  vectorStorage: ['hook_embeddings', 'caption_embeddings', 'creator_memory_vectors'],
  embeddings: ['hooks', 'transcripts', 'ocr_text', 'strategy_notes'],
  aiCaching: ['rewrite_cache', 'recommendation_cache', 'prediction_cache'],
  batching: ['bulk_signal_refresh', 'bulk_embedding_upsert', 'bulk_report_generation'],
  rateLimits: ['per_workspace_ai_budget', 'per_account_tiktok_sync_budget', 'retry_after_backoff'],
  retries: ['exponential_backoff', 'dead_letter_queue', 'idempotency_keys'],
  monitoring: ['queue_depth', 'sync_failures', 'ai_cost_per_workspace', 'latency_p95'],
};
