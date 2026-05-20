import type { TrendStage, TrendVerdict } from '@/lib/trends/types';

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function roundScore(value: number): number {
  return Math.round(clamp(value));
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function hoursBetween(from: string | null, to = new Date()): number {
  const date = safeDate(from);
  if (!date) return 168;
  return Math.max(0, (to.getTime() - date.getTime()) / 36e5);
}

export function formatRelativeTime(value: string | null): string {
  const date = safeDate(value);
  if (!date) return 'aucun scan';
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `il y a ${diffHours} h`;
  return `il y a ${Math.round(diffHours / 24)} j`;
}

export function verdictLabel(verdict: TrendVerdict): string {
  const labels: Record<TrendVerdict, string> = {
    post_now: 'A poster maintenant',
    good_potential: 'Bon potentiel',
    watch: 'A surveiller',
    twist_it: 'A detourner',
    avoid: 'A eviter',
  };
  return labels[verdict];
}

export function stageLabel(stage: TrendStage): string {
  const labels: Record<TrendStage, string> = {
    early_signal: 'Early',
    growth: 'Growth',
    peak: 'Peak',
    saturated: 'Sature',
    declining: 'Declining',
    unstable: 'Instable',
  };
  return labels[stage];
}

export function percentileRank(values: number[], value: number): number {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const below = clean.filter((item) => item <= value).length;
  return clamp((below / clean.length) * 100);
}
