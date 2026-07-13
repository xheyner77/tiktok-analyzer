const INTERNAL_ORIGIN = 'https://viralynz.internal';

export function getSafeInternalPath(value: string | null | undefined, fallback = '/dashboard'): string {
  const candidate = value?.trim() ?? '';
  if (
    !candidate.startsWith('/')
    || candidate.startsWith('//')
    || candidate.includes('\\')
    || /%2f|%5c/i.test(candidate)
    || /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
