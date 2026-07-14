import { join } from 'node:path';

export const FFMPEG_RELEASE = Object.freeze({
  version: 'n8.1.2',
  revision: 'n8.1.2-22-g94138f6973',
  tag: 'autobuild-2026-07-13-14-11',
  repository: 'BtbN/FFmpeg-Builds',
  platforms: Object.freeze({
    'linux-x64': Object.freeze({
      archiveName: 'ffmpeg-n8.1.2-22-g94138f6973-linux64-lgpl-8.1.tar.xz',
      sha256: '00d3d90d0215ab1e6f243419cb6d0046cb2c5f06c54ee26fa774b41114ebde69',
      executableSha256: '8462a68c0aecce7ce054c80dbf7debfc8eae1d743219b366e5b2d073f3ac50e2',
      executableName: 'ffmpeg',
    }),
    'win32-x64': Object.freeze({
      archiveName: 'ffmpeg-n8.1.2-22-g94138f6973-win64-lgpl-8.1.zip',
      sha256: 'dac486b156f71625d70af27af6fdd2b11d3803b09faa92d019b5befc0ce463e2',
      executableSha256: '33c2e8c6f1321e2cc9983dacaa21aff153858fc0b448547f96b05fe25cad0f15',
      executableName: 'ffmpeg.exe',
    }),
  }),
});

export function ffmpegPlatformKey(platform = process.platform, arch = process.arch) {
  return `${platform}-${arch}`;
}

export function getFfmpegAsset(platform = process.platform, arch = process.arch) {
  const key = ffmpegPlatformKey(platform, arch);
  const asset = FFMPEG_RELEASE.platforms[key];
  if (!asset) {
    throw new Error(`Unsupported FFmpeg platform: ${key}. Supported platforms: linux-x64, win32-x64.`);
  }
  return { ...asset, key };
}

export function getFfmpegVendorRelativePath(platform = process.platform, arch = process.arch) {
  const asset = getFfmpegAsset(platform, arch);
  return join('vendor', 'ffmpeg', asset.key, asset.executableName);
}

export function getFfmpegReleaseUrl(platform = process.platform, arch = process.arch) {
  const asset = getFfmpegAsset(platform, arch);
  return `https://github.com/${FFMPEG_RELEASE.repository}/releases/download/${FFMPEG_RELEASE.tag}/${asset.archiveName}`;
}
