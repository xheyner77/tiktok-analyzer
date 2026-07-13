import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true });

    if (error) throw error;

    return NextResponse.json({ count: count ?? 0, available: true }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json(
      { count: null, available: false },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
