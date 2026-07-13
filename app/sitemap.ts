import type { MetadataRoute } from 'next';

const SITE_URL = 'https://www.viralynz.com';

const publicRoutes = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/changelog', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/legal/mentions-legales', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/cgu', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/cgv', changeFrequency: 'yearly', priority: 0.2 },
  { path: '/legal/confidentialite', changeFrequency: 'yearly', priority: 0.2 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
