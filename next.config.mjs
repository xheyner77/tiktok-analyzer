import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withWorkflow } from 'workflow/next';
import { getFfmpegVendorRelativePath } from './scripts/ffmpeg-release.mjs';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === 'development';
const ffmpegExecutable = `./${getFfmpegVendorRelativePath().replaceAll('\\', '/')}`;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectRoot,
  outputFileTracingIncludes: {
    '/.well-known/workflow/v1/step': [ffmpegExecutable],
  },
  poweredByHeader: false,
  webpack(config, { isServer }) {
    if (isServer && process.platform === 'win32') {
      // xdg-app-paths dereferences argv[0] during module initialization, while
      // Next's Windows page-data worker can expose an empty argv. Keep Vercel's
      // Linux runtime untouched and provide the same path API only to that build.
      config.resolve.alias['xdg-app-paths$'] = `${projectRoot}/lib/shims/xdg-app-paths.windows.cjs`;
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
};

export default withWorkflow(nextConfig);
