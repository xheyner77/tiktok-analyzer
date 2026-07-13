import { describe, expect, it } from 'vitest';
import { getSafeInternalPath } from '@/lib/internal-redirect';
import { isTikTokVideoUrl, normalizeTikTokUrl } from '@/lib/tiktok-url';

describe('URL security', () => {
  it('keeps only normalized same-origin login redirects', () => {
    expect(getSafeInternalPath('/dashboard/rewrite?analysis=abc')).toBe('/dashboard/rewrite?analysis=abc');
    expect(getSafeInternalPath('https://evil.example')).toBe('/dashboard');
    expect(getSafeInternalPath('//evil.example')).toBe('/dashboard');
    expect(getSafeInternalPath('/\\evil.example/path')).toBe('/dashboard');
    expect(getSafeInternalPath('/%5cevil.example/path')).toBe('/dashboard');
    expect(getSafeInternalPath('/%2fevil.example/path')).toBe('/dashboard');
  });

  it('accepts only HTTPS TikTok video URLs on the standard port', () => {
    expect(isTikTokVideoUrl(normalizeTikTokUrl('www.tiktok.com/@viralynz/video/123'))).toBe(true);
    expect(isTikTokVideoUrl('https://vm.tiktok.com/ZNRCosuVc/')).toBe(true);
    expect(isTikTokVideoUrl('http://www.tiktok.com/@viralynz/video/123')).toBe(false);
    expect(isTikTokVideoUrl('https://www.tiktok.com:444/@viralynz/video/123')).toBe(false);
    expect(isTikTokVideoUrl('https://user@www.tiktok.com/@viralynz/video/123')).toBe(false);
  });
});
