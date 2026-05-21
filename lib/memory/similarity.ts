import type { CreatorMemoryFact, ExtractedMemoryFact } from './types';

export function normalizeMemoryText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function memoryTextSimilarity(a: string, b: string): number {
  const aWords = new Set(normalizeMemoryText(a).split(' ').filter((word) => word.length > 3));
  const bWords = new Set(normalizeMemoryText(b).split(' ').filter((word) => word.length > 3));
  if (!aWords.size || !bWords.size) return 0;
  const intersection = [...aWords].filter((word) => bWords.has(word)).length;
  return intersection / Math.max(aWords.size, bWords.size);
}

export function isSimilarMemoryFact(a: Pick<ExtractedMemoryFact, 'title' | 'content'>, b: Pick<CreatorMemoryFact, 'title' | 'content'>): boolean {
  return Math.max(
    memoryTextSimilarity(a.title, b.title),
    memoryTextSimilarity(a.content, b.content),
    memoryTextSimilarity(`${a.title} ${a.content}`, `${b.title} ${b.content}`)
  ) >= 0.62;
}
