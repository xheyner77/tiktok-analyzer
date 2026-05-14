export function clampScore(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : 0)));
}

export function parseTimecode(value: string) {
  const clean = value.trim();
  const [minutes, seconds] = clean.split(':').map((part) => Number(part.replace(/[^\d.]/g, '')));
  if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds;
  const numeric = Number(clean.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function sequenceTone(type: string) {
  if (type === 'CTA') return 'border-fuchsia-300/28 bg-fuchsia-400/10 text-fuchsia-100';
  if (type === 'PATTERN_INTERRUPT' || type === 'TRANSITION') return 'border-emerald-300/24 bg-emerald-300/10 text-emerald-100';
  if (type === 'HOOK' || type === 'PAYOFF' || type === 'PROOF') return 'border-cyan-300/28 bg-cyan-300/10 text-cyan-100';
  return 'border-white/[0.11] bg-white/[0.045] text-gray-200';
}

export function moveLabel(move?: string) {
  if (move === 'advance') return 'Avancer';
  if (move === 'cut') return 'Couper';
  if (move === 'insert') return 'Relance';
  if (move === 'move_cta') return 'CTA';
  if (move === 'rewrite') return 'Reecrire';
  return 'Garder';
}
