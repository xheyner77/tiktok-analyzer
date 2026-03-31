'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import ResultsPanel from '@/components/ResultsPanel';
import LoadingState from '@/components/LoadingState';
import PremiumGate from '@/components/PremiumGate';
import AnalysisCounter from '@/components/AnalysisCounter';
import GuestGate, { PENDING_URL_KEY } from '@/components/GuestGate';
import { AnalysisResult } from '@/lib/types';
import { normalizeTikTokUrl, isTikTokVideoUrl } from '@/lib/tiktok-url';
import { extractVideoFramesFromFile } from '@/lib/extract-video-frames';

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

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadTiktokUrl, setUploadTiktokUrl] = useState('');
  const [extractStatus, setExtractStatus] = useState('');
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
      setUploadTiktokUrl(pendingUrl);
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
  const processAnalyzeResponse = async (response: Response) => {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
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

    if (response.status === 400) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Requête invalide.');
      return;
    }

    if (response.status === 403) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Action non autorisée.');
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({} as { error?: string }));
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

    const REQUIRED_SECTIONS = ['hook', 'editing', 'retention'] as const;
    for (const key of REQUIRED_SECTIONS) {
      if (!data[key]) {
        console.error(`[DEBUG][page] MISSING section: data.${key} is`, data[key]);
      } else {
        const s = data[key];
        if (typeof s.score !== 'number') console.error(`[DEBUG][page] data.${key}.score is not a number:`, s.score);
        if (!s.rating) console.error(`[DEBUG][page] data.${key}.rating is missing:`, s.rating);
        if (!Array.isArray(s.strengths)) console.error(`[DEBUG][page] data.${key}.strengths is not an array:`, s.strengths);
        if (!Array.isArray(s.weaknesses)) console.error(`[DEBUG][page] data.${key}.weaknesses is not an array:`, s.weaknesses);
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
          console.error(`[DEBUG][page] data.improvements[${i}].priority has unexpected value:`, imp.priority);
        }
      });
    }

    console.log('[DEBUG][page] structure summary:', {
      viralityScore: data.viralityScore,
      hookScore: data.hook?.score,
      editingScore: data.editing?.score,
      retentionScore: data.retention?.score,
      improvementsCount: data.improvements?.length,
      priorities: data.improvements?.map((i) => i.priority),
      hasStrategy: !!data.strategy,
      hasViralTips: !!data.viralTips,
    });

    setResults(data);
    setCompareItem(null);

    if (authUser) {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((d) => {
          if (d.user) setAuthUser(d.user);
        })
        .catch((err) => {
          console.error('[Home] /api/auth/me refresh failed:', err);
        });
      refreshHistory();
    } else {
      const next = guestCount + 1;
      setGuestCount(next);
      localStorage.setItem(STORAGE_KEY, next.toString());
    }
  };

  const analyzeFromUpload = async () => {
    if (isLimitReached) return;
    if (!uploadTiktokUrl.trim()) {
      setError('Le lien TikTok est obligatoire pour récupérer les stats de la vidéo.');
      return;
    }
    const normalized = normalizeTikTokUrl(uploadTiktokUrl.trim());
    if (!isTikTokVideoUrl(normalized)) {
      setError('Lien TikTok invalide. Colle l’URL complète de la vidéo (…/video/…).');
      return;
    }
    if (!videoFile) {
      setError('Choisis un fichier vidéo (MP4 recommandé).');
      return;
    }
    if (isReady && !authUser) {
      setShowGuestGate(true);
      return;
    }

    setError('');
    setIsLoading(true);
    setResults(null);
    setExtractStatus('Extraction des images…');

    try {
      const { frames, durationSec } = await extractVideoFramesFromFile(videoFile);
      setExtractStatus('Analyse par vision IA…');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          durationSec,
          fileName: videoFile.name,
          tiktokUrl: normalized,
        }),
      });
      await processAnalyzeResponse(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.';
      setError(message);
    } finally {
      setExtractStatus('');
      setIsLoading(false);
    }
  };

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
    <main className="min-h-screen bg-[#080808] overflow-x-hidden">
      <GuestGate
        show={showGuestGate}
        pendingUrl={uploadTiktokUrl}
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
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                Lien TikTok <span className="text-[#ff0050]/90 normal-case font-normal">(obligatoire)</span>
              </label>
              <p className="text-[11px] text-gray-600 px-1 mb-2 leading-relaxed">
                Utilise l’URL de la vidéo sur TikTok pour récupérer les stats (vues, likes, etc.).
              </p>
              <input
                type="url"
                value={uploadTiktokUrl}
                onChange={(e) => setUploadTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@…/video/…"
                disabled={isLoading || isLimitReached}
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none hover:border-[#333] focus:border-[#ff0050]/50 focus:ring-2 focus:ring-[#ff0050]/10 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                Fichier vidéo
              </label>
              <input
                type="file"
                accept="video/*"
                disabled={isLoading || isLimitReached}
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#1a1a1a] file:text-white hover:file:bg-[#252525] border border-[#222] rounded-xl bg-[#111] px-3 py-2 disabled:opacity-50"
              />
              {videoFile && (
                <p className="text-xs text-gray-500 mt-2 px-1 truncate" title={videoFile.name}>
                  {videoFile.name}
                </p>
              )}
            </div>
            <p className="text-[11px] text-gray-600 px-1 leading-relaxed">
              L’analyse par vision extrait quelques images de ton fichier et les envoie au modèle. MP4 recommandé, durée max ~90 s.
            </p>
            <button
              type="button"
              onClick={() => void analyzeFromUpload()}
              disabled={isLoading || isLimitReached || !videoFile || !uploadTiktokUrl.trim()}
              className={`w-full relative overflow-hidden rounded-xl py-4 font-semibold text-white text-sm transition-all duration-200 active:scale-[0.99] shadow-lg ${
                isLimitReached
                  ? 'bg-[#1a1a2a] border border-[#2a1a3a] opacity-50 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[#ff0050]/10'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {extractStatus || 'Analyse en cours…'}
                </span>
              ) : isLimitReached ? (
                <span>Accès Premium requis</span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Analyser la vidéo
                </span>
              )}
            </button>
          </div>

          {isReady && !isLimitReached && (
            <AnalysisCounter
              used={effectiveCount}
              limit={effectiveLimit === Infinity ? undefined : effectiveLimit}
            />
          )}

          {error && (
            <p className="text-red-400 text-sm text-center animate-fade-in">
              {error}
            </p>
          )}
        </div>

        {/* Before / after comparison */}
        {results && compareItem && (
          <div className="mt-6 rounded-2xl border border-[#1a1a1a] bg-[#0f0f0f] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest min-w-0">
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
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest min-w-0">
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

        {isLoading && (
          <div className="mt-10">
            <LoadingState statusLine={extractStatus || undefined} />
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

        {/* Recent analyses + quick relaunch (moved to bottom for cleaner reading flow) */}
        {authUser && (
          <div className="mt-12 bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4">
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
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 rounded-lg border border-[#1e1e1e] bg-[#111] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCompareItem(null);
                        const v = item.video_url;
                        if (!v.startsWith('upload:')) {
                          const n = normalizeTikTokUrl(v);
                          setUploadTiktokUrl(isTikTokVideoUrl(n) ? n : '');
                        } else {
                          setUploadTiktokUrl('');
                        }
                        setResults(item.result);
                        setError('');
                      }}
                      className="text-left flex-1 min-w-0 w-full sm:w-auto"
                    >
                      <p className="text-xs text-white break-all sm:break-normal sm:truncate">{item.video_url}</p>
                      <p className="text-[11px] text-gray-600">
                        Score {item.result?.viralityScore ?? 0} · {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </button>
                    <div className="flex gap-2 shrink-0 self-stretch sm:self-center justify-end sm:justify-start">
                      <button
                        type="button"
                        onClick={() => togglePin(item.id)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-md border ${
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
                        className={`text-[11px] px-2.5 py-1.5 rounded-md border ${
                          compareIds.includes(item.id)
                            ? 'border-[#7928ca]/40 text-[#c084fc] bg-[#120d1f]'
                            : 'border-[#2a2a2a] text-gray-400 hover:text-white'
                        }`}
                      >
                        {compareIds.includes(item.id) ? 'Ajouté' : 'Comparer'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
