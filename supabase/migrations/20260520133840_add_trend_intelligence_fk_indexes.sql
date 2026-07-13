CREATE INDEX IF NOT EXISTS trend_scan_jobs_user_id_idx ON public.trend_scan_jobs(user_id);
CREATE INDEX IF NOT EXISTS trend_cluster_items_raw_item_id_idx ON public.trend_cluster_items(raw_item_id);
CREATE INDEX IF NOT EXISTS trend_user_recommendations_cluster_id_idx ON public.trend_user_recommendations(cluster_id);