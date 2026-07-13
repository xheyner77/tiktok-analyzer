import { NextResponse, type NextRequest } from 'next/server';

const PRIVATE_CACHE_CONTROL = 'private, no-store, max-age=0';

export function privateJson(
  body: unknown,
  init: ResponseInit = {},
): NextResponse {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', PRIVATE_CACHE_CONTROL);
  headers.set('Pragma', 'no-cache');

  return NextResponse.json(body, { ...init, headers });
}

/**
 * Refuse les requêtes navigateur explicitement cross-site sur les mutations
 * authentifiées par cookie. Les clients serveur sans en-têtes navigateur
 * restent compatibles (Stripe, tests et scripts internes).
 */
export function rejectCrossSiteMutation(request: NextRequest): NextResponse | null {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return privateJson({ error: 'Requête non autorisée.' }, { status: 403 });
  }

  const origin = request.headers.get('origin');
  if (!origin) return null;

  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    return privateJson({ error: 'Requête invalide.' }, { status: 400 });
  }

  if (origin !== requestOrigin) {
    return privateJson({ error: 'Requête non autorisée.' }, { status: 403 });
  }

  return null;
}

export async function readJsonObject(
  request: NextRequest,
  maxBytes = 256 * 1024,
): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    if (!request.body) return null;
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let raw = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();

    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function exceedsDeclaredBodyLimit(
  request: NextRequest,
  maxBytes: number,
): boolean {
  const rawLength = request.headers.get('content-length');
  if (!rawLength) return false;

  const length = Number(rawLength);
  return Number.isFinite(length) && length > maxBytes;
}
