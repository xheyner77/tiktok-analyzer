import OpenAI, { APIError, APIConnectionError, RateLimitError } from 'openai';
import type { ChatCompletion, ChatCompletionContentPart } from 'openai/resources/chat/completions';
import type { Plan } from './supabase';
import { OPENAI_CHAT_MODEL } from './openai-models';
import { VISION_MAX_FRAMES } from './vision-config';
import type { AnalysisResult, Rating, Priority } from './types';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 4,
  timeout: 120_000,
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 / 503 : backoff exponentiel (2^n x base) + header Retry-After si present. Max 3 tentatives HTTP. */
function getOpenAIRetryDelayMs(e: unknown, attemptIndex: number): number | null {
  if (attemptIndex >= 2) return null;
  const baseMs = 2000;
  let delay = baseMs * Math.pow(2, attemptIndex);
  if (e instanceof APIError && e.headers) {
    const h = e.headers as Headers;
    const ra = h.get('retry-after');
    if (ra) {
      const sec = parseInt(ra, 10);
      if (!Number.isNaN(sec) && sec >= 0) delay = Math.max(delay, sec * 1000);
    }
  }
  return Math.min(delay, 60_000);
}

function isOpenAIRetryableTransient(e: unknown): boolean {
  if (e instanceof RateLimitError) return true;
  if (e instanceof APIError && (e.status === 429 || e.status === 503)) return true;
  return false;
}

// ── Prompt builders (URL analysis) ────────────────────────────────────────────

function systemPrompt(): string {
  return [
    'Tu es un expert senior en strategie de contenu TikTok. Tu recois les metadonnees publiques d\'une video TikTok',
    '(legende, auteur, duree, statistiques). Tu NE peux PAS voir la video : tu l\'analyses depuis ses metadonnees uniquement.',
    '',
    '=== CE QUE TU PEUX ANALYSER PRECISEMENT ===',
    '1. LEGENDE = hook TEXTUEL reel : sa formulation cree ou non de la curiosite, promet ou non une valeur',
    '2. STATISTIQUES = performance REELLE mesuree (vues, likes, commentaires, partages)',
    '3. DUREE = proxy du taux de completion potentiel (moins de 20s = structurellement superieur a 60% de completion)',
    '4. AUTEUR / NICHE = inference sur le format et les attentes de l\'audience',
    '',
    '=== DONNEES ALGO TIKTOK A UTILISER POUR CALIBRER ===',
    'Taux d\'engagement (likes+comments+shares / vues) : <2% = faible | 2-5% = correct | 5-10% = fort | >10% = viral',
    'Duree optimale completion : 15-25s = max | 26-45s = bon | 46-90s = risque | >90s = tres risque',
    'Hook textuel fort : "Comment j\'ai..." / "Personne ne dit ca..." / chiffre choc / affirmation contre-intuitive',
    'Hook textuel faible : "Aujourd\'hui je vais vous parler de..." / introduction generique = kill switch #1',
    'Sous-titres animes : +28% completion rate (85% audience sans son)',
    '',
    '=== REGLES STRICTES ===',
    '- Dans "analysis" : commence TOUJOURS par ta source reelle ("D\'apres la legende : ..." / "Les stats indiquent : ..." / "La duree de Xs suggere : ...")',
    '- Ne pretends JAMAIS observer des elements visuels que tu ne peux pas voir',
    '- Pour le montage : deduis depuis la duree + le format infere de la legende, donne des benchmarks TikTok chiffres',
    '- Chaque weakness : [observation ancree dans les metadonnees] => [impact algorithmique chiffre si possible]',
    '- Chaque improvement : cite l\'ancrage (hook/montage/retention) + action precise + benefice attendu chiffre',
    '- Scores calibres honnetement : 0-100, ne pas gonfler sans base reelle dans les metadonnees',
    '',
    'Tu reponds UNIQUEMENT en JSON valide, sans texte avant ou apres.',
  ].join('\n');
}

function buildPrompt(
  videoUrl: string,
  plan: 'pro' | 'elite',
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  videoContext?: { caption?: string; authorUsername?: string; durationSec?: number }
): string {
  const isPro = plan === 'pro';
  const tipsCount = isPro ? 5 : 10;

  // Compute real engagement rate
  const views    = observedMetrics?.views    ?? 0;
  const likes    = observedMetrics?.likes    ?? 0;
  const comments = observedMetrics?.comments ?? 0;
  const shares   = observedMetrics?.shares   ?? 0;
  const totalEng = likes + comments + shares;
  const erPct    = views > 0 ? ((totalEng / views) * 100).toFixed(2) : null;

  const caption  = videoContext?.caption?.trim()?.slice(0, 600) ?? '';
  const author   = videoContext?.authorUsername ?? 'inconnu';
  const duration = videoContext?.durationSec;

  const captionLine = caption
    ? `Legende : "${caption}"`
    : 'Legende : non disponible (base l\'analyse sur les stats et la duree)';

  const statsLines = views > 0
    ? [
        'Statistiques reelles :',
        `  Vues         : ${views.toLocaleString('fr-FR')}`,
        `  Likes        : ${likes.toLocaleString('fr-FR')}`,
        `  Commentaires : ${comments.toLocaleString('fr-FR')}`,
        `  Partages     : ${shares.toLocaleString('fr-FR')}`,
        `  Taux d\'engagement : ${erPct ?? '?'}%`,
      ].join('\n')
    : 'Statistiques : non disponibles';

  const durationLine = duration
    ? `Duree : ${duration}s — ${
        duration <= 20 ? 'format court, completion rate structurellement eleve (>60%)' :
        duration <= 45 ? 'duree correcte pour TikTok' :
        'video longue — risque de drop-off accru, taux de completion plus difficile a atteindre'
      }`
    : 'Duree : inconnue';

  const eliteSection = isPro ? '' : [
    '',
    '  "strategy": "150-200 mots — strategie de contenu ANCREE dans ce type de video/niche.',
    '    Mentionne : frequence de publication, creneaux horaires, format des prochaines videos.",',
    '  "viralTips": ["tip1", "tip2", "tip3", "tip4"]',
    '    — 4 insights actionnables specifiques au type de contenu/niche detecte via la legende',
  ].join('\n');

  const priorityRule = isPro
    ? 'Exactement 5 tips : 2 haute, 2 moyenne, 1 basse'
    : 'Exactement 10 tips : 4 haute, 4 moyenne, 2 basse';

  return [
    `Video TikTok : ${videoUrl}`,
    `Auteur : @${author}`,
    durationLine,
    captionLine,
    '',
    statsLines,
    '',
    'MISSION : Analyse cette video depuis ses metadonnees. Sois precis, ancre dans les donnees reelles, honnete sur tes sources.',
    '',
    'INSTRUCTIONS PAR SECTION :',
    'HOOK : Analyse la legende comme hook textuel (curiosite creee, promesse, urgence, format).',
    '       Infere le risque probable sur le hook VISUEL depuis le type de contenu.',
    `MONTAGE : Deduis depuis la duree (${duration ?? '?'}s) + format. Cite benchmarks TikTok (coupes 2-4s, sous-titres, etc.).`,
    'RETENTION : Utilise la structure narrative de la legende + taux d\'engagement reel comme proxy.',
    '',
    `COMPARATIVEINSIGHT : utilise le taux d\'engagement ${erPct ? `(${erPct}%)` : '(non calculable)'} + stats brutes pour situer la video. Chiffres reels obligatoires.`,
    'COMPARATIVEPRIORITY : l\'action la plus rentable en priorite, liee a la faiblesse principale identifiee.',
    '',
    'JSON sans markdown :',
    '{',
    '  "viralityScore": entier 0-100 (hook x0.4 + editing x0.3 + retention x0.3 — score structurel),',
    '  "hook":      { "score": int, "rating": "Excellent|Bon|Moyen|Faible", "analysis": "2-3 phrases ancrées source", "strengths": [...], "weaknesses": [...] },',
    '  "editing":   { "score": int, "rating": "Excellent|Bon|Moyen|Faible", "analysis": "...", "strengths": [...], "weaknesses": [...] },',
    '  "retention": { "score": int, "rating": "Excellent|Bon|Moyen|Faible", "analysis": "...", "strengths": [...], "weaknesses": [...] },',
    `  "improvements": [ { "priority": "haute|moyenne|basse", "tip": "Cote [hook/montage/retention] : action precise + benefice chiffre" } — exactement ${tipsCount} items ],`,
    '  "comparativeInsight": "2-3 phrases avec chiffres reels",',
    '  "comparativePriority": "1-2 phrases action prioritaire"' + eliteSection,
    '}',
    '',
    'Regles :',
    '- rating : Excellent >= 80, Bon >= 60, Moyen >= 40, Faible < 40',
    `- ${priorityRule}`,
    '- Repondre en francais',
  ].join('\n');
}

// ── Parser & validator ─────────────────────────────────────────────────────────

function isValidRating(v: unknown): v is Rating {
  return v === 'Excellent' || v === 'Bon' || v === 'Moyen' || v === 'Faible';
}

function isValidPriority(v: unknown): v is Priority {
  return v === 'haute' || v === 'moyenne' || v === 'basse';
}

function parseResult(raw: string): AnalysisResult {
  // Strip potential markdown code fences
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const json = JSON.parse(clean) as Record<string, unknown>;

  const section = (s: unknown) => {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      return { score: 0, rating: 'Moyen' as Rating, analysis: '', strengths: [], weaknesses: [] };
    }
    const o = s as Record<string, unknown>;
    return {
      score: Math.min(100, Math.max(0, Number(o.score) || 0)),
      rating: isValidRating(o.rating) ? o.rating : 'Moyen' as Rating,
      analysis: String(o.analysis ?? ''),
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String) : [],
      weaknesses: Array.isArray(o.weaknesses) ? o.weaknesses.map(String) : [],
    };
  };

  if (typeof json.error === 'string' && !json.viralityScore && !json.hook) {
    throw new Error(`IA: ${json.error}`);
  }

  return {
    viralityScore: Math.min(100, Math.max(0, Number(json.viralityScore) || 0)),
    hook:      section(json.hook),
    editing:   section(json.editing),
    retention: section(json.retention),
    improvements: Array.isArray(json.improvements)
      ? json.improvements.map((i: unknown) => {
          const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
          return {
            priority: isValidPriority(o.priority) ? o.priority : 'moyenne' as Priority,
            tip: String(o.tip ?? ''),
          };
        })
      : [],
    comparativeInsight:
      typeof json.comparativeInsight === 'string' ? json.comparativeInsight.trim() : undefined,
    comparativePriority:
      typeof json.comparativePriority === 'string' ? json.comparativePriority.trim() : undefined,
    strategy:  typeof json.strategy  === 'string' ? json.strategy  : undefined,
    viralTips: Array.isArray(json.viralTips)
      ? json.viralTips.map(String).filter(Boolean)
      : undefined,
  };
}

// ── Vision prompt builders ─────────────────────────────────────────────────────

/** Prompt systeme vision — expert TikTok avec connaissance algo complete. */
function systemPromptVision(): string {
  return [
    'Tu es un analyste expert en contenu TikTok et en algorithmique des videos courtes.',
    'Tu recois des captures d\'ecran extraites chronologiquement d\'une video TikTok.',
    'Tu analyses chaque frame visible pour identifier precis les forces, faiblesses et leviers d\'optimisation.',
    '',
    '=== SIGNAUX ALGORITHMIQUES TIKTOK ===',
    'COMPLETION RATE (signal #1 — le plus pondérant) :',
    '<30% = distribution bloquee | 30-50% = normale | 50-65% = bonne | >65% = distribution maximale',
    'TAUX D\'ENGAGEMENT (likes+comments+shares / vues) :',
    '<2% = faible | 2-5% = correct | 5-10% = fort | >10% = viral/exceptionnel',
    '',
    '=== CE QUE TU DOIS ANALYSER FRAME PAR FRAME ===',
    'HOOK (frames du debut, ~0-4s) :',
    '- TEXTE OVERLAY visible des la 1ere frame ? CRITIQUE : absent = -28% retention (85% audience sans son)',
    '- PATTERN INTERRUPT visuel : cut brutal / zoom / element choc / visage expressif ? Absent = le scroll ne s\'arrete pas',
    '- VISAGE HUMAIN expressif dans les premieres frames ? Oui = +35% hook rate',
    '- CURIOSITY GAP visible : la 1ere frame cree-t-elle une question chez le viewer ?',
    '- TON/ENERGIE : expression neutre ou plate visible = signal negatif immediat',
    '',
    'MONTAGE (toutes les frames) :',
    '- DENSITE DE COUPE estimee : peu de changement entre frames adjacentes = plans longs (>4s = signal "lent")',
    '- SOUS-TITRES ANIMES sur les dialogues ? Absent = -28% completion rate',
    '- DYNAMISME VISUEL : zooms, B-roll, changements de cadrage, textes animes, split-screen ?',
    '- QUALITE TECHNIQUE : eclairage sombre ou plat ? Flou ? Instabilite ? (eclairage faible = -40% follow rate)',
    '- EFFETS : speed ramp, transition impactante, highlight visuel ?',
    '',
    'RETENTION (frames milieu => fin) :',
    '- MICRO-HOOKS intermediaires toutes les 5-7s : element qui reset l\'attention ?',
    '- PROGRESSION NARRATIVE : montee en tension, revelation, transformation visible ?',
    '- CTA FINAL : question ouverte (x3 commentaires) ou simple "abonne-toi" (peu efficace) ?',
    '- CREUX de retention probable : plan statique ou plat en milieu de video ?',
    '',
    '=== SCORING ===',
    'viralityScore = hook x0.4 + editing x0.3 + retention x0.3 (score structurel uniquement)',
    'Calibration : 75-100 = top 20% | 55-74 = createur intermediaire | 35-54 = structure faible | <35 = non distribuable',
    '',
    '=== REGLES STRICTES ===',
    '1. Chaque strength/weakness : "[observation precise de la frame] => [impact algo chiffre si possible]"',
    '2. INTERDIT : generalisations sans lien avec une frame visible',
    '3. Chaque improvement : "Cote [hook/montage/retention] : [action concrete] => [benefice chiffre]"',
    '4. Tu ne peux PAS entendre l\'audio — ne commente pas la qualite sonore sauf si deduit visuellement',
    '   (micro visible, sous-titres presents/absents, casque audible, etc.)',
    '',
    'Reponds UNIQUEMENT en JSON valide. Aucun texte avant ou apres.',
  ].join('\n');
}

function truncateForPrompt(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '...';
}

function buildVisionUserContent(
  plan: Plan,
  frameCount: number,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string; transcript?: string }
): string {
  const isElite = plan === 'elite';
  const isFree = plan === 'free';
  const tipsCount = isElite ? 10 : 5;
  const depth = isElite
    ? '4-5 phrases par section avec donnees chiffrees'
    : isFree
      ? '1-2 phrases concises par section (apercu plan gratuit — concret et actionnable)'
      : '2-3 phrases par section';

  const views    = observedMetrics?.views    ?? 0;
  const likes    = observedMetrics?.likes    ?? 0;
  const comments = observedMetrics?.comments ?? 0;
  const shares   = observedMetrics?.shares   ?? 0;
  const totalEng = likes + comments + shares;
  const erPct    = views > 0 ? ((totalEng / views) * 100).toFixed(2) : null;

  const fn       = truncateForPrompt(meta?.fileName ?? 'video', 80);
  const link     = meta?.tiktokUrl ? truncateForPrompt(meta.tiktokUrl, 96) : '';
  const duration = meta?.durationSec;

  // Build frame timing hints if duration is known
  let frameTiming = '';
  if (duration && frameCount > 0) {
    const timestamps = Array.from({ length: frameCount }, (_, i) =>
      Math.round(((i + 0.5) / frameCount) * duration)
    );
    frameTiming = `\nTimestamps approximatifs des frames : ${timestamps.map((t, i) => `frame${i + 1}~${t}s`).join(', ')}`;
  }

  const statsLine = views > 0
    ? `Stats TikTok : vues=${views.toLocaleString('fr-FR')} likes=${likes} comments=${comments} shares=${shares} | engagement=${erPct ?? '?'}%`
    : 'Stats TikTok : non disponibles';

  // Transcript block — this is the most valuable signal when available
  const transcriptBlock = meta?.transcript?.trim()
    ? [
        '',
        '=== TRANSCRIPTION AUDIO COMPLETE (Whisper) ===',
        'CECI EST CE QUI EST DIT DANS LA VIDEO — utilise-le pour analyser :',
        '- Le hook verbal exact (premieres phrases = plus important pour la retention)',
        '- La qualite du copywriting et de la promesse',
        '- La presence et la qualite du CTA final',
        '- La structure narrative (setup → montee → revelation → CTA)',
        `"${meta.transcript.trim().slice(0, 1200)}"`,
        '===',
      ].join('\n')
    : '\nAudio : non transcrit (analyse visuelle uniquement).';

  const eliteJsonTail = isElite
    ? ',\n  "strategy": "150-200 mots — strategie de contenu ancree dans CE QUI EST DIT (transcription) ET CE QUI EST VU (frames). Frequence, creneaux, formats complementaires.",\n  "viralTips": ["tip1", "tip2", "tip3", "tip4"] — 4 insights tres specifiques au contenu/niche observe'
    : '';

  const priorityRule = isElite
    ? 'Exactement 10 tips : 4 haute, 4 moyenne, 2 basse'
    : 'Exactement 5 tips : 2 haute, 2 moyenne, 1 basse';

  const comparativeBlock = isFree
    ? [
        '  "comparativeInsight": "1 phrase courte : synthese avec un chiffre cle si les stats sont fournies.",',
        '  "comparativePriority": "1 phrase : une seule action prioritaire."',
      ].join('\n')
    : [
        '  "comparativeInsight": "2-3 phrases : positionnement de cette video (scores + stats si dispo). Chiffres concrets.",',
        '  "comparativePriority": "1-2 phrases : l\'action la plus rentable en priorite, ancree dans la faiblesse principale"' +
          eliteJsonTail,
      ].join('\n');

  return [
    `${frameCount} frames (video TikTok verticale, ordre chronologique).`,
    `Fichier : ${fn} | Duree : ~${duration ?? '?'}s${frameTiming}`,
    statsLine,
    link ? `Lien TikTok fourni : ${link}` : '',
    link ? 'Si le fichier video ne correspond pas au lien, signale-le dans comparativeInsight.' : '',
    transcriptBlock,
    '',
    `ANALYSE DEMANDEE (${depth}) :`,
    meta?.transcript?.trim()
      ? 'Tu as la TRANSCRIPTION COMPLETE + les frames visuelles. Croise les deux : analyse le hook verbal ET le hook visuel, le CTA dit ET le CTA visible.'
      : 'Examine chaque frame precisement. Note les elements visibles (texte, visage, eclairage, sous-titres, dynamisme).',
    'Utilise les timestamps approximatifs pour contextualiser (hook = frames debut, retention = frames fin).',
    '',
    'JSON sans markdown :',
    '{',
    '  "viralityScore": int 0-100 (hook x0.4 + editing x0.3 + retention x0.3),',
    '  "hook":      { "score": int, "rating": "Excellent|Bon|Moyen|Faible", "analysis": "...", "strengths": ["observation frame => impact", ...], "weaknesses": ["probleme observe => impact chiffre", ...] },',
    '  "editing":   { "score": int, "rating": "...", "analysis": "...", "strengths": [...], "weaknesses": [...] },',
    '  "retention": { "score": int, "rating": "...", "analysis": "...", "strengths": [...], "weaknesses": [...] },',
    `  "improvements": [ { "priority": "haute|moyenne|basse", "tip": "Cote [hook/montage/retention] : action precise => benefice attendu" } — exactement ${tipsCount} items ],`,
    comparativeBlock,
    '}',
    '',
    `Regles : ${priorityRule}. Scores 0-100. Tout en francais.`,
  ].filter(Boolean).join('\n');
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function analyzeWithOpenAIVision(
  framesBase64: string[],
  plan: Plan,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  meta?: { durationSec?: number; tiktokUrl?: string; fileName?: string; transcript?: string }
): Promise<AnalysisResult> {
  const frames = framesBase64.slice(0, VISION_MAX_FRAMES);
  const text = buildVisionUserContent(plan, frames.length, observedMetrics, meta);

  const userContent: ChatCompletionContentPart[] = [
    { type: 'text', text },
    ...frames.map((b64) => ({
      type: 'image_url' as const,
      image_url: {
        url: b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`,
        detail: 'low' as const,
      },
    })),
  ];

  // More tokens for richer analysis, lower temp for consistency
  const maxOut = plan === 'elite' ? 3200 : plan === 'free' ? 1900 : 2400;

  const createParams = {
    model: OPENAI_CHAT_MODEL,
    temperature: 0.25,   // was 0.4 — lower = more precise, less hallucination
    max_tokens: maxOut,
    response_format: { type: 'json_object' as const },
    messages: [
      { role: 'system' as const, content: systemPromptVision() },
      { role: 'user' as const, content: userContent },
    ],
  };

  let response: ChatCompletion | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await client.chat.completions.create(createParams);
      break;
    } catch (e) {
      if (!isOpenAIRetryableTransient(e)) throw e;
      const delay = getOpenAIRetryDelayMs(e, attempt);
      if (delay == null) throw e;
      console.warn(
        `[openai] vision retry after transient error (attempt ${attempt + 1}/3, wait ${delay}ms)`,
        e instanceof APIError ? e.status : e
      );
      await sleep(delay);
    }
  }

  if (!response) {
    throw new Error(
      'Le service IA est sature apres plusieurs tentatives. Reessaie dans une minute.'
    );
  }

  const choice = response.choices[0];
  const raw = choice?.message?.content ?? '';
  const finish = choice?.finish_reason;

  if (!raw.trim()) {
    throw new Error(
      "L'IA n'a renvoye aucune analyse. Reessaie ; si le probleme continue, essaie une video plus courte ou un autre export MP4."
    );
  }

  if (finish === 'length') {
    throw new Error(
      "Reponse de l'IA interrompue (trop longue). Reessaie dans un instant."
    );
  }

  try {
    return parseResult(raw);
  } catch (parseErr) {
    console.error('[openai] vision parseResult failed', {
      finish,
      rawLength: raw.length,
      preview: raw.slice(0, 1200),
      err: parseErr instanceof Error ? parseErr.message : parseErr,
    });
    const aiMsg = parseErr instanceof Error && parseErr.message.startsWith('IA:')
      ? parseErr.message
      : 'Format de reponse IA inattendu. Reessaie dans un instant ; si ca persiste, contacte le support.';
    throw new Error(aiMsg);
  }
}

/** Messages utilisateur + code HTTP pour l'API (vision). */
export function mapOpenAIVisionError(e: unknown): { message: string; status: number } {
  if (e instanceof APIConnectionError) {
    return {
      message: 'Impossible de joindre le service IA. Verifie ta connexion et reessaie.',
      status: 503,
    };
  }
  if (e instanceof APIError) {
    if (e.status === 429) {
      return {
        message:
          'OpenAI limite le debit (trop de donnees par requete ou trop d\'appels). Reessaie dans 2 a 5 minutes.',
        status: 503,
      };
    }
    if (e.status === 401) {
      return {
        message: 'Cle API OpenAI invalide ou absente (configuration serveur).',
        status: 502,
      };
    }
    if (e.status === 503 || e.status === 502) {
      return {
        message: 'Service IA temporairement indisponible. Reessaie dans quelques minutes.',
        status: 503,
      };
    }
    if (e.status === 400) {
      return {
        message: `Requete refusee par l'IA : ${e.message}`,
        status: 502,
      };
    }
    return {
      message: `Erreur du service IA (${e.status ?? '?'}). Reessaie.`,
      status: 502,
    };
  }
  if (e instanceof Error && e.message) {
    return { message: e.message, status: 502 };
  }
  return {
    message: 'Analyse vision indisponible. Reessaie dans un instant.',
    status: 502,
  };
}

export async function analyzeWithOpenAI(
  videoUrl: string,
  plan: Extract<Plan, 'pro' | 'elite'>,
  observedMetrics?: { views?: number; likes?: number; comments?: number; shares?: number },
  videoContext?: { caption?: string; authorUsername?: string; durationSec?: number }
): Promise<AnalysisResult> {
  const response = await client.chat.completions.create({
    model: OPENAI_CHAT_MODEL,
    temperature: 0.3,   // was 0.45 — lower = plus coherent, ancre dans les donnees
    max_tokens: plan === 'elite' ? 3200 : 2200,  // was 2800/1600 — plus de place pour une analyse riche
    response_format: { type: 'json_object' as const },  // force JSON propre
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: buildPrompt(videoUrl, plan, observedMetrics, videoContext) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? '';
  return parseResult(raw);
}
