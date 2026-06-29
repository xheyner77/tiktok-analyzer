import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

type TikTokVideoRow = {
  id: string;
  tiktok_video_id: string;
  title: string | null;
  caption: string | null;
  cover_url: string | null;
  share_url: string | null;
  duration: number | string | null;
  create_time: string | null;
  view_count: number | string | null;
};

function toNumber(value: number | string | null): number | null {
  if (value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Non connecte.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('tiktok_videos')
    .select('id,tiktok_video_id,title,caption,cover_url,share_url,duration,create_time,view_count')
    .eq('user_id', session.userId)
    .order('create_time', { ascending: false, nullsFirst: false })
    .limit(20);

  if (error) {
    console.warn('[api/tiktok/videos] read failed:', error.message);
    return NextResponse.json({ videos: [] });
  }

  const videos = ((data ?? []) as TikTokVideoRow[]).map((video) => ({
    id: video.id,
    tiktokVideoId: video.tiktok_video_id,
    title: video.title?.trim() || video.caption?.trim() || null,
    coverUrl: video.cover_url?.trim() || null,
    shareUrl: video.share_url?.trim() || null,
    duration: toNumber(video.duration),
    publishedAt: video.create_time,
    views: toNumber(video.view_count),
  }));

  return NextResponse.json({ videos });
}
