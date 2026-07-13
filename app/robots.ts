import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.viralynz.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        '/dashboard/',
        '/dashboard-v2/',
        '/analyses/',
        '/account/',
        '/billing/',
        '/onboarding/',
        '/review/',
        '/settings/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
