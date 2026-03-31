export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getScoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function getScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export function getRatingColors(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return 'bg-green-500/10 text-green-400 border border-green-500/20';
    case 'Bon':
      return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case 'Moyen':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    case 'Faible':
      return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:
      return 'bg-gray-500/10 text-gray-400';
  }
}
