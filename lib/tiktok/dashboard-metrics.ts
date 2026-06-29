export type TikTokDashboardVideoMetric = {
  id: string;
  title: string | null;
  description: string | null;
  create_time: string | null;
  view_count: number | string | null;
  like_count: number | string | null;
  comment_count: number | string | null;
  share_count: number | string | null;
  cover_image_url: string | null;
  cover_url: string | null;
};

export type TikTokProfileStatsMetric = {
  follower_count: number | string | null;
  likes_count: number | string | null;
  video_count: number | string | null;
};

export type TikTokDashboardMetrics = {
  totalViews: number | null;
  totalEngagements: number | null;
  engagementRate: number | null;
  followers: number | null;
  totalLikes: number | null;
  videoCount: number;
  averageWatchTime: null;
  topVideos: TikTokDashboardVideoMetric[];
};

function toMetricNumber(value: number | string | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

export function calculateTikTokDashboardMetrics(input: {
  videos: TikTokDashboardVideoMetric[];
  profileStats?: TikTokProfileStatsMetric | null;
}): TikTokDashboardMetrics {
  const totalViews = input.videos.reduce((sum, video) => sum + toMetricNumber(video.view_count), 0);
  const totalEngagements = input.videos.reduce(
    (sum, video) =>
      sum +
      toMetricNumber(video.like_count) +
      toMetricNumber(video.comment_count) +
      toMetricNumber(video.share_count),
    0
  );
  const profileVideoCount = toMetricNumber(input.profileStats?.video_count);
  const sortedTopVideos = input.videos
    .slice()
    .sort((a, b) => toMetricNumber(b.view_count) - toMetricNumber(a.view_count))
    .slice(0, 4);

  return {
    totalViews: totalViews > 0 ? totalViews : null,
    totalEngagements: totalViews > 0 ? totalEngagements : null,
    engagementRate: totalViews > 0 ? (totalEngagements / totalViews) * 100 : null,
    followers: input.profileStats ? toMetricNumber(input.profileStats.follower_count) : null,
    totalLikes: input.profileStats ? toMetricNumber(input.profileStats.likes_count) : null,
    videoCount: profileVideoCount > 0 ? profileVideoCount : input.videos.length,
    averageWatchTime: null,
    topVideos: sortedTopVideos,
  };
}
