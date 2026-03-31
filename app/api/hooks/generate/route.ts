import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  getUserById,
  checkAndResetMonthly,
  incrementHooksCount,
  HOOK_LIMITS,
} from '@/lib/auth';

// ── Mock hook templates ───────────────────────────────────────────────────────
// Organised by content style. A real implementation would call OpenAI here.

const HOOK_POOLS: Record<string, string[]> = {
  curiosity: [
    "Le truc que personne ne te dit sur {niche}...",
    "J'ai testé {niche} pendant 30 jours — voilà ce qui s'est passé",
    "Pourquoi 99% des gens ratent {niche} (et comment éviter ça)",
    "Ce détail change tout en {niche} — et tu l'ignores sûrement",
    "La vérité sur {niche} que les experts cachent",
  ],
  pov: [
    "POV : tu découvres enfin comment maîtriser {niche}",
    "POV : tu appliques cette astuce {niche} pour la première fois",
    "POV : tu réalises que tu faisais {niche} dans le mauvais sens",
    "POV : quelqu'un t'explique {niche} en 60 secondes",
    "POV : tu passes au niveau supérieur en {niche}",
  ],
  question: [
    "C'est quoi ton niveau en {niche} ? (réponds en commentaire)",
    "Tu fais quelle erreur en {niche} ? 👇",
    "Combien de temps tu as mis pour comprendre {niche} ?",
    "Est-ce que tu savais ça sur {niche} ?",
    "Quel aspect de {niche} tu veux qu'on creuse ?",
  ],
  challenge: [
    "J'ai fait {niche} en moins de 24h — résultats incroyables",
    "Le défi {niche} que personne n'ose faire",
    "Je teste la méthode {niche} la plus controversée",
    "Can you beat this {niche} score? (commentaire 👇)",
    "Challenge : améliore ton {niche} en 7 jours",
  ],
  story: [
    "Il y a 6 mois je ne savais rien sur {niche}. Aujourd'hui...",
    "J'ai failli tout arrêter à cause de {niche} — voilà pourquoi je suis resté",
    "Mon pire échec en {niche} (et ce que j'ai appris)",
    "De zéro à expert en {niche} : mon parcours honnête",
    "La vraie raison pour laquelle j'ai commencé {niche}",
  ],
};

const STYLE_KEYS = Object.keys(HOOK_POOLS);

function generateMockHooks(niche: string, count: number): string[] {
  const label = niche?.trim() || 'ce domaine';
  const hooks: string[] = [];
  const styles = [...STYLE_KEYS];

  // Rotate through styles so we get variety
  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];
    const pool  = HOOK_POOLS[style];
    const template = pool[i % pool.length];
    hooks.push(template.replace(/\{niche\}/g, label));
  }

  return hooks;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Non authentifié', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    let user = await getUserById(session.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      );
    }

    // ── Monthly reset ───────────────────────────────────────────────────────
    user = await checkAndResetMonthly(user);

    // ── Feature availability ────────────────────────────────────────────────
    const hookLimit = HOOK_LIMITS[user.plan] ?? 0;

    if (hookLimit === 0) {
      return NextResponse.json(
        {
          error: 'Le générateur de hooks est disponible à partir du plan Pro.',
          code: 'PLAN_REQUIRED',
          plan: user.plan,
        },
        { status: 403 }
      );
    }

    // ── Quota check ─────────────────────────────────────────────────────────
    if (user.hooks_count >= hookLimit) {
      return NextResponse.json(
        {
          error: 'Limite atteinte — passe à un plan supérieur pour continuer.',
          code: 'LIMIT_REACHED',
          plan:  user.plan,
          used:  user.hooks_count,
          limit: hookLimit,
        },
        { status: 429 }
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    let niche  = '';
    let count  = 5; // default hooks per request

    try {
      const body = await request.json();
      niche = typeof body.niche  === 'string' ? body.niche  : '';
      count = typeof body.count  === 'number' ? Math.min(Math.max(1, body.count), 10) : 5;
    } catch {
      // Body is optional — fall back to defaults
    }

    // ── Generate hooks ──────────────────────────────────────────────────────
    const hooks = generateMockHooks(niche, count);

    // ── Increment counter ───────────────────────────────────────────────────
    await incrementHooksCount(session.userId);

    console.log('[hooks/generate]', {
      userId: session.userId,
      plan:   user.plan,
      used:   user.hooks_count + 1,
      limit:  hookLimit,
      niche,
    });

    return NextResponse.json({
      hooks,
      used:  user.hooks_count + 1,
      limit: hookLimit,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
