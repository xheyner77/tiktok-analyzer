'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import UrlInput from '@/components/UrlInput';
import ResultsPanel from '@/components/ResultsPanel';
import LoadingState from '@/components/LoadingState';
import PremiumGate from '@/components/PremiumGate';
import AnalysisCounter from '@/components/AnalysisCounter';
import GuestGate, { PENDING_URL_KEY } from '@/components/GuestGate';
import { AnalysisResult } from '@/lib/types';

const STORAGE_KEY = 'tiktok_analysis_count';
const GUEST_LIMIT = 3;

interface AuthUser {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'elite';
  analyses_count: number;
}

interface AnalysisHistoryItem {
  id: string;
  video_url: string;
  created_at: string;
  result: AnalysisResult;
}

const PLAN_LIMITS: Record<string, number> = {
  free:  3,
  pro:   50,
  elite: 300,
};

function normalizeTikTokUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

function isTikTokVideoUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.hostname.includes('tiktok.com') &&
      (u.pathname.includes('/video/') || u.pathname.includes('/t/'))
    );
  } catch {
    return false;
  }
}

function formatCompact(value: string): string {
  const n = Number(value);
  if (!n) return '';
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  // Guest tracking (localStorage)
  const [guestCount, setGuestCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Auth user (from /api/auth/me)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Guest gate modal
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [comments, setComments] = useState('');
  const [shares, setShares] = useState('');
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLocked, setHistoryLocked] = useState(false);
  const [compareItem, setCompareItem] = useState<AnalysisHistoryItem | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  function refreshHistory() {
    fetch('/api/analyze/history')
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.analyses ?? []);
        setHistoryLocked(!!d.locked);
      })
      .catch(() => {});
  }

  useEffect(() => {
    // Restore a pending TikTok URL saved before login/signup
    const pendingUrl = localStorage.getItem(PENDING_URL_KEY);
    if (pendingUrl) {
      setUrl(pendingUrl);
      localStorage.removeItem(PENDING_URL_KEY);
    }

    // Read guest count from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setGuestCount(parseInt(stored, 10));
    setMounted(true);

    // Check if user is authenticated
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
          try {
            const stored = localStorage.getItem(`pinned_analyses_${data.user.id}`);
            if (stored) setPinnedIds(JSON.parse(stored));
          } catch {}
          refreshHistory();
        }
      })
      .catch((err) => {
        console.error('[Home] /api/auth/me failed:', err);
      })
      .finally(() => setAuthLoaded(true));
  }, []);

  // ── Derive effective state ─────────────────────────────────────────────────
  const isReady = mounted && authLoaded;

  const effectiveCount = authUser ? authUser.analyses_count : guestCount;
  const effectiveLimit = authUser
    ? (PLAN_LIMITS[authUser.plan] ?? GUEST_LIMIT)
    : GUEST_LIMIT;

  const isLimitReached =
    isReady && effectiveCount >= effectiveLimit;

  const sortedHistory = [...history].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
    const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const compareItems = sortedHistory.filter((h) => compareIds.includes(h.id)).slice(0, 3);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const analyzeFromUrl = async (sourceUrl: string) => {
    if (isLimitReached) return;

    const trimmed = normalizeTikTokUrl(sourceUrl);
    if (!trimmed) {
      setError('Veuillez coller un lien TikTok.');
      return;
    }
    if (!isTikTokVideoUrl(trimmed)) {
      setError('Lien invalide. Colle un lien vidéo TikTok complet (avec /video/...).');
      return;
    }

    // ── Guest gate: block non-authenticated users ──────────────────────────
    if (isReady && !authUser) {
      setShowGuestGate(true);
      return;
    }

    setError('');
    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          observedMetrics: {
            views: Number(views) || 0,
            likes: Number(likes) || 0,
            comments: Number(comments) || 0,
            shares: Number(shares) || 0,
          },
        }),
      });

      if (response.status === 429) {
        const data = await response.json().catch(() => ({} as any));
        // Server confirmed limit reached (DB authoritative)
        if (authUser) {
          const used = typeof data.used === 'number' ? data.used : effectiveLimit;
          setAuthUser({ ...authUser, analyses_count: used });
        }
        setError(
          data?.limit
            ? `Limite atteinte (${data.used ?? data.limit}/${data.limit}). Passe à un plan supérieur ou attends le prochain reset.`
            : 'Limite atteinte pour ton plan.'
        );
        return;
      }

      if (response.status === 401) {
        setError('Ta session a expiré. Reconnecte-toi puis réessaie.');
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({} as any));
        throw new Error(data?.error ?? 'Analyse échouée');
      }

      const rawText = await response.text();
      console.log('[DEBUG][page] /api/analyze raw response text:', rawText.slice(0, 500));

      let data: AnalysisResult;
      try {
        data = JSON.parse(rawText) as AnalysisResult;
      } catch (parseErr) {
        console.error('[DEBUG][page] JSON.parse failed — raw text was:', rawText);
        throw parseErr;
      }

      // ── Vérification de structure ──────────────────────────────────────────
      const REQUIRED_SECTIONS = ['hook', 'editing', 'retention'] as const;
      for (const key of REQUIRED_SECTIONS) {
        if (!data[key]) {
          console.error(`[DEBUG][page] MISSING section: data.${key} is`, data[key]);
        } else {
          const s = data[key];
          if (typeof s.score !== 'number')  console.error(`[DEBUG][page] data.${key}.score is not a number:`, s.score);
          if (!s.rating)                     console.error(`[DEBUG][page] data.${key}.rating is missing:`, s.rating);
          if (!Array.isArray(s.strengths))   console.error(`[DEBUG][page] data.${key}.strengths is not an array:`, s.strengths);
          if (!Array.isArray(s.weaknesses))  console.error(`[DEBUG][page] data.${key}.weaknesses is not an array:`, s.weaknesses);
        }
      }

      if (typeof data.viralityScore !== 'number') {
        console.error('[DEBUG][page] data.viralityScore is not a number:', data.viralityScore);
      }

      if (!Array.isArray(data.improvements)) {
        console.error('[DEBUG][page] data.improvements is not an array:', data.improvements);
      } else {
        const VALID_PRIORITIES = ['haute', 'moyenne', 'basse'];
        data.improvements.forEach((imp, i) => {
          if (!VALID_PRIORITIES.includes(imp.priority)) {
            console.error(`[DEBUG][page] data.improvements[${i}].priority has unexpected value:`, imp.priority, '— expected: haute | moyenne | basse');
          }
        });
      }

      console.log('[DEBUG][page] structure summary:', {
        viralityScore: data.viralityScore,
        hookScore: data.hook?.score,
        editingScore: data.editing?.score,
        retentionScore: data.retention?.score,
        improvementsCount: data.improvements?.length,
        priorities: data.improvements?.map(i => i.priority),
        hasStrategy: !!data.strategy,
        hasViralTips: !!data.viralTips,
      });

      setResults(data);
      setCompareItem(null);

      if (authUser) {
        // Refresh DB count from server
        fetch('/api/auth/me')
          .then((r) => r.json())
          .then((d) => { if (d.user) setAuthUser(d.user); })
          .catch((err) => {
            console.error('[Home] /api/auth/me refresh failed:', err);
          });
        refreshHistory();
      } else {
        // Guest: persist to localStorage
        const next = guestCount + 1;
        setGuestCount(next);
        localStorage.setItem(STORAGE_KEY, next.toString());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => analyzeFromUrl(url);

  function togglePin(itemId: string) {
    if (!authUser) return;
    setPinnedIds((prev) => {
      const next = prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [itemId, ...prev].slice(0, 8);
      try {
        localStorage.setItem(`pinned_analyses_${authUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function toggleCompare(itemId: string) {
    setCompareIds((prev) => {
      if (prev.includes(itemId)) return prev.filter((id) => id !== itemId);
      if (prev.length >= 3) return prev;
      return [...prev, itemId];
    });
  }

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGuestCount(0);
    setResults(null);
    setError('');
  };

  return (
    <main className="min-h-screen bg-[#080808]">
      <GuestGate
        show={showGuestGate}
        pendingUrl={url}
        onClose={() => setShowGuestGate(false)}
      />
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#ff0050]/6 to-[#7928ca]/6 blur-3xl" />
        {isLimitReached && (
          <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#7928ca]/8 to-[#ff0050]/4 blur-3xl animate-pulse" />
        )}
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-10 pb-24">
        <Header />

        <div className="mt-10 space-y-3">
          <UrlInput
            value={url}
            onChange={setUrl}
            onAnalyze={handleAnalyze}
            isLoading={isLoading}
            isLocked={isLimitReached}
          />

          {isReady && !isLimitReached && (
            <AnalysisCounter
              used={effectiveCount}
              limit={effectiveLimit === Infinity ? undefined : effectiveLimit}
            />
          )}

          <div className="rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] p-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-2">
              Performance observée (optionnel, pour crédibilité du verdict)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input value={views} onChange={(e) => setViews(e.target.value.replace(/\D/g, ''))} placeholder="Vues" className="bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none" />
              <input value={likes} onChange={(e) => setLikes(e.target.value.replace(/\D/g, ''))} placeholder="Likes" className="bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none" />
              <input value={comments} onChange={(e) => setComments(e.target.value.replace(/\D/g, ''))} placeholder="Commentaires" className="bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none" />
              <input value={shares} onChange={(e) => setShares(e.target.value.replace(/\D/g, ''))} placeholder="Partages" className="bg-[#111] border border-[#1f1f1f] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 outline-none" />
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <p className="text-[10px] text-gray-600 px-1">{formatCompact(views) || '—'}</p>
              <p className="text-[10px] text-gray-600 px-1">{formatCompact(likes) || '—'}</p>
              <p className="text-[10px] text-gray-600 px-1">{formatCompact(comments) || '—'}</p>
              <p className="text-[10px] text-gray-600 px-1">{formatCompact(shares) || '—'}</p>
            </div>
            {(views && !likes && !comments && !shares) && (
              <p className="text-[11px] text-amber-400/90 mt-2">
                Estimation auto active: performance calculée principalement à partir des vues.
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center animate-fade-in">
              {error}
            </p>
          )}
        </div>

        {/* Recent analyses + quick relaunch */}
        {authUser && (
          <div className="mt-6 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Historique rapide
              </p>
              {historyLocked && (
                <span className="text-[11px] text-[#c084fc]">Débloque en Pro</span>
              )}
            </div>

            {historyLocked ? (
              <p className="text-xs text-gray-600">
                L&apos;historique complet est disponible en Pro/Elite.
              </p>
            ) : sortedHistory.length === 0 ? (
              <p className="text-xs text-gray-600">Aucune analyse récente.</p>
            ) : (
              <div className="space-y-2">
                {sortedHistory.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-[#1e1e1e] bg-[#111] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setUrl(item.video_url);
                        analyzeFromUrl(item.video_url);
                      }}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="text-xs text-white truncate">{item.video_url}</p>
                      <p className="text-[11px] text-gray-600">
                        Score {item.result?.viralityScore ?? 0} · {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePin(item.id)}
                      className={`text-[11px] px-2 py-1 rounded-md border ${
                        pinnedIds.includes(item.id)
                          ? 'border-[#ff0050]/40 text-[#ff6080] bg-[#1b0a12]'
                          : 'border-[#2a2a2a] text-gray-500 hover:text-white'
                      }`}
                    >
                      {pinnedIds.includes(item.id) ? 'Épinglé' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCompareItem(item);
                        toggleCompare(item.id);
                      }}
                      className={`text-[11px] px-2 py-1 rounded-md border ${
                        compareIds.includes(item.id)
                          ? 'border-[#7928ca]/40 text-[#c084fc] bg-[#120d1f]'
                          : 'border-[#2a2a2a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {compareIds.includes(item.id) ? 'Ajouté' : 'Comparer'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Before / after comparison */}
        {results && compareItem && (
          <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Comparaison avant / après
              </p>
              <button
                type="button"
                onClick={() => setCompareItem(null)}
                className="text-[11px] text-gray-500 hover:text-gray-300"
              >
                Fermer
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Global', prev: compareItem.result.viralityScore, cur: results.viralityScore },
                { label: 'Hook', prev: compareItem.result.hook?.score ?? 0, cur: results.hook?.score ?? 0 },
                { label: 'Montage', prev: compareItem.result.editing?.score ?? 0, cur: results.editing?.score ?? 0 },
                { label: 'Rétention', prev: compareItem.result.retention?.score ?? 0, cur: results.retention?.score ?? 0 },
              ].map((m) => {
                const delta = m.cur - m.prev;
                const up = delta >= 0;
                return (
                  <div key={m.label} className="rounded-lg border border-[#1d1d1d] bg-[#121212] px-3 py-2">
                    <p className="text-[11px] text-gray-500">{m.label}</p>
                    <p className="text-sm font-bold text-white">
                      {m.prev} → {m.cur}
                    </p>
                    <p className={`text-[11px] ${up ? 'text-green-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}{delta}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Multi-version comparison */}
        {compareItems.length >= 2 && (
          <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Comparaison multi-versions ({compareItems.length}/3)
              </p>
              <button
                type="button"
                onClick={() => setCompareIds([])}
                className="text-[11px] text-gray-500 hover:text-gray-300"
              >
                Réinitialiser
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-[#1a1a1a]">
                    <th className="text-left py-2 pr-2">Version</th>
                    <th className="text-left py-2 pr-2">Global</th>
                    <th className="text-left py-2 pr-2">Hook</th>
                    <th className="text-left py-2 pr-2">Montage</th>
                    <th className="text-left py-2 pr-2">Rétention</th>
                  </tr>
                </thead>
                <tbody>
                  {compareItems.map((item) => (
                    <tr key={item.id} className="border-b border-[#151515] last:border-none">
                      <td className="py-2 pr-2 text-gray-400">
                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-2 pr-2 text-white font-semibold">{item.result?.viralityScore ?? 0}</td>
                      <td className="py-2 pr-2 text-gray-300">{item.result?.hook?.score ?? 0}</td>
                      <td className="py-2 pr-2 text-gray-300">{item.result?.editing?.score ?? 0}</td>
                      <td className="py-2 pr-2 text-gray-300">{item.result?.retention?.score ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Score trend chart */}
        {authUser && !historyLocked && sortedHistory.length >= 2 && (
          <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">
              Évolution du score
            </p>
            {(() => {
              const points = sortedHistory
                .slice(0, 10)
                .reverse()
                .map((h) => h.result?.viralityScore ?? 0);
              const max = Math.max(...points, 1);
              const min = Math.min(...points, 0);
              const range = Math.max(1, max - min);
              const width = 300;
              const height = 80;
              const coords = points
                .map((s, i) => {
                  const x = (i / Math.max(1, points.length - 1)) * width;
                  const y = height - ((s - min) / range) * height;
                  return `${x},${y}`;
                })
                .join(' ');
              const last = points[points.length - 1] ?? 0;
              const prev = points[points.length - 2] ?? 0;
              const delta = last - prev;
              return (
                <div>
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
                    <polyline
                      fill="none"
                      stroke="#7928ca"
                      strokeWidth="2.5"
                      points={coords}
                    />
                  </svg>
                  <p className={`text-xs font-semibold ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Dernière évolution: {delta >= 0 ? '+' : ''}{delta} points
                  </p>
                </div>
              );
            })()}
          </div>
        )}

        {isLoading && (
          <div className="mt-10">
            <LoadingState />
          </div>
        )}

        {results && !isLoading && !isLimitReached && (
          <div className="mt-10">
            <ResultsPanel data={results} plan={authUser?.plan ?? 'free'} />
          </div>
        )}

        {isLimitReached && !isLoading && (
          <div className="mt-10">
            <PremiumGate onReset={authUser ? undefined : handleReset} />
          </div>
        )}
      </div>
    </main>
  );
}
