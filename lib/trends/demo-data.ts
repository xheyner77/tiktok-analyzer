import type { RawTrendItem } from '@/lib/trends/types';

const now = new Date('2026-05-20T10:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(now.getTime() - hours * 36e5).toISOString();
}

function item(index: number, caption: string, pattern: string, views: number, shares: number, country = 'FR'): RawTrendItem {
  return {
    id: `demo:${pattern}:${index}`,
    provider: 'demo',
    providerItemId: `${pattern}-${index}`,
    sourceUrl: `https://www.tiktok.com/@demo/video/${pattern}${index}`,
    country,
    language: 'fr',
    query: pattern,
    sourceType: 'search',
    caption,
    hashtags: ['business', 'tiktokfrance', pattern],
    soundId: index % 3 === 0 ? `sound-${pattern}` : null,
    soundName: index % 3 === 0 ? 'Audio loop FR' : null,
    authorId: `creator-${pattern}-${index % 9}`,
    authorUsername: `creator_${index}`,
    authorFollowers: 4000 + index * 520,
    createdAt: hoursAgo(4 + index * 2),
    fetchedAt: now.toISOString(),
    metrics: {
      views,
      likes: Math.round(views * 0.08),
      comments: Math.round(views * 0.012),
      shares,
    },
    duration: 22,
    coverUrl: null,
    rawPayload: { demo: true },
  };
}

export function getDemoRawTrendItems(): RawTrendItem[] {
  return [
    item(1, "Avant / apres brutal : j'ai coupe cette intro et la retention a change.", 'avant-apres', 91000, 3600),
    item(2, "Avant / apres sur un hook TikTok : la preuve arrive enfin en premiere seconde.", 'avant-apres', 73000, 2500),
    item(3, "Avant / apres business : meme idee, angle plus tendu, resultat different.", 'avant-apres', 56000, 1800),
    item(4, "L'erreur qui bloque tes vues n'est pas ton sujet, c'est la premiere phrase.", 'erreur', 68000, 3100),
    item(5, "Si tes videos bloquent a 300 vues, regarde cette erreur de hook.", 'erreur', 52000, 1900),
    item(6, "La plupart des createurs ratent cette partie dans les 2 premieres secondes.", 'erreur', 47000, 1300),
    item(7, "Mini etude de cas : il a change une phrase dans son offre et les reponses ont double.", 'case-study', 64000, 2400),
    item(8, "Etude de cas TikTok : meme produit, promesse plus concrete, meilleur watch time.", 'case-study', 39000, 950),
    item(9, "Analyse d'un flop : ce hook annonce le sujet, mais pas l'enjeu.", 'flop', 42000, 1200),
    item(10, "Pourquoi cette video a floppe : le payoff arrive apres la perte d'attention.", 'flop', 33000, 840),
    item(11, "POV business generique : quand tu copies un format deja grille.", 'pov', 18000, 180),
    item(12, "POV entrepreneur : tout le monde le reconnait, personne ne reste.", 'pov', 15000, 130),
    item(13, "Repost ameliore : meme video, V2 plus courte, preuve avancee.", 'repost', 58000, 2100),
    item(14, "J'ai republie une version corrigee et le hook a enfin cree de la tension.", 'repost', 49000, 1700),
    item(15, "Preuve rapide : montre le resultat avant d'expliquer la methode.", 'preuve', 77000, 3900),
    item(16, "Voici la preuve avant le contexte : le viewer comprend en 1 seconde.", 'preuve', 66000, 3100),
  ];
}
