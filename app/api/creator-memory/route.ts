import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCreatorMemory, getCreatorMemoryLevelLabel } from '@/lib/creator-memory';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ memory: null }, { status: 401 });
  }

  const memory = await getCreatorMemory(session.userId);

  if (!memory) {
    return NextResponse.json({ memory: null });
  }

  return NextResponse.json({
    memory: {
      memoryLevel: memory.memory_level,
      levelLabel: getCreatorMemoryLevelLabel(memory.memory_level),
      totalAnalyses: memory.total_analyses_learned_from,
      lastLearnedAt: memory.last_learned_at,
      creatorVoice: memory.creator_voice,
      hookStyle: memory.hook_style,
      recurringMistakes: memory.recurring_mistakes.slice(0, 3),
      strongestPatterns: memory.strongest_patterns.slice(0, 3),
      nextExperiments: memory.next_experiments.slice(0, 3),
      avoidDoing: memory.avoid_doing.slice(0, 3),
    },
  });
}
