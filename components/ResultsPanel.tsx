'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnalysisResult, Improvement } from '@/lib/types';

interface ResultsPanelProps {
  data: AnalysisResult;
  plan: 'free' | 'pro' | 'elite';
}

/* ── Score color helpers ──────────────────────────────────────────────────── */

function gaugeColors(score: number) {
  if (score >= 80) return { grad1: '#34d399', grad2: '#6ee7b7', glow: 'rgba(52,211,153,0.55)',  text: 'text-emerald-400' };
  if (score >= 60) return { grad1: '#f59e0b', grad2: '#fbbf24', glow: 'rgba(251,191,36,0.55)',  text: 'text-amber-400'  };
  if (score >= 35) return { grad1: '#f97316', grad2: '#fb923c', glow: 'rgba(249,115,22,0.55)',  text: 'text-orange-400' };
  return                { grad1: '#f87171', grad2: '#fca5a5', glow: 'rgba(248,113,113,0.55)', text: 'text-red-400'    };
}

function scoreTextColor(s: number) {
  return s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
}

function scoreBarColor(s: number) {
  return s >= 70 ? 'bg-emerald-400' : s >= 40 ? 'bg-amber-400' : 'bg-red-400';
}

function qualityBadge(s: number) {
  if (s >= 70) return { label: 'Bon',   color: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/25' };
  if (s >= 40) return { label: 'Moyen', color: 'bg-amber-400/20  text-amber-300  border border-amber-400/25'  };
  return              { label: 'Faible', color: 'bg-red-500/20    text-red-300    border border-red-500/25'    };
}

function viralBadge(s: number) {
  if (s >= 80) return { label: 'Viral',           color: 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/25' };
  if (s >= 60) return { label: 'Potentiel',        color: 'bg-amber-400/15  text-amber-300  border border-amber-400/25'  };
  if (s >= 35) return { label: 'En progression',  color: 'bg-orange-400/15 text-orange-300 border border-orange-400/25' };
  return              { label: 'À améliorer',      color: 'bg-red-500/15    text-red-300    border border-red-500/25'    };
}

const PRIORITY_PC: Record<string, string> = {
  haute:   'bg-red-500/20   text-red-300   border border-red-500/25',
  moyenne: 'bg-amber-400/20 text-amber-300 border border-amber-400/25',
  basse:   'bg-blue-500/20  text-blue-300  border border-blue-500/25',
};

function getComparativeData(score: number) {
  if (score >= 85) return { pct: 3,  barGrad: 'bg-gradient-to-r from-emerald-500 to-emerald-400', txtCls: 'text-emerald-400' };
  if (score >= 70) return { pct: 10, barGrad: 'bg-gradient-to-r from-emerald-500 to-emerald-400', txtCls: 'text-emerald-400' };
  if (score >= 55) return { pct: 22, barGrad: 'bg-gradient-to-r from-amber-500 to-amber-400',     txtCls: 'text-amber-400'   };
  if (score >= 40) return { pct: 40, barGrad: 'bg-gradient-to-r from-amber-500 to-amber-400',     txtCls: 'text-amber-400'   };
  if (score >= 25) return { pct: 60, barGrad: 'bg-gradient-to-r from-red-500 to-red-400',         txtCls: 'text-red-400'     };
  return                  { pct: 78, barGrad: 'bg-gradient-to-r from-red-500 to-red-400',         txtCls: 'text-red-400'     };
}

/* ── Animated circular gauge ─────────────────────────────────────────────── */

function CircularGauge({ value, gColors }: { value: number; gColors: ReturnType<typeof gaugeColors> }) {
  const [anim, setAnim] = useState(0);
  useEffect(() => { const t = setTimeout(() => setAnim(value), 250); return () => clearTimeout(t); }, [value]);

  const size = 96, r = (size - 14) / 2, circ = 2 * Math.PI * r;
  const dash = circ * (anim / 100), gap = circ - dash;
  const id = `gg${value}`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#${id})`} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${gap}`}
        style={{ filter: `drop-shadow(0 0 6px ${gColors.glow})`, transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={gColors.grad1} />
          <stop offset="100%" stopColor={gColors.grad2} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ── Animated progress bar ───────────────────────────────────────────────── */

function PBar({ pct, colorCls }: { pct: number; colorCls: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 400); return () => clearTimeout(t); }, [pct]);
  return (
    <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
      <div className={`h-full rounded-full ${colorCls}`} style={{ width: `${w}%`, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

/* ── Quality badge ───────────────────────────────────────────────────────── */

function QBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

/* ── Section analysis card (right column) ───────────────────────────────── */

interface SectionData {
  score: number;
  rating?: string;
  analysis?: string;
  strengths?: string[];
  weaknesses?: string[];
}

function SectionCard({ title, section }: { title: string; section: SectionData }) {
  const s = section.score ?? 0;
  const qb = qualityBadge(s);

  useEffect(() => {
    console.log(`[DEBUG][SectionCard "${title}"] score:${s}`);
  }, [title, s]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-3 sm:p-4">
      {/* Header: title left, score + badge right — score always white like mockup */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-bold text-white">{title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[13px] font-black text-white tabular-nums">{s}</span>
          <QBadge label={qb.label} color={qb.color} />
        </div>
      </div>

      <PBar pct={s} colorCls={scoreBarColor(s)} />

      <div className="mt-2.5 space-y-1.5">
        {(section.strengths?.length ?? 0) > 0 && (
          <>
            <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold">Points forts</p>
            {(section.strengths ?? []).slice(0, 2).map((f, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-emerald-400 text-[10px] font-bold shrink-0">✓</span>
                <span className="text-[10px] text-gray-400">{f}</span>
              </div>
            ))}
          </>
        )}
        {(section.weaknesses?.length ?? 0) > 0 && (
          <>
            <p className="text-[8px] uppercase tracking-[0.18em] text-gray-600 font-bold pt-1">Points faibles</p>
            {(section.weaknesses ?? []).slice(0, 2).map((w, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-red-400 text-[10px] font-bold shrink-0">×</span>
                <span className="text-[10px] text-gray-400">{w}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Recommendations card (right column) ────────────────────────────────── */

function RecoCard({ improvements, plan }: { improvements: Improvement[]; plan: 'free' | 'pro' | 'elite' }) {
  const VISIBLE_FREE = 3;
  const visible = plan === 'free' ? improvements.slice(0, VISIBLE_FREE) : improvements;
  const locked  = plan === 'free' ? improvements.slice(VISIBLE_FREE) : [];

  useEffect(() => {
    console.log('[DEBUG][RecoCard] received', improvements.length, 'improvements');
  }, [improvements]);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-vn-fuchsia/20 border border-vn-fuchsia/30 flex items-center justify-center shrink-0">
          <span className="text-[9px] text-vn-fuchsia">✦</span>
        </span>
        <div>
          <p className="text-[11px] font-bold text-white leading-tight">Recommandations</p>
          <p className="text-[9px] text-gray-600">{improvements.length} conseil{improvements.length > 1 ? 's' : ''} personnalisé{improvements.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {visible.map((item, n) => {
          const pc = PRIORITY_PC[item.priority] ?? PRIORITY_PC.moyenne;
          return (
            <div key={n} className="flex gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-[10px] font-bold text-gray-600 shrink-0 w-3 pt-px">{n + 1}</span>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-300 leading-snug mb-1">{item.tip}</p>
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${pc}`}>
                  Priorité {item.priority}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {locked.length > 0 && (
        <div className="relative mt-2 pt-2 border-t border-white/[0.05]">
          <div className="space-y-1.5 blur-sm pointer-events-none select-none" aria-hidden>
            {locked.slice(0, 2).map((item, n) => (
              <div key={n} className="flex gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <span className="text-[10px] font-bold text-gray-600 shrink-0 w-3 pt-px">{VISIBLE_FREE + n + 1}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-300 leading-snug">{item.tip}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-vn-fuchsia/40 to-vn-indigo/40 blur-md opacity-70 group-hover:opacity-100 transition-all" aria-hidden />
              <Link href="/pricing" className="relative text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:brightness-110 transition-all">
                Débloquer {locked.length} conseils →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main ResultsPanel ───────────────────────────────────────────────────── */

export default function ResultsPanel({ data, plan }: ResultsPanelProps) {
  const structureScore = data.structureScore ?? data.viralityScore ?? 0;
  const viralScore     = typeof data.viralityScore === 'number' ? data.viralityScore : structureScore;

  const metrics = data.observedMetrics ?? {};
  const meta    = data.detectedVideoMeta;

  const gColors  = gaugeColors(viralScore);
  const vBadge   = viralBadge(viralScore);
  const { pct: topPct, barGrad: compBarGrad, txtCls: compTxtCls } = getComparativeData(structureScore);
  const barWidth = Math.max(4, 100 - topPct);

  const comparativeInsight  = data.comparativeInsight?.trim()  || null;
  const comparativePriority = data.comparativePriority?.trim() || null;

  const statsSource =
    data.observedStatsSource === 'cache'      ? 'Source : cache (TTL 6h)' :
    data.observedStatsSource === 'live_page'  ? 'Source : page TikTok'    :
    data.observedStatsSource === 'live_oembed'? 'Source : oEmbed'          :
    data.observedStatsSource === 'manual'     ? 'Saisie manuelle'          :
    'Stats partielles';

  const fmt = (v?: number) =>
    v == null ? '—' : new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  useEffect(() => {
    console.log('[DEBUG][ResultsPanel] plan:', plan, '| viralScore:', viralScore);
  }, [data, plan]);

  return (
    <div className="relative overflow-hidden bg-[#0d0d12] rounded-[1.1rem] sm:rounded-[1.3rem] ring-1 ring-white/[0.10] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_48px_120px_-30px_rgba(0,0,0,0.95)] text-white animate-fade-up">
      {/* Top shimmer line */}
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-10" aria-hidden />

      {/* ── Browser chrome ── */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] bg-[#0a0a0f] px-4 py-3 sm:px-5 sm:py-3.5 shrink-0">
        <div className="flex gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/90" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/90" />
        </div>
        <div className="flex-1 flex justify-center">
            <span className="text-[11px] text-gray-500 bg-white/[0.05] border border-white/[0.07] rounded-md px-4 py-1 font-medium tracking-tight">
                  app.viralynz.com · Analyse vidéo
                </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.analysisSource === 'vision_upload' && (
            <span className="hidden sm:flex text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/25 uppercase tracking-wide items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-vn-fuchsia" />
              Vision
            </span>
          )}
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.7)' }} />
          <span className="hidden sm:block text-[10px] text-emerald-400 font-bold uppercase tracking-[0.18em]">Terminé</span>
        </div>
      </div>

      {/* ── Two-column dashboard ── */}
      <div className="flex flex-col lg:flex-row min-h-0">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 p-4 sm:p-5 lg:border-r border-white/[0.05]">

          {/* Score de viralité */}
          <div className="rounded-xl border border-white/[0.1] bg-[#111118] p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Score de viralité</p>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-vn-fuchsia/20 text-vn-fuchsia border border-vn-fuchsia/25 uppercase tracking-wide">
                {data.analysisSource === 'vision_upload' ? 'Vision' : 'IA'}
              </span>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              {/* Circular gauge */}
              <div className="relative shrink-0">
                <CircularGauge value={viralScore} gColors={gColors} />
                <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                  <span
                    className={`text-[1.6rem] font-black leading-none tabular-nums ${gColors.text}`}
                    style={{ textShadow: `0 0 20px ${gColors.glow}` }}
                  >
                    {viralScore}
                  </span>
                  <span className="text-[9px] text-gray-500 font-medium">/100</span>
                </div>
              </div>

              {/* Structural detail */}
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.18em] text-gray-600 font-bold mb-2">Détail structurel</p>
                <div className="flex gap-2">
                  {[
                    { label: 'Hook',      val: data.hook?.score      ?? 0 },
                    { label: 'Montage',   val: data.editing?.score   ?? 0 },
                    { label: 'Rétention', val: data.retention?.score ?? 0 },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex-1 rounded-lg bg-white/[0.04] border border-white/[0.07] px-2 py-2 text-center">
                      <p className="text-[9px] text-gray-500 mb-0.5">{label}</p>
                      <p className={`text-base font-black leading-none tabular-nums ${scoreTextColor(val)}`}>{val}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <QBadge label={vBadge.label} color={vBadge.color} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats publiques + comparative */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111118] p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Stats publiques détectées</p>
              <span className="text-[9px] text-gray-600 font-medium">{statsSource}</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-2">
              {[
                { label: 'Vues',          val: fmt(metrics.views)    },
                { label: 'Likes',         val: fmt(metrics.likes)    },
                { label: 'Commentaires',  val: fmt(metrics.comments) },
                { label: 'Partages',      val: fmt(metrics.shares)   },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-2">
                  <p className="text-[8px] text-gray-500 mb-0.5">{label}</p>
                  <p className="text-[13px] font-black text-white leading-none">{val}</p>
                </div>
              ))}
            </div>

            {/* Meta row */}
            {(meta?.durationSec || meta?.authorUsername) && (
              <div className="flex gap-2 mb-3">
                {meta.durationSec && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5">
                    <p className="text-[8px] text-gray-500 mb-0.5">Durée</p>
                    <p className="text-[11px] font-semibold text-white">{meta.durationSec}s</p>
                  </div>
                )}
                {meta.authorUsername && (
                  <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2 py-1.5 flex-1 min-w-0">
                    <p className="text-[8px] text-gray-500 mb-0.5">Auteur</p>
                    <p className="text-[11px] font-semibold text-white truncate">@{meta.authorUsername}</p>
                  </div>
                )}
              </div>
            )}

            {/* Comparative inline */}
            <div className="mt-3 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
              <p className="text-[9px] uppercase tracking-[0.18em] text-gray-600 font-bold mb-1.5">Analyse comparative</p>

              <div className="flex items-center gap-2">
                <span className={`text-xl font-black leading-none shrink-0 ${compTxtCls}`}>
                  Top {topPct}%
                </span>
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                    <div className={`h-full rounded-full ${compBarGrad}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[8px] text-gray-600">Moyenne</span>
                    <span className="text-[8px] text-gray-600">Top cr&eacute;ateurs</span>
                  </div>
                </div>
              </div>
              {comparativeInsight && (
                <p className="text-[10px] text-gray-400 mt-2 leading-snug">{comparativeInsight}</p>
              )}
              {comparativePriority && (
                <p className="text-[10px] text-gray-500 mt-1 leading-snug">→ {comparativePriority}</p>
              )}
            </div>
          </div>

          {/* Synthèse — 3 cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <p className="text-[8px] uppercase tracking-wide text-gray-600 font-bold mb-1">Score de structure</p>
              <p className="text-[1.4rem] font-black text-white leading-none mb-1">{structureScore}</p>
              <p className="text-[9px] text-gray-500 leading-snug">Qualité hook, montage, rétention</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <p className="text-[8px] uppercase tracking-wide text-gray-600 font-bold mb-1">Performance observée</p>
              {typeof data.observedPerformanceScore === 'number' ? (
                <>
                  <p className="text-[1.4rem] font-black text-white leading-none mb-1">{data.observedPerformanceScore}</p>
                  <p className="text-[9px] text-gray-500 leading-snug">{data.observedPerformanceLabel ?? 'Basé sur les stats'}</p>
                </>
              ) : (
                <p className="text-[9px] text-gray-600 mt-1 leading-snug">Ajoute un lien TikTok pour ce score</p>
              )}
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <p className="text-[8px] uppercase tracking-wide text-gray-600 font-bold mb-1">Verdict final</p>
              <p className="text-[9px] text-gray-400 leading-snug mt-1 line-clamp-3">
                {data.finalVerdict ?? 'Voir les sections ci-dessous.'}
              </p>
            </div>
          </div>

          {/* Surperformance alert */}
          {data.overperformanceDetected && (
            <div className="rounded-xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.06] px-3 py-2.5">
              <p className="text-[11px] font-semibold text-vn-fuchsia/90">⚡ Surperformance détectée</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                La vidéo performe mieux que ce que sa structure prévoit. Optimise la structure pour reproduire ce niveau.
              </p>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="w-full lg:w-[260px] xl:w-[280px] shrink-0 flex flex-col gap-3 p-4 sm:p-5">

          {data.hook      && <SectionCard title="Analyse du Hook"       section={data.hook}      />}
          {data.editing   && <SectionCard title="Analyse du Montage"    section={data.editing}   />}
          {data.retention && <SectionCard title="Analyse de la Rétention" section={data.retention} />}

          {(data.improvements?.length ?? 0) > 0 && (
            <RecoCard improvements={data.improvements ?? []} plan={plan} />
          )}

          {/* Elite: Viral Tips */}
          {(data.viralTips?.length ?? 0) > 0 && (
            <div className="rounded-xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.05] p-3">
              <p className="text-[10px] font-bold text-vn-fuchsia/90 uppercase tracking-[0.15em] mb-2">Insights viraux</p>
              <ul className="space-y-1.5">
                {(data.viralTips ?? []).slice(0, 4).map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-vn-fuchsia text-[10px] font-black shrink-0">{i + 1}</span>
                    <p className="text-[10px] text-gray-400 leading-snug">{tip}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Elite: Strategy */}
          {data.strategy && (
            <div className="rounded-xl border border-vn-violet/20 bg-vn-violet/[0.06] p-3">
              <p className="text-[10px] font-bold text-vn-violet uppercase tracking-[0.15em] mb-2">Stratégie Elite</p>
              <p className="text-[10px] text-gray-400 leading-snug">
                {data.strategy.length > 240 ? data.strategy.slice(0, 240) + '\u2026' : data.strategy}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
