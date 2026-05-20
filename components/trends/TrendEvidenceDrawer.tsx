'use client';

import type { TrendCluster } from '@/lib/trends/types';
import { stageLabel, verdictLabel, formatRelativeTime } from '@/lib/trends/formatters';

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-white/[0.07] bg-white/[0.04] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-[20px] font-black text-white">{value}</p>
    </div>
  );
}

export function TrendEvidenceDrawer({
  cluster,
  open,
  onClose,
  onNotify,
}: {
  cluster: TrendCluster | null;
  open: boolean;
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
  if (!open || !cluster) return null;

  return (
    <div className="fixed inset-0 z-[280] bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Preuves tendance"
        onClick={(event) => event.stopPropagation()}
        className="absolute right-0 top-0 h-full w-full max-w-[520px] overflow-y-auto border-l border-white/[0.09] bg-[linear-gradient(180deg,rgba(8,15,30,0.98),rgba(3,7,18,0.995))] p-5 text-white shadow-[-30px_0_90px_-50px_rgba(34,211,238,0.8)]"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-black text-slate-300">
          Fermer
        </button>

        <div className="pr-20">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Signal reel detecte</p>
          <h2 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.045em]">{cluster.title}</h2>
          <p className="mt-2 text-[13px] leading-6 text-slate-400">{cluster.recommendation.shortReason}</p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Score label="Final" value={cluster.scores.finalScore} />
          <Score label="Confiance" value={cluster.scores.confidenceScore} />
          <Score label="Saturation" value={cluster.scores.saturationScore} />
        </div>

        <div className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex flex-wrap gap-2 text-[11px] font-black">
            <span className="rounded-full bg-cyan-200/[0.1] px-2.5 py-1 text-cyan-100">{verdictLabel(cluster.recommendation.verdict)}</span>
            <span className="rounded-full bg-violet-200/[0.1] px-2.5 py-1 text-violet-100">{stageLabel(cluster.recommendation.stage)}</span>
            <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-slate-300">{formatRelativeTime(cluster.lastSeenAt)}</span>
          </div>
          <p className="mt-3 text-[12px] leading-5 text-slate-400">
            Base : {cluster.sampleSize} videos publiques · {cluster.uniqueCreators} createurs · {cluster.country} · provider Apify.
          </p>
          <p className="mt-2 text-[12px] leading-5 text-slate-400">
            Hashtags : {cluster.topHashtags.slice(0, 4).map((tag) => `#${tag}`).join(' ') || '-'}
          </p>
        </div>

        <details className="mt-4 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4" open>
          <summary className="cursor-pointer text-[13px] font-black">Hooks, angle, format</summary>
          <div className="mt-3 space-y-3 text-[13px] leading-6">
            <p><span className="font-black text-cyan-100">Hook :</span> {cluster.recommendation.recommendedHook}</p>
            <p><span className="font-black text-cyan-100">Angle :</span> {cluster.recommendation.recommendedAngle}</p>
            <p><span className="font-black text-cyan-100">Format :</span> {cluster.recommendation.recommendedFormat}</p>
          </div>
        </details>

        <details className="mt-3 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
          <summary className="cursor-pointer text-[13px] font-black">Exemples sources</summary>
          <div className="mt-3 space-y-2">
            {cluster.evidenceItems.slice(0, 3).map((item, index) => (
              <a
                key={`${cluster.id}-${index}`}
                href={item.sourceUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[12px] border border-white/[0.07] bg-black/20 p-3 text-[12px] leading-5 text-slate-300 transition hover:border-cyan-200/20"
              >
                <span className="font-black text-white">{item.hookText || item.caption.slice(0, 90)}</span>
                <span className="mt-1 block text-slate-500">{item.views.toLocaleString('fr-FR')} vues · {item.shares.toLocaleString('fr-FR')} partages</span>
              </a>
            ))}
          </div>
        </details>

        <details className="mt-3 rounded-[16px] border border-white/[0.08] bg-white/[0.035] p-4">
          <summary className="cursor-pointer text-[13px] font-black">Analyse et risque</summary>
          <div className="mt-3 space-y-2 text-[12px] leading-5 text-slate-400">
            <p>{cluster.recommendation.actionNow}</p>
            {cluster.recommendation.avoidReason && <p>Risque : {cluster.recommendation.avoidReason}</p>}
            {cluster.recommendation.twistSuggestion && <p>Detour : {cluster.recommendation.twistSuggestion}</p>}
          </div>
        </details>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {['Créer un script', 'Ajouter au plan', 'Sauvegarder'].map((label) => (
            <button key={label} onClick={() => onNotify(`${label} : action enregistree.`)} className="rounded-[12px] border border-white/[0.09] bg-white/[0.045] px-3 py-3 text-[12px] font-black text-white transition hover:bg-white/[0.07]">
              {label}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
