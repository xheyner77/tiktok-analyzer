'use client';

import Link from 'next/link';
import { getTrendHealth } from '@/lib/trends/trend-scoring';
import type { Trend } from '@/lib/trends/trend-types';
import { ActionButton, Badge, ScoreRing, SignalMetric, categoryLabels, difficultyLabels, effortLabels, healthStyles, stageLabels, stageStyles, verdictLabels, verdictStyles } from './trend-ui';

export function TrendDetailsPanel({ trend, onNotify }: { trend: Trend; onNotify: (message: string) => void }) {
  const health = getTrendHealth(trend);

  return (
    <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,15,30,0.96),rgba(3,7,18,0.99))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className={verdictStyles[trend.verdict]}>{verdictLabels[trend.verdict]}</Badge>
            <Badge className={stageStyles[trend.stage]}>{stageLabels[trend.stage]}</Badge>
          </div>
          <h2 className="mt-4 text-[24px] font-black tracking-[-0.045em] text-white">{trend.name}</h2>
          <p className="mt-2 text-[12px] leading-5 text-slate-400">{categoryLabels[trend.category]} · {trend.timeWindow.label}</p>
        </div>
        <ScoreRing score={trend.opportunityScore} label="final" size="sm" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <SignalMetric label="Volume" value={trend.volumeScore} tone="violet" />
        <SignalMetric label="Velocity" value={trend.velocityScore} tone="cyan" />
        <SignalMetric label="Accélération" value={trend.accelerationScore} tone="cyan" />
        <SignalMetric label="Saturation" value={trend.saturationScore} tone="rose" />
        <SignalMetric label="Nouveauté" value={trend.noveltyScore} tone="violet" />
        <SignalMetric label="Risque" value={trend.riskScore} tone={trend.riskScore > 70 ? 'rose' : 'amber'} />
      </div>

      <div className="mt-5 space-y-4">
        <div className={`rounded-[15px] border p-4 ${healthStyles[health.tone]}`}>
          <p className="text-[13px] font-black">{health.label}</p>
          <p className="mt-1 text-[12px] leading-5 opacity-80">{health.explanation}</p>
        </div>
        {[
          ['Résumé', trend.explanation],
          ['Pourquoi ça marche', trend.whyItWorks],
          ['Pourquoi maintenant', trend.whyNow],
          ['Niveau de saturation', trend.saturationReason],
        ].map(([title, body]) => (
          <div key={title}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">{title}</p>
            <p className="mt-2 text-[13px] leading-6 text-slate-300">{body}</p>
          </div>
        ))}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Signaux détectés</p>
          <div className="mt-2 space-y-2">
            {trend.signals.map((signal) => (
              <div key={signal.label} className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[12px] font-black text-white">{signal.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${signal.sentiment === 'positive' ? 'bg-emerald-300/[0.1] text-emerald-100' : signal.sentiment === 'negative' ? 'bg-rose-300/[0.1] text-rose-100' : 'bg-white/[0.06] text-slate-300'}`}>{signal.value}</span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{signal.explanation}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/70">Formats recommandés</p>
          <div className="mt-2 space-y-2">
            {trend.recommendedFormats.map((format) => (
              <div key={format.label} className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] p-3">
                <p className="text-[12px] font-black text-white">{format.label} · {format.duration}</p>
                <p className="mt-1 text-[11px] text-slate-500">Difficulté : {difficultyLabels[format.difficulty]}</p>
                <p className="mt-2 text-[11px] leading-4 text-slate-400">{format.why}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/70">Hooks prêts à utiliser</p>
          <div className="mt-2 space-y-2">
            {trend.hooks.slice(0, 3).map((hook, index) => (
              <button key={hook} type="button" onClick={() => onNotify(`Hook ${index + 1} prêt à réutiliser.`)} className="w-full rounded-[13px] border border-white/[0.07] bg-white/[0.035] p-3 text-left text-[12px] font-bold leading-5 text-white transition hover:border-cyan-200/18 hover:bg-white/[0.055]">
                {index + 1}. “{hook}”
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/70">Angles à tester</p>
          <div className="mt-2 space-y-2">
            {trend.angles.slice(0, 3).map((angle, index) => (
              <p key={angle} className="rounded-[13px] border border-white/[0.07] bg-white/[0.03] p-3 text-[12px] leading-5 text-slate-300">{index + 1}. {angle}</p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Plan d’action</p>
          <div className="mt-2 space-y-2">
            {trend.actionPlan.map((step) => (
              <div key={step.title} className="rounded-[13px] border border-white/[0.07] bg-white/[0.035] p-3">
                <p className="text-[12px] font-black text-white">{step.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{step.description}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Effort {effortLabels[step.effort]} · Priorité {effortLabels[step.priority]}</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/70">Erreurs à éviter</p>
          <div className="mt-2 grid gap-2">
            {trend.mistakesToAvoid.map((mistake) => (
              <span key={mistake} className="rounded-[12px] border border-amber-200/[0.1] bg-amber-300/[0.045] px-3 py-2 text-[12px] font-bold text-amber-50">{mistake}</span>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
          <Link href="/dashboard/analyze" className="inline-flex min-h-[40px] items-center justify-center rounded-[10px] border border-white/[0.085] bg-white/[0.045] px-4 text-[12px] font-black text-slate-200 transition hover:bg-white/[0.075] hover:text-white">
            Utiliser dans une analyse
          </Link>
          <ActionButton onClick={() => onNotify('Tendance sauvegardée.')}>Sauvegarder</ActionButton>
          <ActionButton tone="primary" onClick={() => onNotify('Tendance ajoutée au plan de contenu.')}>Ajouter au plan de contenu</ActionButton>
        </div>
      </div>
    </section>
  );
}
