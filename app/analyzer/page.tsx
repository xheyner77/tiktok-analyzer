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
import { extractVideoFramesFromFile, extractAudioFromVideo } from '@/lib/extract-video-frames';
import { PLAN_LIMITS } from '@/lib/plan-limits';
import FloatingParticles from '@/components/FloatingParticles';

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

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadTiktokUrl, setUploadTiktokUrl] = useState('');
  const [extractStatus, setExtractStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  const [guestCount, setGuestCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

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
    const pendingUrl = localStorage.getItem(PENDING_URL_KEY);
    if (pendingUrl) {
      setUploadTiktokUrl(pendingUrl);
      localStorage.removeItem(PENDING_URL_KEY);
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setGuestCount(parseInt(stored, 10));
    setMounted(true);

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
          try {
            const s = localStorage.getItem(`pinned_analyses_${data.user.id}`);
            if (s) setPinnedIds(JSON.parse(s));
          } catch {}
          refreshHistory();
        }
      })
      .catch((err) => console.error('[Home] /api/auth/me failed:', err))
      .finally(() => setAuthLoaded(true));
  }, []);

  const isReady = mounted && authLoaded;
  const effectiveCount = authUser ? authUser.analyses_count : guestCount;
  const effectiveLimit = authUser ? (PLAN_LIMITS[authUser.plan] ?? GUEST_LIMIT) : GUEST_LIMIT;
  const isLimitReached = isReady && effectiveCount >= effectiveLimit;

  const sortedHistory = [...history].sort((a, b) => {
    const ap = pinnedIds.includes(a.id) ? 1 : 0;
    const bp = pinnedIds.includes(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const compareItems = sortedHistory.filter((h) => compareIds.includes(h.id)).slice(0, 3);

  const processAnalyzeResponse = async (response: Response) => {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      if (authUser) {
        const used = typeof data.used === 'number' ? data.used : effectiveLimit;
        setAuthUser({ ...authUser, analyses_count: used });
      }
      setError(
        data?.limit
          ? `Limite atteinte (${data.used ?? data.limit}/${data.limit}). Passe \u00e0 un plan sup\u00e9rieur.`
          : 'Limite atteinte pour ton plan.'
      );
      return;
    }
    if (response.status === 401) { setError('Ta session a expir\u00e9. Reconnecte-toi.'); return; }
    if (response.status === 400) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Requ\u00eate invalide.'); return;
    }
    if (response.status === 403) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Action non autoris\u00e9e.'); return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      throw new Error(data?.error ?? 'Analyse \u00e9chou\u00e9e');
    }

    const rawText = await response.text();
    let data: AnalysisResult;
    try { data = JSON.parse(rawText) as AnalysisResult; }
    catch (e) { console.error('[analyze] JSON.parse failed:', rawText.slice(0, 200)); throw e; }

    setResults(data);
    setCompareItem(null);

    if (authUser) {
      // Optimistic increment so the counter updates immediately without waiting for the re-fetch
      setAuthUser((prev) => prev ? { ...prev, analyses_count: prev.analyses_count + 1 } : prev);
      // Then sync with the real server count (corrects any drift)
      fetch('/api/auth/me').then((r) => r.json()).then((d) => { if (d.user) setAuthUser(d.user); }).catch(() => {});
      refreshHistory();
    } else {
      const next = guestCount + 1;
      setGuestCount(next);
      localStorage.setItem(STORAGE_KEY, next.toString());
    }
  };

  const analyzeFromUpload = async () => {
    if (isLimitReached) return;
    if (!videoFile) { setError('Choisis un fichier vid\u00e9o (MP4 recommand\u00e9).'); return; }

    let normalized = '';
    if (uploadTiktokUrl.trim()) {
      normalized = normalizeTikTokUrl(uploadTiktokUrl.trim());
      if (!isTikTokVideoUrl(normalized)) {
        setError(
          'Lien TikTok invalide. Utilise un lien vm.tiktok.com, vt.tiktok.com ou une URL contenant /video/ ou /t/.'
        );
        return;
      }
    }

    if (isReady && !authUser) { setShowGuestGate(true); return; }

    setError('');
    setIsLoading(true);
    setResults(null);
    setExtractStatus('Extraction des images\u2026');

    try {
      // Extract frames + audio in parallel for maximum speed
      setExtractStatus('Extraction des images et de l\u2019audio\u2026');
      const [{ frames, durationSec }, audioResult] = await Promise.all([
        extractVideoFramesFromFile(videoFile),
        extractAudioFromVideo(videoFile),
      ]);

      // If audio extracted, transcribe via Whisper (non-blocking: silently skip on error)
      let transcript = '';
      if (audioResult && authUser) {
        setExtractStatus('Transcription audio (Whisper)\u2026');
        try {
          const tRes = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioResult.audioBase64, mimeType: audioResult.mimeType }),
          });
          if (tRes.ok) {
            const tData = await tRes.json() as { transcript?: string };
            transcript = tData.transcript?.trim() ?? '';
            if (transcript) console.log('[analyze] whisper transcript:', transcript.slice(0, 120));
          }
        } catch (tErr) {
          console.warn('[analyze] transcription failed (non-blocking):', tErr);
        }
      }

      setExtractStatus('Analyse par vision IA\u2026');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          durationSec,
          fileName: videoFile.name,
          tiktokUrl: normalized || undefined,
          transcript: transcript || undefined,
        }),
      });
      await processAnalyzeResponse(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez r\u00e9essayer.');
    } finally {
      setExtractStatus('');
      setIsLoading(false);
    }
  };

  function togglePin(itemId: string) {
    if (!authUser) return;
    setPinnedIds((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [itemId, ...prev].slice(0, 8);
      try { localStorage.setItem(`pinned_analyses_${authUser.id}`, JSON.stringify(next)); } catch {}
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

  const handleAnalysisReset = () => {
    setResults(null);
    setError('');
    setVideoFile(null);
    setUploadTiktokUrl('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <GuestGate show={showGuestGate} pendingUrl={uploadTiktokUrl} onClose={() => setShowGuestGate(false)} />

      {/* Ambient glows + particles */}
      <div className="absolute top-0 inset-x-0 h-[520px] pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-gradient-to-br from-vn-fuchsia/10 to-vn-indigo/10 blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] rounded-full bg-vn-violet/5 blur-3xl" />
        {isLimitReached && (
          <div className="absolute -top-64 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-vn-indigo/10 to-vn-fuchsia/6 blur-3xl animate-pulse" />
        )}
        <FloatingParticles count={32} />
      </div>

      {/* ── Narrow header + form ── */}
      <div className="relative max-w-xl mx-auto px-4 pt-10 pb-6">
        <Header />

        <div className="mt-10 space-y-4">
          {/* Form card */}
          <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-5 sm:p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.15em] mb-2.5 px-0.5">
                  Fichier vid&eacute;o <span className="text-vn-fuchsia/80 normal-case font-normal tracking-normal">(obligatoire)</span>
                </label>
                <input
                  type="file"
                  accept="video/*"
                  disabled={isLoading || isLimitReached}
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-[13px] file:font-semibold file:bg-white/[0.08] file:text-white hover:file:bg-white/[0.14] file:transition-colors border border-white/[0.09] rounded-xl bg-white/[0.03] px-3 py-2 disabled:opacity-50 transition-colors"
                />
                {videoFile && (
                  <p className="text-[11px] text-vn-violet/70 mt-2 px-0.5 truncate flex items-center gap-1.5" title={videoFile.name}>
                    <span className="w-1.5 h-1.5 rounded-full bg-vn-fuchsia inline-block shrink-0" />
                    {videoFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-[0.15em] mb-2.5 px-0.5">
                  Lien TikTok <span className="text-gray-600 normal-case font-normal tracking-normal">(fortement conseill&eacute; &mdash; pour les stats)</span>
                </label>
                <input
                  type="url"
                  value={uploadTiktokUrl}
                  onChange={(e) => setUploadTiktokUrl(e.target.value)}
                  placeholder="https://vm.tiktok.com/\u2026 ou tiktok.com/\u2026/video/\u2026"
                  disabled={isLoading || isLimitReached}
                  className="w-full bg-white/[0.03] border border-white/[0.09] rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none hover:border-white/[0.15] focus:border-vn-violet/50 focus:ring-2 focus:ring-vn-violet/10 disabled:opacity-50 transition-colors"
                />
              </div>

              <p className="text-[11px] text-gray-600 px-0.5 leading-relaxed">
                L&apos;analyse visuelle porte sur le <span className="text-gray-500">fichier</span> import&eacute;. Le <span className="text-gray-500">lien TikTok</span> est fortement conseill&eacute; : stats r&eacute;elles (vues, likes&hellip;). MP4, dur&eacute;e max ~90 s.
              </p>

              {/* CTA */}
              <div className="relative group">
                {!isLimitReached && !isLoading && videoFile && (
                  <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-vn-fuchsia/45 via-vn-violet/35 to-vn-indigo/35 opacity-60 blur-md group-hover:opacity-90 transition-all duration-500" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => void analyzeFromUpload()}
                  disabled={isLoading || isLimitReached || !videoFile}
                  className={`relative w-full rounded-xl py-4 font-semibold text-white text-[15px] transition-all duration-200 active:scale-[0.99] ${
                    isLimitReached
                      ? 'bg-white/[0.04] border border-white/[0.08] opacity-60 cursor-not-allowed'
                      : 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_8px_32px_-8px_rgba(232,121,249,0.45)]'
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {extractStatus || 'Analyse en cours\u2026'}
                    </span>
                  ) : isLimitReached ? (
                    <span>Acc\u00e8s Premium requis</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Analyser la vid&eacute;o
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {isReady && !isLimitReached && (
            <AnalysisCounter
              used={effectiveCount}
              limit={effectiveLimit === Infinity ? undefined : effectiveLimit}
            />
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 animate-fade-in">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="mt-10">
            <LoadingState statusLine={extractStatus || undefined} />
          </div>
        )}

        {/* Premium gate */}
        {isLimitReached && !isLoading && (
          <div className="mt-10">
            <PremiumGate onReset={authUser ? undefined : handleReset} />
          </div>
        )}
      </div>

      {/* ── Wide results section ── */}
      {results && !isLoading && !isLimitReached && (
        <div className="relative px-1 sm:px-2 pb-10">
          <div className="relative">
            {/* Outer glow */}
            <div
              className="absolute -inset-2 rounded-[1.6rem] bg-gradient-to-br from-vn-fuchsia/20 via-vn-violet/8 to-vn-indigo/18 blur-3xl opacity-60 pointer-events-none"
              aria-hidden
            />
            <div className="relative">
              <ResultsPanel
                data={results}
                plan={authUser?.plan ?? 'free'}
                onReset={handleAnalysisReset}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Narrow bottom section: comparison + history ── */}
      <div className="relative max-w-xl mx-auto px-4 pb-20">

        {/* Before / after comparison */}
        {results && compareItem && (
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest min-w-0">Comparaison avant / apr&egrave;s</p>
              <button type="button" onClick={() => setCompareItem(null)} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">Fermer</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'Global',    prev: compareItem.result.viralityScore,         cur: results.viralityScore         },
                { label: 'Hook',      prev: compareItem.result.hook?.score      ?? 0, cur: results.hook?.score      ?? 0 },
                { label: 'Montage',   prev: compareItem.result.editing?.score   ?? 0, cur: results.editing?.score   ?? 0 },
                { label: 'R\u00e9tention', prev: compareItem.result.retention?.score ?? 0, cur: results.retention?.score ?? 0 },
              ].map((m) => {
                const delta = m.cur - m.prev;
                const up = delta >= 0;
                return (
                  <div key={m.label} className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-gray-500">{m.label}</p>
                    <p className="text-sm font-bold text-white">{m.prev} &rarr; {m.cur}</p>
                    <p className={`text-[11px] ${up ? 'text-emerald-400' : 'text-red-400'}`}>{up ? '+' : ''}{delta}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Multi-version comparison */}
        {compareItems.length >= 2 && (
          <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest min-w-0">Comparaison multi-versions ({compareItems.length}/3)</p>
              <button type="button" onClick={() => setCompareIds([])} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">R&eacute;initialiser</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-white/[0.07]">
                    <th className="text-left py-2 pr-2">Version</th>
                    <th className="text-left py-2 pr-2">Global</th>
                    <th className="text-left py-2 pr-2">Hook</th>
                    <th className="text-left py-2 pr-2">Montage</th>
                    <th className="text-left py-2 pr-2">R&eacute;tention</th>
                  </tr>
                </thead>
                <tbody>
                  {compareItems.map((item) => (
                    <tr key={item.id} className="border-b border-white/[0.05] last:border-none">
                      <td className="py-2 pr-2 text-gray-400">{new Date(item.created_at).toLocaleDateString('fr-FR')}</td>
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

        {/* Historique rapide */}
        {authUser && (
          <div className="mt-10 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.15em]">Historique rapide</p>
              {historyLocked && <span className="text-[11px] text-vn-violet font-medium">D&eacute;bloque en Pro</span>}
            </div>

            {historyLocked ? (
              <p className="text-xs text-gray-600">L&apos;historique complet est disponible en Pro/Elite.</p>
            ) : sortedHistory.length === 0 ? (
              <p className="text-xs text-gray-600">Aucune analyse r&eacute;cente.</p>
            ) : (
              <div className="space-y-2">
                {sortedHistory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3 hover:border-white/[0.12] transition-colors"
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
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-left flex-1 min-w-0 w-full sm:w-auto"
                    >
                      <p className="text-xs text-gray-300 break-all sm:break-normal sm:truncate">{item.video_url}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Score <span className="text-vn-violet font-semibold">{item.result?.viralityScore ?? 0}</span> &middot; {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </button>
                    <div className="flex gap-1.5 shrink-0 self-stretch sm:self-center justify-end sm:justify-start">
                      <button
                        type="button"
                        onClick={() => togglePin(item.id)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                          pinnedIds.includes(item.id)
                            ? 'border-vn-fuchsia/35 text-vn-fuchsia bg-vn-fuchsia/[0.08]'
                            : 'border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.15]'
                        }`}
                      >
                        {pinnedIds.includes(item.id) ? '\u00c9pingl\u00e9' : 'Pin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCompareItem(item); toggleCompare(item.id); }}
                        className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${
                          compareIds.includes(item.id)
                            ? 'border-vn-violet/35 text-vn-violet bg-vn-violet/[0.08]'
                            : 'border-white/[0.08] text-gray-500 hover:text-gray-300 hover:border-white/[0.15]'
                        }`}
                      >
                        {compareIds.includes(item.id) ? 'Ajout\u00e9' : 'Comparer'}
                      </button>
                    </div>
                  </div>
                ))}
                {sortedHistory.length > 5 && (
                  <div className="pt-1 flex items-center justify-between">
                    <p className="text-[11px] text-gray-600">
                      {sortedHistory.length - 5} analyse{sortedHistory.length - 5 > 1 ? 's' : ''} de plus dans ton dashboard
                    </p>
                    <a
                      href="/dashboard"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-vn-fuchsia/20 to-vn-indigo/20 border border-vn-fuchsia/25 text-vn-fuchsia hover:from-vn-fuchsia/30 hover:to-vn-indigo/30 transition-all"
                    >
                      Voir tout l&apos;historique →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
