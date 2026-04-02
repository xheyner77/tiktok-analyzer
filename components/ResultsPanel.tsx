'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnalysisResult, Improvement } from '@/lib/types';

interface ResultsPanelProps {
  data: AnalysisResult;
  plan: 'free' | 'pro' | 'elite';
  onReset?: () => void;
}

function scoreColors(s: number) {
  if (s >= 80) return { hex: '#34d399', glow: 'rgba(52,211,153,0.35)',  grad1: '#34d399', grad2: '#6ee7b7' };
  if (s >= 60) return { hex: '#f59e0b', glow: 'rgba(251,191,36,0.35)',  grad1: '#f59e0b', grad2: '#fbbf24' };
  if (s >= 35) return { hex: '#f97316', glow: 'rgba(249,115,22,0.35)',  grad1: '#f97316', grad2: '#fb923c' };
  return              { hex: '#f87171', glow: 'rgba(248,113,113,0.35)', grad1: '#f87171', grad2: '#fca5a5' };
}

function scoreBarCls(s: number) {
  return s >= 70 ? 'bg-emerald-400' : s >= 40 ? 'bg-amber-400' : 'bg-red-400';
}

function viralBadge(s: number) {
  if (s >= 85) return { label: 'Viral',          cls: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20' };
  if (s >= 75) return { label: 'Fort potentiel', cls: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20' };
  if (s >= 60) return { label: 'Potentiel',      cls: 'bg-amber-400/15  text-amber-300  border border-amber-400/20'  };
  if (s >= 40) return { label: 'En progression', cls: 'bg-orange-400/15 text-orange-300 border border-orange-400/20' };
  return              { label: 'À améliorer',    cls: 'bg-red-500/15    text-red-300    border border-red-500/20'    };
}

function compBenchmark(s: number) {
  if (s >= 85) return { pct: 3,  grad: 'from-emerald-500 to-emerald-400', hex: '#34d399' };
  if (s >= 70) return { pct: 10, grad: 'from-emerald-500 to-emerald-400', hex: '#34d399' };
  if (s >= 55) return { pct: 22, grad: 'from-amber-500 to-amber-400',     hex: '#f59e0b' };
  if (s >= 40) return { pct: 40, grad: 'from-amber-500 to-amber-400',     hex: '#f59e0b' };
  if (s >= 25) return { pct: 60, grad: 'from-red-500 to-red-400',         hex: '#f87171' };
  return              { pct: 78, grad: 'from-red-500 to-red-400',         hex: '#f87171' };
}

function buildSummary(data: AnalysisResult): string {
  const v = data.viralityScore, h = data.hook?.score ?? 0,
        e = data.editing?.score ?? 0, r = data.retention?.score ?? 0;
  if (v >= 85) return 'Excellente vidéo — potentiel viral très fort.';
  if (v >= 75) return 'Très bonne vidéo — optimise les détails pour le viral.';
  const weak = [
    { label: 'hook',      score: h },
    { label: 'montage',   score: e },
    { label: 'rétention', score: r },
  ].filter(d => d.score < 60).sort((a, b) => a.score - b.score);
  if (weak.length >= 2) return `Ta vidéo perd des vues à cause du\u00a0${weak[0].label} et de la\u00a0${weak[1].label}.`;
  if (weak.length === 1) {
    if (weak[0].label === 'hook')    return "Ta vidéo décroche en hook — l'audience part avant 3\u00a0secondes.";
    if (weak[0].label === 'montage') return 'Ta vidéo perd des vues à cause du montage.';
    return 'Ta vidéo perd son audience trop rapidement.';
  }
  const verdict = data.finalVerdict?.trim();
  if (verdict) return verdict.split('.')[0] + '.';
  return 'Ta vidéo est correcte — corrige les points faibles pour décoller.';
}

function deriveMainProblem(data: AnalysisResult): string {
  const dims = [
    { label: 'Hook',      score: data.hook?.score ?? 0,      weakness: data.hook?.weaknesses?.[0] },
    { label: 'Montage',   score: data.editing?.score ?? 0,   weakness: data.editing?.weaknesses?.[0] },
    { label: 'Rétention', score: data.retention?.score ?? 0, weakness: data.retention?.weaknesses?.[0] },
  ].sort((a, b) => a.score - b.score);
  const w = dims[0];
  if (w.weakness) return w.weakness;
  const fallbacks: Record<string, string> = {
    'Hook':      "Hook insuffisant — l'audience décroche avant 3\u00a0secondes.",
    'Montage':   "Montage trop lent — perte d'attention au milieu.",
    'Rétention': "Rétention faible — la vidéo n'est pas regardée jusqu'au bout.",
  };
  return fallbacks[w.label] ?? 'Optimisation nécessaire pour améliorer les performances.';
}

function deriveProjection(data: AnalysisResult): { label: string; gain: number } | null {
  const dims = [
    { label: 'le hook',      score: data.hook?.score ?? 0 },
    { label: 'le montage',   score: data.editing?.score ?? 0 },
    { label: 'la rétention', score: data.retention?.score ?? 0 },
  ].filter(d => d.score < 72).sort((a, b) => a.score - b.score);
  if (!dims.length) return null;
  const gain = Math.round(dims.slice(0, 2).reduce((sum, d) => sum + Math.max(0, 75 - d.score) * 0.45, 0));
  if (gain < 5) return null;
  return { label: `En améliorant\u00a0${dims[0].label}`, gain };
}

function findReco(improvs: Improvement[], kws: string[]): string | undefined {
  const byPriority = [...improvs].sort((a, b) => {
    const o: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
  });
  return byPriority.find(i => kws.some(k => i.tip.toLowerCase().includes(k)))?.tip ?? byPriority[0]?.tip;
}

function PBar({ pct, cls }: { pct: number; cls: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 500); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${cls}`}
        style={{ width: `${w}%`, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

function Gauge({ value }: { value: number }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 200); return () => clearTimeout(t); }, [value]);
  const c = scoreColors(value);
  const size = 136, r = (size - 16) / 2, circ = 2 * Math.PI * r;
  const dash = circ * (anim / 100), gap = circ - dash;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 shrink-0">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#g${value})`} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${gap}`}
        style={{ filter: `drop-shadow(0 0 12px ${c.glow})`, transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
      <defs>
        <linearGradient id={`g${value}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={c.grad1} />
          <stop offset="100%" stopColor={c.grad2} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Hr() { return <div className="border-t border-white/[0.06]" />; }

export default function ResultsPanel({ data, plan, onReset }: ResultsPanelProps) {
  const vs      = typeof data.viralityScore === 'number' ? data.viralityScore : 0;
  const ss      = data.structureScore ?? vs;
  const sc      = scoreColors(vs);
  const vb      = viralBadge(vs);
  const bench   = compBenchmark(ss);
  const metrics = data.observedMetrics ?? {};
  const meta    = data.detectedVideoMeta;
  const hasStats = Object.values(metrics).some(v => v != null);

  const summary    = buildSummary(data);
  const mainProb   = deriveMainProblem(data);
  const projection = deriveProjection(data);

  const improvs = data.improvements ?? [];
  const sorted  = [...improvs].sort((a, b) => {
    const o: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
  });
  const VISIBLE_FREE = 3;
  const visible = plan === 'free' ? sorted.slice(0, VISIBLE_FREE) : sorted.slice(0, 5);
  const locked  = plan === 'free' ? Math.max(0, sorted.length - VISIBLE_FREE) : 0;

  const hookReco   = findReco(improvs, ['hook', 'accroche', 'début', 'intro', 'premi']);
  const editReco   = findReco(improvs, ['montage', 'transition', 'cut', 'rythme', 'coupe']);
  const retentReco = findReco(improvs, ['rétention', 'audience', 'attention', 'interrupt', 'rebond']);

  const pillars = [
    { title: 'Hook',       s: data.hook,      reco: hookReco   },
    { title: 'Montage',    s: data.editing,   reco: editReco   },
    { title: 'Rétention',  s: data.retention, reco: retentReco },
  ];

  const pillarDetailCap = plan === 'free' ? 1 : 2;

  const fmt = (v?: number) =>
    v == null ? '—' : new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  const label9 = 'text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600';

  return (
    <div className="bg-[#0d0d12] rounded-[1.25rem] ring-1 ring-white/[0.08] text-white overflow-hidden">

      <div className="h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

      {/* 1. HERO — centré sur mobile, aligné à gauche à partir de sm */}
      <div className="px-7 sm:px-10 pt-10 pb-8">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left gap-7 sm:gap-10">

          {/* Gauge ring */}
          <div className="relative shrink-0">
            <Gauge value={vs} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[3.2rem] font-black leading-none tabular-nums"
                style={{ color: sc.hex, textShadow: `0 0 48px ${sc.glow}` }}>
                {vs}
              </span>
              <span className="text-[10px] text-gray-600 mt-0.5">/100</span>
            </div>
          </div>

          {/* Right — status + headline + mini-scores piliers */}
          <div className="flex-1 min-w-0 w-full flex flex-col items-center sm:items-start">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-4">
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${vb.cls}`}>{vb.label}</span>
              {data.analysisSource === 'vision_upload' && (
                <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20 uppercase tracking-wide">
                  Vision IA
                </span>
              )}
              {data.overperformanceDetected && (
                <span className="text-[9px] font-bold px-2.5 py-0.5 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20">
                  ⚡ Surperformance
                </span>
              )}
            </div>

            <p className="text-[1.25rem] sm:text-[1.45rem] font-bold text-white leading-tight mb-6 max-w-lg mx-auto sm:mx-0">
              {summary}
            </p>

            <div className="flex gap-7 sm:gap-10 justify-center sm:justify-start">
              {pillars.map(({ title, s }) => {
                const score = s?.score ?? 0;
                const c = scoreColors(score);
                return (
                  <div key={title} className="text-center sm:text-left">
                    <p className={`${label9} mb-1`}>{title}</p>
                    <p className="text-[1.75rem] font-black leading-none tabular-nums"
                      style={{ color: c.hex }}>{score}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Hr />

      {/* 2. PROBLÈME PRINCIPAL + PLAN D'ACTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">

        <div className="px-7 sm:px-10 py-8 text-center sm:text-left">
          <p className={`${label9} mb-5`}>Problème principal</p>
          <div className="flex items-start gap-4 justify-center sm:justify-start">
            <div className="w-0.5 self-stretch rounded-full bg-red-500/50 shrink-0 hidden sm:block" aria-hidden />
            <p className="text-[15px] font-semibold text-white leading-snug max-w-xl sm:max-w-none">{mainProb}</p>
          </div>
        </div>

        <div className="px-7 sm:px-10 py-8 text-center sm:text-left">
          <p className={`${label9} mb-5`}>À corriger maintenant</p>
          <ol className="space-y-3 text-left max-w-lg mx-auto sm:max-w-none sm:mx-0">
            {visible.map((imp, i) => (
              <li key={i} className="flex items-start gap-3.5">
                <span className="text-[11px] font-black text-gray-700 shrink-0 w-4 mt-px">{i + 1}</span>
                <p className="text-[13px] text-gray-300 leading-snug">{imp.tip}</p>
              </li>
            ))}
          </ol>

          {/* Locked extra recommendations for free users */}
          {plan === 'free' && locked > 0 && (
            <div className="relative mt-5 rounded-2xl overflow-hidden border border-vn-fuchsia/25 bg-[#08080f] min-h-[168px]">
              <div className="blur-sm pointer-events-none select-none opacity-30 p-5 space-y-3 min-h-[168px]" aria-hidden>
                {Array.from({ length: Math.min(locked, 3) }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="text-[11px] font-black text-gray-700 shrink-0 w-4">{VISIBLE_FREE + i + 1}</span>
                    <div className="h-2.5 rounded-full bg-gray-600 mt-1 flex-1 max-w-[90%]" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5 py-8 gap-3 bg-[#0d0d12]/[0.97]">
                <span className="text-[9px] font-bold px-3 py-1 rounded-full bg-vn-fuchsia/18 text-vn-fuchsia border border-vn-fuchsia/35 uppercase tracking-[0.14em]">
                  Plan Pro
                </span>
                <p className="text-[13px] font-bold text-white leading-snug max-w-[240px]">
                  +{locked} recommandation{locked > 1 ? 's' : ''} en plus avec Pro
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold px-5 py-2.5 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_6px_20px_-6px_rgba(232,121,249,0.45)] mt-1"
                >
                  ⭐ Débloquer avec Pro
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>

      <Hr />

      {/* 3. ANALYSE PAR PILIER */}
      <div className="px-7 sm:px-10 py-9 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-9 md:gap-12">
          {pillars.map(({ title, s, reco }) => {
            const score = s?.score ?? 0;
            const c     = scoreColors(score);
            return (
              <div key={title} className="flex flex-col gap-0 items-center text-center md:items-stretch md:text-left max-w-md mx-auto md:max-w-none md:mx-0 w-full">
                <div className="flex items-end gap-3 mb-3 w-full justify-center md:justify-start">
                  <span className="text-[2.8rem] font-black leading-none tabular-nums"
                    style={{ color: c.hex, textShadow: `0 0 28px ${c.glow}` }}>{score}</span>
                  <div className="flex-1 min-w-0 max-w-[200px] md:max-w-none pb-1">
                    <p className="text-[12px] font-bold text-white mb-2">{title}</p>
                    <PBar pct={score} cls={scoreBarCls(score)} />
                  </div>
                </div>

                {(s?.strengths?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-1.5 w-full max-w-sm mx-auto md:mx-0 text-left">
                    {(s?.strengths ?? []).slice(0, pillarDetailCap).map((f, i) => (
                      <p key={i} className="text-[12px] text-gray-400 leading-snug">
                        <span className="text-emerald-400 font-bold mr-1.5">✓</span>{f}
                      </p>
                    ))}
                    {plan === 'free' && (s?.strengths?.length ?? 0) > pillarDetailCap && (
                      <div className="relative mt-2 rounded-xl overflow-hidden border border-vn-fuchsia/15 min-h-[4.5rem]">
                        <div className="blur-sm pointer-events-none select-none opacity-25 px-4 py-4 min-h-[4.5rem]" aria-hidden>
                          <p className="text-[11px] text-gray-500 leading-relaxed">✓ Autres forces visibles sur ta vidéo…</p>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-1.5 px-3 py-3 bg-[#0d0d12]/[0.96]">
                          <span className="text-[9px] font-bold text-vn-fuchsia uppercase tracking-[0.12em]">Plan Pro</span>
                          <Link href="/pricing" className="text-[10px] font-semibold text-white/90 hover:text-white">
                            Voir tout →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(s?.weaknesses?.length ?? 0) > 0 && (
                  <div className="mt-2 space-y-1.5 w-full max-w-sm mx-auto md:mx-0 text-left">
                    {(s?.weaknesses ?? []).slice(0, pillarDetailCap).map((w, i) => (
                      <p key={i} className="text-[12px] text-gray-500 leading-snug">
                        <span className="text-red-400 font-bold mr-1.5">×</span>{w}
                      </p>
                    ))}
                    {plan === 'free' && (s?.weaknesses?.length ?? 0) > pillarDetailCap && (
                      <div className="relative mt-2 rounded-xl overflow-hidden border border-vn-fuchsia/15 min-h-[4.5rem]">
                        <div className="blur-sm pointer-events-none select-none opacity-25 px-4 py-4 min-h-[4.5rem]" aria-hidden>
                          <p className="text-[11px] text-gray-500 leading-relaxed">× Autres points à corriger…</p>
                        </div>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-1.5 px-3 py-3 bg-[#0d0d12]/[0.96]">
                          <span className="text-[9px] font-bold text-vn-fuchsia uppercase tracking-[0.12em]">Plan Pro</span>
                          <Link href="/pricing" className="text-[10px] font-semibold text-white/90 hover:text-white">
                            Voir tout →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {reco && (
                  plan === 'free' ? (
                    <div className="relative mt-4 rounded-xl overflow-hidden border border-white/[0.08] min-h-[5.5rem]">
                      <div className="border-t border-white/[0.06] pt-0 min-h-[5.5rem]">
                        <p className="text-[12px] text-vn-violet/70 leading-snug blur-sm select-none opacity-30 pointer-events-none px-4 py-5" aria-hidden>
                          → {reco}
                        </p>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 px-4 py-5 bg-[#0d0d12]/[0.97]">
                        <span className="text-[9px] font-bold text-vn-fuchsia uppercase tracking-[0.12em]">Reco pilier · Pro</span>
                        <Link
                          href="/pricing"
                          className="inline-flex items-center justify-center text-[11px] font-semibold px-4 py-2 rounded-lg bg-gradient-to-r from-vn-fuchsia/90 to-vn-indigo/90 text-white hover:brightness-110 transition-all"
                        >
                          Débloquer
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 pt-3 text-[12px] text-vn-violet/80 leading-snug border-t border-white/[0.05]">
                      → {reco}
                    </p>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. STATS PUBLIQUES */}
      {hasStats && (
        <>
          <Hr />
          <div className="px-7 sm:px-10 py-8 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-center justify-center sm:justify-between gap-2 mb-6">
              <p className={label9}>Stats publiques</p>
              <span className="text-[9px] text-gray-700">
                {data.observedStatsSource === 'live_page'   ? 'Source\u00a0: TikTok' :
                 data.observedStatsSource === 'live_oembed' ? 'Source\u00a0: oEmbed'  :
                 data.observedStatsSource === 'cache'       ? 'Source\u00a0: cache'   : 'Stats partielles'}
              </span>
            </div>

            <div className="flex flex-wrap gap-8 sm:gap-12 mb-6 justify-center sm:justify-start">
              {[
                { label: 'Vues',         val: fmt(metrics.views)    },
                { label: 'Likes',        val: fmt(metrics.likes)    },
                { label: 'Commentaires', val: fmt(metrics.comments) },
                { label: 'Partages',     val: fmt(metrics.shares)   },
                ...(meta?.durationSec ? [{ label: 'Durée', val: `${meta.durationSec}s` }] : []),
                ...(meta?.authorUsername ? [{ label: 'Auteur', val: `@${meta.authorUsername}` }] : []),
              ].filter(m => m.val !== '—').map(({ label, val }) => (
                <div key={label}>
                  <p className={`${label9} mb-1.5`}>{label}</p>
                  <p className="text-[1.5rem] font-black text-white leading-none">{val}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 max-w-sm mx-auto sm:mx-0">
              <span className="text-[1.15rem] font-black shrink-0" style={{ color: bench.hex }}>
                Top {bench.pct}%
              </span>
              <div className="flex-1">
                <div className="h-[3px] rounded-full bg-white/[0.07] overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${bench.grad}`}
                    style={{ width: `${Math.max(4, 100 - bench.pct)}%` }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[8px] text-gray-700">Moyenne</span>
                  <span className="text-[8px] text-gray-700">Top créateurs</span>
                </div>
              </div>
            </div>

            {data.comparativeInsight && (
              plan === 'free' ? (
                <div className="relative mt-5 rounded-2xl overflow-hidden border border-white/[0.1] max-w-lg mx-auto sm:mx-0 min-h-[156px] bg-[#08080f]">
                  <p className="text-[12px] text-gray-500 leading-relaxed px-4 py-8 blur-md select-none opacity-35 pointer-events-none min-h-[156px]" aria-hidden>
                    {data.comparativeInsight}
                  </p>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2.5 px-5 py-8 bg-[#0d0d12]/[0.97]">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-vn-fuchsia">Analyse comparative · Pro</span>
                    <p className="text-[11px] text-gray-400 leading-relaxed max-w-[220px]">
                      Contexte stats, benchmark et lecture algo complète.
                    </p>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center text-[11px] font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-[0_4px_16px_-4px_rgba(232,121,249,0.35)] mt-1"
                    >
                      Débloquer
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-gray-500 leading-relaxed max-w-lg mx-auto sm:mx-0">
                  {data.comparativeInsight}
                </p>
              )
            )}
          </div>
        </>
      )}

      <Hr />

      {/* 5. VERDICT + STRATÉGIE */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.06]">

        <div className="px-7 sm:px-10 py-8 text-center sm:text-left">
          {data.finalVerdict ? (
            <p className="text-[14px] text-gray-300 leading-relaxed max-w-xl mx-auto sm:mx-0">{data.finalVerdict}</p>
          ) : (
            <p className="text-[14px] text-gray-500">Voir l&apos;analyse détaillée ci-dessus.</p>
          )}
          {data.comparativePriority && (
            plan === 'free' ? (
              <div className="relative mt-4 rounded-2xl overflow-hidden border border-vn-violet/20 min-h-[104px] max-w-xl mx-auto sm:mx-0 bg-[#08080f]">
                <p className="text-[12px] text-vn-violet/70 leading-snug px-4 py-6 blur-md select-none opacity-30 pointer-events-none min-h-[104px]" aria-hidden>
                  → {data.comparativePriority}
                </p>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2.5 px-5 py-6 bg-[#0d0d12]/[0.97]">
                  <span className="text-[9px] font-bold text-vn-violet uppercase tracking-[0.12em]">Action prioritaire · Pro</span>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center text-[11px] font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-vn-violet to-vn-indigo text-white hover:brightness-110 transition-all"
                  >
                    Débloquer
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-vn-violet/80 leading-snug">
                → {data.comparativePriority}
              </p>
            )
          )}
          {data.overperformanceDetected && (
            <p className="mt-3 text-[12px] text-vn-fuchsia/80">
              ⚡ Surperformance — ta vidéo performe au-dessus de sa structure.
            </p>
          )}
          {typeof data.observedPerformanceScore === 'number' && (
            plan === 'free' ? (
              <div className="relative mt-5 rounded-2xl overflow-hidden border border-white/[0.1] min-h-[132px] max-w-md mx-auto sm:mx-0 bg-[#08080f]">
                <div className="flex flex-col items-center justify-center blur-md select-none opacity-25 pointer-events-none py-10 px-4 min-h-[132px]" aria-hidden>
                  <span className="text-[2.5rem] font-black text-white leading-none tabular-nums">00</span>
                  <span className="text-[11px] text-gray-500 mt-1">Performance observée</span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-2 px-5 py-8 bg-[#0d0d12]/[0.97]">
                  <span className="text-[9px] font-bold text-vn-fuchsia uppercase tracking-[0.12em]">Score observé · Pro</span>
                  <p className="text-[10px] text-gray-500 max-w-[200px] leading-snug">
                    Compare structure et stats réelles en un seul indicateur.
                  </p>
                  <Link
                    href="/pricing"
                    className="text-[11px] font-semibold text-white hover:text-vn-fuchsia transition-colors mt-0.5"
                  >
                    Voir les plans →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-[2.2rem] font-black text-white leading-none">
                  {data.observedPerformanceScore}
                </span>
                <span className="text-[11px] text-gray-500">
                  {data.observedPerformanceLabel ?? 'Performance observée'}
                </span>
              </div>
            )
          )}
        </div>

        {/* Stratégie — locked for free users */}
        {plan === 'free' ? (
          <div className="relative px-7 sm:px-10 py-8 overflow-hidden min-h-[260px]">
            <div className="blur-sm pointer-events-none select-none opacity-25 min-h-[220px]" aria-hidden>
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600 mb-5">Stratégie</p>
              <div className="mb-5">
                <p className="text-[12px] text-gray-500 mb-1">En améliorant le hook</p>
                <p className="text-[3rem] font-black leading-none text-emerald-400">+22</p>
                <p className="text-[11px] text-gray-600 mt-1">points de score potentiel</p>
              </div>
              <div className="space-y-2 max-w-xs">
                <div className="h-3 rounded-full bg-gray-700 w-4/5" />
                <div className="h-3 rounded-full bg-gray-700 w-3/5" />
                <div className="h-3 rounded-full bg-gray-700 w-2/3" />
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-10 bg-[#0d0d12]/[0.96]">
              <div className="w-11 h-11 rounded-xl bg-vn-fuchsia/15 border border-vn-fuchsia/30 flex items-center justify-center mb-4">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-[18px] h-[18px] text-vn-fuchsia" aria-hidden>
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[9px] font-bold px-3 py-1 rounded-full bg-vn-fuchsia/18 text-vn-fuchsia border border-vn-fuchsia/35 uppercase tracking-[0.14em] mb-3">
                Plan Pro
              </span>
              <p className="text-[14px] font-bold text-white mb-2">Stratégie personnalisée</p>
              <p className="text-[11px] text-gray-400 mb-5 max-w-[220px] mx-auto leading-relaxed">
                Gain potentiel, plan de progression et stratégie IA sur 30 jours.
              </p>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold px-6 py-3 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(232,121,249,0.45)]"
              >
                ⭐ Passer à Pro
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-7 sm:px-10 py-8 text-center sm:text-left">
            <p className={`${label9} mb-5`}>Stratégie</p>
            {projection && (
              <div className="mb-5">
                <p className="text-[12px] text-gray-500 mb-1">{projection.label}</p>
                <p className="text-[3rem] font-black leading-none" style={{ color: '#34d399', textShadow: 'rgba(52,211,153,0.3)' }}>
                  +{projection.gain}
                </p>
                <p className="text-[11px] text-gray-600 mt-1">points de score potentiel</p>
              </div>
            )}
            {data.strategy ? (
              <p className="text-[13px] text-gray-400 leading-relaxed">{data.strategy}</p>
            ) : (
              <p className="text-[13px] text-gray-500 leading-relaxed">
                {(() => {
                  const weak = pillars.filter(p => (p.s?.score ?? 0) < 70).slice(0, 2).map(p => p.title.toLowerCase());
                  return weak.length
                    ? `Concentre-toi sur ${weak.join(' et ')} pour maximiser ta portée.`
                    : 'Continue sur cette trajectoire — optimise chaque nouvelle vidéo.';
                })()}
              </p>
            )}
          </div>
        )}

      </div>

      {/* 6. ELITE — Insights viraux */}
      <Hr />
      {plan === 'elite' && (data.viralTips?.length ?? 0) > 0 ? (
        <div className="px-7 sm:px-10 py-8 text-center md:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-2 sm:gap-3 mb-6">
            <p className={label9}>Insights viraux</p>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20 uppercase tracking-wide">Elite</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 text-left max-w-lg mx-auto md:max-w-none md:mx-0">
            {(data.viralTips ?? []).map((tip, i) => (
              <p key={i} className="text-[12px] text-gray-400 leading-snug">
                <span className="text-vn-fuchsia font-black mr-2">{i + 1}</span>{tip}
              </p>
            ))}
          </div>
        </div>
      ) : plan !== 'elite' && (
        /* Locked Elite insights preview */
        <div className="relative overflow-hidden border-t-0 min-h-[300px]">
          <div className="blur-sm pointer-events-none select-none opacity-30 px-7 sm:px-10 py-10 min-h-[280px]" aria-hidden>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-6">
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600">Insights viraux</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/20 uppercase tracking-wide">Elite</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 max-w-lg mx-auto">
              {['Ton hook crée une tension narrative rare — continue sur cet angle spécifique.','Tes cuts synchronisés sur le beat placent ta vidéo dans le top 8% du format.','La rétention après 15s est anormalement haute — exploite cette fenêtre.','Détecté : pattern de viralité secondaire sur les 3 premières secondes.'].map((tip, i) => (
                <p key={i} className="text-[12px] text-gray-400 leading-snug">
                  <span className="text-vn-fuchsia font-black mr-2">{i + 1}</span>{tip}
                </p>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 py-10 bg-[#0d0d12]/[0.97]">
            <div className="max-w-[280px] flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-vn-violet/15 border border-vn-violet/35 flex items-center justify-center">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-[18px] h-[18px] text-violet-400" aria-hidden>
                  <path fillRule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-[9px] font-bold px-3 py-1 rounded-full bg-vn-violet/20 text-violet-300 border border-vn-violet/35 uppercase tracking-[0.14em]">
                Plan Elite
              </span>
              <p className="text-[15px] font-black text-white leading-tight">Insights viraux exclusifs</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Patterns viraux, benchmarks top créateurs et stratégie avancée.
              </p>
              <div className="flex flex-wrap justify-center gap-2 w-full pt-1">
                {['🔮 Patterns', '📊 Benchmark', '⚡ Stratégie'].map((f, i) => (
                  <span key={i} className="inline-flex items-center text-[10px] font-medium px-2.5 py-1.5 rounded-full bg-vn-violet/12 text-violet-200/90 border border-vn-violet/25">
                    {f}
                  </span>
                ))}
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 text-[12px] font-bold px-6 py-3 rounded-xl bg-gradient-to-r from-vn-violet to-vn-fuchsia text-white hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_28px_-8px_rgba(139,92,246,0.5)] mt-2 w-full max-w-[240px]"
              >
                🔥 Passer à Elite
              </Link>
              <p className="text-[10px] text-gray-600 pt-1">Sans engagement · Annule en 1 clic</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. CTA */}
      <Hr />
      <div className="px-7 sm:px-10 py-8 flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-white">Prêt à corriger&nbsp;?</p>
          <p className="text-[11px] text-gray-600 mt-0.5">Analyse une autre vidéo ou génère des hooks optimisés.</p>
        </div>
        <div className="flex gap-2.5 shrink-0 flex-wrap justify-center sm:justify-end">
          {onReset ? (
            <button type="button" onClick={onReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(232,121,249,0.4)]">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Analyser une autre vidéo
            </button>
          ) : (
            <Link href="/analyzer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all">
              Analyser une autre vidéo
            </Link>
          )}
          <Link href="/hook-generator"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white/70 bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-white/[0.16] active:scale-[0.98] transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
            Générer des hooks
          </Link>
        </div>
      </div>

    </div>
  );
}
