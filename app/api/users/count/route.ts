import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Base offset to display a credible starting number
const BASE_OFFSET = 0;

export async function GET() {
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const total = (count ?? 0) + BASE_OFFSET;

    return NextResponse.json({ count: total }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ count: BASE_OFFSET }, { status: 200 });
  }
}
