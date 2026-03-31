import { NextRequest, NextResponse } from 'next/server';
import { AnalysisResult, Rating, Improvement, AnalysisSection } from '@/lib/types';
import { getSession } from '@/lib/session';
import { getUserById, incrementAnalysesCount, PLAN_LIMITS } from '@/lib/auth';
import { saveAnalysis } from '@/lib/analyses';
import { analyzeWithOpenAI } from '@/lib/openai';

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getRating(score: number): Rating {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  return 'Faible';
}

// rating is not stored in the profile — it is computed dynamically in buildMockResult
type MockSection = Omit<AnalysisSection, 'rating'>;

interface MockProfile {
  viralityScore: number;
  hook: MockSection;
  editing: MockSection;
  retention: MockSection;
  improvements: Improvement[];
  strategy: string;
  viralTips: string[];
}

const profiles: MockProfile[] = [
  // ── Profil A — Haute performance (~83%) ─────────────────────────────────
  {
    viralityScore: 83,
    hook: {
      score: 86,
      analysis:
        "Ton hook est dans le top 5% de la plateforme. Le pattern interrupt visuel à 00:01 combiné à la question directe au viewer stoppe le scroll efficacement. Seul défaut : tu arrives au vrai sujet à 00:04 — c'est 1,5 seconde de trop. Les hooks qui convertissent le plus sont résolus en 2,5s maximum.",
      strengths: [
        "Coupure brutale à 00:01 qui stoppe physiquement le scroll",
        "Question posée directement au viewer dans les 2 premières secondes",
        "Expression de choc ou visuel fort dès la première frame",
      ],
      weaknesses: [
        "Le sujet réel arrive à 00:04 — ramène-le à 00:02 maximum pour éviter le drop-off précoce",
        "Aucun sous-titre dans les 2 premières secondes : -30% de rétention sur audience mobile sans son",
      ],
    },
    editing: {
      score: 81,
      analysis:
        "Rythme solide — tes cuts sont en moyenne à 2,4s, dans la zone optimale TikTok (2-3s). Problème identifié : le plan entre 00:08 et 00:13 est statique sur 5 secondes, c'est exactement là que ta courbe de rétention chute. Découpe-le en 2 plans ou insère un zoom progressif à 110% sur ce segment.",
      strengths: [
        "Rythme de coupe à 2,4s de moyenne — dans la zone de performance optimale",
        "Cuts synchronisés sur les temps forts musicaux",
        "Aucune transition décorative inutile qui alourdit le flux",
      ],
      weaknesses: [
        "Plan statique de 5s entre 00:08-00:13 — c'est ton point de drop-off principal",
        "Volume musique de fond trop élevé : la voix doit dominer à 70% du mix audio",
      ],
    },
    retention: {
      score: 79,
      analysis:
        "Bonne courbe de rétention jusqu'à la mi-vidéo. La structure 'promesse → build-up → révélation' fonctionne. Mais ta fin est trop douce : les viewers regardent jusqu'à ~00:27 puis quittent sans action. Il te manque un twist ou une déclaration choc dans les 3 dernières secondes pour provoquer le commentaire.",
      strengths: [
        "Micro-hook toutes les 6-7s qui reset l'attention — structure correcte",
        "Taux de complétion estimé à 65-70% — top 10% sur la plateforme",
        "Promesse du hook tenue jusqu'à la fin sans trahison du viewer",
      ],
      weaknesses: [
        "Creux de rétention détecté à mi-vidéo — insère une stat choc ou un changement de plan brutal",
        "CTA final trop mou ('n'hésite pas à...') — ça ne déclenche aucune action mesurable",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Ajoute des sous-titres animés sur les 3 premières secondes UNIQUEMENT — 85% de ton audience est sans son sur mobile. C'est +30% de rétention immédiat sans rien retourner.",
      },
      {
        priority: 'haute',
        tip: "Découpe le plan statique à 00:08 : ajoute un zoom à 110% + son 'whoosh'. Ce seul changement peut récupérer 10-15 points de taux de complétion.",
      },
      {
        priority: 'moyenne',
        tip: "Remplace ton CTA final par : 'Commente [MOT CLÉ] si t'as vécu ça.' Les commentaires boostent la distribution algorithmique 3x plus que les likes.",
      },
      {
        priority: 'moyenne',
        tip: "Insère un texte overlay rouge type '⚠️ Ce que personne ne dit' en overlay à 00:01 — capture les viewers sans son dès la première seconde.",
      },
      {
        priority: 'basse',
        tip: "Teste une version raccourcie à 18s en coupant après la révélation principale — les vidéos <20s ont un taux de complétion 40% plus élevé selon les benchmarks creators.",
      },
      {
        priority: 'moyenne',
        tip: "Lance une série de 3 à 5 épisodes en partant du sujet de cette vidéo. Les séries augmentent le taux de retour sur ton profil de 60% et signalent à l'algorithme que tu es un créateur à pousser dans la durée.",
      },
      {
        priority: 'moyenne',
        tip: "Engage chaque commentaire dans les 30 premières minutes après publication. Ce signal d'activité est le deuxième levier le plus puissant après le taux de complétion pour déclencher la distribution élargie.",
      },
      {
        priority: 'basse',
        tip: "Crée une version 'derrière les coulisses' de cette vidéo — comment tu l'as construite, quel était ton objectif. Les vidéos making-of sur du contenu performant génèrent en moyenne 40% de l'engagement de la vidéo originale.",
      },
    ],
    strategy: "Ton contenu est déjà dans le top tier. Pour maximiser la croissance, publie 4 à 5 fois par semaine minimum — la régularité est le seul levier manquant à ce niveau. Format recommandé : mix 60% vidéos éducatives, 30% behind-the-scenes et 10% trends virales du moment. Cible les créneaux 7h-9h et 18h-21h en semaine. Sur les 30 prochains jours, lance une série de 5 épisodes sur ton sujet phare avec un teaser en première vidéo. Engage chaque commentaire dans les 30 premières minutes après publication — c'est le signal le plus fort que tu peux envoyer à l'algorithme. Objectif atteignable : doubler ton taux d'abonnés en 30 jours avec cette stratégie de contenu.",
    viralTips: [
      "Les vidéos virales dans le top 5% utilisent toutes un 'pattern interrupt' visuel dans la première seconde : cut brutal, zoom à 120%, ou changement de fond soudain — aucun démarrage en douceur.",
      "Les créateurs qui dépassent 1M de vues systématiquement terminent toujours avec une question ouverte ou une affirmation polémique. Jamais un 'merci d'avoir regardé' — ça tue l'engagement.",
      "Le taux de repartage est 3× plus élevé sur les vidéos qui contiennent une stat contre-intuitive dans les 5 premières secondes. Le cerveau humain partage ce qui le surprend.",
      "Les hooks qui convertissent le plus commencent par la CONCLUSION, pas par l'introduction. Montre le résultat en premier, construis le mystère autour de comment tu y es arrivé.",
    ],
  },

  // ── Profil B — Performance moyenne (~55%) ───────────────────────────────
  {
    viralityScore: 55,
    hook: {
      score: 57,
      analysis:
        "Ton hook ne stoppe pas le scroll. Tu commences avec une introduction générique — 'Aujourd'hui je vais vous parler de...' — c'est le suicide algorithmique #1 sur TikTok. L'audience swipe avant que tu finisses ta première phrase. Ton sujet a un réel potentiel viral, mais ta porte d'entrée le tue.",
      strengths: [
        "Le sujet traité a un potentiel de viralité réel sur sa niche",
        "Qualité audio correcte — la voix est claire et audible",
      ],
      weaknesses: [
        "Première phrase générique — supprime entièrement les 2 premières secondes",
        "Aucune image choc, zoom brutal ou coupure franche dans les 3 premières secondes",
        "Ton plat et monocorde sans urgence — parle comme si tu racontais ça à 23h à un ami",
        "Zéro texte overlay : -45% de rétention sur l'audience sans son",
      ],
    },
    editing: {
      score: 53,
      analysis:
        "Ton montage est calqué sur un format YouTube ou LinkedIn, pas TikTok. Tes plans durent en moyenne 5-6 secondes — c'est 2x trop long. Au-delà de 4s sans changement visuel, l'algorithme enregistre un signal de désengagement et réduit ta distribution. Résultat : tu parles à de moins en moins de personnes à chaque seconde.",
      strengths: [
        "Stabilité et cadrage corrects — aucun problème technique bloquant",
        "Son propre sans écho ni bruit parasite",
      ],
      weaknesses: [
        "Plans à 5-6s de moyenne — objectif : 2-3s max, surtout dans les 10 premières secondes",
        "Zéro zoom, zéro effet de vitesse — le visuel est mort entre les coupes",
        "Musique de fond absente : sans ambiance sonore, la vidéo paraît froide et décroche l'audience",
      ],
    },
    retention: {
      score: 50,
      analysis:
        "Tu perds 50% de ton audience avant la mi-vidéo. Cause : après le hook raté, tu déroules ton contenu à plat sans jamais replanter un clou de curiosité. Le viewer sait où tu vas dès les 5 premières secondes — il n'a aucune raison de rester.",
      strengths: [
        "Le contenu a une valeur informative réelle si le viewer reste jusqu'au bout",
        "Durée de 30-45s adaptée — ni trop courte ni trop longue",
      ],
      weaknesses: [
        "Drop-off à 50% estimé avant la mi-vidéo — aucun micro-hook intermédiaire pour retenir",
        "Structure plate : même rythme, même ton, même énergie du début à la fin",
        "Fin abrupte sans CTA ni question posée au viewer — aucune action déclenchée",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Supprime tes 2 premières secondes. Commence directement par la stat la plus choquante ou la conclusion — laisse le viewer se demander 'comment il en est arrivé là ?' Exemple : 'J'ai multiplié mon audience par 10 en faisant l'inverse de tout le monde.'",
      },
      {
        priority: 'haute',
        tip: "Coupe chaque plan à 3s max dans les 10 premières secondes. Passe de 2 cuts à 6 cuts minimum — c'est non-négociable pour rester dans la zone de distribution optimale.",
      },
      {
        priority: 'haute',
        tip: "Insère un micro-hook toutes les 7s : une question brutale ('et le pire c'est que...'), une stat choc ('92% des créateurs ratent ça'), ou un changement d'angle inattendu.",
      },
      {
        priority: 'moyenne',
        tip: "Ajoute une musique trending à -18dB en fond — cherche 'viral sounds TikTok [mois actuel]' sur TikTok Sound Board ou Pinterest pour trouver les sons en montée.",
      },
      {
        priority: 'basse',
        tip: "Termine par 'Suite en partie 2 👇' — les séries augmentent le retour sur profil de 60% et forcent l'algorithme à te recommander à la même audience.",
      },
      {
        priority: 'haute',
        tip: "Refais intégralement les 3 premières secondes : supprime toute intro et commence directement par la stat ou l'affirmation la plus choquante. Ce seul changement peut multiplier ton taux de rétention à 3 secondes par 2.",
      },
      {
        priority: 'moyenne',
        tip: "Teste la même vidéo avec 3 hooks différents en republiant à 48h d'intervalle. Le hook qui performe le mieux devient ton template pour les 30 prochaines vidéos.",
      },
      {
        priority: 'basse',
        tip: "Publie uniquement entre 18h et 21h du mardi au jeudi — les créateurs dans ta niche qui respectent ces créneaux ont un reach initial 35% supérieur à ceux qui publient de manière aléatoire.",
      },
    ],
    strategy: "Priorité absolue sur les 30 prochains jours : refondre ton approche des 3 premières secondes. Publie 3 fois par semaine minimum — la régularité construit le momentum algorithmique. Mix idéal : 50% vidéos éducatives courtes (15-25s), 30% réactions à des trends et 20% vidéos backstage. Cible les créneaux 19h-21h du mardi au jeudi pour maximiser la portée initiale. Commence chaque vidéo par ta conclusion ou ton résultat — montre la fin en premier, explique après. Sur les 7 prochains jours, reprends tes 3 meilleures vidéos et refais uniquement les 5 premières secondes avec un hook choc. En 30 jours avec ce format, tu peux atteindre un taux de complétion de 55%+ et sortir de la zone de distribution limitée.",
    viralTips: [
      "Les vidéos virales de cette catégorie ont en moyenne 8 à 12 cuts dans les 15 premières secondes — chaque plan statique au-delà de 3s est un signal négatif envoyé à l'algorithme.",
      "Les sons trending boostent la distribution jusqu'à 40% par rapport aux vidéos sans son reconnaissable. Utilise TikTok Sound Board pour identifier les sons en montée chaque semaine.",
      "Les sous-titres animés augmentent le taux de complétion de 28% en moyenne — 85% de l'audience mobile regarde sans son lors de la première découverte.",
      "Les créateurs qui passent de 0 à 100K abonnés en moins de 6 mois publient quasi exclusivement entre 18h et 21h du mardi au jeudi et répondent à chaque commentaire dans l'heure.",
    ],
  },

  // ── Profil C — Faible performance (~29%) ────────────────────────────────
  {
    viralityScore: 29,
    hook: {
      score: 27,
      analysis:
        "Cette vidéo ne tient pas 1,5 seconde sur le For You Page. Il n'y a aucun signal visuel ou auditif qui stoppe le pouce dans les 3 premières secondes. Ta première frame est statique et vide — c'est un kill switch algorithmique. TikTok distribue ta vidéo à un micro-échantillon : si ces 3s ne convertissent pas, la vidéo est enterrée définitivement.",
      strengths: [
        "Le sujet traité a un vrai potentiel viral s'il est entièrement reconstruit",
      ],
      weaknesses: [
        "Première frame sans élément choc — le pouce ne s'arrête pas, il n'y a aucune friction",
        "Zéro pattern interrupt : pas de son fort, pas de mouvement, pas de texte dans les 3 premières secondes",
        "Première phrase prévisible et générique — à remplacer intégralement par une déclaration choc",
        "Aucun sous-titre, aucun overlay — vidéo silencieuse invisible pour 85% de l'audience",
        "Expression faciale neutre ou absente dès le départ — l'émotion attire l'humain",
      ],
    },
    editing: {
      score: 30,
      analysis:
        "Le montage est la cause directe d'un taux de complétion estimé sous les 20%. Tes plans durent entre 6 et 12 secondes — c'est un format reportage TV, pas TikTok. Au-delà de 4s sans coupe, le cerveau du viewer enregistre 'contenu lent' et le pouce bouge automatiquement. Ce montage est à refaire intégralement.",
      strengths: [
        "L'image est stable — base technique suffisante pour tout reconstruire dessus",
      ],
      weaknesses: [
        "Plans de 6 à 12s — cible zéro plan au-delà de 3s dans les 15 premières secondes",
        "Aucune dynamique visuelle : pas un seul zoom, ralenti, accéléré ou changement de plan impactant",
        "Pas de musique de fond : TikTok pénalise algorithmiquement les vidéos sans son ambiant",
        "Éclairage plat ou insuffisant — une ring light à 30€ double la qualité perçue à contenu égal",
      ],
    },
    retention: {
      score: 24,
      analysis:
        "Taux de complétion estimé inférieur à 20% — tu perds l'audience dans les 3-4 premières secondes. C'est catastrophique : TikTok utilise le taux de complétion comme signal #1 de distribution. En dessous de 30%, la vidéo n'est quasiment pas diffusée hors de tes abonnés existants. Elle est algorithmiquement morte.",
      strengths: [
        "Le contenu, entièrement restructuré, pourrait atteindre 60-70% de complétion",
      ],
      weaknesses: [
        "Taux de complétion estimé <20% — seuil critique franchi, distribution algorithmique bloquée",
        "Aucun teasing ni promesse dans le hook qui forcerait le viewer à rester",
        "Structure plate sans tension : le viewer devine la fin dès la 3ème seconde",
        "Pas de CTA, pas de question posée, pas de moment de récompense en fin de vidéo",
      ],
    },
    improvements: [
      {
        priority: 'haute',
        tip: "Refais entièrement les 3 premières secondes. Commence par montrer le résultat final ou l'élément le plus choquant en PREMIER. Le viewer doit se demander 'comment il en est arrivé là ?' dès la 1ère seconde — pas à la 10ème.",
      },
      {
        priority: 'haute',
        tip: "Raccourcis à 15-22 secondes maximum. Au-delà, ton taux de complétion ne peut pas atteindre le seuil de distribution (30%+). Chaque seconde en trop est une pénalité algorithmique.",
      },
      {
        priority: 'haute',
        tip: "Remplace ta première phrase par une déclaration choc en 5 mots max. Exemples : 'J'ai perdu 3 ans à faire ça.' / 'Personne ne te dira jamais ça.' / 'J'ai failli tout arrêter.' Zéro intro, zéro bonjour.",
      },
      {
        priority: 'haute',
        tip: "Ajoute une musique trending à -15dB + des sous-titres animés sur chaque phrase parlée. C'est le minimum vital pour exister sur TikTok — sans ça, 85% de ton audience potentielle ne voit pas ta vidéo.",
      },
      {
        priority: 'moyenne',
        tip: "Filme face à une fenêtre ou avec une ring light à 30€. La qualité visuelle perçue influence directement le follow rate : un contenu identique avec un bon éclairage convertit 2x plus en abonnés.",
      },
      {
        priority: 'haute',
        tip: "Supprime intégralement les 3 premières secondes actuelles et remplace par une seule phrase choc en 5 mots max : 'J'ai failli tout perdre' / 'Personne ne te dit ça' / 'J'ai eu tort pendant 2 ans'. Aucun bonjour, aucune intro.",
      },
      {
        priority: 'haute',
        tip: "Raccourcis cette vidéo à 15-20 secondes maximum en ne gardant que le point le plus percutant. Les vidéos <20s ont un taux de complétion structurellement > 60% — le seuil minimum pour déclencher la distribution algorithmique.",
      },
      {
        priority: 'moyenne',
        tip: "Ajoute une musique trending en fond à -15dB (cherche 'TikTok trending sounds [mois actuel]'). TikTok favorise algorithmiquement les vidéos qui utilisent des sons en montée — levier de distribution gratuit et immédiat.",
      },
    ],
    strategy: "Cette vidéo nécessite une refonte totale — mais le potentiel est là. Plan d'action sur 30 jours : les 7 premiers jours, regarde 20 vidéos virales dans ta niche et décortique leur structure (hook, rythme, fin). Semaines 2-3 : republie en format ultra-court (15s max) avec uniquement la partie la plus impactante de tes vidéos existantes. Semaine 4 : lance un nouveau format avec un hook choc dès la première seconde. Publie au minimum 5 fois par semaine pour forcer l'algorithme à te distribuer. Cible le créneau 19h-21h en début de semaine. L'objectif sur 30 jours : passer ton taux de complétion de <20% à >40% — ce seul changement débloquera la distribution et changera tes statistiques radicalement.",
    viralTips: [
      "Les vidéos virales démarrent toutes avec un élément de curiosité non résolu — le viewer reste pour avoir la réponse, jamais pour l'intro. Ton objectif : que le viewer se demande 'mais comment ?' dans la première seconde.",
      "La durée optimale pour déclencher la distribution large est 15-22 secondes : assez long pour donner de la valeur, assez court pour avoir un taux de complétion > 65% qui déclenche l'algorithme.",
      "Une ring light à 30€ augmente le 'follow rate' de 40% à contenu strictement identique — la qualité visuelle est un signal de crédibilité instantané que le viewer évalue en 0,3 seconde.",
      "Les créateurs qui explosent utilisent un 'hook en 3 temps' : déclaration choc → élément visuellement fort → question implicite au viewer dans les 3 premières secondes.",
    ],
  },
];

function buildMockResult(url: string, plan: string = 'free'): AnalysisResult {
  const hash = simpleHash(url);
  const profile = profiles[hash % profiles.length];
  const variation = (hash % 11) - 5;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  const result: AnalysisResult = {
    viralityScore: clamp(profile.viralityScore + variation),
    hook: {
      ...profile.hook,
      score: clamp(profile.hook.score + variation),
      rating: getRating(clamp(profile.hook.score + variation)),
    },
    editing: {
      ...profile.editing,
      score: clamp(profile.editing.score + variation),
      rating: getRating(clamp(profile.editing.score + variation)),
    },
    retention: {
      ...profile.retention,
      score: clamp(profile.retention.score + variation),
      rating: getRating(clamp(profile.retention.score + variation)),
    },
    improvements: profile.improvements,
  };

  if (plan === 'elite') {
    result.strategy = profile.strategy;
    result.viralTips = profile.viralTips;
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
    }

    // ── Auth & limit check ────────────────────────────────────────────────────
    const session = await getSession();
    let dbUser = null;

    if (session) {
      dbUser = await getUserById(session.userId);

      // Profile row missing (signup DB insert may have failed) — create it now
      if (!dbUser) {
        const { supabase } = await import('@/lib/supabase');
        await supabase
          .from('users')
          .upsert(
            { id: session.userId, email: session.email, plan: 'free', analyses_count: 0 },
            { onConflict: 'id', ignoreDuplicates: true }
          );
        dbUser = {
          id: session.userId,
          email: session.email,
          plan: 'free' as const,
          analyses_count: 0,
          created_at: new Date().toISOString(),
        };
        console.log('[analyze] profile row created on-the-fly for:', session.userId);
      }

      const limit = PLAN_LIMITS[dbUser.plan] ?? PLAN_LIMITS.free;

      console.log('[analyze] limit check —', {
        plan: dbUser.plan,
        count: dbUser.analyses_count,
        limit,
        allowed: dbUser.analyses_count < limit,
      });

      if (dbUser.analyses_count >= limit) {
        return NextResponse.json(
          {
            error: 'Tu as atteint ta limite. Passe en premium pour continuer.',
            code: 'LIMIT_REACHED',
            plan: dbUser.plan,
            used: dbUser.analyses_count,
            limit,
          },
          { status: 429 }
        );
      }
    }

    // ── Analysis ─────────────────────────────────────────────────────────────
    const plan = dbUser?.plan ?? 'free';
    const useOpenAI =
      (plan === 'pro' || plan === 'elite') &&
      !!process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'sk-your-key-here';

    let result: AnalysisResult;

    if (useOpenAI) {
      try {
        result = await analyzeWithOpenAI(url, plan as 'pro' | 'elite');
        console.log(`[analyze] OpenAI (${plan}) — viralityScore:`, result.viralityScore);
      } catch (aiErr) {
        console.error('[analyze] OpenAI failed, falling back to mock:', aiErr);
        result = buildMockResult(url, plan);
      }
    } else {
      // Free plan or no API key — deterministic mock
      await new Promise((resolve) => setTimeout(resolve, 1800 + Math.random() * 1200));
      result = buildMockResult(url, plan);
    }

    // ── Persist for authenticated users ──────────────────────────────────────
    if (session && dbUser) {
      await Promise.all([
        incrementAnalysesCount(session.userId),
        saveAnalysis(session.userId, url, result),
      ]);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
