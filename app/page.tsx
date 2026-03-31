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

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro: 50,
  elite: Infinity,
};

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
        if (data.user) setAuthUser(data.user);
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
    isReady && effectiveCount >= effectiveLimit && effectiveLimit !== Infinity;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (isLimitReached) return;

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Veuillez coller un lien TikTok.');
      return;
    }
    if (!trimmed.includes('tiktok.com') && !trimmed.startsWith('http')) {
      setError('Veuillez entrer un lien TikTok valide.');
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
        body: JSON.stringify({ url: trimmed }),
      });

      if (response.status === 429) {
        // Server confirmed limit reached (DB authoritative)
        if (authUser) setAuthUser({ ...authUser, analyses_count: effectiveLimit });
        return;
      }

      if (!response.ok) throw new Error('Analyse échouée');

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

      if (authUser) {
        // Refresh DB count from server
        fetch('/api/auth/me')
          .then((r) => r.json())
          .then((d) => { if (d.user) setAuthUser(d.user); })
          .catch((err) => {
            console.error('[Home] /api/auth/me refresh failed:', err);
          });
      } else {
        // Guest: persist to localStorage
        const next = guestCount + 1;
        setGuestCount(next);
        localStorage.setItem(STORAGE_KEY, next.toString());
      }
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

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

          {error && (
            <p className="text-red-400 text-sm text-center animate-fade-in">
              {error}
            </p>
          )}
        </div>

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
