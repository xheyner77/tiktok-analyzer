export interface ScaleFoundation {
  queueJobs: string[];
  backgroundSyncs: string[];
  caching: string[];
  batching: string[];
  storageOptimizations: string[];
  rateLimitHandling: string[];
  tokenRefreshHandling: string[];
  syncScheduling: string[];
}

export const scaleFoundations: ScaleFoundation = {
  queueJobs: ['video_analysis', 'tiktok_sync', 'daily_insight_generation', 'trend_scan'],
  backgroundSyncs: ['tiktok_accounts', 'analytics_cache', 'token_refresh'],
  caching: ['creator_memory_cache', 'analytics_summary_cache', 'tiktok_stats_cache'],
  batching: ['bulk_video_refresh', 'hook_performance_rollup'],
  storageOptimizations: ['frame_retention_policy', 'transcript_compression', 'analysis_result_versioning'],
  rateLimitHandling: ['per_account_backoff', 'retry_after_respect', 'sync_budget'],
  tokenRefreshHandling: ['encrypted_refresh_tokens', 'refresh_before_expiry', 'disconnect_on_revoked_scope'],
  syncScheduling: ['hourly_light_sync', 'daily_deep_sync', 'weekly_memory_rollup'],
};
