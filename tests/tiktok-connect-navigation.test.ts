import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isTikTokConnectHref } from '@/lib/tiktok-navigation';

function listTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTsxFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.tsx') ? [entryPath] : [];
  });
}

describe('navigation document TikTok OAuth', () => {
  it('reconnaît uniquement la route de connexion TikTok et ses paramètres', () => {
    expect(isTikTokConnectHref('/api/tiktok/connect')).toBe(true);
    expect(isTikTokConnectHref('/api/tiktok/connect?review=1')).toBe(true);
    expect(isTikTokConnectHref('/api/tiktok/connect#permissions')).toBe(true);
    expect(isTikTokConnectHref('/api/tiktok/connected')).toBe(false);
    expect(isTikTokConnectHref('/dashboard/settings')).toBe(false);
  });

  it('ne confie jamais la route OAuth à next/link ou au router client dans les composants TSX', () => {
    const roots = ['app', 'components'].map((root) => path.join(process.cwd(), root));
    const offenders = roots.flatMap(listTsxFiles).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8');
      const linkTags = source.match(/<Link\b[^>]*>/g) ?? [];
      const routerCalls = source.match(/router\.(?:push|replace)\s*\([^)]*\)/g) ?? [];
      return [...linkTags, ...routerCalls]
        .filter((tag) => tag.includes('/api/tiktok/connect'))
        .map(() => path.relative(process.cwd(), filePath));
    });

    expect(offenders).toEqual([]);
  });
});
