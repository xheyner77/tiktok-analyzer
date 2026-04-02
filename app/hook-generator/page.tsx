'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import GuestGate from '@/components/GuestGate';
import { HOOK_LIMITS, MAX_HOOKS_ELITE, MAX_HOOKS_PRO } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface AuthUser {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'elite';
  hooks_count: number;
}

interface HookHistoryItem {
  id: string;
  hook_text: string;
  tone: string;
  scene: string | null;
  is_favorite: boolean;
  created_at: string;
  variant_of: string | null;
}

/* ── Options ────────────────────────────────────────────────────────────────── */

const TONES = [
  { id: 'dramatique', label: 'Dramatique', emoji: '🎭' },
  { id: 'clash',      label: 'Clash',      emoji: '🔥' },
  { id: 'curieux',    label: 'Curieux',    emoji: '👀' },
  { id: 'choquant',   label: 'Choquant',   emoji: '😱' },
  { id: 'émotion',    label: 'Émotion',    emoji: '💔' },
  { id: 'luxe',       label: 'Luxe',       emoji: '💎' },
  { id: 'autorité',   label: 'Autorité',   emoji: '👑' },
] as const;

const SCENES = [
  'Clash / recadrage',
  'Révélation choc',
  'Transformation',
  'Challenge / défi',
  'Lifestyle / flex',
  'Émotion / story',
  'Mystère / suspense',
  'Autre',
];

const COUNT_OPTIONS = [3, 5, 7, 10];

const CONTEXT_TEMPLATES = [
  'Je réponds à un hater qui me critique',
  'Je révèle un secret que personne ne connaît',
  "J'ai testé une astuce pendant 7 jours",
  'Avant / Après: transformation totale',
];

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const label9 = 'text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600';

function CopyIcon({ copied }: { copied: boolean }) {
  return copied ? (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────────── */

export default function HookGeneratorPage() {
  const [authUser,   setAuthUser]   = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [domReady,   setDomReady]   = useState(false);

  const [context, setContext] = useState('');
  const [scene,   setScene]   = useState(SCENES[0]);
  const [person,  setPerson]  = useState('');
  const [tone,    setTone]    = useState<string>('dramatique');
  const [count,   setCount]   = useState(5);

  const [hooks,     setHooks]     = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [used,      setUsed]      = useState(0);
  const [limitUsed, setLimitUsed] = useState(0);
  const [copied,    setCopied]    = useState<number | null>(null);

  const [history,        setHistory]        = useState<HookHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter,  setHistoryFilter]  = useState<'all' | 'favorites'>('all');
  const [historyQuery,   setHistoryQuery]   = useState('');
  const [copiedFavorites, setCopiedFavorites] = useState(false);

  const [showGuestGate, setShowGuestGate] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDomReady(true);
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setAuthUser(d.user);
          setUsed(d.user.hooks_count ?? 0);
          setLimitUsed(HOOK_LIMITS[d.user.plan] ?? 0);
          setLoadingHistory(true);
          fetch('/api/hooks/history')
            .then((r) => r.json())
            .then((h) => setHistory(h.hooks ?? []))
            .catch(() => {})
            .finally(() => setLoadingHistory(false));
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoaded(true));
  }, []);

  const plan           = authUser?.plan ?? null;
  const limit          = plan ? HOOK_LIMITS[plan] : 0;
  const effectiveLimit = limitUsed || limit;
  const remaining      = Math.max(0, effectiveLimit - used);
  const canUse         = !!plan && plan !== 'free' && used < effectiveLimit;

  useEffect(() => {
    if (!authUser || authUser.plan === 'free') return;
    if (count > remaining && remaining > 0) setCount(remaining);
  }, [authUser, remaining, count]);

  async function handleGenerate() {
    setError('');
    if (!authLoaded || loading) return;
    if (!authUser) { setShowGuestGate(true); return; }
    if (plan === 'free') return;
    if (!context.trim()) { setError('Décris le contexte de ta vidéo.'); return; }
    if (context.trim().length > 500) { setError('Contexte trop long (max 500 caractères).'); return; }

    setLoading(true);
    setHooks([]);

    try {
      const res  = await fetch('/api/hooks/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context.trim(), scene, person: person.trim(), tone, count }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        if (res.status === 429 || res.status === 403) setUsed(data.used ?? used);
        if (typeof data.limit === 'number') setLimitUsed(data.limit);
        return;
      }

      const newHooks: string[] = data.hooks ?? [];
      setHooks(newHooks);
      setUsed(data.used ?? used);
      setLimitUsed(data.limit ?? limitUsed);

      if (authUser && newHooks.length > 0) {
        const now = new Date().toISOString();
        const optimistic: HookHistoryItem[] = newHooks.map((h, i) => ({
          id: `temp-${Date.now()}-${i}`, hook_text: h, tone, scene,
          is_favorite: false, created_at: now, variant_of: null,
        }));
        setHistory((prev) => [...optimistic, ...prev]);

        if (data.historySaved === false) console.warn('[HookGenerator] hooks not saved to DB');
        fetch('/api/hooks/history').then((r) => r.json()).then((h) => {
          if (Array.isArray(h.hooks) && h.hooks.length > 0) setHistory(h.hooks);
        }).catch(console.error);
      }

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Une erreur est survenue. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  }

  function copyHook(hook: string, idx: number) {
    navigator.clipboard.writeText(hook).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  async function toggleFavorite(item: HookHistoryItem) {
    if (item.id.startsWith('temp-')) return;
    const next = !item.is_favorite;
    setHistory((prev) => prev.map((h) => h.id === item.id ? { ...h, is_favorite: next } : h));
    const res = await fetch('/api/hooks/favorite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookId: item.id, favorite: next }),
    });
    if (!res.ok) setHistory((prev) => prev.map((h) => h.id === item.id ? { ...h, is_favorite: item.is_favorite } : h));
  }

  async function deleteHistoryItem(item: HookHistoryItem) {
    if (item.id.startsWith('temp-')) return;
    const previous = history;
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    const res = await fetch('/api/hooks/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookId: item.id }),
    });
    if (!res.ok) setHistory(previous);
  }

  function copyFavorites() {
    const favs = history.filter((h) => h.is_favorite).map((h) => h.hook_text);
    if (!favs.length) return;
    navigator.clipboard.writeText(favs.join('\n')).then(() => {
      setCopiedFavorites(true);
      setTimeout(() => setCopiedFavorites(false), 1800);
    });
  }

  function copyAllHooks() {
    if (!hooks.length) return;
    navigator.clipboard.writeText(hooks.join('\n')).then(() => {
      setCopied(-1);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */

  return (
    <main className="min-h-screen bg-vn-bg overflow-x-hidden">

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full bg-gradient-to-br from-vn-indigo/8 to-vn-fuchsia/6 blur-3xl" />
      </div>

      {/* Guest gate */}
      {showGuestGate && domReady && createPortal(
        <GuestGate show={showGuestGate} pendingUrl="" onClose={() => setShowGuestGate(false)} />,
        document.body
      )}

      <div className="relative max-w-2xl mx-auto px-5 sm:px-8 pt-16 pb-28">

        {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
        <div className="mb-12">
          <p className={`${label9} mb-5`}>Viralynz · Hook Generator</p>
          <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold tracking-tight leading-tight mb-3">
            <span className="text-white">Génère des hooks </span>
            <span style={{
              background: 'linear-gradient(105deg, #f5c5ff 0%, #c084fc 45%, #818cf8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>qui accrochent.</span>
          </h1>
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Courts. Viraux. Percutants. Conçus pour l&apos;overlay TikTok.
          </p>
        </div>

        {/* ══ FREE PLAN UPSELL ═════════════════════════════════════════════ */}
        {authLoaded && authUser && plan === 'free' && (
          <div className="mb-10 p-6 rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.02]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-vn-violet/10 border border-vn-violet/15 flex items-center justify-center text-lg shrink-0">🔒</div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-white mb-1">Fonctionnalité Pro &amp; Elite</p>
                <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
                  {MAX_HOOKS_PRO} hooks/mois avec Pro · {MAX_HOOKS_ELITE} hooks/mois avec Elite.
                </p>
                <Link href="/pricing"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white text-[13px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(232,121,249,0.4)]">
                  Passer à Pro — {DISPLAY_CATALOG_PRO_EUR}€/mois
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ══ GUEST UPSELL ════════════════════════════════════════════════ */}
        {authLoaded && !authUser && (
          <div className="mb-10 p-6 rounded-2xl ring-1 ring-white/[0.07] bg-white/[0.02]">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-vn-fuchsia/10 border border-vn-fuchsia/15 flex items-center justify-center text-lg shrink-0">⚡</div>
              <div className="flex-1">
                <p className="text-[14px] font-bold text-white mb-1">Connecte-toi pour générer des hooks</p>
                <p className="text-[12px] text-gray-500 mb-4">Disponible à partir du plan Pro.</p>
                <div className="flex gap-2.5">
                  <Link href="/signup"
                    className="inline-flex items-center px-5 py-2.5 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white text-[13px] font-semibold hover:brightness-110 active:scale-[0.98] transition-all">
                    Créer un compte
                  </Link>
                  <Link href="/login"
                    className="inline-flex items-center px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.09] text-[13px] font-semibold text-gray-300 hover:bg-white/[0.07] transition-all">
                    Se connecter
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ QUOTA (Pro/Elite) ════════════════════════════════════════════ */}
        {authLoaded && authUser && plan !== 'free' && (
          <div className="mb-8 flex items-end justify-between pb-5 border-b border-white/[0.06]">
            <div>
              <p className={`${label9} mb-2`}>Hooks ce mois</p>
              <div className="flex items-baseline gap-2">
                <span className="text-[2rem] font-black text-white leading-none tabular-nums">{used}</span>
                <span className="text-[13px] text-gray-600">/ {effectiveLimit}</span>
              </div>
              <div className="mt-2 w-32 h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, effectiveLimit > 0 ? (used / effectiveLimit) * 100 : 0)}%`,
                    background: used >= effectiveLimit ? '#ef4444' : 'linear-gradient(to right, #e879f9, #6366f1)',
                  }} />
              </div>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${
              plan === 'elite'
                ? 'bg-vn-violet/15 text-vn-violet border border-vn-violet/25'
                : 'bg-vn-fuchsia/10 text-vn-fuchsia border border-vn-fuchsia/20'
            }`}>
              {plan === 'elite' ? 'Elite' : 'Pro'}
            </span>
          </div>
        )}

        {/* ══ FORM ════════════════════════════════════════════════════════ */}
        <div className="space-y-7">

          {/* Contexte */}
          <div>
            <p className={`${label9} mb-3`}>Contexte de ta vidéo <span className="text-vn-fuchsia normal-case tracking-normal">*</span></p>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex : Je remets à sa place quelqu'un qui m'a critiqué sur ma façon de m'habiller..."
              rows={3}
              maxLength={300}
              className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] focus:border-vn-violet/40 focus:ring-1 focus:ring-vn-violet/15 text-white text-[13px] placeholder-gray-700 rounded-xl px-4 py-3.5 resize-none transition-all outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {CONTEXT_TEMPLATES.map((tpl) => (
                  <button key={tpl} type="button" onClick={() => setContext(tpl)}
                    className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.07] text-gray-500 hover:text-gray-300 hover:border-white/[0.12] transition-colors">
                    {tpl}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-gray-700 tabular-nums shrink-0 ml-3">{context.length}/300</span>
            </div>
          </div>

          {/* Type de scène + Personnage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className={`${label9} mb-3`}>Type de scène</p>
              <select value={scene} onChange={(e) => setScene(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] focus:border-vn-violet/40 text-white text-[13px] rounded-xl px-4 py-3 outline-none transition-all appearance-none cursor-pointer">
                {SCENES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className={`${label9} mb-3`}>Personnage <span className="normal-case tracking-normal font-normal text-gray-600">(optionnel)</span></p>
              <input type="text" value={person} onChange={(e) => setPerson(e.target.value)}
                placeholder="Ex : mon ex, un hater…"
                maxLength={50}
                className="w-full bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.14] focus:border-vn-violet/40 text-white text-[13px] placeholder-gray-700 rounded-xl px-4 py-3 outline-none transition-all" />
            </div>
          </div>

          {/* Ton */}
          <div>
            <p className={`${label9} mb-3`}>Ton souhaité</p>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button key={t.id} onClick={() => setTone(t.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    tone === t.id
                      ? 'bg-vn-violet/20 border border-vn-violet/40 text-vn-violet ring-1 ring-vn-violet/15'
                      : 'bg-white/[0.03] border border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.14]'
                  }`}>
                  <span>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de hooks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className={label9}>Nombre de hooks</p>
              {authUser && plan !== 'free' && (
                <span className="text-[10px] text-gray-600">{remaining} restants ce mois</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {COUNT_OPTIONS.map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  disabled={!!authUser?.plan && authUser.plan !== 'free' && n > remaining}
                  className={`w-12 h-10 rounded-xl text-[13px] font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                    count === n
                      ? 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-[0_4px_12px_-4px_rgba(232,121,249,0.4)]'
                      : 'bg-white/[0.04] border border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.14]'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] px-4 py-3">
              <p className="text-[13px] text-red-400">{error}</p>
            </div>
          )}

          {/* CTA */}
          <div className="relative group">
            {!loading && canUse && context.trim() && (
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-vn-fuchsia/40 to-vn-indigo/30 opacity-50 blur-md group-hover:opacity-80 transition-all" aria-hidden />
            )}
            <button onClick={handleGenerate}
              disabled={loading || (!!authUser && !canUse)}
              className={`relative w-full py-4 rounded-xl font-bold text-[14px] transition-all active:scale-[0.99] ${
                loading || (!!authUser && !canUse)
                  ? 'bg-white/[0.04] border border-white/[0.08] text-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 shadow-[0_8px_32px_-8px_rgba(232,121,249,0.45)]'
              }`}>
              {loading ? (
                <span className="flex items-center justify-center gap-2.5">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Génération en cours…
                </span>
              ) : !authUser ? 'Générer mes hooks →'
                : plan === 'free' ? '🔒 Disponible à partir du plan Pro'
                : used >= limit ? `Limite atteinte (${used}/${effectiveLimit})`
                : `Générer ${count} hook${count > 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>

        {/* ══ LOADING SKELETONS ════════════════════════════════════════════ */}
        {loading && hooks.length === 0 && (
          <div className="mt-12 space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        )}

        {/* ══ RESULTS ══════════════════════════════════════════════════════ */}
        {hooks.length > 0 && (
          <div ref={resultsRef} className="mt-12">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className={`${label9} mb-1`}>Résultats</p>
                <p className="text-[14px] font-bold text-white">
                  {hooks.length} hook{hooks.length > 1 ? 's' : ''} générés
                </p>
              </div>
              <button type="button" onClick={copyAllHooks}
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  copied === -1
                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : 'border-white/[0.09] text-gray-500 hover:text-gray-300 hover:border-white/[0.15]'
                }`}>
                <CopyIcon copied={copied === -1} />
                {copied === -1 ? 'Tout copié' : 'Copier tout'}
              </button>
            </div>

            {/* Hook cards */}
            <div className="space-y-3">
              {hooks.map((hook, i) => (
                <div key={i}
                  className="group relative p-5 sm:p-6 rounded-2xl bg-[#0d0d12] ring-1 ring-white/[0.07] hover:ring-white/[0.13] transition-all">

                  {/* Index */}
                  <span className={`${label9} block mb-3`}>#{i + 1}</span>

                  {/* Hook text — dominant */}
                  <p className="text-[17px] sm:text-[18px] font-extrabold text-white leading-snug tracking-tight">
                    {hook}
                  </p>

                  {/* Actions */}
                  <div className="mt-4 flex items-center justify-end">
                    <button type="button" onClick={() => copyHook(hook, i)}
                      className={`flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        copied === i
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-white/[0.08] text-gray-600 hover:text-gray-300 hover:border-white/[0.15]'
                      }`}>
                      <CopyIcon copied={copied === i} />
                      {copied === i ? 'Copié' : 'Copier'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Regenerate */}
            <button onClick={handleGenerate}
              disabled={loading || used >= effectiveLimit}
              className="mt-4 w-full py-3 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] text-[13px] font-semibold text-gray-500 hover:text-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Génération…' : '↺ Regénérer'}
            </button>
          </div>
        )}

        {/* ══ HISTORY (Pro/Elite) ══════════════════════════════════════════ */}
        {authUser && plan !== 'free' && (
          <section className="mt-16">

            {/* Header */}
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]">
              <div>
                <p className={`${label9} mb-1`}>Bibliothèque</p>
                <p className="text-[14px] font-bold text-white">Historique des hooks</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setHistoryFilter('all')}
                  className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    historyFilter === 'all'
                      ? 'border-vn-violet/35 text-vn-violet bg-vn-violet/10'
                      : 'border-white/[0.09] text-gray-500 hover:text-gray-300'
                  }`}>Tous</button>
                <button type="button" onClick={() => setHistoryFilter('favorites')}
                  className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                    historyFilter === 'favorites'
                      ? 'border-vn-fuchsia/35 text-vn-fuchsia bg-vn-fuchsia/10'
                      : 'border-white/[0.09] text-gray-500 hover:text-gray-300'
                  }`}>Favoris</button>
                <button type="button" onClick={copyFavorites}
                  disabled={!history.some((h) => h.is_favorite)}
                  className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    copiedFavorites
                      ? 'border-emerald-500/35 text-emerald-400 bg-emerald-500/10'
                      : 'border-white/[0.09] text-gray-500 hover:text-gray-300'
                  }`}>
                  {copiedFavorites ? '✓ Copiés' : 'Copier favoris'}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="mb-5">
              <input type="text" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Rechercher…"
                className="w-full bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] focus:border-vn-violet/35 text-white text-[13px] placeholder-gray-700 rounded-xl px-4 py-3 outline-none transition-all" />
            </div>

            {/* Items */}
            <div>
              {(historyFilter === 'favorites' ? history.filter(h => h.is_favorite) : history)
                .filter(h => {
                  const q = historyQuery.trim().toLowerCase();
                  if (!q) return true;
                  return h.hook_text.toLowerCase().includes(q) || (h.tone ?? '').toLowerCase().includes(q) || (h.scene ?? '').toLowerCase().includes(q);
                })
                .slice(0, 20)
                .map((item) => (
                  <div key={item.id}
                    className="group flex items-start gap-4 py-4 border-b border-white/[0.05] last:border-none hover:border-white/[0.08] transition-colors">

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-300 leading-snug mb-1">{item.hook_text}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-gray-700">{new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-[10px] text-gray-700">{item.tone}</span>
                        {item.is_favorite && <span className="text-[10px] text-vn-fuchsia">★ Favori</span>}
                      </div>
                    </div>

                    {/* Actions — visible on hover */}
                    <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                      <button type="button" onClick={() => copyHook(item.hook_text, -99)}
                        className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-500 hover:text-gray-200 hover:border-white/[0.15] transition-all">
                        Copier
                      </button>
                      <button type="button" onClick={() => toggleFavorite(item)}
                        className={`text-[12px] px-2.5 py-1.5 rounded-lg border transition-all ${
                          item.is_favorite
                            ? 'border-vn-fuchsia/30 text-vn-fuchsia bg-vn-fuchsia/10'
                            : 'bg-white/[0.04] border-white/[0.08] text-gray-500 hover:text-vn-fuchsia hover:border-vn-fuchsia/25'
                        }`}>★</button>
                      <button type="button" onClick={() => deleteHistoryItem(item)}
                        className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-600 hover:text-red-400 hover:border-red-500/25 transition-all">×</button>
                    </div>
                  </div>
                ))}

              {!loadingHistory && history.length === 0 && (
                <p className="text-[12px] text-gray-600 text-center py-8">
                  Aucun hook enregistré pour le moment.
                </p>
              )}

              {loadingHistory && (
                <div className="space-y-3 pt-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-10 rounded-xl bg-white/[0.02] animate-pulse" />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ══ BOTTOM CTA ══════════════════════════════════════════════════ */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex items-center justify-between gap-4">
          <p className="text-[12px] text-gray-600">Analyse ta prochaine vidéo pour identifier ce qui bloque.</p>
          <Link href="/analyzer"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-white/70 bg-white/[0.04] border border-white/[0.09] hover:bg-white/[0.07] hover:border-white/[0.15] transition-all">
            Analyser →
          </Link>
        </div>

      </div>
    </main>
  );
}
