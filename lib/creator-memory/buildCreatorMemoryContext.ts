import type { CreatorMemoryRecord } from './types';

function firstItems(items: string[], limit = 4) {
  return items.filter(Boolean).slice(0, limit);
}

function line(label: string, values: string[] | string | undefined) {
  if (!values) return null;
  const text = Array.isArray(values) ? firstItems(values).join('; ') : values;
  return text ? `- ${label} : ${text}` : null;
}

export function buildCreatorMemoryContext(memory: CreatorMemoryRecord | null | undefined): string {
  if (!memory || memory.total_analyses_learned_from <= 0) return '';

  const lines = [
    'Memoire Createur Viralynz :',
    `- Niveau memoire : ${memory.memory_level}/100`,
    `- Analyses apprises : ${memory.total_analyses_learned_from}`,
    line('Style du createur', [memory.creator_voice, memory.content_style, memory.hook_style].filter(Boolean)),
    line('Audience probable', memory.audience_profile),
    line('Erreurs frequentes', [...memory.recurring_mistakes, ...memory.weakest_patterns]),
    line('Patterns a renforcer', [...memory.strongest_patterns, ...memory.do_more_of]),
    line('Hooks gagnants observes', memory.winning_hooks),
    line('Hooks a eviter', memory.losing_hooks),
    line('Rythme / retention', [...memory.retention_patterns, ...memory.pacing_patterns]),
    line('Prochains tests', memory.next_experiments),
    line('A eviter', memory.avoid_doing),
    'Regle : utilise cette memoire pour personnaliser le diagnostic, les hooks, la V2, les CTA et les relances. Ne donne pas de conseil generique. Si une memoire est incertaine, formule prudemment et cite le signal observe.',
  ].filter(Boolean);

  return lines.join('\n').slice(0, 2400);
}

export function buildCreatorMemoryShortSummary(memory: CreatorMemoryRecord | null | undefined): string {
  if (!memory || memory.total_analyses_learned_from <= 0) return '';
  return [
    memory.profile_summary,
    memory.weakest_patterns[0] ? `Erreur qui revient : ${memory.weakest_patterns[0]}` : '',
    memory.next_experiments[0] ? `Prochain test : ${memory.next_experiments[0]}` : '',
  ].filter(Boolean).join(' ').slice(0, 420);
}
