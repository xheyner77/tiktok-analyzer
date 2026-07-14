import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';

function comparablePath(value: string): string {
  const resolved = resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function isSafeAnalysisTempDirPath(path: string): boolean {
  const rawSegments = path.replace(/\\/g, '/').split('/');
  if (!isAbsolute(path) || rawSegments.includes('..')) return false;
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(tmpdir());
  return comparablePath(dirname(resolvedPath)) === comparablePath(resolvedRoot)
    && basename(resolvedPath).startsWith('viralynz-');
}

export function isAllowedPrivateDownloadUrl(signedUrl: string, supabaseUrl: string): boolean {
  try {
    const candidate = new URL(signedUrl);
    const expected = new URL(supabaseUrl);
    return candidate.username === ''
      && candidate.password === ''
      && candidate.origin === expected.origin
      && candidate.pathname.startsWith('/storage/v1/object/');
  } catch {
    return false;
  }
}
