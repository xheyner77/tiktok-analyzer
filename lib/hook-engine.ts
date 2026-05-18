import type { GeneratedHook, HookObjective, HookPack, HookStyle, VideoFormat } from './types';

export interface HookGenerationInput {
  context: string;
  scene: string;
  person?: string;
  tone: string;
  count: number;
  format?: VideoFormat;
  objective?: HookObjective;
  niche?: string;
  hookMode?: 'text' | 'spoken';
  mode?: 'facecam_text' | 'text_only' | 'opening_3s' | 'repost_angle' | 'comment_bait' | 'watchtime';
  intensity?: number;
}

const styleLabels: Record<HookStyle, string> = {
  curiosity: 'Curiosité',
  storytelling: 'Story',
  authority: 'Autorité',
  emotion: 'Émotion',
  debate: 'Débat',
  watchtime: 'Watchtime',
  comments: 'Commentaires',
  contrarian: 'Contrarian',
  proof: 'Preuve',
  drama: 'Drama',
  educational: 'Éducation',
  fomo: 'FOMO',
  controversial: 'Controverse',
  beginner_mistake: 'Erreur débutant',
  secret: 'Secret',
  stop_scrolling: 'Stop scrolling',
  nobody_talks: 'Personne n’en parle',
};

const styleWhy: Record<HookStyle, string> = {
  curiosity: 'Crée un manque d’information immédiat : le viewer reste pour fermer la boucle.',
  storytelling: 'Installe une mini-histoire avec tension avant contexte.',
  authority: 'Positionne le créateur comme quelqu’un qui a vu ce que les autres ratent.',
  emotion: 'Déclenche une réaction humaine avant l’explication.',
  debate: 'Invite à prendre position, donc augmente les commentaires.',
  watchtime: 'Promet un payoff proche et pousse à regarder quelques secondes de plus.',
  comments: 'Donne une action simple à répondre en commentaire.',
  contrarian: 'Casse une croyance attendue et stoppe le scroll.',
  proof: 'Promet une preuve concrète plutôt qu’une opinion.',
  drama: 'Amplifie l’enjeu émotionnel dès la première seconde.',
  educational: 'Promet un apprentissage clair sans sur-expliquer.',
  fomo: 'Crée la peur de rater une information utile.',
  controversial: 'Force le viewer à prendre position.',
  beginner_mistake: 'Vise une erreur fréquente, donc très identifiable.',
  secret: 'Ouvre une boucle forte autour d’une information cachée.',
  stop_scrolling: 'Interrompt directement le scroll avec une injonction.',
  nobody_talks: 'Positionne le contenu comme rare ou sous-coté.',
};

const videoFormatLabels: Record<VideoFormat, string> = {
  facecam: 'Facecam',
  texte_ecran: 'Texte écran',
  storytelling: 'Storytelling',
  tutoriel: 'Tutoriel',
  ecommerce: 'E-commerce',
  humour: 'Humour',
  playback_lipsync: 'Playback / lip sync',
  sans_parole: 'Sans parole',
  gaming: 'Gaming',
  lifestyle: 'Lifestyle',
  motivation: 'Motivation',
  avant_apres: 'Avant/après',
};

function normalizeContext(input: string) {
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function titleCaseStyle(style: HookStyle) {
  return styleLabels[style];
}

function compactTopic(context: string) {
  const clean = normalizeContext(context).toLowerCase();
  if (clean.includes('hater')) return 'UN HATER';
  if (clean.includes('tiktok')) return 'TIKTOK';
  if (clean.includes('client')) return 'TES CLIENTS';
  if (clean.includes('business')) return 'TON BUSINESS';
  if (clean.includes('sport') || clean.includes('fitness')) return 'TON CORPS';
  if (clean.includes('vente') || clean.includes('produit')) return 'TES VENTES';
  return 'TA VIDÉO';
}

function scoreHook(hook: string, style: HookStyle, index: number): number {
  const words = hook.split(/\s+/).filter(Boolean).length;
  const lengthScore = words >= 3 && words <= 6 ? 24 : words <= 8 ? 18 : words <= 11 ? 10 : 3;
  const tensionScore = /ERREUR|PERSONNE|ARRÊTE|PERDU|REGARDE|POURQUOI|JAMAIS|VOILÀ|PREUVE|STOP|TROP TARD|DÉTRUIT/.test(hook) ? 24 : 13;
  const specificity = /TIKTOK|CLIENTS|VENTES|HATER|VIDÉO|COMMENTAIRES/.test(hook) ? 15 : 9;
  const styleBoost = ['curiosity', 'watchtime', 'proof', 'contrarian', 'stop_scrolling', 'nobody_talks', 'beginner_mistake'].includes(style) ? 12 : 8;
  return Math.max(62, Math.min(98, 42 + lengthScore + tensionScore + specificity + styleBoost - index));
}

function hookSubScores(hook: string, style: HookStyle, score: number) {
  const words = hook.split(/\s+/).filter(Boolean).length;
  const shortBoost = words <= 6 ? 9 : words <= 8 ? 4 : -5;
  const curiosityBoost = /POURQUOI|PERSONNE|TROP TARD|VOILÀ|SECRET|REGARDE|ÇA/.test(hook) ? 10 : 2;
  const emotionBoost = /PERDU|DÉTRUIT|STOP|ARRÊTE|REGRETTER|MAL|HONTE/.test(hook) ? 10 : 3;
  const debateBoost = /PERSONNE|ARRÊTE|FAUX|MENT|TORT|AVIS/.test(hook) ? 10 : 2;

  return {
    watchtimeScore: Math.max(52, Math.min(99, score + shortBoost + (['watchtime', 'secret', 'proof'].includes(style) ? 6 : 0))),
    commentScore: Math.max(48, Math.min(98, score - 3 + debateBoost + (['comments', 'debate', 'controversial'].includes(style) ? 8 : 0))),
    curiosityScore: Math.max(50, Math.min(99, score + curiosityBoost + (['curiosity', 'secret', 'nobody_talks'].includes(style) ? 6 : 0))),
    emotionScore: Math.max(45, Math.min(98, score - 2 + emotionBoost + (['emotion', 'drama'].includes(style) ? 8 : 0))),
    rawViralScore: Math.max(55, Math.min(99, Math.round(score * 0.62 + (shortBoost + curiosityBoost + emotionBoost + debateBoost) * 0.9))),
  };
}

function impactFromScore(score: number) {
  if (score >= 90) return 'potentiel de rétention très fort';
  if (score >= 82) return 'potentiel de rétention solide';
  if (score >= 74) return 'potentiel de rétention à tester';
  return 'hypothèse de progression';
}

function clampScore(value: number) {
  return Math.max(45, Math.min(99, Math.round(value)));
}

function difficultyFromScore(score: number): HookPack['difficulty'] {
  if (score >= 88) return 'avancé';
  if (score >= 76) return 'moyen';
  return 'facile';
}

function normalizeFormat(format?: string): VideoFormat {
  const raw = (format ?? '').toLowerCase();
  if (raw.includes('sans')) return 'sans_parole';
  if (raw.includes('ecom') || raw.includes('commerce') || raw.includes('produit')) return 'ecommerce';
  if (raw.includes('humour')) return 'humour';
  if (raw.includes('playback') || raw.includes('lip')) return 'playback_lipsync';
  if (raw.includes('gaming')) return 'gaming';
  if (raw.includes('life')) return 'lifestyle';
  if (raw.includes('motivation')) return 'motivation';
  if (raw.includes('avant')) return 'avant_apres';
  if (raw.includes('tuto')) return 'tutoriel';
  if (raw.includes('story')) return 'storytelling';
  if (raw.includes('texte')) return 'texte_ecran';
  return 'facecam';
}

function objectiveFromStyle(style: HookStyle, inputObjective?: HookObjective): HookObjective {
  if (inputObjective) return inputObjective;
  if (['comments', 'debate', 'controversial'].includes(style)) return 'comments';
  if (['watchtime', 'secret', 'fomo'].includes(style)) return 'watchtime';
  if (['authority', 'proof', 'educational'].includes(style)) return 'authority';
  return 'views';
}

function firstFrameForFormat(format: VideoFormat, topic: string) {
  const map: Record<VideoFormat, string> = {
    facecam: 'Plan serré visage, regard caméra, déjà dans l’émotion.',
    texte_ecran: `Affiche directement le problème lié à ${topic.toLowerCase()}, sans intro.`,
    storytelling: 'Montre le moment de tension ou la conséquence avant le contexte.',
    tutoriel: 'Montre le résultat final à 0:00, puis seulement après la méthode.',
    ecommerce: 'Montre le problème client ou le résultat produit dès la première frame.',
    humour: 'Ouvre sur le contraste visuel ou la réaction, pas sur l’explication.',
    playback_lipsync: 'Premier plan expressif synchronisé avec le texte écran.',
    sans_parole: 'Frame forte avec texte écran lisible et action déjà commencée.',
    gaming: 'Montre le moment critique, fail, clutch ou réaction avant le setup.',
    lifestyle: 'Plan situationnel clair avec détail intrigant visible immédiatement.',
    motivation: 'Plan intense ou résultat final, avec énergie dès 0:00.',
    avant_apres: 'Affiche l’après en premier, puis coupe vers l’avant.',
  };
  return map[format];
}

function actionForFormat(format: VideoFormat) {
  const map: Record<VideoFormat, string> = {
    facecam: 'Micro zoom sur le visage au premier mot, puis cut si la phrase dépasse 2 secondes.',
    texte_ecran: 'Fais apparaître le texte en deux temps, avec un cut dès que le contexte est compris.',
    storytelling: 'Commence par le payoff visuel, puis coupe sur le détail qui crée la question.',
    tutoriel: 'Montre le résultat, freeze court, puis cut vers la première étape.',
    ecommerce: 'Montre l’objection ou le problème produit, puis zoom sur la preuve.',
    humour: 'Cut sec avant l’explication, laisse le contraste faire le travail.',
    playback_lipsync: 'Synchronise texte écran et expression, puis rupture visuelle sur le beat.',
    sans_parole: 'Rythme visuel rapide : zoom léger, texte court, cut avant 1.5s.',
    gaming: 'Zoom ou replay instantané sur le moment critique.',
    lifestyle: 'Mouvement caméra simple vers le détail qui intrigue.',
    motivation: 'Cut sur action forte, pas sur introduction parlée.',
    avant_apres: 'Flash de l’après, cut vers l’avant, puis retour rapide au résultat.',
  };
  return map[format];
}

function cameraForFormat(format: VideoFormat) {
  if (format === 'facecam') return 'Plan poitrine ou visage, caméra stable, zoom léger à 0.8s.';
  if (format === 'sans_parole' || format === 'texte_ecran') return 'Cadre lisible, texte centré haut, mouvement visuel dès la première seconde.';
  if (format === 'ecommerce') return 'Produit ou problème client au centre, preuve visible sans attendre.';
  if (format === 'humour') return 'Plan large pour comprendre le contraste, puis cut serré sur réaction.';
  return 'Commence sur le plan le plus fort, puis coupe avant que le rythme retombe.';
}

function makePackFromHook(hook: GeneratedHook, input: HookGenerationInput, index: number, source: HookPack['source']): HookPack {
  const format = normalizeFormat(input.format);
  const topic = compactTopic(input.context);
  const noSpeech = input.hookMode === 'text' || format === 'sans_parole' || input.mode === 'text_only';
  const objective = objectiveFromStyle(hook.style, input.objective);
  const base = hook.score;
  const screenText = input.hookMode === 'spoken'
    ? (hook.hook.length <= 36 ? hook.hook : hook.hook.slice(0, 36).trim())
    : (hook.hook.length <= 44 ? hook.hook : hook.hook.slice(0, 44).trim());
  const spokenHook = noSpeech ? '' : hook.hook.charAt(0) + hook.hook.slice(1).toLowerCase();
  const titlePrefix = videoFormatLabels[format];

  return {
    id: `pack-${Date.now()}-${index}`,
    title: `${titlePrefix} · ${styleLabels[hook.style]}`,
    style: hook.style,
    format,
    objective,
    spokenHook,
    onScreenText: screenText,
    firstFrame: firstFrameForFormat(format, topic),
    visualAction: actionForFormat(format),
    cameraDirection: cameraForFormat(format),
    cutTiming: format === 'sans_parole' ? 'Cut avant 1.2s dès que le texte écran est compris.' : 'Cut à 1.2s-1.8s, avant de commencer à expliquer.',
    deliveryTone: noSpeech ? 'Aucun besoin de parler : laisse le texte écran et l’action porter le hook.' : 'Phrase courte, ton direct, pas d’explication avant la preuve.',
    soundCue: input.mode === 'watchtime' ? 'Beat léger ou silence avant le cut pour renforcer la boucle ouverte.' : undefined,
    scriptOpening: noSpeech
      ? [
          { time: '0.0s', instruction: firstFrameForFormat(format, topic) },
          { time: '0.5s', instruction: `Texte écran : “${screenText}”` },
          { time: '1.5s', instruction: 'Cut sur preuve, réaction ou détail important.' },
          { time: '2.5s', instruction: 'Montre la conséquence ou le contraste.' },
        ]
      : [
          { time: '0.0s', instruction: firstFrameForFormat(format, topic) },
          { time: '0.5s', instruction: `Texte écran : “${screenText}”` },
          { time: '1.5s', instruction: `Phrase à dire : “${spokenHook}”` },
          { time: '2.5s', instruction: 'Cut sur preuve ou réaction.' },
        ],
    whyItWorks: hook.whyItWorks,
    bestFor: [videoFormatLabels[format], objective === 'comments' ? 'Commentaires' : objective === 'watchtime' ? 'Watchtime' : 'Vues', input.niche || 'TikTok'],
    risk: hook.aggressiveness >= 9 ? 'Très fort : à garder si le contenu tient vraiment la promesse.' : undefined,
    scores: {
      overall: clampScore(base),
      scrollStop: clampScore(base + 4),
      curiosity: clampScore(hook.curiosityScore ?? base),
      emotion: clampScore(hook.emotionScore ?? base - 2),
      clarity: clampScore(base - (hook.hook.split(/\s+/).length > 8 ? 8 : 1)),
      comments: clampScore(hook.commentScore ?? base - 3),
      watchtime: clampScore(hook.watchtimeScore ?? base + 2),
    },
    aggression: hook.aggressiveness,
    difficulty: difficultyFromScore(base),
    source,
  };
}

function makeHook(style: HookStyle, hook: string, index: number, proOnly = false): GeneratedHook {
  const score = scoreHook(hook, style, index);
  const scores = hookSubScores(hook, style, score);
  return {
    style,
    hook,
    whyItWorks: styleWhy[style],
    aggressiveness: Math.max(4, Math.min(10, Math.round(score / 10))),
    difficulty: Math.max(2, Math.min(10, 4 + Math.round((score - 70) / 8))),
    emotionType: ['emotion', 'drama'].includes(style) ? 'émotion' : ['debate', 'controversial', 'contrarian'].includes(style) ? 'débat' : ['proof', 'authority', 'educational'].includes(style) ? 'crédibilité' : 'curiosité',
    objective: ['comments', 'debate', 'controversial'].includes(style) ? 'comments' : ['watchtime', 'secret', 'fomo'].includes(style) ? 'watchtime' : ['authority', 'proof', 'educational'].includes(style) ? 'authority' : 'views',
    ...scores,
    estimatedRetentionBoost: impactFromScore(score),
    score,
    proOnly,
  };
}

export function generateFallbackHooks(input: HookGenerationInput): GeneratedHook[] {
  const topic = compactTopic(input.context);
  const person = input.person?.trim() ? input.person.trim().toUpperCase().slice(0, 22) : topic;
  const templates: Array<[HookStyle, string]> = [
    ['stop_scrolling', `STOP FAIS PAS ÇA`],
    ['curiosity', `TU RATES ÇA`],
    ['watchtime', `REGARDE LA FIN`],
    ['contrarian', `ARRÊTE ÇA SUR ${topic}`],
    ['beginner_mistake', `L'ERREUR QUI DÉTRUIT`],
    ['secret', `PERSONNE TE DIT ÇA`],
    ['nobody_talks', `PERSONNE NE PARLE DE ÇA`],
    ['fomo', `TU VAS REGRETTER ÇA`],
    ['proof', `LA PREUVE EST À 0:05`],
    ['educational', `VOILÀ POURQUOI ÇA FLOP`],
    ['storytelling', `J'AI COMPRIS TROP TARD`],
    ['controversial', `CET AVIS VA ÉNERVER`],
    ['drama', `J'AI FAILLI ARRÊTER`],
    ['debate', `VOUS ÊTES PAS PRÊTS`],
    ['comments', `COMMENTE SI ${person} A TORT`],
    ['authority', `ON TE MENT SUR ÇA`],
    ['emotion', `ÇA M'A MIS MAL`],
    ['curiosity', `VOILÀ LE VRAI PROBLÈME`],
    ['beginner_mistake', `TU EXPLIQUES TROP TÔT`],
    ['nobody_talks', `PERSONNE T'AVERTIT`],
    ['stop_scrolling', `LIS ÇA AVANT DE POSTER`],
  ];

  const tone = input.tone.toLowerCase();
  const ordered = tone.includes('émotion')
    ? templates.sort(([a], [b]) => (a === 'emotion' ? -1 : b === 'emotion' ? 1 : 0))
    : tone.includes('autorité')
      ? templates.sort(([a], [b]) => (a === 'authority' ? -1 : b === 'authority' ? 1 : 0))
      : tone.includes('curieux')
        ? templates.sort(([a], [b]) => (a === 'curiosity' ? -1 : b === 'curiosity' ? 1 : 0))
        : templates;

  return ordered.slice(0, Math.max(1, input.count)).map(([style, hook], index) => makeHook(style, hook, index, index >= 3));
}

export function generateFallbackHookPacks(input: HookGenerationInput): HookPack[] {
  const count = Math.max(1, Math.min(input.count || 10, 12));
  return generateFallbackHooks({ ...input, count }).map((hook, index) =>
    makePackFromHook(hook, input, index, 'local_fallback')
  );
}

export function hookPacksToGeneratedHooks(packs: HookPack[]): GeneratedHook[] {
  return packs.map((pack, index) => ({
    style: pack.style,
    hook: (pack.spokenHook || pack.onScreenText).toUpperCase(),
    whyItWorks: pack.whyItWorks,
    aggressiveness: pack.aggression,
    difficulty: pack.difficulty === 'facile' ? 3 : pack.difficulty === 'moyen' ? 6 : 8,
    objective: pack.objective === 'repost' || pack.objective === 'first_seconds' ? 'views' : pack.objective,
    watchtimeScore: pack.scores.watchtime,
    commentScore: pack.scores.comments,
    curiosityScore: pack.scores.curiosity,
    emotionScore: pack.scores.emotion,
    rawViralScore: pack.scores.overall,
    estimatedRetentionBoost: impactFromScore(pack.scores.overall),
    score: pack.scores.overall,
    proOnly: index >= 3,
  }));
}

export function normalizeHookPacks(rawPacks: unknown, input: HookGenerationInput, source: HookPack['source'] = 'openai'): HookPack[] {
  if (!Array.isArray(rawPacks)) return generateFallbackHookPacks(input);
  const fallback = generateFallbackHookPacks(input);
  const packs = rawPacks
    .map((item, index): HookPack | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Partial<HookPack>;
      const seed = fallback[index % fallback.length];
      const spokenHook = typeof raw.spokenHook === 'string' ? raw.spokenHook.trim() : seed.spokenHook;
      const onScreenText = typeof raw.onScreenText === 'string' ? raw.onScreenText.trim() : seed.onScreenText;
      const firstFrame = typeof raw.firstFrame === 'string' ? raw.firstFrame.trim() : seed.firstFrame;
      const visualAction = typeof raw.visualAction === 'string' ? raw.visualAction.trim() : seed.visualAction;

      if (!onScreenText || !firstFrame || !visualAction) return null;

      return {
        ...seed,
        id: typeof raw.id === 'string' && raw.id ? raw.id : `pack-ai-${Date.now()}-${index}`,
        title: typeof raw.title === 'string' && raw.title ? raw.title : seed.title,
        spokenHook: input.hookMode === 'text' || normalizeFormat(input.format) === 'sans_parole' ? '' : spokenHook,
        onScreenText,
        firstFrame,
        visualAction,
        cameraDirection: typeof raw.cameraDirection === 'string' && raw.cameraDirection ? raw.cameraDirection : seed.cameraDirection,
        cutTiming: typeof raw.cutTiming === 'string' && raw.cutTiming ? raw.cutTiming : seed.cutTiming,
        deliveryTone: typeof raw.deliveryTone === 'string' && raw.deliveryTone ? raw.deliveryTone : seed.deliveryTone,
        soundCue: typeof raw.soundCue === 'string' ? raw.soundCue : seed.soundCue,
        scriptOpening: Array.isArray(raw.scriptOpening) && raw.scriptOpening.length
          ? raw.scriptOpening
              .map((step) => ({
                time: typeof step?.time === 'string' ? step.time : '0.0s',
                instruction: typeof step?.instruction === 'string' ? step.instruction : '',
              }))
              .filter((step) => step.instruction)
              .slice(0, 4)
          : seed.scriptOpening,
        whyItWorks: typeof raw.whyItWorks === 'string' && raw.whyItWorks ? raw.whyItWorks : seed.whyItWorks,
        bestFor: Array.isArray(raw.bestFor) && raw.bestFor.length ? raw.bestFor.map(String).slice(0, 4) : seed.bestFor,
        risk: typeof raw.risk === 'string' ? raw.risk : seed.risk,
        scores: {
          overall: clampScore(raw.scores?.overall ?? seed.scores.overall),
          scrollStop: clampScore(raw.scores?.scrollStop ?? seed.scores.scrollStop),
          curiosity: clampScore(raw.scores?.curiosity ?? seed.scores.curiosity),
          emotion: clampScore(raw.scores?.emotion ?? seed.scores.emotion),
          clarity: clampScore(raw.scores?.clarity ?? seed.scores.clarity),
          comments: clampScore(raw.scores?.comments ?? seed.scores.comments),
          watchtime: clampScore(raw.scores?.watchtime ?? seed.scores.watchtime),
        },
        aggression: Math.max(1, Math.min(10, Math.round(Number(raw.aggression ?? seed.aggression)))),
        difficulty: raw.difficulty === 'facile' || raw.difficulty === 'moyen' || raw.difficulty === 'avancé' ? raw.difficulty : seed.difficulty,
        source,
      };
    })
    .filter((pack): pack is HookPack => Boolean(pack));

  return packs.length ? packs.slice(0, Math.max(1, input.count)) : fallback;
}

export function normalizeGeneratedHooks(rawHooks: string[], input: HookGenerationInput): GeneratedHook[] {
  const fallbackStyles: HookStyle[] = ['curiosity', 'watchtime', 'proof', 'contrarian', 'comments', 'storytelling', 'authority', 'emotion', 'debate', 'secret', 'fomo', 'stop_scrolling', 'nobody_talks'];
  const clean = rawHooks
    .map((hook) => hook.replace(/\s+/g, ' ').trim().toUpperCase())
    .filter(Boolean)
    .slice(0, input.count);

  if (!clean.length) return generateFallbackHooks(input);

  return clean.map((hook, index) => {
    const style = fallbackStyles[index % fallbackStyles.length];
    return makeHook(style, hook.length > 56 ? hook.slice(0, 56).trim() : hook, index, index >= 3);
  }).sort((a, b) => b.score - a.score);
}

export function generatedHooksToHookPacks(hooks: GeneratedHook[], input: HookGenerationInput, source: HookPack['source'] = 'openai') {
  return hooks.map((hook, index) => makePackFromHook(hook, input, index, source));
}

export function styleLabel(style: HookStyle) {
  return titleCaseStyle(style);
}
