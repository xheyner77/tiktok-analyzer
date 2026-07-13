import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Viralynz — Coach de repost',
    short_name: 'Viralynz',
    description:
      'Analyse tes vidéos, transforme le diagnostic en décisions de montage et prépare la V2 à republier.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#020611',
    theme_color: '#020611',
    lang: 'fr-FR',
    categories: ['productivity', 'video'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
