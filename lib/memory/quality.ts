import type { ExtractedMemoryFact, MemoryFactType } from './types';

const FACT_TYPES: MemoryFactType[] = ['hook', 'mistake', 'format', 'cta', 'retention', 'v2', 'style', 'structure', 'audience', 'risk'];

function cleanText(value: unknown, max = 220): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, max);
}

function sentence(value: unknown, max = 180): string {
  const clean = cleanText(value, max);
  if (!clean) return '';
  return clean.endsWith('.') ? clean : `${clean}.`;
}

function isVague(value: string): boolean {
  const normalized = value.toLowerCase();
  const banned = [
    'améliorer le contenu',
    'ameliorer le contenu',
    'meilleures vidéos',
    'meilleures videos',
    'optimiser la stratégie',
    'optimiser la strategie',
    'créer de meilleures vidéos',
    'creer de meilleures videos',
  ];
  return value.length < 18 || banned.some((item) => normalized.includes(item));
}

export function sanitizeExtractedFacts(facts: ExtractedMemoryFact[], maxFacts: number): ExtractedMemoryFact[] {
  const seen = new Set<string>();
  return facts
    .map((fact) => ({
      ...fact,
      title: cleanText(fact.title, 90),
      content: sentence(fact.content, 220),
      evidence: sentence(fact.evidence, 220),
      confidenceScore: Math.max(0, Math.min(100, Math.round(fact.confidenceScore || 0))),
      importanceScore: Math.max(0, Math.min(100, Math.round(fact.importanceScore || 0))),
    }))
    .filter((fact) => FACT_TYPES.includes(fact.type))
    .filter((fact) => fact.confidenceScore >= 40)
    .filter((fact) => Boolean(fact.title && fact.content && fact.evidence))
    .filter((fact) => !isVague(`${fact.title} ${fact.content}`))
    .filter((fact) => {
      const key = `${fact.type}:${fact.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxFacts);
}
