export function canAccessTrendRadar(plan: string | null | undefined): boolean {
  return plan === 'pro' || plan === 'scale';
}
