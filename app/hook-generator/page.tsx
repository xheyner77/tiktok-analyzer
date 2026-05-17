'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import GuestGate from '@/components/GuestGate';
import { HOOK_LIMITS, MAX_HOOKS_CREATOR, MAX_HOOKS_PRO } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_CREATOR_EUR } from '@/lib/stripe-pricing';
import type { HookObjective, HookPack, VideoFormat } from '@/lib/types';

interface AuthUser {
  id: string;
  email: string;
  plan: 'free' | 'creator' | 'pro' | 'scale';
  hooks_count: number;
}

const formats: Array<{ id: VideoFormat; label: string }> = [
  { id: 'facecam', label: 'Facecam' },
  { id: 'texte_ecran', label: 'Texte écran' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'tutoriel', label: 'Tutoriel' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'humour', label: 'Humour' },
  { id: 'playback_lipsync', label: 'Playback' },
  { id: 'sans_parole', label: 'Sans parole' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'lifestyle', label: 'Lifestyle' },
  { id: 'motivation', label: 'Motivation' },
  { id: 'avant_apres', label: 'Avant/après' },
];

const objectives: Array<{ id: HookObjective; label: string }> = [
  { id: 'views', label: 'Réduire le scroll risk' },
  { id: 'comments', label: 'Commentaires' },
  { id: 'watchtime', label: 'Watchtime' },
  { id: 'first_seconds', label: '3 premières secondes' },
  { id: 'repost', label: 'Angle de reconstruction' },
  { id: 'authority', label: 'Autorité' },
];

const modes = [
  { id: 'facecam_text', label: 'Texte + facecam' },
  { id: 'text_only', label: 'Texte écran uniquement' },
  { id: 'opening_3s', label: 'Opening 0-3s' },
  { id: 'repost_angle', label: 'Angle structure' },
  { id: 'comment_bait', label: 'Comment bait' },
  { id: 'watchtime', label: 'Watchtime' },
];

const presets = [
  'Je veux corriger une intro qui décroche',
  'Je veux un CTA plus clair',
  'Je veux avancer le payoff',
  'Je veux une version plus tendue',
  'Je veux une preuve sans parler',
  'Je veux un hook facecam',
];

const labelClass = 'text-[10px] font-black uppercase tracking-[0.2em] text-gray-500';

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

function packToText(pack: HookPack) {
  return [
    `Hook Pack · ${pack.title}`,
    pack.spokenHook ? `Phrase à dire: ${pack.spokenHook}` : 'Phrase à dire: aucune, ouverture sans parole',
    `Texte écran: ${pack.onScreenText}`,
    `Première frame: ${pack.firstFrame}`,
    `Action visuelle: ${pack.visualAction}`,
    `Direction caméra: ${pack.cameraDirection}`,
    `Cut timing: ${pack.cutTiming}`,
    `Delivery: ${pack.deliveryTone}`,
    'Timing 0-3s:',
    ...pack.scriptOpening.map((step) => `${step.time} : ${step.instruction}`),
    `Pourquoi ça marche: ${pack.whyItWorks}`,
  ].join('\n');
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-600">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}/100</p>
    </div>
  );
}

export default function HookGeneratorPage() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [domReady, setDomReady] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);

  const [context, setContext] = useState('');
  const [format, setFormat] = useState<VideoFormat>('facecam');
  const [niche, setNiche] = useState('');
  const [objective, setObjective] = useState<HookObjective>('views');
  const [mode, setMode] = useState('opening_3s');
  const [tone, setTone] = useState('direct');
  const [intensity, setIntensity] = useState(7);
  const [count, setCount] = useState(10);

  const [packs, setPacks] = useState<HookPack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState('');
  const [used, setUsed] = useState(0);
  const [limitUsed, setLimitUsed] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDomReady(true);
    const params = new URLSearchParams(window.location.search);
    const trendHook = params.get('trendHook');
    const trendTitle = params.get('trendTitle');
    const trendType = params.get('trendType');
    if (trendHook || trendTitle) {
      setContext([
        trendTitle ? `Radar: ${trendTitle}` : '',
        trendHook ? `Hook exemple: ${trendHook}` : '',
        trendType ? `Type: ${trendType}` : '',
      ].filter(Boolean).join('\n'));
      setObjective(trendType === 'repost' ? 'repost' : trendType === 'cta' ? 'comments' : 'views');
      setMode(trendType === 'repost' ? 'repost_angle' : trendType === 'cta' ? 'comment_bait' : 'opening_3s');
    }
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setAuthUser(d.user);
          setUsed(d.user.hooks_count ?? 0);
          setLimitUsed(HOOK_LIMITS[d.user.plan] ?? 0);
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, []);

  const plan = authUser?.plan ?? null;
  const limit = plan ? HOOK_LIMITS[plan] : 0;
  const effectiveLimit = limitUsed || limit;
  const remaining = Math.max(0, effectiveLimit - used);
  const canUse = !!plan && plan !== 'free' && used < effectiveLimit;
  const bestPack = packs[0];

  useEffect(() => {
    if (!authUser || authUser.plan === 'free') return;
    if (count > remaining && remaining > 0) setCount(Math.min(remaining, 12));
  }, [authUser, remaining, count]);

  function applyPreset(preset: string) {
    if (preset.includes('commentaires')) {
      setObjective('comments');
      setMode('comment_bait');
    } else if (preset.includes('3 premières')) {
      setObjective('first_seconds');
      setMode('opening_3s');
    } else if (preset.includes('brutal')) {
      setTone('brutal');
      setIntensity(9);
    } else if (preset.includes('sans parler')) {
      setFormat('sans_parole');
      setMode('text_only');
    } else if (preset.includes('facecam')) {
      setFormat('facecam');
      setMode('facecam_text');
    } else {
      setObjective('views');
    }
  }

  async function fillFromLastAnalysis() {
    setLoadingAnalysis(true);
    setError('');
    try {
      const res = await fetch('/api/analyze/history');
      const data = await res.json();
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
      setFormat(detected === 'sans_parole' || detected === 'gaming' || detected === 'humour' || detected === 'ecommerce' ? detected : 'facecam');
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
      setError('Décris le sujet de ta vidéo.');
      return;
    }
    if (context.trim().length > 420) {
      setError('Sujet trop long (max 420 caractères).');
      return;
    }

    setLoading(true);
    setPacks([]);
    try {
      const res = await fetch('/api/hooks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: context.trim(),
          scene: mode,
          person: '',
          tone,
          count: Math.min(count, remaining || count, 12),
          format,
          objective,
          niche,
          mode,
          intensity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
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
      setError('Une erreur est survenue. Réessaie dans un instant.');
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

  const battle = useMemo(() => {
    if (compareIds.length !== 2) return null;
    const [a, b] = compareIds.map((id) => packs.find((pack) => pack.id === id));
    if (!a || !b) return null;
    const aScore = a.scores.scrollStop + a.scores.clarity + a.scores.emotion + a.scores.comments + a.scores.watchtime;
    const bScore = b.scores.scrollStop + b.scores.clarity + b.scores.emotion + b.scores.comments + b.scores.watchtime;
    const winner = bScore >= aScore ? b : a;
    return { a, b, winner };
  }, [compareIds, packs]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[540px] overflow-hidden" aria-hidden>
        <div className="absolute -top-56 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-indigo/[0.1] to-vn-fuchsia/[0.08] blur-3xl" />
        <div className="absolute right-[8%] top-32 h-48 w-48 rounded-full bg-cyan-400/[0.055] blur-3xl" />
      </div>

      {showGuestGate && domReady && createPortal(
        <GuestGate show={showGuestGate} pendingUrl="" onClose={() => setShowGuestGate(false)} />,
        document.body
      )}

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        <section className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100">
              Hook Studio
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl">
              Réécris l’ouverture avant le <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">remontage.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-gray-400 sm:text-base">
              Viralynz transforme un hook faible en variantes testables : directe, preuve, tension, storytelling et version courte.
            </p>
            <p className="mt-3 text-sm font-black text-white">Un hook testable, avec texte écran, première frame et timing 0-3s.</p>
          </div>

          <div className="rounded-[1.35rem] border border-white/[0.09] bg-white/[0.035] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['Phrase', 'Texte écran', 'Première frame', 'Premier cut'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">Studio</p>
                  <p className="mt-1 text-sm font-black text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {authLoaded && authUser && plan === 'free' && (
          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <p className="text-sm font-black text-white">Hook Studio transforme les diagnostics Viralynz en ouvertures prêtes à tester.</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              {MAX_HOOKS_CREATOR} hooks/mois avec Creator · {MAX_HOOKS_PRO} hooks/mois avec Pro.
            </p>
            <Link href="/pricing" className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-2.5 text-sm font-black text-white">
              Passer à Creator · {DISPLAY_CATALOG_CREATOR_EUR}€/mois
            </Link>
          </div>
        )}

        {!authLoaded || !authUser || plan === 'free' ? null : (
          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={labelClass}>Quota Hook Studio</p>
                <p className="mt-2 text-3xl font-black text-white">{used}<span className="text-base text-gray-600"> / {effectiveLimit}</span></p>
                <p className="mt-1 text-xs font-semibold text-gray-500">Un HookPack garde plusieurs ouvertures comparables pour le même angle.</p>
              </div>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100">
                {remaining} restants
              </span>
            </div>
          </div>
        )}

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="rounded-[1.35rem] border border-white/[0.09] bg-[#0b0b12] p-4 shadow-[0_28px_95px_-82px_rgba(99,102,241,0.85)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={labelClass}>Brief</p>
                <h2 className="mt-1 text-xl font-black text-white">Construis les 3 premières secondes</h2>
              </div>
              <button
                type="button"
                onClick={fillFromLastAnalysis}
                disabled={loadingAnalysis}
                className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-[11px] font-black text-gray-300 transition hover:border-white/[0.16] disabled:opacity-50"
              >
                {loadingAnalysis ? 'Chargement…' : 'Depuis ma dernière analyse'}
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className={labelClass}>Sujet de la vidéo</label>
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                  maxLength={420}
                  placeholder="Ex : Je montre pourquoi mon TikTok a floppé alors que l’idée était bonne..."
                  className="mt-3 w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-700 hover:border-white/[0.14] focus:border-vn-fuchsia/40"
                />
                <p className="mt-2 text-right text-[10px] font-semibold text-gray-600">{context.length}/420</p>
              </div>

              <div>
                <p className={labelClass}>Presets rapides</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold text-gray-400 transition hover:border-white/[0.15] hover:text-white"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Format vidéo</label>
                  <select value={format} onChange={(e) => setFormat(e.target.value as VideoFormat)} className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#111118] px-4 py-3 text-sm font-bold text-white outline-none">
                    {formats.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Niche</label>
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="business, fitness, beauté..." className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-700" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Objectif</label>
                  <select value={objective} onChange={(e) => setObjective(e.target.value as HookObjective)} className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#111118] px-4 py-3 text-sm font-bold text-white outline-none">
                    {objectives.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Mode</label>
                  <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#111118] px-4 py-3 text-sm font-bold text-white outline-none">
                    {modes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Intensité</label>
                    <span className="text-xs font-black text-white">{intensity}/10</span>
                  </div>
                  <input type="range" min={1} max={10} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="mt-4 w-full accent-fuchsia-400" />
                </div>
                <div>
                  <label className={labelClass}>Ouvertures</label>
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="mt-3 w-full rounded-xl border border-white/[0.08] bg-[#111118] px-4 py-3 text-sm font-bold text-white outline-none sm:w-28">
                    {[6, 8, 10, 12].map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              {error && <p className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm font-semibold text-red-300">{error}</p>}

              <button
                onClick={handleGenerate}
                disabled={loading || (!!authUser && !canUse)}
                className="w-full rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 py-4 text-sm font-black text-white shadow-[0_18px_60px_-34px_rgba(232,121,249,0.95)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {loading ? 'Réécriture des hooks…' : !authUser ? 'Créer mes HookPacks →' : plan === 'free' ? 'Disponible avec Creator' : `Créer ${count} hooks testables →`}
              </button>
            </div>
          </div>

          <aside className="rounded-[1.35rem] border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5">
            <p className={labelClass}>Ce que Viralynz construit</p>
            <h2 className="mt-2 text-2xl font-black text-white">Un hook TikTok, ce n’est pas juste une phrase.</h2>
            <div className="mt-5 grid gap-3">
              {[
                ['Phrase à dire', 'La ligne courte qui ouvre la boucle.'],
                ['Texte écran', 'Ce que le viewer lit avant de comprendre.'],
                ['Première frame', 'Le plan qui donne une raison de rester.'],
                ['Cut / rythme', 'Le moment exact où couper avant l’ennui.'],
                ['Delivery', 'Ton, énergie, émotion et promesse.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-white/[0.07] bg-black/20 p-3.5">
                  <p className="text-sm font-black text-white">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {loading && (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-[1.35rem] border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        )}

        {packs.length > 0 && (
          <section ref={resultsRef} className="mt-10">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={labelClass}>Résultats</p>
                <h2 className="mt-1 text-2xl font-black text-white">{packs.length} HookPacks prêts à tester</h2>
              </div>
              <button
                type="button"
                onClick={() => copyText(packs.map(packToText).join('\n\n---\n\n'), 'all')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-black text-gray-300"
              >
                <CopyIcon copied={copied === 'all'} />
                {copied === 'all' ? 'Tout copié' : 'Copier tous les packs'}
              </button>
            </div>

            {bestPack && (
              <div className="mb-5 rounded-[1.35rem] border border-vn-fuchsia/25 bg-vn-fuchsia/[0.07] p-4 sm:p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Meilleure ouverture</p>
                <p className="mt-2 text-2xl font-black text-white">{bestPack.spokenHook || bestPack.onScreenText}</p>
                <p className="mt-2 text-sm leading-6 text-gray-300">{bestPack.whyItWorks}</p>
              </div>
            )}

            {battle && (
              <div className="mb-5 rounded-[1.35rem] border border-cyan-300/20 bg-cyan-300/[0.055] p-4 sm:p-5">
                <p className={labelClass}>Hook Battle</p>
                <p className="mt-2 text-lg font-black text-white">Choix recommandé : {battle.winner.title}</p>
                <p className="mt-1 text-sm leading-6 text-gray-400">
                  {battle.winner.spokenHook || battle.winner.onScreenText}, car il demande moins de contexte et crée une tension plus rapide.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[battle.a, battle.b].map((pack) => (
                    <div key={pack.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                      <p className="font-black text-white">{pack.spokenHook || pack.onScreenText}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <ScorePill label="Scroll" value={pack.scores.scrollStop} />
                        <ScorePill label="Clarté" value={pack.scores.clarity} />
                        <ScorePill label="Émotion" value={pack.scores.emotion} />
                        <ScorePill label="Coms" value={pack.scores.comments} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              {packs.map((pack, index) => (
                <article key={pack.id} className={`rounded-[1.35rem] border bg-[#0b0b12] p-4 shadow-[0_28px_95px_-82px_rgba(99,102,241,0.85)] sm:p-5 ${index === 0 ? 'border-vn-fuchsia/28' : 'border-white/[0.09]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-100">#{index + 1}</span>
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-black text-emerald-100">{pack.scores.overall}/100</span>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-bold text-gray-400">{pack.difficulty}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-white">{pack.title}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFavorites((current) => {
                        const next = new Set(current);
                        if (next.has(pack.id)) next.delete(pack.id);
                        else next.add(pack.id);
                        return next;
                      })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-black ${favorites.has(pack.id) ? 'border-vn-fuchsia/35 bg-vn-fuchsia/12 text-fuchsia-100' : 'border-white/[0.08] bg-white/[0.03] text-gray-500'}`}
                    >
                      ★
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3.5">
                      <p className={labelClass}>Hook à dire</p>
                      <p className="mt-2 text-lg font-black text-white">{pack.spokenHook || 'Ouverture sans parole'}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
                        <p className={labelClass}>Texte écran</p>
                        <p className="mt-2 text-sm font-black text-white">{pack.onScreenText}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
                        <p className={labelClass}>Première frame</p>
                        <p className="mt-2 text-sm font-semibold leading-5 text-gray-200">{pack.firstFrame}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
                        <p className={labelClass}>Action visuelle</p>
                        <p className="mt-2 text-sm font-semibold leading-5 text-gray-200">{pack.visualAction}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3.5">
                        <p className={labelClass}>Cut timing</p>
                        <p className="mt-2 text-sm font-semibold leading-5 text-gray-200">{pack.cutTiming}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.055] p-3.5">
                    <p className={labelClass}>Timing 0-3s</p>
                    <div className="mt-3 grid gap-2">
                      {pack.scriptOpening.map((step) => (
                        <div key={`${pack.id}-${step.time}`} className="grid grid-cols-[3.2rem_1fr] gap-3 text-sm">
                          <span className="font-black text-cyan-200">{step.time}</span>
                          <span className="font-semibold text-gray-200">{step.instruction}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-gray-400">{pack.whyItWorks}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <ScorePill label="Scroll" value={pack.scores.scrollStop} />
                    <ScorePill label="Curiosité" value={pack.scores.curiosity} />
                    <ScorePill label="Émotion" value={pack.scores.emotion} />
                    <ScorePill label="Watch" value={pack.scores.watchtime} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => copyText(pack.spokenHook || pack.onScreenText, `${pack.id}-hook`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-gray-300">
                      <CopyIcon copied={copied === `${pack.id}-hook`} />
                      Copier hook
                    </button>
                    <button onClick={() => copyText(packToText(pack), `${pack.id}-pack`)} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-gray-300">
                      <CopyIcon copied={copied === `${pack.id}-pack`} />
                      Copier pack
                    </button>
                    <button onClick={() => setCompareIds((current) => current.includes(pack.id) ? current.filter((id) => id !== pack.id) : [...current.slice(-1), pack.id])} className={`rounded-xl border px-3 py-2 text-xs font-black ${compareIds.includes(pack.id) ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100' : 'border-white/[0.09] bg-white/[0.035] text-gray-400'}`}>
                      Comparer
                    </button>
                    <button onClick={handleGenerate} className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-xs font-black text-gray-400">
                      Générer variante
                    </button>
                    <Link href="/dashboard/analyze" className="rounded-xl border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-3 py-2 text-xs font-black text-fuchsia-100">
                      Utiliser dans mon plan de remontage
                    </Link>
                    <Link href={`/dashboard#growth-loop`} className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
                      Créer une structure depuis ce hook
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
