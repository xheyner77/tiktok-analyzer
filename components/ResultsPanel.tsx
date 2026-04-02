'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnalysisResult, Improvement } from '@/lib/types';

interface ResultsPanelProps {
  data: AnalysisResult;
  plan: 'free' | 'pro' | 'elite';
  onReset?: () => void;
}

/* ══ Color helpers ══════════════════════════════════════════════════════════ */

function gc(score: number) {
  if (score >= 80) return { grad1: '#34d399', grad2: '#6ee7b7', glow: 'rgba(52,211,153,0.5)',  text: 'text-emerald-400', heroBg: 'rgba(52,211,153,0.07)'  };
  if (score >= 60) return { grad1: '#f59e0b', grad2: '#fbbf24', glow: 'rgba(251,191,36,0.5)',  text: 'text-amber-400',   heroBg: 'rgba(251,191,36,0.06)'  };
  if (score >= 35) return { grad1: '#f97316', grad2: '#fb923c', glow: 'rgba(249,115,22,0.5)',  text: 'text-orange-400',  heroBg: 'rgba(249,115,22,0.06)'  };
  return              { grad1: '#f87171', grad2: '#fca5a5', glow: 'rgba(248,113,113,0.5)', text: 'text-red-400',     heroBg: 'rgba(248,113,113,0.06)' };
}

function scoreBarCls(s: number) {
  return s >= 70 ? 'bg-emerald-400' : s >= 40 ? 'bg-amber-400' : 'bg-red-400';
}
function scoreTxtCls(s: number) {
  return s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
}
function qBadge(s: number) {
  if (s >= 80) return { label: 'Excellent', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' };
  if (s >= 70) return { label: 'Bon',       cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' };
  if (s >= 40) return { label: 'Moyen',     cls: 'bg-amber-400/20  text-amber-300  border border-amber-400/25'   };
  return              { label: 'Faible',    cls: 'bg-red-500/20    text-red-300    border border-red-500/25'     };
}
function viralBadge(s: number) {
  if (s >= 85) return { label: 'Viral',          cls: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20' };
  if (s >= 75) return { label: 'Fort potentiel', cls: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/20' };
  if (s >= 60) return { label: 'Potentiel',      cls: 'bg-amber-400/15  text-amber-300  border border-amber-400/20'  };
  if (s >= 40) return { label: 'En progression', cls: 'bg-orange-400/15 text-orange-300 border border-orange-400/20' };
  return              { label: 'À améliorer',    cls: 'bg-red-500/15    text-red-300    border border-red-500/20'    };
}
const PRIORITY_CLS: Record<string, string> = {
  haute:   'bg-red-500/20   text-red-300   border border-red-500/25',
  moyenne: 'bg-amber-400/20 text-amber-300 border border-amber-400/25',
  basse:   'bg-blue-500/20  text-blue-300  border border-blue-500/25',
};
function compData(score: number) {
  if (score >= 85) return { pct: 3,  grad: 'bg-gradient-to-r from-emerald-500 to-emerald-400', txt: 'text-emerald-400' };
  if (score >= 70) return { pct: 10, grad: 'bg-gradient-to-r from-emerald-500 to-emerald-400', txt: 'text-emerald-400' };
  if (score >= 55) return { pct: 22, grad: 'bg-gradient-to-r from-amber-500 to-amber-400',     txt: 'text-amber-400'  };
  if (score >= 40) return { pct: 40, grad: 'bg-gradient-to-r from-amber-500 to-amber-400',     txt: 'text-amber-400'  };
  if (score >= 25) return { pct: 60, grad: 'bg-gradient-to-r from-red-500 to-red-400',         txt: 'text-red-400'    };
  return                  { pct: 78, grad: 'bg-gradient-to-r from-red-500 to-red-400',         txt: 'text-red-400'    };
}

/* ══ Smart text helpers ══════════════════════════════════════════════════════ */

function buildSummary(data: AnalysisResult): string {
  const v = data.viralityScore;
  const h = data.hook?.score ?? 0;
  const e = data.editing?.score ?? 0;
  const r = data.retention?.score ?? 0;
  if (v >= 85) return 'Excellente vid\u00e9o\u00a0\u2014 potentiel viral tr\u00e8s fort, continue dans cette direction.';
  if (v >= 75) return 'Tr\u00e8s bonne vid\u00e9o\u00a0\u2014 quelques optimisations pour atteindre le niveau viral.';
  const weak = [
    { label: 'hook',      score: h },
    { label: 'montage',   score: e },
    { label: 'r\u00e9tention', score: r },
  ].filter(d => d.score < 60).sort((a, b) => a.score - b.score);
  if (weak.length >= 2) return `Ta vid\u00e9o a du potentiel mais est bloqu\u00e9e par le\u00a0${weak[0].label} et la\u00a0${weak[1].label}.`;
  if (weak.length === 1) {
    if (weak[0].label === 'hook')      return 'Ta vid\u00e9o perd son audience d\u00e8s les premi\u00e8res secondes\u00a0\u2014 le hook est la priorit\u00e9 absolue.';
    if (weak[0].label === 'montage')   return 'Le contenu est int\u00e9ressant mais le montage freine l\u2019engagement.';
    return 'Le d\u00e9but est bon mais la vid\u00e9o perd son audience trop rapidement.';
  }
  return data.finalVerdict?.trim() || 'Ta vid\u00e9o est correcte\u00a0\u2014 quelques optimisations peuvent la faire d\u00e9coller.';
}

function getBlockers(data: AnalysisResult) {
  const dims = [
    { label: 'Hook',      icon: '🎣', score: data.hook?.score ?? 0,      reason: data.hook?.weaknesses?.[0] },
    { label: 'Montage',   icon: '✂️', score: data.editing?.score ?? 0,   reason: data.editing?.weaknesses?.[0] },
    { label: 'R\u00e9tention', icon: '📉', score: data.retention?.score ?? 0, reason: data.retention?.weaknesses?.[0] },
  ].sort((a, b) => a.score - b.score);
  const out: { label: string; icon: string; score: number; reason: string }[] = [];
  for (const d of dims) {
    if (d.score < 72 && out.length < 3) {
      out.push({ label: d.label, icon: d.icon, score: d.score, reason: d.reason ?? `Score\u00a0${d.score}/100\u00a0\u2014 \u00e0 am\u00e9liorer` });
    }
  }
  for (const imp of (data.improvements ?? []).filter(i => i.priority === 'haute')) {
    if (out.length >= 3) break;
    out.push({ label: 'Correction', icon: '\u26a0\ufe0f', score: 0, reason: imp.tip });
  }
  return out.slice(0, 3);
}

function topRecoFor(improvements: Improvement[], kws: string[]): string | undefined {
  const sorted = [...improvements].sort((a, b) => {
    const o: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
  });
  return sorted.find(i => kws.some(kw => i.tip.toLowerCase().includes(kw)))?.tip ?? sorted[0]?.tip;
}

/* ══ Sub-components ══════════════════════════════════════════════════════════ */

function PBar({ pct, cls }: { pct: number; cls: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 400); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${cls}`} style={{ width: `${w}%`, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

function Gauge({ value, colors }: { value: number; colors: ReturnType<typeof gc> }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 250); return () => clearTimeout(t); }, [value]);
  const size = 124, r = (size - 16) / 2, circ = 2 * Math.PI * r;
  const dash = circ * (anim / 100), gap = circ - dash;
  const id = `gg${value}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ filter: `drop-shadow(0 0 10px ${colors.glow})`, transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={colors.grad1} />
          <stop offset="100%" stopColor={colors.grad2} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ══ Main ResultsPanel ══════════════════════════════════════════════════════ */

export default function ResultsPanel({ data, plan, onReset }: ResultsPanelProps) {
  const vs   = typeof data.viralityScore === 'number' ? data.viralityScore : 0;
  const ss   = data.structureScore ?? vs;
  const colors = gc(vs);
  const vb   = viralBadge(vs);
  const { pct: topPct, grad: compGrad, txt: compTxt } = compData(ss);
  const barW = Math.max(4, 100 - topPct);

  const metrics    = data.observedMetrics ?? {};
  const meta       = data.detectedVideoMeta;
  const hasMetrics = Object.values(metrics).some(v => v != null);

  const summary  = buildSummary(data);
  const blockers = getBlockers(data);
  const improvs  = data.improvements ?? [];
  const sortedImprovs = [...improvs].sort((a, b) => {
    const o: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
    return (o[a.priority] ?? 1) - (o[b.priority] ?? 1);
  });

  const hookReco   = topRecoFor(improvs, ['hook', 'accroche', 'début', 'intro', 'premi']);
  const editReco   = topRecoFor(improvs, ['montage', 'transition', 'cut', 'coupe', 'rythme', 'effet']);
  const retentReco = topRecoFor(improvs, ['rétention', 'audience', 'attention', 'interrupt', 'rebond', 'cta']);

  const VISIBLE_FREE  = 3;
  const visibleImprovs = plan === 'free' ? sortedImprovs.slice(0, VISIBLE_FREE) : sortedImprovs;
  const lockedImprovs  = plan === 'free' ? sortedImprovs.slice(VISIBLE_FREE) : [];

  const fmt = (v?: number) =>
    v == null ? '—' : new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const statsSource =
    data.observedStatsSource === 'live_page'   ? 'Source\u00a0: page TikTok' :
    data.observedStatsSource === 'live_oembed' ? 'Source\u00a0: oEmbed'      :
    data.observedStatsSource === 'cache'       ? 'Source\u00a0: cache'       : 'Stats partielles';

  const pillars = [
    { title: 'Hook',      section: data.hook,      reco: hookReco,   idx: 0 },
    { title: 'Montage',   section: data.editing,   reco: editReco,   idx: 1 },
    { title: 'R\u00e9tention', section: data.retention, reco: retentReco, idx: 2 },
  ];

  return (
    <div className="relative overflow-hidden bg-[#0d0d12] rounded-[1.1rem] sm:rounded-[1.3rem] ring-1 ring-white/[0.10] text-white">
      {/* Top shimmer */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none z-10" aria-hidden />

      {/* ══ 1. HERO RÉSULTAT ══════════════════════════════════════════════ */}
      <div
        className="relative overflow-hidden border-b border-white/[0.07]"
        style={{ background: `linear-gradient(135deg, ${colors.heroBg} 0%, transparent 60%)` }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 8% 50%, ${colors.glow.replace('0.5','0.08')}, transparent 55%)` }}
          aria-hidden
        />
        <div className="relative px-5 sm:px-8 py-7 sm:py-9 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">

          {/* Gauge */}
          <div className="relative shrink-0">
            <Gauge value={vs} colors={colors} />
            <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
              <span className={`text-[2.4rem] font-black leading-none tabular-nums ${colors.text}`}
                style={{ textShadow: `0 0 28px ${colors.glow}` }}>
                {vs}
              </span>
              <span className="text-[10px] text-gray-500 font-medium">/100</span>
            </div>
          </div>

          {/* Text zone */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest ${vb.cls}`}>
                {vb.label}
              </span>
              {data.analysisSource === 'vision_upload' && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/25 uppercase tracking-wide">
                  Vision IA
                </span>
              )}
              {data.overperformanceDetected && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/20">
                  ⚡ Surperformance
                </span>
              )}
            </div>

            <p className="text-[1.15rem] sm:text-[1.3rem] font-bold text-white leading-snug mb-5">
              {summary}
            </p>

            {/* Pillar mini-scores */}
            <div className="flex gap-2 sm:gap-3">
              {pillars.map(({ title, section }) => {
                const s = section?.score ?? 0;
                return (
                  <div key={title} className="flex-1 max-w-[96px] rounded-xl bg-white/[0.06] border border-white/[0.09] px-3 py-2.5 text-center">
                    <p className="text-[9px] text-gray-500 mb-1.5 font-medium">{title}</p>
                    <p className={`text-[18px] font-black leading-none tabular-nums ${scoreTxtCls(s)}`}>{s}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══ 2. CE QUI BLOQUE + PLAN D'ACTION ══════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b border-white/[0.07]">

        {/* Ce qui bloque */}
        <div className="p-5 sm:p-6 md:border-r border-b md:border-b-0 border-white/[0.07]">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center text-sm shrink-0">🚧</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Ce qui bloque ta vidéo</p>
          </div>
          <div className="space-y-2.5">
            {blockers.map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/[0.04] border border-red-500/[0.12] hover:border-red-500/20 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/15 flex items-center justify-center shrink-0 text-sm mt-0.5">
                  {b.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[12px] font-bold text-white">{b.label}</p>
                    {b.score > 0 && <span className="text-[10px] font-semibold text-red-400/80">{b.score}/100</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-snug">{b.reason}</p>
                </div>
              </div>
            ))}
            {blockers.length === 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/[0.12]">
                <p className="text-[12px] text-emerald-400 font-semibold">✓ Aucun blocage majeur détecté</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Concentre-toi sur les optimisations ci-contre.</p>
              </div>
            )}
          </div>
        </div>

        {/* Plan d'action */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-vn-violet/10 border border-vn-violet/15 flex items-center justify-center text-sm shrink-0">🎯</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Ce que tu dois corriger maintenant</p>
          </div>
          <div className="space-y-2">
            {visibleImprovs.map((imp, i) => {
              const pc = PRIORITY_CLS[imp.priority] ?? PRIORITY_CLS.moyenne;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-vn-violet/[0.04] border border-vn-violet/[0.10] hover:border-vn-violet/20 transition-colors">
                  <div className="w-6 h-6 rounded-md bg-vn-violet/10 border border-vn-violet/20 flex items-center justify-center shrink-0 text-[11px] font-black text-vn-violet mt-0.5">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-300 leading-snug mb-1">{imp.tip}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${pc}`}>
                      Priorité {imp.priority}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Locked improvements (free plan) */}
            {lockedImprovs.length > 0 && (
              <div className="relative mt-1 pt-2">
                <div className="space-y-2 blur-sm pointer-events-none select-none" aria-hidden>
                  {lockedImprovs.slice(0, 2).map((imp, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                      <div className="w-6 h-6 rounded-md bg-white/[0.05] flex items-center justify-center shrink-0 text-[11px] font-black text-gray-500">
                        {VISIBLE_FREE + i + 1}
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug">{imp.tip}</p>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link href="/pricing" className="relative text-[11px] font-semibold px-4 py-2 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all shadow-[0_4px_20px_-4px_rgba(232,121,249,0.5)]">
                    Débloquer {lockedImprovs.length} conseils →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ 3. ANALYSE PAR PILIER ══════════════════════════════════════════ */}
      <div className="border-b border-white/[0.07]">
        <div className="px-5 sm:px-7 pt-5 pb-1 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">📊</span>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Analyse par pilier</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.07]">
          {pillars.map(({ title, section, reco }) => {
            const s = section?.score ?? 0;
            const qb = qBadge(s);
            return (
              <div key={title} className="p-5 sm:p-6 flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold text-white">{title}</p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[17px] font-black tabular-nums ${scoreTxtCls(s)}`}>{s}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${qb.cls}`}>{qb.label}</span>
                  </div>
                </div>
                <PBar pct={s} cls={scoreBarCls(s)} />

                {/* Analysis text */}
                {section?.analysis?.trim() && (
                  <p className="text-[11px] text-gray-400 leading-snug">{section.analysis}</p>
                )}

                {/* Strengths */}
                {(section?.strengths?.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold">Points forts</p>
                    {(section?.strengths ?? []).slice(0, 2).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-emerald-400 text-[10px] font-black shrink-0 mt-px">✓</span>
                        <span className="text-[11px] text-gray-400 leading-snug">{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Weaknesses */}
                {(section?.weaknesses?.length ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold">Points faibles</p>
                    {(section?.weaknesses ?? []).slice(0, 2).map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-red-400 text-[10px] font-black shrink-0 mt-px">×</span>
                        <span className="text-[11px] text-gray-400 leading-snug">{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Key reco */}
                {reco && (
                  <div className="mt-auto pt-3 border-t border-white/[0.06]">
                    <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold mb-1.5">Recommandation clé</p>
                    <p className="text-[11px] text-vn-violet/90 leading-snug">→ {reco}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ 4. STATS + VERDICT ═════════════════════════════════════════════ */}
      <div className={`grid grid-cols-1 ${hasMetrics ? 'md:grid-cols-2' : ''} border-b border-white/[0.07]`}>

        {/* Stats publiques */}
        {hasMetrics && (
          <div className="p-5 sm:p-6 md:border-r border-b md:border-b-0 border-white/[0.07]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">📈</span>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Stats publiques</p>
              </div>
              <span className="text-[9px] text-gray-600">{statsSource}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { label: 'Vues',         val: fmt(metrics.views)    },
                { label: 'Likes',        val: fmt(metrics.likes)    },
                { label: 'Commentaires', val: fmt(metrics.comments) },
                { label: 'Partages',     val: fmt(metrics.shares)   },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] px-3.5 py-3">
                  <p className="text-[9px] text-gray-500 mb-1">{label}</p>
                  <p className="text-[16px] font-black text-white leading-none">{val}</p>
                </div>
              ))}
            </div>
            {(meta?.durationSec || meta?.authorUsername) && (
              <div className="flex gap-2 mt-2">
                {meta?.durationSec && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                    <p className="text-[9px] text-gray-500 mb-0.5">Durée</p>
                    <p className="text-[13px] font-semibold text-white">{meta.durationSec}s</p>
                  </div>
                )}
                {meta?.authorUsername && (
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2 flex-1 min-w-0">
                    <p className="text-[9px] text-gray-500 mb-0.5">Auteur</p>
                    <p className="text-[13px] font-semibold text-white truncate">@{meta.authorUsername}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Verdict + benchmark */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-sm shrink-0">🏆</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Verdict final</p>
          </div>

          {/* Benchmark */}
          <div className="mb-3 rounded-xl bg-white/[0.04] border border-white/[0.08] p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[1.7rem] font-black leading-none tabular-nums ${compTxt}`}>Top {topPct}%</span>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                  <div className={`h-full rounded-full ${compGrad}`} style={{ width: `${barW}%` }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[8px] text-gray-600">Moyenne</span>
                  <span className="text-[8px] text-gray-600">Top créateurs</span>
                </div>
              </div>
            </div>
            {data.comparativeInsight && (
              <p className="text-[11px] text-gray-400 leading-snug">{data.comparativeInsight}</p>
            )}
          </div>

          {data.finalVerdict && (
            <div className="mb-3 rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
              <p className="text-[12px] text-gray-300 leading-relaxed">{data.finalVerdict}</p>
            </div>
          )}
          {data.comparativePriority && (
            <div className="mb-3 rounded-xl bg-vn-violet/[0.05] border border-vn-violet/[0.15] p-3">
              <p className="text-[11px] text-vn-violet/90 leading-snug">→ {data.comparativePriority}</p>
            </div>
          )}
          {typeof data.observedPerformanceScore === 'number' && (
            <div className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/[0.07] p-3.5">
              <div className="shrink-0">
                <p className="text-[9px] uppercase tracking-wide text-gray-600 font-bold mb-0.5">Performance</p>
                <p className="text-[22px] font-black text-white leading-none tabular-nums">{data.observedPerformanceScore}</p>
              </div>
              <p className="text-[11px] text-gray-500 leading-snug flex-1">{data.observedPerformanceLabel ?? 'Basé sur les stats'}</p>
            </div>
          )}
        </div>
      </div>

      {/* ══ 5. STRATÉGIE ═══════════════════════════════════════════════════ */}
      {data.strategy && (
        <div className="border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-vn-indigo/10 border border-vn-indigo/15 flex items-center justify-center text-sm shrink-0">🚀</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Stratégie recommandée</p>
          </div>
          <div className="rounded-xl bg-vn-violet/[0.05] border border-vn-violet/[0.15] p-4">
            <p className="text-[12px] text-gray-300 leading-relaxed">{data.strategy}</p>
          </div>
        </div>
      )}

      {/* ══ 6. INSIGHTS VIRAUX (Elite) ══════════════════════════════════════ */}
      {(data.viralTips?.length ?? 0) > 0 && (
        <div className="border-b border-white/[0.07] p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 rounded-lg bg-vn-fuchsia/10 border border-vn-fuchsia/15 flex items-center justify-center text-sm shrink-0">⚡</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Insights viraux</p>
            <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/15 text-vn-fuchsia border border-vn-fuchsia/20 uppercase tracking-wide">Elite</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(data.viralTips ?? []).map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-vn-fuchsia/[0.04] border border-vn-fuchsia/[0.10]">
                <span className="text-vn-fuchsia text-[11px] font-black shrink-0 w-4 pt-px">{i + 1}</span>
                <p className="text-[11px] text-gray-400 leading-snug">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ 7. CTA FINAL ════════════════════════════════════════════════════ */}
      <div className="p-5 sm:p-7">
        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-white mb-1">Prêt à améliorer ta prochaine vidéo\u00a0?</p>
            <p className="text-[11px] text-gray-500">Analyse une autre vidéo ou génère des hooks optimisés pour ton contenu.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 shrink-0 w-full sm:w-auto">
            {onReset ? (
              <button
                type="button"
                onClick={onReset}
                className="relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(232,121,249,0.4)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Analyser une autre vidéo
              </button>
            ) : (
              <Link href="/analyzer" className="relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_24px_-8px_rgba(232,121,249,0.4)]">
                Analyser une autre vidéo
              </Link>
            )}
            <Link
              href="/hook-generator"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-white/80 bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.08] hover:border-white/[0.18] active:scale-[0.98] transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              Générer des hooks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
