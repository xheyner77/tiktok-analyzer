import { extname } from 'node:path';

const VIDEO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  'video/mp4': ['.mp4', '.m4v'],
  'video/quicktime': ['.mov', '.qt'],
  'video/webm': ['.webm'],
  'video/x-matroska': ['.mkv'],
  'video/mpeg': ['.mpeg', '.mpg'],
};

const DEFAULT_VIDEO_EXTENSION: Readonly<Record<string, string>> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'video/mpeg': '.mpeg',
};

const JOB_STAGE_VALUE_KEYS = new Set([
  'source_metadata',
  'probe',
  'transcript',
  'technical_signals',
  'cost_metrics',
]);

export interface IdempotentUploadIdentity {
  original_file_name: string;
  content_type: string;
  size_bytes: number;
  creator_context: Record<string, unknown>;
}

export interface RequestedUploadIdentity {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  creatorContext: Record<string, unknown>;
}

export function sanitizeOriginalFileName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    // Retire les contrôles de direction/format invisibles qui peuvent masquer
    // l'extension réelle dans l'interface ou dans les journaux d'exploitation.
    .replace(/[\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[\\/<>:"|?*]/g, '-')
    .trim();
  return (normalized || 'video').slice(0, 160);
}

export function safeVideoExtension(fileName: string, contentType: string): string {
  const candidate = extname(fileName).toLowerCase();
  const allowed = VIDEO_EXTENSIONS[contentType] ?? [];
  return allowed.includes(candidate)
    ? candidate
    : (DEFAULT_VIDEO_EXTENSION[contentType] ?? '.video');
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)]),
    );
  }
  return value;
}

export function matchesIdempotentUpload(
  existing: IdempotentUploadIdentity,
  requested: RequestedUploadIdentity,
): boolean {
  if (existing.original_file_name !== sanitizeOriginalFileName(requested.fileName)) return false;
  if (existing.content_type !== requested.contentType) return false;
  if (existing.size_bytes !== requested.sizeBytes) return false;
  return JSON.stringify(canonicalizeJson(existing.creator_context))
    === JSON.stringify(canonicalizeJson(requested.creatorContext));
}

export function buildInputStoragePath(input: {
  userId: string;
  jobId: string;
  fileName: string;
  contentType: string;
}): string {
  return `${input.userId}/${input.jobId}/input${safeVideoExtension(input.fileName, input.contentType)}`;
}

export function isOwnedInputStorageLocation(input: {
  userId: string;
  jobId: string;
  bucket: string;
  path: string;
}): boolean {
  if (input.bucket !== 'analysis-inputs') return false;
  const expectedPrefix = `${input.userId}/${input.jobId}/input`;
  return input.path.startsWith(expectedPrefix)
    && /^\.[a-z0-9]{2,5}$/.test(input.path.slice(expectedPrefix.length));
}

export function isOwnedArtifactStorageLocation(input: {
  userId: string;
  jobId: string;
  bucket: string;
  path: string;
}): boolean {
  if (input.bucket !== 'analysis-evidence') return false;
  const prefix = `${input.userId}/${input.jobId}/`;
  if (!input.path.startsWith(prefix)) return false;
  const segments = input.path.slice(prefix.length).split('/');
  return segments.length >= 2
    && segments.every((segment) => (
      segment.length > 0
      && segment !== '.'
      && segment !== '..'
      && /^[A-Za-z0-9._-]+$/.test(segment)
    ));
}

/**
 * Les valeurs de stade proviennent de nombreuses étapes. Une allowlist empêche
 * qu'un objet trop large n'écrase user_id, quota_state ou un état terminal.
 */
export function pickJobStageValues(values: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!values) return {};
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => JOB_STAGE_VALUE_KEYS.has(key) && value !== undefined),
  );
}

export function parseAnalysisCompletionId(value: unknown): string {
  if (
    typeof value !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new Error('ANALYSIS_COMPLETION_RESPONSE_INVALID');
  }
  return value;
}
