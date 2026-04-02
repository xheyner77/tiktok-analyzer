'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Plan } from '@/lib/supabase';
import { AnalysisRow } from '@/lib/analyses';
import { getScoreTextColor, getRatingColors } from '@/lib/utils';
import { MAX_ANALYSES_ELITE, MAX_ANALYSES_FREE, MAX_ANALYSES_PRO, MAX_HOOKS_ELITE } from '@/lib/plan-limits';
import { DISPLAY_CATALOG_ELITE_EUR, DISPLAY_CATALOG_PRO_EUR } from '@/lib/stripe-pricing';
import { waitForBillingPlan } from '@/lib/wait-for-billing-sync';

interface DashboardClientProps {
  email: string;
  plan: Plan;
  billingPlan: Plan;
  usesStripeSubscription: boolean;
  showEliteUpgrade: boolean;
  analysesCount: number;
  analysesLimit: number;
  hooksCount: number;
  hooksLimit: number;
  memberSince: string;
  analyses: AnalysisRow[];
  stripeSessionId?: string | null;
}

const planLabels: Record<Plan, string> = { free: 'Free', pro: 'Pro', elite: 'Elite' };

const planGradient: Record<Plan, string> = {
  free:  'from-gray-500/20 to-gray-600/20 border-gray-500/25 text-gray-300',
  pro:   'from-vn-fuchsia/25 to-vn-violet/20 border-vn-fuchsia/30 text-vn-fuchsia',
  elite: 'from-vn-violet/30 to-vn-indigo/25 border-vn-violet/35 text-vn-glow',
};

function scoreColor(s: number) {
  return s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
}
function scoreBg(s: number) {
  return s >= 70 ? 'bg-emerald-400/10 border-emerald-400/20' : s >= 40 ? 'bg-amber-400/10 border-amber-400/20' : 'bg-red-400/10 border-red-400/20';
}

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-[11px] font-bold text-gray-600">—</span>;
  return <span className={`text-[11px] font-bold tabular-nums ${getScoreTextColor(score)}`}>{score}</span>;
}

/* ── Circular progress ring ──────────────────────────────────────────────── */
function RingProgress({ value, max, size = 56 }: { value: number; max: number; size?: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 300); return () => clearTimeout(t); }, [value]);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? anim / max : 0;
  const dash = circ * pct;
  const color = pct >= 0.85 ? '#f87171' : pct >= 0.5 ? '#fbbf24' : '#e879f9';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 4px ${color}88)` }}
      />
    </svg>
  );
}

/* ── History item ────────────────────────────────────────────────────────── */
function AnalysisHistoryItem({ row }: { row: AnalysisRow }) {
  const [open, setOpen] = useState(false);
  const { result, video_url, created_at } = row;
  const score = typeof result?.viralityScore === 'number' ? result.viralityScore : null;
  const isUpload = video_url.startsWith('upload:');

  const displayUrl = isUpload
    ? video_url.replace(/^upload:/, '').replace(/-\d+$/, '')
    : video_url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48) + (video_url.length > 58 ? '…' : '');

  const date = new Date(created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const time = new Date(created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${open ? 'border-white/[0.12] bg-[#0f0f16]' : 'border-white/[0.06] bg-[#0a0a10] hover:border-white/[0.10] hover:bg-[#0d0d14]'}`}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        {/* Score badge */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm border ${score === null ? 'bg-white/[0.04] border-white/[0.06] text-gray-600' : scoreBg(score) + ' ' + scoreColor(score)}`}>
          {score ?? '?'}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-gray-200 font-medium truncate">{displayUrl}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-600">{date} · {time}</span>
            {isUpload && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20 uppercase tracking-wide">Vision</span>}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {[
            { label: 'Hook', val: result?.hook?.score },
            { label: 'Edit', val: result?.editing?.score },
            { label: 'Rét',  val: result?.retention?.score },
          ].map(({ label, val }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</p>
              <ScorePill score={val} />
            </div>
          ))}
        </div>

        <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform ml-1 ${open ? 'rotate-180' : ''}`}>
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-white/[0.06] px-4 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { label: 'Hook', section: result?.hook },
              { label: 'Montage', section: result?.editing },
              { label: 'Rétention', section: result?.retention },
            ] as const).map(({ label, section }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-xl font-black ${section?.score != null ? getScoreTextColor(section.score) : 'text-gray-600'}`}>
                  {section?.score ?? '—'}
                </p>
                {section?.rating && (
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${getRatingColors(section.rating)}`}>
                    {section.rating}
                  </span>
                )}
              </div>
            ))}
          </div>

          {(result?.improvements ?? []).filter(i => i.priority === 'haute').length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em]">Priorités hautes</p>
              {(result?.improvements ?? []).filter(i => i.priority === 'haute').map((imp, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-vn-fuchsia text-[10px] font-black shrink-0 mt-0.5">→</span>
                  <p className="text-[11px] text-gray-400 leading-snug">{imp.tip}</p>
                </div>
              ))}
            </div>
          )}

          {!isUpload && (
            <a href={video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8.914 6.025a.75.75 0 1 0-1.06 1.06 1.75 1.75 0 0 1 0 2.475l-2.36 2.36a1.75 1.75 0 0 1-2.475-2.475l1.105-1.104a.75.75 0 0 0-1.06-1.06l-1.106 1.104a3.25 3.25 0 1 0 4.595 4.596l2.36-2.36a3.25 3.25 0 0 0 0-4.596Z" />
                <path d="M7.086 9.975a.75.75 0 1 0 1.06-1.06 1.75 1.75 0 0 1 0-2.475l2.36-2.36a1.75 1.75 0 0 1 2.475 2.475l-1.105 1.104a.75.75 0 0 0 1.06 1.06l1.106-1.104a3.25 3.25 0 0 0-4.595-4.596l-2.36 2.36a3.25 3.25 0 0 0 0 4.596Z" />
              </svg>
              Voir la vidéo
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Paginated history ───────────────────────────────────────────────────── */
const PAGE_SIZE = 10;

function AnalysisHistoryPaginated({ analyses }: { analyses: AnalysisRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(analyses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = analyses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {slice.map((row) => <AnalysisHistoryItem key={row.id} row={row} />)}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/[0.08] bg-white/[0.03] text-gray-500 hover:text-white hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06L5.47 8.53a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
            const isActive = n === safePage;
            const isNear = Math.abs(n - safePage) <= 1 || n === 1 || n === totalPages;
            if (!isNear) {
              if (n === 2 && safePage > 3) return <span key={n} className="text-[11px] text-gray-600">…</span>;
              if (n === totalPages - 1 && safePage < totalPages - 2) return <span key={n} className="text-[11px] text-gray-600">…</span>;
              return null;
            }
            return (
              <button key={n} type="button" onClick={() => setPage(n)}
                className={`w-8 h-8 rounded-lg text-[12px] font-semibold border transition-all ${isActive ? 'bg-gradient-to-br from-vn-fuchsia/30 to-vn-indigo/30 border-vn-fuchsia/40 text-white' : 'border-white/[0.08] bg-white/[0.03] text-gray-500 hover:text-white hover:border-white/[0.15]'}`}>
                {n}
              </button>
            );
          })}

          <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/[0.08] bg-white/[0.03] text-gray-500 hover:text-white hover:border-white/[0.15] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </button>

          <span className="ml-2 text-[11px] text-gray-600">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, analyses.length)} / {analyses.length}
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function DashboardClient({
  email,
  plan,
  billingPlan,
  usesStripeSubscription,
  showEliteUpgrade,
  analysesCount,
  analysesLimit,
  hooksCount,
  hooksLimit,
  memberSince,
  analyses,
  stripeSessionId,
}: DashboardClientProps) {
  const router = useRouter();
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [upgradedPlan, setUpgradedPlan] = useState<string | null>(null);
  const [eliteUpgradeLoading, setEliteUpgradeLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [cancelError, setCancelError] = useState('');
  const [cancelDoneMode, setCancelDoneMode] = useState<'immediate' | 'end_of_period' | null>(null);
  const [domReady, setDomReady] = useState(false);
  useEffect(() => { setDomReady(true); }, []);

  useEffect(() => {
    if (!stripeSessionId) return;
    const pendingPlan = localStorage.getItem('pendingPlan');
    if (!pendingPlan || (pendingPlan !== 'pro' && pendingPlan !== 'elite')) { router.replace('/dashboard'); return; }
    setUpgradeStatus('loading');
    fetch('/api/upgrade-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: pendingPlan, sessionId: stripeSessionId }) })
      .then(r => r.json())
      .then(async data => {
        if (data.success) {
          localStorage.removeItem('pendingPlan');
          setUpgradedPlan(pendingPlan);
          setUpgradeStatus('success');
          const ok = await waitForBillingPlan(pendingPlan as 'pro' | 'elite');
          if (!ok) console.warn('[Dashboard] billingPlan pas encore à jour — reload.');
          window.location.href = '/dashboard';
        } else { setUpgradeStatus('error'); }
      })
      .catch(() => setUpgradeStatus('error'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeSessionId]);

  // ── Computed stats ──────────────────────────────────────────────────────
  const remaining = Math.max(0, analysesLimit - analysesCount);
  const hooksRemaining = hooksLimit > 0 ? Math.max(0, hooksLimit - hooksCount) : 0;
  const canAnalyze = remaining > 0;
  const initials = email.slice(0, 2).toUpperCase();
  const hasHistory = analyses.length > 0;
  const memberDate = new Date(memberSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const scores = analyses.map(a => a.result?.viralityScore).filter((s): s is number => typeof s === 'number');
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;

  const remainingDisplay = remaining > 0 ? `${remaining} restante${remaining > 1 ? 's' : ''}` : 'Limite atteinte';

  // ── Cancel ──────────────────────────────────────────────────────────────
  async function handleEliteUpgrade() {
    setEliteUpgradeLoading(true);
    try {
      const res = await fetch('/api/upgrade-subscription', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert(data.error ?? 'Mise à niveau impossible.'); return; }
      const synced = await waitForBillingPlan('elite');
      if (!synced) console.warn('[Dashboard] Elite webhook lent.');
      window.location.href = '/dashboard?t=' + Date.now();
    } catch (e) { console.error(e); alert('Erreur réseau.'); }
    finally { setEliteUpgradeLoading(false); }
  }

  async function handleCancelPlan() {
    setCancelStatus('loading'); setCancelError('');
    try {
      const res = await fetch('/api/cancel-plan', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCancelDoneMode(data.cancelAtPeriodEnd ? 'end_of_period' : 'immediate');
        setCancelStatus('done');
        setTimeout(() => { window.location.href = '/dashboard?t=' + Date.now(); }, data.cancelAtPeriodEnd ? 2500 : 1500);
        return;
      }
      if (res.status === 401 || data.code === 'SESSION_EXPIRED') {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login?redirect=/dashboard'; return;
      }
      setCancelError(data.error ?? 'Une erreur est survenue');
      setCancelStatus('error');
    } catch { setCancelError('Erreur réseau.'); setCancelStatus('error'); }
  }

  // ── Cancel modal ────────────────────────────────────────────────────────
  const cancelModal = showCancelModal && domReady && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={() => { if (cancelStatus !== 'loading') setShowCancelModal(false); }}>
      <div className="w-full max-w-sm bg-[#0d0d12] border border-white/[0.10] rounded-2xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        {cancelStatus === 'done' ? (
          <div className="text-center py-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
            </div>
            <p className="text-base font-semibold text-white mb-1">{cancelDoneMode === 'end_of_period' ? 'Résiliation programmée' : 'Abonnement annulé'}</p>
            <p className="text-xs text-gray-500">{cancelDoneMode === 'end_of_period' ? "Tu conserves l'accès jusqu'à la fin de la période payée." : 'Ton plan a été repassé en Free. Redirection…'}</p>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-red-400"><path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" /></svg>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-2">Annuler ton abonnement {billingPlan === 'elite' ? 'Elite' : 'Pro'} ?</h3>
            <p className="text-sm text-gray-400 text-center leading-relaxed mb-5">
              {usesStripeSubscription ? (<>L'abonnement sera arrêté à la <span className="text-white font-medium">fin de la période en cours</span>.</>) : (<>Ton plan passera immédiatement en <span className="text-white font-medium">Free</span>.</>)}
              <br /><span className="text-gray-600 text-xs">Ton historique sera conservé.</span>
            </p>
            {cancelStatus === 'error' && <div className="bg-red-500/8 border border-red-500/20 rounded-xl px-3 py-2.5 mb-3"><p className="text-xs text-red-400 text-center">{cancelError}</p></div>}
            <div className="flex gap-3">
              <button onClick={() => setShowCancelModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-300 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all">Garder mon plan</button>
              <button onClick={handleCancelPlan} disabled={cancelStatus === 'loading'} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600/80 hover:bg-red-600 transition-all disabled:opacity-60">
                {cancelStatus === 'loading' ? <span className="flex items-center justify-center gap-1.5"><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Annulation…</span> : "Confirmer l'annulation"}
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

        {/* ── Alert banners ── */}
        {upgradeStatus === 'loading' && (
          <div className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4">
            <svg className="w-4 h-4 animate-spin text-vn-fuchsia shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            <p className="text-sm text-gray-400">Activation de ton plan en cours…</p>
          </div>
        )}
        {upgradeStatus === 'success' && (
          <div className="flex items-center gap-3 bg-emerald-500/[0.07] border border-emerald-500/20 rounded-2xl px-5 py-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-emerald-400"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-400">Paiement réussi — compte mis à jour !</p>
              <p className="text-xs text-emerald-600 mt-0.5">Plan {upgradedPlan === 'elite' ? 'Elite' : 'Pro'} actif.</p>
            </div>
          </div>
        )}
        {upgradeStatus === 'error' && (
          <div className="flex items-center gap-3 bg-red-500/[0.07] border border-red-500/20 rounded-2xl px-5 py-4">
            <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-red-400"><path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-400">Erreur lors de la mise à jour du plan.</p>
              <p className="text-xs text-red-600 mt-0.5">Ton paiement a été encaissé. Contacte le support.</p>
            </div>
          </div>
        )}
        {billingPlan !== 'free' && plan === 'free' && (
          <div className="flex items-center gap-3 bg-amber-500/[0.08] border border-amber-500/25 rounded-2xl px-5 py-4">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-amber-400"><path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
            </div>
            <p className="text-sm text-amber-200">Problème de paiement — mets à jour ton moyen de paiement depuis l'e-mail Stripe.</p>
          </div>
        )}

        {/* ── Hero header ── */}
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-6 sm:p-8">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-vn-fuchsia/[0.06] via-transparent to-vn-indigo/[0.04] pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-vn-fuchsia to-vn-indigo blur-md opacity-60" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-vn-fuchsia to-vn-indigo flex items-center justify-center text-white font-black text-xl shadow-lg">
                {initials}
              </div>
            </div>

            {/* Name + email */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-none">
                  {email.split('@')[0]}
                </h1>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r border ${planGradient[plan]}`}>
                  {planLabels[plan]}
                </span>
              </div>
              <p className="text-sm text-gray-500 truncate">{email}</p>
              <p className="text-xs text-gray-600 mt-1">Membre depuis {memberDate}</p>
            </div>

            {/* Quick CTA */}
            <div className="shrink-0">
              <Link href="/analyzer" className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white transition-all ${canAnalyze ? 'bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 shadow-lg shadow-vn-fuchsia/25' : 'bg-white/[0.06] border border-white/[0.10] opacity-60 cursor-not-allowed pointer-events-none'}`}>
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><path d="M9.196.944a.75.75 0 0 0-1.483.183l.175 1.417A8.001 8.001 0 0 0 2.25 8.5h1.5a6.5 6.5 0 0 1 4.637-6.224l.175 1.417a.75.75 0 0 0 1.374.293l1.346-3a.75.75 0 0 0-.623-1.045l-1.463.003Z" /><path d="M5.483 13.897a.75.75 0 0 1-.957-.408l-.565-1.356a6.5 6.5 0 0 1-1.711-5.633h-1.5A8 8 0 0 0 4 14.75a.75.75 0 0 0 .957.408l1.346-3a.75.75 0 0 0-.82-1.261Z" /></svg>
                Nouvelle analyse
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Analyses */}
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 flex items-center gap-4">
            <RingProgress value={analysesCount} max={analysesLimit} size={56} />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-1">Analyses</p>
              <p className="text-2xl font-black text-white leading-none">{analysesCount}<span className="text-sm text-gray-600 font-medium"> / {analysesLimit}</span></p>
              <p className={`text-[11px] mt-1 font-medium ${remaining === 0 ? 'text-red-400' : 'text-gray-500'}`}>{remainingDisplay}</p>
            </div>
          </div>

          {/* Score moyen */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Score moyen</p>
            {avgScore !== null ? (
              <>
                <p className={`text-3xl font-black leading-none ${scoreColor(avgScore)}`}>{avgScore}</p>
                <p className="text-[11px] text-gray-600 mt-1">sur {scores.length} vidéo{scores.length > 1 ? 's' : ''}</p>
              </>
            ) : (
              <p className="text-2xl font-black text-gray-700">—</p>
            )}
          </div>

          {/* Meilleur score */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Meilleur score</p>
            {bestScore !== null ? (
              <>
                <p className={`text-3xl font-black leading-none ${scoreColor(bestScore)}`}>{bestScore}</p>
                <p className="text-[11px] text-gray-600 mt-1">score viral</p>
              </>
            ) : (
              <p className="text-2xl font-black text-gray-700">—</p>
            )}
          </div>

          {/* Hooks ou "Passer Pro" */}
          {hooksLimit > 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Hooks générés</p>
              <p className="text-3xl font-black text-white leading-none">{hooksCount}<span className="text-sm text-gray-600 font-medium"> / {hooksLimit}</span></p>
              <p className="text-[11px] text-gray-600 mt-1">{hooksRemaining > 0 ? `${hooksRemaining} restant${hooksRemaining > 1 ? 's' : ''}` : 'Quota atteint'}</p>
            </div>
          ) : (
            <Link href="/pricing" className="rounded-2xl border border-vn-fuchsia/20 bg-gradient-to-br from-vn-fuchsia/[0.07] to-vn-indigo/[0.05] p-5 group hover:border-vn-fuchsia/35 transition-all">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Plan actuel</p>
              <p className="text-2xl font-black text-white leading-none mb-1">Free</p>
              <p className="text-[11px] text-vn-fuchsia font-semibold group-hover:text-vn-fuchsia/80 transition-colors">Passer à Pro →</p>
            </Link>
          )}
        </div>

        {/* ── Elite upgrade banner ── */}
        {showEliteUpgrade && (
          <div className="relative overflow-hidden rounded-2xl border border-vn-violet/30 bg-gradient-to-br from-vn-violet/10 to-vn-fuchsia/[0.06] p-6">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-vn-violet/50 to-transparent pointer-events-none" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-white mb-1">Passer à Elite</p>
                <p className="text-xs text-gray-400">{MAX_ANALYSES_ELITE} analyses · {MAX_HOOKS_ELITE} hooks · Stratégie Elite · Insights viraux</p>
              </div>
              <button type="button" disabled={eliteUpgradeLoading} onClick={handleEliteUpgrade}
                className="shrink-0 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vn-indigo to-vn-fuchsia hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-vn-fuchsia/20">
                {eliteUpgradeLoading ? 'Mise à niveau…' : `Elite — ${DISPLAY_CATALOG_ELITE_EUR}€/mois`}
              </button>
            </div>
          </div>
        )}

        {/* ── Two-column layout: history + sidebar ── */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">

          {/* History — left, takes most space */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Historique des analyses</h2>
                {hasHistory && <p className="text-[11px] text-gray-600 mt-0.5">{analyses.length} analyse{analyses.length > 1 ? 's' : ''} au total</p>}
              </div>
              {plan !== 'free' && hasHistory && (
                <Link href="/analyzer" className="text-[11px] font-semibold text-vn-fuchsia hover:text-vn-fuchsia/80 transition-colors">
                  + Nouvelle →
                </Link>
              )}
            </div>

            {plan === 'free' ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-vn-violet/10 border border-vn-violet/20 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-vn-glow"><path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" /></svg>
                </div>
                <p className="text-sm font-semibold text-white mb-2">Historique disponible en Pro</p>
                <p className="text-xs text-gray-500 mb-5">Retrouve toutes tes analyses passées et suis ta progression.</p>
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-xs font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 transition-opacity shadow-lg shadow-vn-fuchsia/20">
                  Passer à Pro →
                </Link>
              </div>
            ) : !hasHistory ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 text-center">
                <p className="text-sm text-gray-500 mb-1">Aucune analyse pour le moment.</p>
                <p className="text-xs text-gray-600">Lance ta première analyse pour la retrouver ici.</p>
              </div>
            ) : (
              <AnalysisHistoryPaginated analyses={analyses} />
            )}
          </div>

          {/* Sidebar — right */}
          <div className="lg:w-[280px] xl:w-[300px] shrink-0 space-y-4">

            {/* Quick actions */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Actions rapides</p>
              <div className="space-y-2">
                <Link href="/analyzer" className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${canAnalyze ? 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.05] hover:border-vn-fuchsia/35 hover:bg-vn-fuchsia/[0.08]' : 'border-white/[0.06] bg-white/[0.02] opacity-50 pointer-events-none'}`}>
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-vn-fuchsia to-vn-indigo flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-white"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">Analyser une vidéo</p>
                    <p className="text-[10px] text-gray-500">{remainingDisplay}</p>
                  </div>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                </Link>

                {plan === 'free' ? (
                  <Link href="/pricing" className="flex items-center gap-3 p-3 rounded-xl border border-vn-violet/20 bg-vn-violet/[0.05] hover:border-vn-violet/35 hover:bg-vn-violet/[0.08] transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-vn-violet/20 border border-vn-violet/25 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-vn-glow"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white group-hover:text-vn-glow transition-colors">Passer à Pro</p>
                      <p className="text-[10px] text-gray-500">{`${MAX_ANALYSES_PRO} analyses · ${DISPLAY_CATALOG_PRO_EUR}€/mois`}</p>
                    </div>
                  </Link>
                ) : (
                  <Link href="/hooks" className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04] transition-all group">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-400"><path d="M7.557 2.066A.75.75 0 0 1 8 2.75v10.5a.75.75 0 0 1-1.248.56L3.59 11H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.59l3.162-2.81a.75.75 0 0 1 .805-.124ZM12.95 3.05a.75.75 0 1 0-1.06 1.06 5.5 5.5 0 0 1 0 7.78.75.75 0 1 0 1.06 1.06 7 7 0 0 0 0-9.9Z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">Générateur de hooks</p>
                      <p className="text-[10px] text-gray-500">{hooksLimit > 0 ? `${hooksRemaining} restant${hooksRemaining > 1 ? 's' : ''}` : 'Disponible en Pro'}</p>
                    </div>
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-gray-600 ml-auto group-hover:text-gray-400 transition-colors"><path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Quota reset info */}
            {hooksLimit > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-vn-indigo/15 border border-vn-indigo/20 flex items-center justify-center shrink-0 mt-0.5">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-vn-indigo">
                      <path fillRule="evenodd" d="M1 8.74c0 .983.713 1.825 1.69 1.943l.764.095a.81.81 0 0 1 .718.80v.68c0 .684.663 1.158 1.31.93l.758-.27a.81.81 0 0 1 .803.161l.51.473c.51.473 1.29.473 1.8 0l.51-.473a.81.81 0 0 1 .803-.161l.758.27c.647.228 1.31-.246 1.31-.93v-.68a.81.81 0 0 1 .718-.80l.764-.095A1.96 1.96 0 0 0 15 8.74v-.48A1.96 1.96 0 0 0 13.31 6.317l-.764-.095a.81.81 0 0 1-.718-.80v-.68c0-.684-.663-1.158-1.31-.93l-.758.27a.81.81 0 0 1-.803-.161l-.51-.473a1.35 1.35 0 0 0-1.8 0l-.51.473a.81.81 0 0 1-.803.161l-.758-.27c-.647-.228-1.31.246-1.31.93v.68a.81.81 0 0 1-.718.80l-.764.095A1.96 1.96 0 0 0 1 8.26v.48ZM8 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white mb-0.5">Reset automatique</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {usesStripeSubscription ? "Quotas rechargés à chaque renouvellement d'abonnement." : 'Quotas rechargés le 1er du mois calendaire.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Subscription management */}
            {billingPlan !== 'free' && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-3">Abonnement</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Plan {billingPlan === 'elite' ? 'Elite' : 'Pro'}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Facturation {usesStripeSubscription ? 'Stripe' : 'manuelle'}</p>
                  </div>
                  <button
                    onClick={() => { setCancelStatus('idle'); setCancelError(''); setCancelDoneMode(null); setShowCancelModal(true); }}
                    className="text-[11px] font-medium text-gray-600 hover:text-red-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-red-500/[0.06] border border-transparent hover:border-red-500/15"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
