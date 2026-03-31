'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Plan } from '@/lib/supabase';
import { AnalysisRow } from '@/lib/analyses';
import { getScoreTextColor, getRatingColors } from '@/lib/utils';

interface DashboardClientProps {
  email: string;
  plan: Plan;
  analysesCount: number;
  analysesLimit: number;
  hooksCount: number;
  hooksLimit: number;
  memberSince: string;
  analyses: AnalysisRow[];
  stripeSessionId?: string | null;
}

const planLabels: Record<Plan, string> = { free: 'Free', pro: 'Pro', elite: 'Elite' };

const planColors: Record<Plan, string> = {
  free: 'bg-[#1a1a1a] text-gray-400 border-[#222]',
  pro: 'bg-[#ff0050]/10 text-[#ff0050] border-[#ff0050]/20',
  elite: 'bg-[#7928ca]/15 text-[#b060ff] border-[#7928ca]/25',
};

function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-gray-500">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-xs font-bold text-gray-600">N/A</span>;
  return (
    <span className={`text-xs font-bold tabular-nums ${getScoreTextColor(score)}`}>
      {score}
    </span>
  );
}

function AnalysisHistoryItem({ row }: { row: AnalysisRow }) {
  const [open, setOpen] = useState(false);
  const { result, video_url, created_at } = row;

  const score = typeof result?.viralityScore === 'number' ? result.viralityScore : null;

  const displayUrl = video_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 42) +
    (video_url.length > 52 ? '…' : '');

  const date = new Date(created_at).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const time = new Date(created_at).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="border border-[#1a1a1a] rounded-xl overflow-hidden transition-colors hover:border-[#242424]">
      {/* Row header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left bg-[#111] hover:bg-[#131313] transition-colors"
      >
        {/* Virality score badge */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm
          ${score === null ? 'bg-[#1a1a1a] text-gray-600' :
            score >= 70 ? 'bg-green-500/10 text-green-400' :
            score >= 40 ? 'bg-amber-500/10 text-amber-400' :
            'bg-red-500/10 text-red-400'}`}>
          {score ?? 'N/A'}
        </div>

        {/* URL + date */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-xs text-white font-medium truncate">{displayUrl}</p>
          <p className="text-[11px] text-gray-600 mt-0.5 truncate">{date} à {time}</p>
        </div>

        {/* Sub-scores */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-500 shrink-0">
          <span>Hook <ScorePill score={result?.hook?.score} /></span>
          <span>Edit <ScorePill score={result?.editing?.score} /></span>
          <span>Rét <ScorePill score={result?.retention?.score} /></span>
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 16 16" fill="currentColor"
          className={`w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="bg-[#0d0d0d] border-t border-[#1a1a1a] px-4 py-4 space-y-4">
          {/* Score summary */}
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: 'Hook', section: result?.hook },
              { label: 'Montage', section: result?.editing },
              { label: 'Rétention', section: result?.retention },
            ] as const).map(({ label, section }) => (
              <div key={label} className="bg-[#111] rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-xl font-bold ${section?.score != null ? getScoreTextColor(section.score) : 'text-gray-600'}`}>
                  {section?.score ?? 'N/A'}
                </p>
                {section?.rating ? (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getRatingColors(section.rating)}`}>
                    {section.rating}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-600">—</span>
                )}
              </div>
            ))}
          </div>

          {/* Analyses */}
          <div className="space-y-2">
            {([
              { label: 'Hook', text: result?.hook?.analysis },
              { label: 'Montage', text: result?.editing?.analysis },
              { label: 'Rétention', text: result?.retention?.analysis },
            ] as const).map(({ label, text }) => (
              text ? (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
                </div>
              ) : null
            ))}
          </div>

          {/* Top improvements */}
          {(result?.improvements ?? []).filter(i => i.priority === 'haute').length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Priorités haute
              </p>
              <div className="space-y-1.5">
                {(result?.improvements ?? [])
                  .filter(i => i.priority === 'haute')
                  .map((imp, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-[#ff0050] mt-0.5 shrink-0 text-xs">→</span>
                      <p className="text-xs text-gray-400 leading-relaxed">{imp.tip}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Full URL */}
          <a
            href={video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8.914 6.025a.75.75 0 1 0-1.06 1.06 1.75 1.75 0 0 1 0 2.475l-2.36 2.36a1.75 1.75 0 0 1-2.475-2.475l1.105-1.104a.75.75 0 0 0-1.06-1.06l-1.106 1.104a3.25 3.25 0 1 0 4.595 4.596l2.36-2.36a3.25 3.25 0 0 0 0-4.596Z" />
              <path d="M7.086 9.975a.75.75 0 1 0 1.06-1.06 1.75 1.75 0 0 1 0-2.475l2.36-2.36a1.75 1.75 0 0 1 2.475 2.475l-1.105 1.104a.75.75 0 0 0 1.06 1.06l1.106-1.104a3.25 3.25 0 0 0-4.595-4.596l-2.36 2.36a3.25 3.25 0 0 0 0 4.596Z" />
            </svg>
            Voir la vidéo originale
          </a>
        </div>
      )}
    </div>
  );
}

export default function DashboardClient({
  email, plan, analysesCount, analysesLimit, hooksCount, hooksLimit, memberSince, analyses, stripeSessionId,
}: DashboardClientProps) {
  const router = useRouter();
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [upgradedPlan, setUpgradedPlan] = useState<string | null>(null);

  // ── Cancel subscription state ──────────────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [cancelError, setCancelError] = useState<string>('');
  const [domReady, setDomReady] = useState(false);
  useEffect(() => { setDomReady(true); }, []);

  // After Stripe redirects back with ?session_id=cs_xxx, verify the payment
  // server-side and apply the plan upgrade, then clean the URL.
  useEffect(() => {
    if (!stripeSessionId) return;

    const pendingPlan = localStorage.getItem('pendingPlan');

    // No pending plan stored — just clean the URL silently
    if (!pendingPlan || (pendingPlan !== 'pro' && pendingPlan !== 'elite')) {
      router.replace('/dashboard');
      return;
    }

    setUpgradeStatus('loading');

    fetch('/api/upgrade-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: pendingPlan, sessionId: stripeSessionId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          localStorage.removeItem('pendingPlan');
          setUpgradedPlan(pendingPlan);
          setUpgradeStatus('success');
          // Hard reload after 2s so server component fetches fresh plan data.
          // router.refresh() is unreliable here (Next.js may serve cached response).
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        } else {
          console.error('[Dashboard] upgrade-plan failed:', data.error);
          setUpgradeStatus('error');
        }
      })
      .catch((err) => {
        console.error('[Dashboard] upgrade-plan error:', err);
        setUpgradeStatus('error');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeSessionId]);

  const remaining  = Math.max(0, analysesLimit - analysesCount);
  const canAnalyze = remaining > 0;
  const hooksRemaining = hooksLimit > 0 ? Math.max(0, hooksLimit - hooksCount) : 0;
  const initials = email.slice(0, 2).toUpperCase();
  const hasHistory = analyses.length > 0;

  const memberDate = new Date(memberSince).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const limitDisplay = `${analysesCount} / ${analysesLimit}`;
  const remainingDisplay = remaining > 0
    ? `${remaining} restante${remaining > 1 ? 's' : ''}`
    : 'Limite atteinte';

  async function handleCancelPlan() {
    setCancelStatus('loading');
    setCancelError('');
    try {
      const res = await fetch('/api/cancel-plan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCancelStatus('done');
        // Hard reload with cache-busting param to bypass any Next.js stale cache
        setTimeout(() => { window.location.href = '/dashboard?t=' + Date.now(); }, 1500);
      } else {
        console.error('[cancel-plan]', data.error, '| status:', res.status);
        setCancelError(
          res.status === 401
            ? 'Ta session a expiré. Déconnecte-toi et reconnecte-toi, puis réessaie.'
            : (data.error ?? 'Une erreur est survenue.')
        );
        setCancelStatus('error');
      }
    } catch (err) {
      console.error('[cancel-plan] network error:', err);
      setCancelError('Erreur réseau. Vérifie ta connexion et réessaie.');
      setCancelStatus('error');
    }
  }

  // ── Cancel confirmation modal ──────────────────────────────────────────────
  const cancelModal = showCancelModal && domReady && createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={() => { if (cancelStatus !== 'loading') setShowCancelModal(false); }}
    >
      <div
        className="w-full max-w-sm bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {cancelStatus === 'done' ? (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-green-400">
                <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-base font-semibold text-white mb-1">Abonnement annulé</p>
            <p className="text-xs text-gray-500">Ton plan a bien été repassé en Free. Redirection...</p>
          </div>
        ) : (
          <>
            {/* Icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-red-400">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
              </svg>
            </div>

            <h3 className="text-base font-bold text-white text-center mb-2">
              Annuler ton abonnement {plan === 'elite' ? 'Elite' : 'Pro'} ?
            </h3>
            <p className="text-sm text-gray-400 text-center leading-relaxed mb-5">
              Ton plan passera immédiatement en <span className="text-white font-medium">Free</span> (3 analyses max, sans historique ni hooks).
              <br /><br />
              <span className="text-gray-500 text-xs">Ton historique d&apos;analyses existant sera conservé.</span>
            </p>

            {cancelStatus === 'error' && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 mb-3">
                <p className="text-xs text-red-400 text-center leading-relaxed">
                  {cancelError || 'Une erreur est survenue. Réessaie dans un instant.'}
                </p>
                {cancelError.includes('session') && (
                  <a
                    href="/login"
                    className="block text-center text-xs text-[#ff6080] hover:underline mt-1.5"
                  >
                    Se reconnecter →
                  </a>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 bg-[#111] border border-[#1e1e1e] hover:bg-[#181818] hover:text-white transition-all"
              >
                Garder mon plan
              </button>
              <button
                onClick={handleCancelPlan}
                disabled={cancelStatus === 'loading'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {cancelStatus === 'loading' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Annulation...
                  </span>
                ) : (
                  'Confirmer l\'annulation'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
    {cancelModal}
    <div className="space-y-8 animate-fade-up">
      {/* Upgrade in progress */}
      {upgradeStatus === 'loading' && (
        <div className="flex items-center gap-3 bg-[#111] border border-[#1a1a1a] rounded-2xl px-5 py-4">
          <svg className="w-4 h-4 animate-spin text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-400">Activation de ton plan en cours…</p>
        </div>
      )}

      {/* Upgrade success */}
      {upgradeStatus === 'success' && (
        <div className="flex items-start gap-3 bg-green-500/8 border border-green-500/20 rounded-2xl px-5 py-4">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-green-400">
              <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-400">
              Paiement réussi — ton compte a été mis à jour !
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              Plan {upgradedPlan === 'elite' ? 'Elite' : 'Pro'} actif. Les nouvelles limites sont appliquées immédiatement.
            </p>
          </div>
        </div>
      )}

      {/* Upgrade error */}
      {upgradeStatus === 'error' && (
        <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl px-5 py-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-red-400">
              <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-400">Erreur lors de la mise à jour du plan.</p>
            <p className="text-xs text-red-600 mt-0.5">
              Ton paiement a bien été encaissé. Contacte le support en indiquant ton email.
            </p>
          </div>
        </div>
      )}

      {/* Welcome header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#ff0050] to-[#7928ca] flex items-center justify-center text-white font-bold text-base sm:text-lg shadow-lg shadow-[#ff0050]/20 shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-white truncate">
            Bonjour, {email.split('@')[0]} 👋
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 truncate">{email}</p>
        </div>
        <div className="shrink-0">
          <span className={`text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border ${planColors[plan]}`}>
            {planLabels[plan]}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Analyses utilisées"
          value={limitDisplay}
          sub={remainingDisplay}
          icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          label="Plan actuel"
          value={planLabels[plan]}
          sub={plan === 'free' ? '3 analyses incluses' : plan === 'pro' ? '50 analyses / mois' : '300 analyses / mois'}
          icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" /></svg>}
        />
        <StatCard
          label="Membre depuis"
          value={memberDate}
          icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 1.75a.75.75 0 0 1 1.5 0V3h5V1.75a.75.75 0 0 1 1.5 0V3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2V1.75ZM4.5 7a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1h-7Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4Z" clipRule="evenodd" /></svg>}
        />
      </div>

      {/* Hooks stat — Pro/Elite only */}
      {hooksLimit > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="Hooks générés ce mois"
            value={`${hooksCount} / ${hooksLimit}`}
            sub={hooksRemaining > 0 ? `${hooksRemaining} restant${hooksRemaining > 1 ? 's' : ''}` : 'Quota atteint'}
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M7.557 2.066A.75.75 0 0 1 8 2.75v10.5a.75.75 0 0 1-1.248.56L3.59 11H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.59l3.162-2.81a.75.75 0 0 1 .805-.124ZM12.95 3.05a.75.75 0 1 0-1.06 1.06 5.5 5.5 0 0 1 0 7.78.75.75 0 1 0 1.06 1.06 7 7 0 0 0 0-9.9Z" />
                <path d="M10.828 5.172a.75.75 0 1 0-1.06 1.06 2.5 2.5 0 0 1 0 3.536.75.75 0 1 0 1.06 1.061 4 4 0 0 0 0-5.657Z" />
              </svg>
            }
          />
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-[#ff0050]/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#ff0050]">
                <path d="M8 1a6 6 0 0 1 3.196 11.064.75.75 0 0 1-.064.372l-1.154 2.83a.75.75 0 0 1-.697.47H6.72a.75.75 0 0 1-.698-.47l-1.153-2.83a.75.75 0 0 1-.064-.372A6 6 0 0 1 8 1zm.75 8a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0V9zm0-4.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Reset mensuel automatique</p>
              <p className="text-xs text-gray-500 mt-0.5">Quotas rechargés chaque 1er du mois</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/"
            className={`group flex items-center gap-4 p-5 rounded-2xl border transition-all duration-200
              ${canAnalyze
                ? 'bg-gradient-to-br from-[#ff0050]/8 to-[#7928ca]/8 border-[#ff0050]/20 hover:border-[#ff0050]/40 hover:from-[#ff0050]/12 hover:to-[#7928ca]/12'
                : 'bg-[#111] border-[#1a1a1a] opacity-50 pointer-events-none'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff0050] to-[#7928ca] flex items-center justify-center shrink-0 shadow-md shadow-[#ff0050]/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-white">Analyser une vidéo</p>
              <p className="text-xs text-gray-500 mt-0.5">{remainingDisplay}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </Link>

          {plan === 'free' ? (
            <Link href="/pricing" className="group flex items-center gap-4 p-5 rounded-2xl bg-[#111] border border-[#1a1a1a] hover:border-[#2a1a4a] hover:bg-[#0f0a18] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#7928ca]/15 border border-[#7928ca]/25 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#b060ff]"><path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" /></svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-white group-hover:text-[#c084fc] transition-colors">Passer à Pro</p>
                <p className="text-xs text-gray-500 mt-0.5">50 analyses/mois • 9,99€</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-600 ml-auto group-hover:text-[#b060ff] transition-colors"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </Link>
          ) : (
            <Link href="/" className="group flex items-center gap-4 p-5 rounded-2xl bg-[#111] border border-[#1a1a1a] hover:border-[#222] transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#ff0050]/10 border border-[#ff0050]/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#ff0050]"><path d="M5.25 3A2.25 2.25 0 0 0 3 5.25v9.5A2.25 2.25 0 0 0 5.25 17h9.5A2.25 2.25 0 0 0 17 14.75v-9.5A2.25 2.25 0 0 0 14.75 3h-9.5ZM10 8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 10 8Z" /></svg>
              </div>
              <div>
                <p className="font-semibold text-sm text-white">Nouvelle analyse</p>
                <p className="text-xs text-gray-500 mt-0.5">{remainingDisplay}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L9.19 8 6.22 5.03a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </Link>
          )}
        </div>
      </div>

      {/* ── History section ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Historique des analyses
          </h2>
          {hasHistory && (
            <span className="text-xs text-gray-600">{analyses.length} analyse{analyses.length > 1 ? 's' : ''}</span>
          )}
        </div>

        {plan === 'free' ? (
          /* Free plan — locked with upsell */
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center card-glow">
            <div className="w-10 h-10 rounded-xl bg-[#7928ca]/10 border border-[#7928ca]/20 flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#b060ff]">
                <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white mb-1">Historique disponible en Pro</p>
            <p className="text-xs text-gray-500 mb-4">Retrouvez toutes vos analyses passées et suivez votre progression.</p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-[#ff0050] to-[#7928ca] text-white hover:opacity-90 transition-opacity"
            >
              Passer à Pro →
            </Link>
          </div>
        ) : !hasHistory ? (
          /* Pro/Elite but no analyses yet */
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 text-center card-glow">
            <p className="text-sm text-gray-500">Aucune analyse pour le moment.</p>
            <p className="text-xs text-gray-600 mt-1">Lance ta première analyse pour la retrouver ici.</p>
          </div>
        ) : (
          /* List of analyses */
          <div className="space-y-2">
            {analyses.map((row) => (
              <AnalysisHistoryItem key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="bg-gradient-to-br from-[#ff0050]/5 to-[#7928ca]/5 border border-[#ff0050]/10 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#ff0050]/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-[#ff0050]">
              <path d="M8 1a6 6 0 0 1 3.196 11.064.75.75 0 0 1-.064.372l-1.154 2.83a.75.75 0 0 1-.697.47H6.72a.75.75 0 0 1-.698-.47l-1.153-2.83a.75.75 0 0 1-.064-.372A6 6 0 0 1 8 1zm.75 8a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0V9zm0-4.25a.75.75 0 0 0-1.5 0v2.5a.75.75 0 0 0 1.5 0v-2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Conseil du jour</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Les vidéos TikTok publiées entre 18h et 22h reçoivent en moyenne 40% plus d&apos;impressions. Planifiez vos publications sur ce créneau pour maximiser votre portée organique.
            </p>
          </div>
        </div>
      </div>

      {/* ── Subscription management — Pro/Elite only ─────────────────────── */}
      {plan !== 'free' && (
        <div className="border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 bg-[#111] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-0.5">
                Gérer mon abonnement
              </p>
              <p className="text-xs text-gray-600">
                Plan actuel : <span className={plan === 'elite' ? 'text-[#c084fc]' : 'text-[#ff6080]'}>
                  {plan === 'elite' ? 'Elite' : 'Pro'}
                </span>
              </p>
            </div>
            <button
              onClick={() => { setCancelStatus('idle'); setCancelError(''); setShowCancelModal(true); }}
              className="text-xs font-medium text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/5 border border-transparent hover:border-red-500/15"
            >
              Annuler l&apos;abonnement
            </button>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
