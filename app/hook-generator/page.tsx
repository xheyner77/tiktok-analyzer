'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import GuestGate from '@/components/GuestGate';
import { HOOK_LIMITS, MAX_HOOKS_ELITE, MAX_HOOKS_PRO } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';

// ── Types ─────────────────────────────────────────────────────────────────────

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


// ── Tone options ──────────────────────────────────────────────────────────────

const TONES = [
  { id: 'dramatique', label: 'Dramatique',  emoji: '🎭' },
  { id: 'clash',      label: 'Clash',       emoji: '🔥' },
  { id: 'curieux',    label: 'Curieux',     emoji: '👀' },
  { id: 'choquant',   label: 'Choquant',    emoji: '😱' },
  { id: 'émotion',    label: 'Émotion',     emoji: '💔' },
  { id: 'luxe',       label: 'Luxe',        emoji: '💎' },
  { id: 'autorité',   label: 'Autorité',    emoji: '👑' },
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
  'J’ai testé une astuce pendant 7 jours',
  'Avant / Après: transformation totale',
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HookGeneratorPage() {
  // Auth
  const [authUser,   setAuthUser]   = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [domReady,   setDomReady]   = useState(false);

  // Form
  const [context, setContext] = useState('');
  const [scene,   setScene]   = useState(SCENES[0]);
  const [person,  setPerson]  = useState('');
  const [tone,    setTone]    = useState<string>('dramatique');
  const [count,   setCount]   = useState(5);

  // Results
  const [hooks,     setHooks]     = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [used,      setUsed]      = useState(0);
  const [limitUsed, setLimitUsed] = useState(0);
  const [copied,    setCopied]    = useState<number | null>(null);

  // History
  const [history, setHistory] = useState<HookHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'favorites'>('all');
  const [historyQuery, setHistoryQuery] = useState('');
  const [copiedFavorites, setCopiedFavorites] = useState(false);

  // Guest gate
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

  const plan    = authUser?.plan ?? null;
  const limit   = plan ? HOOK_LIMITS[plan] : 0;
  const effectiveLimit = limitUsed || limit;
  const remaining = Math.max(0, effectiveLimit - used);
  const canUse  = !!plan && plan !== 'free' && used < effectiveLimit;

  useEffect(() => {
    if (!authUser || authUser.plan === 'free') return;
    if (count > remaining && remaining > 0) {
      setCount(remaining);
    }
  }, [authUser, remaining, count]);

  async function handleGenerate() {
    setError('');

    if (!authLoaded) return;
    if (loading) return; // prevent double-click while a request is in flight

    if (!authUser) {
      setShowGuestGate(true);
      return;
    }

    if (plan === 'free') return; // handled by upsell UI

    if (!context.trim()) {
      setError('Décris le contexte de ta vidéo pour générer des hooks.');
      return;
    }

    if (context.trim().length > 500) {
      setError('Le contexte ne doit pas dépasser 500 caractères.');
      return;
    }

    setLoading(true);
    setHooks([]);

    try {
      const res = await fetch('/api/hooks/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          context: context.trim(),
          scene,
          person: person.trim(),
          tone,
          count,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        if (res.status === 429 || res.status === 403) {
          setUsed(data.used ?? used);
        }
        if (typeof data.limit === 'number') setLimitUsed(data.limit);
        return;
      }

      const newHooks: string[] = data.hooks ?? [];
      setHooks(newHooks);
      setUsed(data.used ?? used);
      setLimitUsed(data.limit ?? limitUsed);

      if (authUser && newHooks.length > 0) {
        // 1. Mise à jour optimiste : affichage immédiat dans l'historique (IDs temp)
        const now = new Date().toISOString();
        const optimistic: HookHistoryItem[] = newHooks.map((h, i) => ({
          id: `temp-${Date.now()}-${i}`,
          hook_text: h,
          tone,
          scene,
          is_favorite: false,
          created_at: now,
          variant_of: null,
        }));
        setHistory((prev) => [...optimistic, ...prev]);

        // 2. L'API a déjà effectué l'INSERT avant de répondre.
        //    On recharge l'historique réel pour remplacer les IDs temporaires
        //    par les vrais UUIDs (nécessaires pour Favori / Supprimer).
        //    Si historySaved === false, le log serveur indique la cause exacte.
        if (data.historySaved === false) {
          console.warn('[HookGenerator] hooks generated but NOT saved to DB — check server logs');
        }
        fetch('/api/hooks/history')
          .then((r) => r.json())
          .then((h) => {
            if (Array.isArray(h.hooks) && h.hooks.length > 0) {
              setHistory(h.hooks);
            }
            // Si h.hooks est vide, on garde l'optimiste pour ne pas effacer l'affichage
          })
          .catch((err) => console.error('[HookGenerator] history reload failed:', err));
      }

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
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
    // Optimistic items use temp IDs — wait for the real history reload before acting.
    if (item.id.startsWith('temp-')) return;

    const next = !item.is_favorite;
    setHistory((prev) => prev.map((h) => (h.id === item.id ? { ...h, is_favorite: next } : h)));
    const res = await fetch('/api/hooks/favorite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookId: item.id, favorite: next }),
    });
    if (!res.ok) {
      // rollback optimistic update
      setHistory((prev) => prev.map((h) => (h.id === item.id ? { ...h, is_favorite: item.is_favorite } : h)));
    }
  }

  async function deleteHistoryItem(item: HookHistoryItem) {
    // Optimistic items use temp IDs — wait for the real history reload before acting.
    if (item.id.startsWith('temp-')) return;

    const previous = history;
    setHistory((prev) => prev.filter((h) => h.id !== item.id));
    const res = await fetch('/api/hooks/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hookId: item.id }),
    });
    if (!res.ok) {
      setHistory(previous);
    }
  }

  function copyFavorites() {
    const favoriteHooks = history
      .filter((h) => h.is_favorite)
      .map((h) => h.hook_text);
    if (!favoriteHooks.length) return;
    navigator.clipboard.writeText(favoriteHooks.join('\n')).then(() => {
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#080808] overflow-x-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-gradient-to-br from-[#7928ca]/8 to-[#ff0050]/6 blur-3xl" />
      </div>

      {/* Guest gate portal */}
      {showGuestGate && domReady && createPortal(
        <GuestGate show={showGuestGate} pendingUrl="" onClose={() => setShowGuestGate(false)} />,
        document.body
      )}

      <div className="relative max-w-2xl mx-auto px-4 pt-24 pb-24">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7928ca]/10 border border-[#7928ca]/20 text-[#c084fc] text-xs font-semibold mb-4">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            Hooks textuels uniquement
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            Hook{' '}
            <span className="bg-gradient-to-r from-[#ff0050] to-[#7928ca] bg-clip-text text-transparent">
              Generator
            </span>
          </h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Génère des hooks textuels courts, viraux et percutants pour tes vidéos TikTok — conçus pour être affichés en overlay sur la vidéo.
          </p>
        </div>

        {/* ── Free plan upsell ────────────────────────────────────────────────── */}
        {authLoaded && authUser && plan === 'free' && (
          <div className="mb-8 rounded-2xl bg-[#0f0a18] border border-[#2d1a4a] p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#7928ca]/15 border border-[#7928ca]/25 flex items-center justify-center text-xl mx-auto mb-4">
              🔒
            </div>
            <h2 className="text-base font-bold text-white mb-2">Fonctionnalité Pro & Elite</h2>
            <p className="text-sm text-gray-500 mb-5">
              {`Le Hook Generator est disponible à partir du plan Pro (${MAX_HOOKS_PRO} hooks/mois) et Elite (${MAX_HOOKS_ELITE} hooks/mois).`}
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-[#ff0050]/20"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
              {`Passer à Pro — ${DISPLAY_CATALOG_PRO_EUR}€/mois`}
            </Link>
          </div>
        )}

        {/* ── Guest CTA ───────────────────────────────────────────────────────── */}
        {authLoaded && !authUser && (
          <div className="mb-8 rounded-2xl bg-[#0d0d0d] border border-[#1e1e1e] p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#ff0050]/10 border border-[#ff0050]/20 flex items-center justify-center text-xl mx-auto mb-4">
              ⚡
            </div>
            <h2 className="text-base font-bold text-white mb-2">Connecte-toi pour générer des hooks</h2>
            <p className="text-sm text-gray-500 mb-5">
              Le Hook Generator est disponible à partir du plan Pro.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-md shadow-[#ff0050]/20"
              >
                Créer un compte
              </Link>
              <Link
                href="/login"
                className="px-5 py-2.5 rounded-xl bg-[#111] border border-[#1e1e1e] text-sm font-semibold text-gray-300 hover:bg-[#181818] hover:border-[#2a2a2a] transition-all"
              >
                Se connecter
              </Link>
            </div>
          </div>
        )}

        {/* ── Quota bar (Pro/Elite) ────────────────────────────────────────────── */}
        {authLoaded && authUser && plan !== 'free' && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a]">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500">Hooks ce mois</span>
                <span className="text-xs font-semibold text-gray-300 tabular-nums">
                  {used} / {effectiveLimit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, effectiveLimit > 0 ? (used / effectiveLimit) * 100 : 0)}%`,
                    background: used >= effectiveLimit ? '#ef4444' : 'linear-gradient(to right, #ff0050, #7928ca)',
                  }}
                />
              </div>
            </div>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              plan === 'elite'
                ? 'bg-[#7928ca]/15 text-[#c084fc] border border-[#7928ca]/25'
                : 'bg-[#ff0050]/10 text-[#ff0050] border border-[#ff0050]/20'
            }`}>
              {plan === 'elite' ? 'Elite' : 'Pro'}
            </span>
          </div>
        )}

        {/* ── Form ─────────────────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Contexte */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">
              Contexte de ta vidéo <span className="text-[#ff0050]">*</span>
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Ex : Je remets à sa place quelqu'un qui m'a critiqué sur ma façon de m'habiller..."
              rows={3}
              maxLength={300}
              className="w-full bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] focus:border-[#7928ca]/40 focus:ring-1 focus:ring-[#7928ca]/20 text-white text-sm placeholder-gray-700 rounded-xl px-4 py-3 resize-none transition-all duration-150 outline-none"
            />
            <p className="text-right text-[11px] text-gray-700 mt-1 tabular-nums">{context.length} / 300</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONTEXT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setContext(tpl)}
                  className="text-[11px] px-2.5 py-1 rounded-md bg-[#101010] border border-[#1f1f1f] text-gray-500 hover:text-gray-300 hover:border-[#2d2d2d] transition-colors"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>

          {/* Type de scène + Personnage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">Type de scène</label>
              <select
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] focus:border-[#7928ca]/40 text-white text-sm rounded-xl px-3 py-2.5 outline-none transition-all appearance-none cursor-pointer"
              >
                {SCENES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-2">
                Personnage <span className="text-gray-600 font-normal">(optionnel)</span>
              </label>
              <input
                type="text"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                placeholder="Ex : mon ex, un hater..."
                maxLength={50}
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] focus:border-[#7928ca]/40 text-white text-sm placeholder-gray-700 rounded-xl px-3 py-2.5 outline-none transition-all"
              />
            </div>
          </div>

          {/* Ton */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Ton souhaité</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                    ${tone === t.id
                      ? 'bg-[#7928ca]/20 border border-[#7928ca]/50 text-[#c084fc]'
                      : 'bg-[#0d0d0d] border border-[#1e1e1e] text-gray-500 hover:border-[#2a2a2a] hover:text-gray-300'
                    }`}
                >
                  <span>{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nombre de hooks */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">Nombre de hooks</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  disabled={authUser?.plan && authUser.plan !== 'free' && n > remaining}
                  className={`w-12 h-10 rounded-lg text-sm font-bold transition-all duration-150 disabled:opacity-35 disabled:cursor-not-allowed
                    ${count === n
                      ? 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white shadow-md shadow-[#ff0050]/20'
                      : 'bg-[#0d0d0d] border border-[#1e1e1e] text-gray-500 hover:border-[#2a2a2a] hover:text-gray-300'
                    }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {authUser && plan !== 'free' && (
              <p className="text-[11px] text-gray-600 mt-1">
                Restants ce mois: {remaining}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* CTA button */}
          <button
            onClick={handleGenerate}
            disabled={loading || (!!authUser && !canUse)}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 active:scale-[0.99] shadow-lg
              ${loading || (!!authUser && !canUse)
                ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 shadow-[#ff0050]/20'
              }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2.5">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Génération en cours...
              </span>
            ) : !authUser ? (
              'Générer mes hooks →'
            ) : plan === 'free' ? (
              '🔒 Disponible à partir du plan Pro'
            ) : used >= limit ? (
              `Limite atteinte (${used}/${effectiveLimit})`
            ) : (
              `Générer ${count} hook${count > 1 ? 's' : ''} →`
            )}
          </button>
        </div>

        {/* ── Results ──────────────────────────────────────────────────────────── */}
        {hooks.length > 0 && (
          <div ref={resultsRef} className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">
                {hooks.length} hook{hooks.length > 1 ? 's' : ''} générés
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyAllHooks}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    copied === -1
                      ? 'bg-green-500/15 text-green-400 border-green-500/30'
                      : 'bg-[#111] text-gray-500 border-[#1f1f1f] hover:text-gray-300'
                  }`}
                >
                  {copied === -1 ? 'Tout copié' : 'Copier tout'}
                </button>
                <span className="text-xs text-gray-600">Clic pour copier</span>
              </div>
            </div>

            <div className="space-y-3">
              {hooks.map((hook, i) => (
                <div
                  key={i}
                  className="group w-full text-left rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] hover:bg-[#111] transition-all duration-150 px-5 py-4"
                >
                  <p className="text-base font-extrabold text-white tracking-wide leading-tight">
                    {hook}
                  </p>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => copyHook(hook, i)}
                      className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all
                        ${copied === i
                          ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                          : 'bg-[#1a1a1a] text-gray-600 border border-[#222] group-hover:text-gray-400'
                        }`}
                    >
                      {copied === i ? (
                        <>
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                          </svg>
                          Copié
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
                          </svg>
                          Copier
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Regenerate */}
            <button
              onClick={handleGenerate}
            disabled={loading || used >= effectiveLimit}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] text-sm font-semibold text-gray-500 hover:text-gray-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Génération...' : '↺ Regénérer'}
            </button>
          </div>
        )}

        {/* ── History + favorites (Pro/Elite) ───────────────────────────────── */}
        {authUser && plan !== 'free' && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Historique des hooks</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHistoryFilter('all')}
                  className={`text-xs px-2.5 py-1 rounded-md border ${
                    historyFilter === 'all'
                      ? 'border-[#2d1a4a] text-[#c084fc] bg-[#120d1f]'
                      : 'border-[#1f1f1f] text-gray-500'
                  }`}
                >
                  Tous
                </button>
                <button
                  type="button"
                  onClick={copyFavorites}
                  disabled={!history.some((h) => h.is_favorite)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    copiedFavorites
                      ? 'border-green-500/40 text-green-400 bg-green-500/10'
                      : 'border-[#1f1f1f] text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {copiedFavorites ? 'Favoris copiés' : 'Copier favoris'}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryFilter('favorites')}
                  className={`text-xs px-2.5 py-1 rounded-md border ${
                    historyFilter === 'favorites'
                      ? 'border-[#ff0050]/40 text-[#ff6080] bg-[#1b0a12]'
                      : 'border-[#1f1f1f] text-gray-500'
                  }`}
                >
                  Favoris
                </button>
              </div>
            </div>

            <div className="mb-3">
              <input
                type="text"
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Rechercher dans l'historique..."
                className="w-full bg-[#0d0d0d] border border-[#1e1e1e] hover:border-[#2a2a2a] focus:border-[#7928ca]/40 text-white text-sm placeholder-gray-700 rounded-lg px-3 py-2 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              {(historyFilter === 'favorites'
                ? history.filter((h) => h.is_favorite)
                : history
              )
                .filter((h) => {
                  const q = historyQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    h.hook_text.toLowerCase().includes(q) ||
                    (h.tone ?? '').toLowerCase().includes(q) ||
                    (h.scene ?? '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 20)
                .map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#1a1a1a] bg-[#0d0d0d] px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-white">{item.hook_text}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-600">
                      {new Date(item.created_at).toLocaleDateString('fr-FR')} · {item.tone}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item)}
                        className={`text-[11px] px-2 py-1 rounded-md border ${
                          item.is_favorite
                            ? 'border-[#ff0050]/40 text-[#ff6080] bg-[#1b0a12]'
                            : 'border-[#1f1f1f] text-gray-500'
                        }`}
                      >
                        {item.is_favorite ? 'Favori' : 'Ajouter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHistoryItem(item)}
                        className="text-[11px] px-2 py-1 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!loadingHistory && history.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">
                  Aucun hook enregistré pour le moment.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────────── */}
        {loading && hooks.length === 0 && (
          <div className="mt-10 space-y-3">
            {Array.from({ length: count }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-[#0d0d0d] border border-[#1e1e1e] animate-pulse" />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
