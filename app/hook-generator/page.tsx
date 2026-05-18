'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import GuestGate from '@/components/GuestGate';
import { HOOK_LIMITS, MAX_HOOKS_CREATOR, MAX_HOOKS_PRO } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_CREATOR_EUR } from '@/lib/stripe-pricing';
import type { HookObjective, HookPack, VideoFormat } from '@/lib/types';

type HookMode = 'text' | 'spoken';

interface AuthUser {
  id: string;
  email: string;
  plan: 'free' | 'creator' | 'pro' | 'scale';
  hooks_count: number;
}

interface CreatorMemorySummary {
  memoryLevel: number;
  levelLabel: string;
  totalAnalyses: number;
  creatorVoice: string;
  hookStyle: string;
  recurringMistakes: string[];
  strongestPatterns: string[];
  nextExperiments: string[];
  avoidDoing: string[];
}

type Preset = {
  label: string;
  context: string;
  tone: string;
  objective: HookObjective;
  mode: string;
  format: VideoFormat;
  intensity: number;
};

const formatOptions: Array<{ id: VideoFormat; label: string }> = [
  { id: 'facecam', label: 'Facecam' },
  { id: 'texte_ecran', label: 'Texte écran' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'tutoriel', label: 'Tutoriel' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'humour', label: 'Humour' },
  { id: 'sans_parole', label: 'Sans parole' },
  { id: 'avant_apres', label: 'Avant / après' },
];

const objectives: Array<{ id: HookObjective; label: string }> = [
  { id: 'views', label: 'Stopper le scroll' },
  { id: 'first_seconds', label: 'Renforcer les 0-3s' },
  { id: 'watchtime', label: 'Créer une boucle' },
  { id: 'comments', label: 'Faire réagir' },
  { id: 'repost', label: 'Préparer une V2' },
  { id: 'authority', label: 'Installer l’expertise' },
];

const textPresets: Preset[] = [
  { label: 'Texte écran choc', context: 'Je veux une phrase écran très courte qui force à lire la suite.', tone: 'direct', objective: 'views', mode: 'text_only', format: 'texte_ecran', intensity: 8 },
  { label: 'Curiosité immédiate', context: 'Je veux ouvrir une boucle sans expliquer le sujet trop tôt.', tone: 'curieux', objective: 'watchtime', mode: 'opening_3s', format: 'texte_ecran', intensity: 7 },
  { label: 'Erreur commune', context: 'Je veux viser une erreur que tout le monde fait dans ma niche.', tone: 'cash', objective: 'views', mode: 'text_only', format: 'texte_ecran', intensity: 8 },
  { label: 'Avant / après', context: 'Je veux montrer un contraste avant après en très peu de mots.', tone: 'preuve', objective: 'repost', mode: 'repost_angle', format: 'avant_apres', intensity: 7 },
  { label: 'Contradiction', context: 'Je veux contredire une croyance évidente dans ma niche.', tone: 'contrarian', objective: 'comments', mode: 'comment_bait', format: 'texte_ecran', intensity: 8 },
  { label: 'Chiffre violent', context: 'Je veux utiliser un chiffre ou une perte claire comme déclencheur.', tone: 'direct', objective: 'views', mode: 'opening_3s', format: 'texte_ecran', intensity: 9 },
  { label: 'Phrase de carousel', context: 'Je veux une première ligne qui donne envie de swiper ou lire la suite.', tone: 'net', objective: 'watchtime', mode: 'text_only', format: 'texte_ecran', intensity: 6 },
  { label: 'Overlay minimaliste', context: 'Je veux un overlay très court, sobre, lisible en une seconde.', tone: 'minimal', objective: 'first_seconds', mode: 'text_only', format: 'sans_parole', intensity: 6 },
];

const spokenPresets: Preset[] = [
  { label: 'Facecam cash', context: 'Je veux une phrase orale directe qui attaque le vrai problème.', tone: 'cash', objective: 'views', mode: 'facecam_text', format: 'facecam', intensity: 8 },
  { label: 'Storytelling direct', context: 'Je veux ouvrir avec une tension narrative avant le contexte.', tone: 'storytelling', objective: 'watchtime', mode: 'opening_3s', format: 'storytelling', intensity: 7 },
  { label: 'Confession', context: 'Je veux une ouverture personnelle crédible, pas trop écrite.', tone: 'confession', objective: 'watchtime', mode: 'facecam_text', format: 'facecam', intensity: 6 },
  { label: 'Je vais te montrer', context: 'Je veux promettre une démonstration simple et rapide.', tone: 'expert', objective: 'authority', mode: 'opening_3s', format: 'tutoriel', intensity: 6 },
  { label: 'Objection frontale', context: 'Je veux répondre à une objection que mon audience pense déjà.', tone: 'direct', objective: 'comments', mode: 'comment_bait', format: 'facecam', intensity: 8 },
  { label: 'Ton expert', context: 'Je veux une phrase calme, sûre de soi, avec crédibilité immédiate.', tone: 'expert', objective: 'authority', mode: 'facecam_text', format: 'facecam', intensity: 5 },
  { label: 'Phrase naturelle', context: 'Je veux une phrase qui sonne vraiment humaine à l’oral.', tone: 'naturel', objective: 'first_seconds', mode: 'facecam_text', format: 'facecam', intensity: 5 },
  { label: 'Ouverture agressive', context: 'Je veux une ouverture très tendue, mais encore crédible.', tone: 'agressif', objective: 'views', mode: 'opening_3s', format: 'facecam', intensity: 9 },
];

const modeCopy = {
  text: {
    badge: 'Hook textuel',
    title: 'Ce que le viewer lit avant de comprendre.',
    subtitle: 'Texte écran, overlay, première ligne, phrase courte.',
    topicLabel: 'Idée brute / texte à afficher',
    placeholder: 'Ex : Les créateurs perdent l’audience avant même la preuve...',
    toneOptions: ['direct', 'curieux', 'contradiction', 'preuve', 'minimal', 'cash'],
    blueprint: [
      ['Texte écran', 'Phrase courte, lisible en 1 seconde.'],
      ['Première frame', 'Le plan qui donne envie de lire la suite.'],
      ['Timing', 'Apparition entre 0.0s et 0.5s.'],
      ['Mot à emphase', 'Le mot qui porte la tension.'],
      ['Cut recommandé', 'Couper avant que le contexte soit trop long.'],
      ['Risque scroll', 'Trop de mots ou promesse floue.'],
    ],
    loading: ['Test de lisibilité 1 seconde...', 'Construction du texte écran...', 'Compression de la tension...', 'Vérification punch / clarté...'],
  },
  spoken: {
    badge: 'Hook parlé',
    title: 'Ce que le viewer entend avant de scroller.',
    subtitle: 'Facecam, voix off, micro, première phrase orale.',
    topicLabel: 'Idée brute / phrase à dire',
    placeholder: 'Ex : Je veux expliquer pourquoi mon idée était bonne mais mon intro trop lente...',
    toneOptions: ['cash', 'storytelling', 'confession', 'expert', 'naturel', 'provocation'],
    blueprint: [
      ['Phrase à dire', 'Une ouverture qui sonne humaine.'],
      ['Ton de voix', 'L’énergie à tenir sur la première phrase.'],
      ['Pause / rythme', 'Le silence ou cut qui garde la tension.'],
      ['Expression', 'L’attitude qui rend la phrase crédible.'],
      ['Premier cut', 'Le moment où passer à la preuve.'],
      ['Texte complémentaire', 'Une ligne écran qui renforce, sans répéter.'],
    ],
    loading: ['Viralynz teste plusieurs angles...', 'Construction des 3 premières secondes...', 'Vérification naturel oral / rythme...', 'Compression de la phrase facecam...'],
  },
} as const;

const labelClass = 'text-[10px] font-black uppercase tracking-[0.2em] text-slate-500';

function formatLimit(limit: number) {
  return Number.isFinite(limit) ? String(limit) : 'Illimité';
}

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate' }) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/18 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
  };

  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${tones[tone]}`}>{children}</span>;
}

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path d="M0 6.75C0 5.78.78 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
      <path d="M5 1.75C5 .78 5.78 0 6.75 0h7.5C15.22 0 16 .78 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  );
}

function packToText(pack: HookPack, hookMode: HookMode) {
  const mainHook = hookMode === 'text' ? pack.onScreenText : (pack.spokenHook || pack.onScreenText);
  return [
    `Hook Studio · ${pack.title}`,
    `Mode: ${hookMode === 'text' ? 'Hook textuel' : 'Hook parlé'}`,
    `Hook: ${mainHook}`,
    `Texte écran: ${pack.onScreenText}`,
    pack.spokenHook ? `Phrase à dire: ${pack.spokenHook}` : '',
    `Première frame: ${pack.firstFrame}`,
    `Cut: ${pack.cutTiming}`,
    `Pourquoi ça marche: ${pack.whyItWorks}`,
    pack.risk ? `Risque: ${pack.risk}` : '',
  ].filter(Boolean).join('\n');
}

function scoreValue(pack: HookPack, hookMode: HookMode) {
  if (hookMode === 'text') {
    return Math.round((pack.scores.scrollStop * 0.32) + (pack.scores.clarity * 0.28) + (pack.scores.curiosity * 0.24) + (pack.scores.emotion * 0.16));
  }
  return Math.round((pack.scores.scrollStop * 0.25) + (pack.scores.emotion * 0.22) + (pack.scores.clarity * 0.18) + (pack.scores.watchtime * 0.35));
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}/100</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#e879f9)] transition-all" style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

function TextPreview({ pack }: { pack: HookPack }) {
  return (
    <div className="relative aspect-[9/16] min-h-[320px] overflow-hidden rounded-[22px] border border-white/[0.08] bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,#111827,#030712)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="absolute left-4 top-4 rounded-full border border-white/[0.12] bg-black/35 px-2.5 py-1 text-[10px] font-black text-white">0-3s</div>
      <div className="absolute inset-x-4 top-[34%] rounded-[18px] bg-black/42 p-4 text-center backdrop-blur">
        <p className="text-[26px] font-black leading-[1.02] tracking-[-0.04em] text-white">{pack.onScreenText}</p>
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-[15px] border border-white/[0.08] bg-white/[0.045] p-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Première frame</p>
        <p className="mt-1 text-[12px] leading-5 text-slate-300">{pack.firstFrame}</p>
      </div>
    </div>
  );
}

function SpokenPreview({ pack }: { pack: HookPack }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(3,7,18,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="rounded-[18px] border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">Script facecam</p>
        <p className="mt-3 text-[24px] font-black leading-tight tracking-[-0.035em] text-white">“{pack.spokenHook || pack.onScreenText}”</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[15px] border border-white/[0.07] bg-white/[0.035] p-3">
          <p className={labelClass}>Ton conseillé</p>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-200">{pack.deliveryTone}</p>
        </div>
        <div className="rounded-[15px] border border-white/[0.07] bg-white/[0.035] p-3">
          <p className={labelClass}>Pause / cut</p>
          <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-200">{pack.cutTiming}</p>
        </div>
      </div>
      <div className="mt-3 rounded-[15px] border border-white/[0.07] bg-black/18 p-3">
        <p className={labelClass}>Texte écran complémentaire</p>
        <p className="mt-2 text-[15px] font-black text-white">{pack.onScreenText}</p>
      </div>
    </div>
  );
}

export default function HookGeneratorPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [memory, setMemory] = useState<CreatorMemorySummary | null>(null);
  const [domReady, setDomReady] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  const [hookMode, setHookMode] = useState<HookMode>('text');
  const [context, setContext] = useState('');
  const [format, setFormat] = useState<VideoFormat>('texte_ecran');
  const [niche, setNiche] = useState('');
  const [objective, setObjective] = useState<HookObjective>('first_seconds');
  const [mode, setMode] = useState('text_only');
  const [tone, setTone] = useState('direct');
  const [intensity, setIntensity] = useState(7);
  const [count, setCount] = useState(8);
  const [useMemory, setUseMemory] = useState(true);

  const [packs, setPacks] = useState<HookPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState('');
  const [used, setUsed] = useState(0);
  const [limitUsed, setLimitUsed] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const copy = modeCopy[hookMode];
  const plan = authUser?.plan ?? null;
  const limit = plan ? HOOK_LIMITS[plan] : 0;
  const effectiveLimit = limitUsed || limit;
  const remaining = Number.isFinite(effectiveLimit) ? Math.max(0, effectiveLimit - used) : Number.POSITIVE_INFINITY;
  const canUse = !!plan && plan !== 'free' && (Number.isFinite(effectiveLimit) ? used < effectiveLimit : true);
  const quotaProgress = Number.isFinite(effectiveLimit) && effectiveLimit > 0 ? (used / effectiveLimit) * 100 : 18;
  const presets = hookMode === 'text' ? textPresets : spokenPresets;

  useEffect(() => {
    setDomReady(true);
    const params = new URLSearchParams(window.location.search);
    const trendHook = params.get('trendHook');
    const trendTitle = params.get('trendTitle');
    const trendType = params.get('trendType');
    if (trendHook || trendTitle) {
      setContext([trendTitle ? `Radar: ${trendTitle}` : '', trendHook ? `Hook exemple: ${trendHook}` : '', trendType ? `Type: ${trendType}` : ''].filter(Boolean).join('\n'));
      setObjective(trendType === 'repost' ? 'repost' : 'views');
      setMode(trendType === 'repost' ? 'repost_angle' : 'opening_3s');
    }
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
          setUsed(data.user.hooks_count ?? 0);
          setLimitUsed(HOOK_LIMITS[data.user.plan] ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoaded(true));

    fetch('/api/creator-memory')
      .then((response) => response.ok ? response.json() : { memory: null })
      .then((data) => setMemory(data.memory ?? null))
      .catch(() => setMemory(null));
  }, []);

  useEffect(() => {
    if (hookMode === 'text') {
      setFormat((current) => current === 'facecam' ? 'texte_ecran' : current);
      setMode((current) => current === 'facecam_text' ? 'text_only' : current);
    } else {
      setFormat((current) => current === 'texte_ecran' || current === 'sans_parole' ? 'facecam' : current);
      setMode((current) => current === 'text_only' ? 'facecam_text' : current);
    }
    setPacks([]);
  }, [hookMode]);

  useEffect(() => {
    if (!authUser || authUser.plan === 'free' || !Number.isFinite(remaining)) return;
    if (count > remaining && remaining > 0) setCount(Math.min(remaining, 12));
  }, [authUser, remaining, count]);

  function applyPreset(preset: Preset) {
    setContext((current) => current.trim() ? current : preset.context);
    setTone(preset.tone);
    setObjective(preset.objective);
    setMode(preset.mode);
    setFormat(preset.format);
    setIntensity(preset.intensity);
  }

  async function fillFromLastAnalysis() {
    setLoadingAnalysis(true);
    setError('');
    try {
      const response = await fetch('/api/analyze/history');
      const data = await response.json();
      const latest = Array.isArray(data.analyses) ? data.analyses[0] : null;
      if (!latest) {
        setError('Aucune analyse récente trouvée. Décris ton sujet manuellement.');
        return;
      }
      const result = latest.result ?? latest.analysis_result ?? latest;
      const coach = result.coachAnalysis;
      const detected = coach?.detectedVideoFormat?.primary;
      setContext([
        result.finalVerdict || coach?.verdict || coach?.coachSummary,
        coach?.dominantFailure?.title,
        result.repostVersion?.hook,
        result.repostVersion?.angle,
        Array.isArray(result.actionPlan) ? result.actionPlan.slice(0, 2).join(' ') : '',
      ].filter(Boolean).join(' ').slice(0, 420));
      setFormat(detected === 'sans_parole' || detected === 'texte_ecran' ? 'texte_ecran' : 'facecam');
      setHookMode(detected === 'sans_parole' || detected === 'texte_ecran' ? 'text' : 'spoken');
      setObjective('repost');
      setMode('repost_angle');
    } catch {
      setError('Impossible de récupérer ta dernière analyse.');
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function handleGenerate() {
    setError('');
    if (!authLoaded || loading) return;
    if (!authUser) {
      setShowGuestGate(true);
      return;
    }
    if (plan === 'free') return;
    if (!context.trim()) {
      setError('Décris le sujet ou l’angle de ta vidéo.');
      return;
    }
    if (context.trim().length > 420) {
      setError('Sujet trop long. Garde le brief sous 420 caractères.');
      return;
    }

    setLoading(true);
    setPacks([]);
    try {
      const response = await fetch('/api/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: context.trim(),
          scene: hookMode === 'text' ? 'overlay 0-3 secondes' : 'ouverture facecam ou voix off',
          person: '',
          tone,
          count: Math.min(count, Number.isFinite(remaining) ? remaining : count, 12),
          format,
          objective,
          niche,
          hookMode,
          mode,
          intensity,
          useMemory,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        if (typeof data.used === 'number') setUsed(data.used);
        if (typeof data.limit === 'number') setLimitUsed(data.limit);
        return;
      }
      const nextPacks: HookPack[] = Array.isArray(data.hookPacks) ? data.hookPacks : [];
      setPacks(nextPacks);
      setUsed(data.used ?? used);
      setLimitUsed(data.limit ?? limitUsed);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Erreur réseau. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  const bestPack = packs[0];
  const loadingLines = copy.loading;

  return (
    <main className="relative min-h-dvh overflow-x-hidden text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden" aria-hidden>
        <div className="absolute -top-56 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-violet-500/[0.12] to-cyan-400/[0.08] blur-3xl" />
        <div className="absolute right-[6%] top-32 h-56 w-56 rounded-full bg-fuchsia-400/[0.06] blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      {showGuestGate && domReady && createPortal(
        <GuestGate show={showGuestGate} pendingUrl="" onClose={() => setShowGuestGate(false)} />,
        document.body
      )}

      <div className="relative mx-auto max-w-[1460px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-stretch">
          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(13,21,41,0.98),rgba(5,9,20,0.99)_56%,rgba(28,13,54,0.96))] p-5 shadow-[0_42px_132px_-86px_rgba(124,58,237,1),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7 lg:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_8%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.2),transparent_38%)]" />
            <div className="relative">
              <div className="flex flex-wrap gap-2">
                <Badge tone="cyan">Hook Studio</Badge>
                <Badge tone="slate">Scroll Stopper Zone</Badge>
                <Badge tone="violet">0-3s</Badge>
              </div>
              <h1 className="mt-5 max-w-5xl text-[38px] font-black leading-[0.96] tracking-[-0.065em] text-white sm:text-[58px] lg:text-[72px]">
                Écris ce que le viewer lit. Ou ce qu’il doit entendre.
              </h1>
              <p className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-[17px]">
                Choisis un hook textuel pour l’écran ou un hook parlé pour la facecam. Viralynz adapte l’angle, le ton, le rythme et la promesse.
              </p>
              <div className="mt-7 grid gap-2 sm:grid-cols-5">
                {['Texte écran', 'Facecam', 'Voix off', 'Carousel', 'Repost V2'].map((item) => (
                  <div key={item} className="rounded-[15px] border border-white/[0.075] bg-white/[0.04] px-3 py-3">
                    <p className="text-[11px] font-black text-white">{item}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Opening</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(5,9,20,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]">
            <p className={labelClass}>Quota Hook Studio</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[36px] font-black tracking-[-0.06em] text-white">{used}<span className="text-base text-slate-600"> / {formatLimit(effectiveLimit)}</span></p>
                <p className="mt-1 text-[12px] font-semibold text-slate-500">{Number.isFinite(remaining) ? `${remaining} hooks restants` : 'Hooks illimités'} · Plan {plan ?? 'invité'}</p>
              </div>
              <Badge tone={remaining === 0 ? 'amber' : 'green'}>{plan === 'free' ? 'Verrouillé' : 'Actif'}</Badge>
            </div>
            <div className="mt-4">
              <ProgressBar value={quotaProgress} />
            </div>
            <div className="mt-5 rounded-[16px] border border-violet-300/14 bg-violet-400/[0.075] p-4">
              <p className="text-[13px] font-black text-white">Creator génère. Pro personnalise.</p>
              <p className="mt-2 text-[12.5px] leading-5 text-slate-400">Pro adapte les hooks à ta mémoire créateur et débloque des reconstructions V2 plus contextuelles.</p>
              <Link href="/dashboard/billing" className="mt-4 inline-flex min-h-[38px] items-center rounded-[11px] border border-white/[0.09] bg-white/[0.045] px-3 text-[12px] font-black text-white transition hover:bg-white/[0.075]">
                Débloquer les hooks personnalisés
              </Link>
            </div>
          </aside>
        </section>

        {authLoaded && authUser && plan === 'free' && (
          <div className="mt-6 rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-sm font-black text-white">Hook Studio est disponible à partir de Creator.</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{MAX_HOOKS_CREATOR} hooks/mois avec Creator · {MAX_HOOKS_PRO} hooks/mois avec Pro.</p>
            <Link href="/pricing" className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-blue-600 px-5 py-2.5 text-sm font-black text-white">
              Passer à Creator · {DISPLAY_CATALOG_CREATOR_EUR}€/mois
            </Link>
          </div>
        )}

        <section className="mt-6 rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.99))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
          <div className="grid gap-3 md:grid-cols-2">
            {(['text', 'spoken'] as HookMode[]).map((item) => {
              const active = hookMode === item;
              const option = modeCopy[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setHookMode(item)}
                  className={`rounded-[20px] border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                    active ? 'border-cyan-200/28 bg-cyan-300/[0.08] shadow-[0_24px_76px_-62px_rgba(34,211,238,1)]' : 'border-white/[0.065] bg-white/[0.03] hover:bg-white/[0.055]'
                  }`}
                >
                  <Badge tone={active ? 'cyan' : 'slate'}>{option.badge}</Badge>
                  <p className="mt-3 text-[20px] font-black tracking-[-0.035em] text-white">{option.title}</p>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{option.subtitle}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_430px]">
          <div className="rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.94),rgba(5,9,20,0.99))] p-4 shadow-[0_30px_100px_-82px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.055)] sm:p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Badge tone="cyan">Brief de hook</Badge>
                <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-white">Donne l’idée brute. Viralynz construit l’ouverture.</h2>
              </div>
              <button
                type="button"
                onClick={fillFromLastAnalysis}
                disabled={loadingAnalysis}
                className="min-h-[40px] rounded-[12px] border border-white/[0.09] bg-white/[0.04] px-3 text-[12px] font-black text-slate-200 transition hover:bg-white/[0.075] disabled:opacity-50"
              >
                {loadingAnalysis ? 'Lecture analyse...' : 'Depuis ma dernière analyse'}
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className={labelClass}>{copy.topicLabel}</span>
                <textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  rows={4}
                  maxLength={420}
                  placeholder={copy.placeholder}
                  className="mt-3 w-full resize-none rounded-[16px] border border-white/[0.08] bg-[#070d1c] px-4 py-3.5 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-700 hover:border-white/[0.14] focus:border-violet-300/40 focus:ring-2 focus:ring-violet-300/10"
                />
                <span className="mt-2 block text-right text-[11px] font-semibold text-slate-600">{context.length}/420</span>
              </label>

              <div>
                <p className={labelClass}>Presets rapides</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[11px] font-black text-slate-300 transition hover:-translate-y-0.5 hover:border-cyan-200/22 hover:bg-white/[0.065] hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Niche</span>
                  <input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="business, fitness, beauté..." className="mt-3 h-12 w-full rounded-[14px] border border-white/[0.08] bg-[#070d1c] px-4 text-sm font-semibold text-white outline-none placeholder:text-slate-700 focus:border-violet-300/40" />
                </label>
                <label className="block">
                  <span className={labelClass}>Format vidéo</span>
                  <select value={format} onChange={(event) => setFormat(event.target.value as VideoFormat)} className="mt-3 h-12 w-full rounded-[14px] border border-white/[0.08] bg-[#111827] px-4 text-sm font-black text-white outline-none focus:border-violet-300/40">
                    {formatOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Objectif</span>
                  <select value={objective} onChange={(event) => setObjective(event.target.value as HookObjective)} className="mt-3 h-12 w-full rounded-[14px] border border-white/[0.08] bg-[#111827] px-4 text-sm font-black text-white outline-none focus:border-violet-300/40">
                    {objectives.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Ton</span>
                  <select value={tone} onChange={(event) => setTone(event.target.value)} className="mt-3 h-12 w-full rounded-[14px] border border-white/[0.08] bg-[#111827] px-4 text-sm font-black text-white outline-none focus:border-violet-300/40">
                    {copy.toneOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_150px] md:items-end">
                <div>
                  <div className="flex items-center justify-between">
                    <span className={labelClass}>Niveau d’intensité</span>
                    <span className="text-xs font-black text-white">{intensity}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} className="mt-4 w-full accent-fuchsia-400" />
                </div>
                <label className="block">
                  <span className={labelClass}>Hooks</span>
                  <select value={count} onChange={(event) => setCount(Number(event.target.value))} className="mt-3 h-12 w-full rounded-[14px] border border-white/[0.08] bg-[#111827] px-4 text-sm font-black text-white outline-none">
                    {[4, 6, 8, 10, 12].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>

              <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">{memory ? 'Mémoire créateur activée' : 'Analyse quelques vidéos pour personnaliser tes hooks.'}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-500">
                      {memory ? `${memory.levelLabel} · ${memory.totalAnalyses} analyse${memory.totalAnalyses > 1 ? 's' : ''} apprise${memory.totalAnalyses > 1 ? 's' : ''}` : 'Pro adapte les hooks à ton style, tes erreurs et tes patterns récurrents.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseMemory((current) => !current)}
                    className={`rounded-full border px-3 py-2 text-[11px] font-black transition ${useMemory ? 'border-emerald-300/22 bg-emerald-300/10 text-emerald-100' : 'border-white/[0.08] bg-white/[0.035] text-slate-400'}`}
                  >
                    {useMemory ? 'Mémoire utilisée' : 'Mémoire ignorée'}
                  </button>
                </div>
                {memory ? (
                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    <p className="rounded-[13px] border border-white/[0.06] bg-black/18 p-3 text-[12px] leading-5 text-slate-300">Style : {memory.creatorVoice || memory.hookStyle || 'en apprentissage'}</p>
                    <p className="rounded-[13px] border border-white/[0.06] bg-black/18 p-3 text-[12px] leading-5 text-slate-300">Erreur : {memory.recurringMistakes[0] || 'hook trop explicatif à surveiller'}</p>
                    <p className="rounded-[13px] border border-white/[0.06] bg-black/18 p-3 text-[12px] leading-5 text-slate-300">À renforcer : {memory.strongestPatterns[0] || memory.nextExperiments[0] || 'tension immédiate'}</p>
                  </div>
                ) : null}
              </div>

              {error ? <p className="rounded-[15px] border border-rose-300/18 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">{error}</p> : null}

              <button
                onClick={handleGenerate}
                disabled={loading || (!!authUser && !canUse)}
                className="min-h-[52px] w-full rounded-[14px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-sm font-black text-white shadow-[0_24px_60px_-28px_rgba(139,92,246,1)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? 'Construction des 3 premières secondes...' : !authUser ? 'Créer mes hooks →' : plan === 'free' ? 'Disponible avec Creator' : `Générer ${count} hooks ${hookMode === 'text' ? 'textuels' : 'parlés'} →`}
              </button>
            </div>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-[104px] xl:self-start">
            <section className="rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.94),rgba(5,9,20,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Badge tone="cyan">Blueprint des 3 premières secondes</Badge>
              <h2 className="mt-3 text-[26px] font-black tracking-[-0.05em] text-white">{copy.title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">{hookMode === 'text' ? 'Ce que le viewer doit lire avant de comprendre la vidéo.' : 'Ce que le viewer doit entendre avant d’avoir envie de scroller.'}</p>
              <div className="mt-5 grid gap-2.5">
                {copy.blueprint.map(([title, body]) => (
                  <div key={title} className="rounded-[15px] border border-white/[0.065] bg-white/[0.035] p-3">
                    <p className="text-[13px] font-black text-white">{title}</p>
                    <p className="mt-1 text-[12px] leading-5 text-slate-500">{body}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-[22px] border border-white/[0.075] bg-white/[0.035] p-5">
            <Badge tone="slate">Hook Lab</Badge>
            <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">Un hook écrit ne se pense pas comme un hook parlé.</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
                <p className="font-black text-white">Hook textuel</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">Le viewer le lit avant de comprendre. Il doit être court, visuel, brutalement clair.</p>
              </div>
              <div className="rounded-[16px] border border-violet-300/14 bg-violet-300/[0.055] p-4">
                <p className="font-black text-white">Hook parlé</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">Le viewer l’entend en même temps qu’il juge ton énergie. Il doit sonner humain et crédible.</p>
              </div>
            </div>
          </article>
          <article className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(76,29,149,0.2),rgba(5,9,20,0.98)_58%,rgba(8,47,73,0.2))] p-5">
            <Badge tone="violet">Pro</Badge>
            <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">Les hooks personnalisés viennent de ta mémoire créateur.</h3>
            <p className="mt-3 text-[13px] leading-6 text-slate-400">Creator génère des hooks solides. Pro utilise tes analyses pour éviter les phrases génériques et pousser tes patterns gagnants.</p>
            <Link href="/dashboard/billing" className="mt-5 inline-flex min-h-[42px] items-center rounded-[12px] border border-white/[0.09] bg-white/[0.05] px-4 text-[13px] font-black text-white transition hover:bg-white/[0.08]">
              Voir Pro
            </Link>
          </article>
        </section>

        {loading ? (
          <section className="mt-8 rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.99))] p-5">
            <Badge tone="cyan">Génération</Badge>
            <h2 className="mt-3 text-[28px] font-black tracking-[-0.05em] text-white">Viralynz construit l’ouverture.</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {loadingLines.map((line) => (
                <div key={line} className="rounded-[16px] border border-white/[0.065] bg-white/[0.035] p-4">
                  <div className="h-1.5 w-16 animate-pulse rounded-full bg-cyan-300/50" />
                  <p className="mt-4 text-[13px] font-semibold text-slate-300">{line}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {packs.length > 0 ? (
          <section ref={resultsRef} className="mt-10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={labelClass}>Résultats générés</p>
                <h2 className="mt-1 text-[32px] font-black tracking-[-0.055em] text-white">{packs.length} hooks {hookMode === 'text' ? 'textuels' : 'parlés'} prêts à tester</h2>
              </div>
              <button
                type="button"
                onClick={() => copyText(packs.map((pack) => packToText(pack, hookMode)).join('\n\n---\n\n'), 'all')}
                className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[12px] border border-white/[0.1] bg-white/[0.04] px-4 text-xs font-black text-slate-300"
              >
                <CopyIcon copied={copied === 'all'} />
                {copied === 'all' ? 'Tout copié' : 'Copier tous les hooks'}
              </button>
            </div>

            {bestPack ? (
              <div className="mb-5 rounded-[24px] border border-violet-300/22 bg-violet-400/[0.075] p-5">
                <p className={labelClass}>Meilleure ouverture</p>
                <p className="mt-2 text-[28px] font-black leading-tight tracking-[-0.04em] text-white">“{hookMode === 'text' ? bestPack.onScreenText : (bestPack.spokenHook || bestPack.onScreenText)}”</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{bestPack.whyItWorks}</p>
              </div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-2">
              {packs.map((pack, index) => {
                const mainHook = hookMode === 'text' ? pack.onScreenText : (pack.spokenHook || pack.onScreenText);
                const globalScore = scoreValue(pack, hookMode);
                return (
                  <article key={pack.id} className={`rounded-[24px] border bg-[#070d1c] p-4 shadow-[0_30px_100px_-82px_rgba(124,58,237,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-5 ${index === 0 ? 'border-violet-300/24' : 'border-white/[0.08]'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="violet">#{index + 1}</Badge>
                          <Badge tone="green">{globalScore}/100</Badge>
                          <Badge tone="slate">{hookMode === 'text' ? 'Textuel' : 'Parlé'}</Badge>
                        </div>
                        <h3 className="mt-4 text-[24px] font-black leading-tight tracking-[-0.04em] text-white">“{mainHook}”</h3>
                      </div>
                    </div>

                    <div className="mt-5">
                      {hookMode === 'text' ? <TextPreview pack={pack} /> : <SpokenPreview pack={pack} />}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3.5">
                        <p className={labelClass}>Angle utilisé</p>
                        <p className="mt-2 text-sm font-black text-white">{pack.title}</p>
                      </div>
                      <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.035] p-3.5">
                        <p className={labelClass}>Émotion déclenchée</p>
                        <p className="mt-2 text-sm font-black text-white">{pack.bestFor[1] || 'Curiosité'}</p>
                      </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-slate-400">{pack.whyItWorks}</p>
                    <p className="mt-2 text-sm leading-6 text-amber-100/80">Risque : {pack.risk || (hookMode === 'text' ? 'peut devenir trop long si tu ajoutes du contexte.' : 'peut sonner écrit si tu ne le dis pas naturellement.')}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {hookMode === 'text' ? (
                        <>
                          <ScorePill label="Scroll" value={pack.scores.scrollStop} />
                          <ScorePill label="Lisibilité" value={pack.scores.clarity} />
                          <ScorePill label="Curiosité" value={pack.scores.curiosity} />
                          <ScorePill label="Punch" value={pack.scores.emotion} />
                        </>
                      ) : (
                        <>
                          <ScorePill label="Oral" value={pack.scores.clarity} />
                          <ScorePill label="Rythme" value={pack.scores.watchtime} />
                          <ScorePill label="Émotion" value={pack.scores.emotion} />
                          <ScorePill label="Crédible" value={pack.scores.scrollStop} />
                        </>
                      )}
                    </div>

                    <div className="mt-5 rounded-[16px] border border-cyan-300/14 bg-cyan-300/[0.055] p-3.5">
                      <p className={labelClass}>{hookMode === 'text' ? 'Variante plus courte' : 'Texte écran complémentaire'}</p>
                      <p className="mt-2 text-[15px] font-black text-white">{pack.onScreenText.length > 32 ? `${pack.onScreenText.slice(0, 32).trim()}...` : pack.onScreenText}</p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button onClick={() => copyText(mainHook, `${pack.id}-hook`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-slate-300">
                        <CopyIcon copied={copied === `${pack.id}-hook`} />
                        Copier
                      </button>
                      <button onClick={() => copyText(packToText(pack, hookMode), `${pack.id}-pack`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-slate-300">
                        <CopyIcon copied={copied === `${pack.id}-pack`} />
                        Copier le pack
                      </button>
                      <span className="rounded-xl border border-emerald-300/16 bg-emerald-300/[0.08] px-3 py-2 text-xs font-black text-emerald-100">
                        Enregistré dans l’historique
                      </span>
                      <button onClick={handleGenerate} className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-slate-300">
                        Générer une variation
                      </button>
                      <Link href="/dashboard/rewrite" className="rounded-xl border border-violet-300/22 bg-violet-400/10 px-3 py-2 text-xs font-black text-violet-100">
                        Transformer en V2
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
