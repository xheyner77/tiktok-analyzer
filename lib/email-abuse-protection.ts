import { createHash } from 'node:crypto';

export interface BestEffortEmailRateLimitRule {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}

export interface BestEffortEmailRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface EmailRateLimitGlobal {
  __viralynzBestEffortEmailRateLimits?: Map<string, RateLimitBucket>;
}

const FIFTEEN_MINUTES_MS = 15 * 60 * 1_000;

export const BEST_EFFORT_EMAIL_LIMITS = {
  authEmailPerTarget: { limit: 3, windowMs: FIFTEEN_MINUTES_MS },
  authEmailPerClient: { limit: 10, windowMs: FIFTEEN_MINUTES_MS },
  feedbackPerActor: { limit: 4, windowMs: FIFTEEN_MINUTES_MS },
  supportPerUser: { limit: 3, windowMs: FIFTEEN_MINUTES_MS },
} as const;

const MAX_BUCKETS_PER_INSTANCE = 5_000;
const globalStore = globalThis as typeof globalThis & EmailRateLimitGlobal;
const buckets = globalStore.__viralynzBestEffortEmailRateLimits ?? new Map<string, RateLimitBucket>();
globalStore.__viralynzBestEffortEmailRateLimits = buckets;

function hashIdentifier(identifier: string): string {
  return createHash('sha256').update(identifier).digest('hex');
}

function normalizeRule(rule: BestEffortEmailRateLimitRule): BestEffortEmailRateLimitRule {
  if (!rule.scope.trim() || !rule.identifier.trim()) {
    throw new TypeError('Une règle anti-abus email doit avoir un scope et un identifiant.');
  }
  if (!Number.isInteger(rule.limit) || rule.limit < 1 || !Number.isFinite(rule.windowMs) || rule.windowMs < 1) {
    throw new TypeError('Une règle anti-abus email doit avoir une limite et une fenêtre valides.');
  }

  return {
    ...rule,
    scope: rule.scope.trim(),
    identifier: rule.identifier.trim(),
  };
}

function removeExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function ensureCapacity(now: number): void {
  if (buckets.size < MAX_BUCKETS_PER_INSTANCE) return;

  removeExpiredBuckets(now);
  while (buckets.size >= MAX_BUCKETS_PER_INSTANCE) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

/**
 * Limiteur local best-effort pour réduire les rafales vers les fournisseurs email.
 * Il est volontairement atomique dans une instance, mais n'est pas distribué entre
 * les instances serverless. Les identifiants sont hachés avant stockage en mémoire.
 */
export function consumeBestEffortEmailRateLimits(
  inputRules: BestEffortEmailRateLimitRule[],
  now = Date.now(),
): BestEffortEmailRateLimitDecision {
  if (inputRules.length === 0) return { allowed: true, retryAfterSeconds: 0 };

  const rules = inputRules.map(normalizeRule).map((rule) => ({
    ...rule,
    key: `${rule.scope}:${hashIdentifier(rule.identifier)}`,
  }));

  let retryAfterMs = 0;
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (bucket && bucket.resetAt > now && bucket.count >= rule.limit) {
      retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - now);
    }
  }

  if (retryAfterMs > 0) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1_000)),
    };
  }

  ensureCapacity(now);
  for (const rule of rules) {
    const bucket = buckets.get(rule.key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(rule.key, { count: 1, resetAt: now + rule.windowMs });
      continue;
    }
    bucket.count += 1;
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Empreinte best-effort. Vercel fournit normalement x-forwarded-for ; le fallback
 * évite de conserver une adresse brute et reste limité à l'instance courante.
 */
export function getBestEffortRequestIdentifier(request: Pick<Request, 'headers'>): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
    .slice(0, 128);
  const directIp = request.headers.get('x-real-ip')?.trim().slice(0, 128);
  const connectingIp = request.headers.get('cf-connecting-ip')?.trim().slice(0, 128);
  const ip = forwardedFor || directIp || connectingIp;
  if (ip) return `ip:${ip}`;

  const userAgent = request.headers.get('user-agent')?.slice(0, 256) || 'unknown-agent';
  const language = request.headers.get('accept-language')?.slice(0, 64) || 'unknown-language';
  return `fallback:${userAgent}:${language}`;
}

export function resetBestEffortEmailRateLimitsForTests(): void {
  if (process.env.NODE_ENV === 'test') buckets.clear();
}
