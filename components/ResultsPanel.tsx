'use client';

import { useEffect } from 'react';
import { AnalysisResult } from '@/lib/types';
import ScoreRing from './ScoreRing';
import AnalysisCard from './AnalysisCard';
import ImprovementTips from './ImprovementTips';

interface ResultsPanelProps {
  data: AnalysisResult;
  plan: 'free' | 'pro' | 'elite';
}

// ── Comparative analysis helpers ──────────────────────────────────────────────

interface ComparativeData {
  topPercent: number;
  comparison: string;
  gap: string;
  barColor: string;
}

function getComparativeData(score: number): ComparativeData {
  if (score >= 85) {
    return {
      topPercent: 3,
      comparison:
        'Ton contenu rivalise avec les vidéos virales les plus performantes. Hook instantané, montage dynamique et rétention maximale : tu coches les cases que l\'algorithme TikTok récompense.',
      gap: 'À ce niveau, l\'axe restant est la régularité : les créateurs dans ce percentile publient 5-7 fois par semaine pour maintenir la pression algorithmique.',
      barColor: '#22c55e',
    };
  }
  if (score >= 70) {
    return {
      topPercent: 10,
      comparison:
        'Ta vidéo performe nettement au-dessus de la moyenne. Les vidéos virales dans ta niche partagent un point commun : elles déclenchent une action (commentaire, partage) dans les 5 dernières secondes — ce qui manque encore ici.',
      gap: 'Le différentiel avec le top 3% tient souvent à un seul élément : un CTA final qui polarise ("Commente si tu as vécu ça") plutôt qu\'un appel générique.',
      barColor: '#22c55e',
    };
  }
  if (score >= 55) {
    return {
      topPercent: 22,
      comparison:
        'Tu es dans la moyenne haute, mais les vidéos virales de ta catégorie ont en moyenne 2× plus de cuts dans les 10 premières secondes et un hook résolu avant la 3ème seconde.',
      gap: 'Le principal gap : ton taux de complétion estimé (~45-55%) ne déclenche pas encore la distribution large. TikTok pousse massivement au-delà de 65% de complétion.',
      barColor: '#f59e0b',
    };
  }
  if (score >= 40) {
    return {
      topPercent: 40,
      comparison:
        'Tu es dans la moyenne. Les vidéos virales dans ta niche ont un score de viralité moyen de 72 — soit +' +
        (72 - score) +
        ' points au-dessus du tien. La différence principale : leur première frame force l\'arrêt du scroll.',
      gap: 'Ce qui te sépare du top : l\'absence d\'un élément de curiosité non résolu dans les 3 premières secondes. Le viewer doit se demander "mais comment ?" avant même que tu expliques.',
      barColor: '#f59e0b',
    };
  }
  if (score >= 25) {
    return {
      topPercent: 60,
      comparison:
        'Ta vidéo est sous la moyenne de distribution. Les créateurs viraux dans cette niche génèrent en moyenne 3× plus d\'engagement grâce à un montage rythmé (coupe toutes les 2-3s) et une accroche choc dès le départ.',
      gap: 'Priorité absolue : reconstruire les 3 premières secondes avec une déclaration contre-intuitive ou un visuel surprenant. C\'est le seul levier qui peut changer radicalement ta distribution.',
      barColor: '#ef4444',
    };
  }
  return {
    topPercent: 78,
    comparison:
      'Le contenu est en dessous du seuil de distribution algorithmique. Les vidéos virales TikTok ont en commun un taux de complétion > 60% — ici, la structure actuelle génère vraisemblablement moins de 25%.',
    gap: 'Cette vidéo nécessite une refonte complète : hook, rythme de montage et structure narrative. Les recommandations ci-dessous sont classées par impact décroissant.',
    barColor: '#ef4444',
  };
}

const HookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4zm10.5 5.707a.5.5 0 0 0 0-.707l-3.5-3.5a.5.5 0 0 0-.707 0L7 6.793 5.854 5.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0L8.5 6.707l3.293 3.293a.5.5 0 0 0 .707 0z" clipRule="evenodd" />
  </svg>
);

const EditingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.262a1.75 1.75 0 0 0 0-2.474Z" />
    <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
  </svg>
);

const RetentionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
    <path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v1.5a.75.75 0 0 1-1.5 0V3.5h-11v9h3.75a.75.75 0 0 1 0 1.5H2a1 1 0 0 1-1-1V3Z" />
    <path d="M13 9.75a.75.75 0 0 0-1.5 0v1.69l-.47-.47a.75.75 0 0 0-1.06 1.06l1.75 1.75a.75.75 0 0 0 1.06 0l1.75-1.75a.75.75 0 1 0-1.06-1.06l-.47.47V9.75Z" />
  </svg>
);

export default function ResultsPanel({ data, plan }: ResultsPanelProps) {
  const structureScore = data.structureScore ?? data.viralityScore ?? 0;
  /** Score global crédible (structure + stats réelles) — ne pas confondre avec le score de structure seul */
  const viralScore =
    typeof data.viralityScore === 'number' ? data.viralityScore : structureScore;

  const metrics = data.observedMetrics ?? {};
  const meta = data.detectedVideoMeta;

  const formatNumber = (value?: number) => {
    if (value == null) return 'N/A';
    return new Intl.NumberFormat('fr-FR', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  useEffect(() => {
    console.log('[DEBUG][ResultsPanel] props received — plan:', plan);
    console.log('[DEBUG][ResultsPanel] full data object:', data);

    if (data == null) {
      console.error('[DEBUG][ResultsPanel] data is null or undefined!');
      return;
    }

    // Vérification des sections requises
    (['hook', 'editing', 'retention'] as const).forEach((key) => {
      if (!data[key]) {
        console.error(`[DEBUG][ResultsPanel] data.${key} is MISSING:`, data[key]);
      } else {
        const s = data[key];
        if (typeof s.score !== 'number')
          console.error(`[DEBUG][ResultsPanel] data.${key}.score is not a number:`, s.score);
        if (!s.rating)
          console.error(`[DEBUG][ResultsPanel] data.${key}.rating is missing:`, s.rating);
        if (!Array.isArray(s.strengths))
          console.error(`[DEBUG][ResultsPanel] data.${key}.strengths is not an array:`, s.strengths);
        if (!Array.isArray(s.weaknesses))
          console.error(`[DEBUG][ResultsPanel] data.${key}.weaknesses is not an array:`, s.weaknesses);
      }
    });

    // Vérification improvements
    if (!Array.isArray(data.improvements)) {
      console.error('[DEBUG][ResultsPanel] data.improvements is not an array:', data.improvements);
    } else {
      const VALID = ['haute', 'moyenne', 'basse'];
      data.improvements.forEach((imp, i) => {
        if (!VALID.includes(imp.priority)) {
          console.error(
            `[DEBUG][ResultsPanel] improvements[${i}].priority INVALID:`,
            imp.priority,
            '— expected: haute | moyenne | basse'
          );
        }
      });
      console.log('[DEBUG][ResultsPanel] improvements priorities:',
        data.improvements.map(i => i.priority)
      );
    }

    // Vérifications optionnelles
    if (typeof data.viralityScore !== 'number') {
      console.error('[DEBUG][ResultsPanel] viralityScore is not a number:', data.viralityScore);
    }
  }, [data, plan]);

  return (
    <div className="space-y-8 animate-fade-up min-w-0">
      {/* 1 — Hero : score de viralité (priorité visuelle) */}
      <div className="gradient-border rounded-2xl p-5 sm:p-7 card-glow">
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Score de viralité
          </p>
          <p className="text-[11px] text-gray-600 mt-1.5 max-w-md">
            Score global combinant analyse structurelle et signaux de performance réels (vues, engagement).
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-8 lg:gap-12 xl:gap-16">
          <div className="flex justify-center shrink-0">
            <ScoreRing score={viralScore} size={176} strokeWidth={10} />
          </div>

          <div className="flex-1 w-full max-w-xl mx-auto lg:mx-0">
            <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-3 text-center lg:text-left">
              Détail structurel
            </p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Hook', score: data.hook?.score ?? 0 },
                { label: 'Montage', score: data.editing?.score ?? 0 },
                { label: 'Rétention', score: data.retention?.score ?? 0 },
              ].map(({ label, score }) => (
                <div
                  key={label}
                  className="bg-[#0e0e0e] rounded-xl p-3 sm:p-3.5 text-center border border-[#1a1a1a]"
                >
                  <p className="text-[10px] sm:text-xs text-gray-500 mb-1">{label}</p>
                  <p
                    className="text-base sm:text-lg font-bold tabular-nums"
                    style={{
                      color:
                        score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {score}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2 — Synthèse rapide */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-0.5">
          Synthèse
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-[#1a1a1a] bg-[#101010] p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Score de structure</p>
            <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">{structureScore}</p>
            <p className="text-[10px] text-gray-600 mt-2 leading-snug">
              Qualité perçue du hook, du montage et de la rétention.
            </p>
          </div>
          <div className="rounded-xl border border-[#1a1a1a] bg-[#101010] p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Performance observée</p>
            <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
              {typeof data.observedPerformanceScore === 'number'
                ? `${data.observedPerformanceScore}`
                : '—'}
              {typeof data.observedPerformanceScore === 'number' && (
                <span className="text-sm font-semibold text-gray-500">/100</span>
              )}
            </p>
            {data.observedPerformanceLabel && (
              <p className="text-[11px] text-gray-500 mt-1.5">{data.observedPerformanceLabel}</p>
            )}
            {typeof data.observedPerformanceScore !== 'number' && (
              <p className="text-[10px] text-gray-600 mt-2">Stats non disponibles pour ce lien.</p>
            )}
          </div>
          <div className="rounded-xl border border-[#1a1a1a] bg-[#101010] p-4 sm:col-span-1">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider">Verdict final</p>
            <p className="text-sm text-gray-300 mt-2 leading-relaxed">
              {data.finalVerdict ?? 'Verdict indisponible'}
            </p>
          </div>
        </div>
      </section>

      {/* 3 — Stats publiques */}
      <section className="rounded-2xl border border-[#1a1a1a] bg-[#101010] p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-gray-500 uppercase tracking-wider">Stats publiques détectées</p>
          <span className="text-[10px] text-gray-600">
            {data.observedStatsSource === 'cache' ? 'Source: cache (TTL 6h)' :
             data.observedStatsSource === 'live_page' ? 'Source: page TikTok' :
             data.observedStatsSource === 'live_oembed' ? 'Source: oEmbed (partiel)' :
             data.observedStatsSource === 'manual' ? 'Source: saisie manuelle' :
             'Partielles / indisponibles'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Vues', value: formatNumber(metrics.views) },
            { label: 'Likes', value: formatNumber(metrics.likes) },
            { label: 'Commentaires', value: formatNumber(metrics.comments) },
            { label: 'Partages', value: formatNumber(metrics.shares) },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-[#1c1c1c] bg-[#121212] px-3 py-2">
              <p className="text-[10px] text-gray-500">{m.label}</p>
              <p className="text-sm font-semibold text-white">{m.value}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          <div className="rounded-lg border border-[#1c1c1c] bg-[#121212] px-3 py-2">
            <p className="text-[10px] text-gray-500">Favoris</p>
            <p className="text-xs text-gray-300">{formatNumber(meta?.favorites)}</p>
          </div>
          <div className="rounded-lg border border-[#1c1c1c] bg-[#121212] px-3 py-2">
            <p className="text-[10px] text-gray-500">Durée</p>
            <p className="text-xs text-gray-300">{meta?.durationSec ? `${meta.durationSec}s` : 'N/A'}</p>
          </div>
          <div className="rounded-lg border border-[#1c1c1c] bg-[#121212] px-3 py-2">
            <p className="text-[10px] text-gray-500">Auteur</p>
            <p className="text-xs text-gray-300 truncate">{meta?.authorUsername ? `@${meta.authorUsername}` : 'N/A'}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
          <span>Publication: {meta?.publishedAt ? new Date(meta.publishedAt).toLocaleDateString('fr-FR') : 'N/A'}</span>
          {meta?.caption && <span className="truncate max-w-full">Caption: {meta.caption}</span>}
        </div>
        {data.unavailableObservedStats && data.unavailableObservedStats.length > 0 && (
          <p className="mt-2 text-[11px] text-gray-600">
            Stats non disponibles: {data.unavailableObservedStats.join(', ')}
          </p>
        )}
      </section>

      {data.overperformanceDetected && (
        <div className="rounded-xl border border-[#ff0050]/25 bg-gradient-to-r from-[#1a0b13] to-[#130c1f] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-[#ff6080]">🔥</span>
            <p className="text-sm font-semibold text-[#ff6f95]">Surperformance détectée</p>
          </div>
          <p className="text-xs text-gray-300 mt-1">
            La vidéo performe mieux que ce que sa structure laisse prévoir. Bon signal produit/audience; optimise la structure pour reproduire ce niveau.
          </p>
        </div>
      )}

      {/* 4 — Analyse comparative (basée sur le score de structure) */}
      {(() => {
        const { topPercent, comparison, gap, barColor } = getComparativeData(structureScore);
        const barWidth = Math.max(4, 100 - topPercent);
        return (
          <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Analyse comparative
            </h2>

            {/* Top % highlight — stack on narrow screens to avoid squeeze */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
              <div className="shrink-0 text-center sm:text-left">
                <p className="text-3xl font-black" style={{ color: barColor }}>
                  Top {topPercent}%
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider">
                  des créateurs TikTok
                </p>
              </div>

              {/* Progress bar */}
              <div className="flex-1 min-w-0 w-full">
                <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-700">Moyenne</span>
                  <span className="text-[10px] text-gray-700">Top créateurs</span>
                </div>
              </div>
            </div>

            {/* Text insights */}
            <div className="space-y-2.5 pt-1 border-t border-[#1a1a1a] min-w-0">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-1 shrink-0 text-green-500 text-xs">✓</span>
                <p className="text-sm text-gray-300 leading-relaxed min-w-0 break-words">{comparison}</p>
              </div>
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-1 shrink-0 text-[#ff0050] text-xs">→</span>
                <p className="text-sm text-gray-400 leading-relaxed min-w-0 break-words">{gap}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5 — Analyse détaillée */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-0.5">
          Analyse détaillée
        </h2>

        {data.hook && (
          <AnalysisCard
            title="Analyse du Hook"
            icon={<HookIcon />}
            data={data.hook}
            delay={100}
          />
        )}
        {data.editing && (
          <AnalysisCard
            title="Analyse du Montage"
            icon={<EditingIcon />}
            data={data.editing}
            delay={200}
          />
        )}
        {data.retention && (
          <AnalysisCard
            title="Analyse de la Rétention"
            icon={<RetentionIcon />}
            data={data.retention}
            delay={300}
          />
        )}
      </div>

      {/* 6 — Recommandations */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-0.5">
          Recommandations
        </h2>
        <ImprovementTips improvements={data.improvements ?? []} plan={plan} />
      </div>

      {/* Viral Tips — Elite only */}
      {data.viralTips && data.viralTips.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">
            Ce que font les vidéos virales
          </h2>
          <div
            className="rounded-2xl p-5 card-glow"
            style={{
              background:
                'linear-gradient(#0a0d14, #0a0d14) padding-box, linear-gradient(135deg, #ff0050, #7928ca) border-box',
              border: '1px solid transparent',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-[#ff0050]/15 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-[#ff0050]">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-[#ff6080] uppercase tracking-wider">
                Insights viraux — Plan Elite
              </span>
            </div>
            <ul className="space-y-3">
              {data.viralTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#ff0050]/15 flex items-center justify-center text-[10px] font-bold text-[#ff6080] mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-300 leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Strategy — Elite only */}
      {data.strategy && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest px-1">
            Stratégie personnalisée
          </h2>
          <div
            className="rounded-2xl p-5 card-glow"
            style={{
              background:
                'linear-gradient(#0d0a14, #0d0a14) padding-box, linear-gradient(135deg, #7928ca, #ff0050) border-box',
              border: '1px solid transparent',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#7928ca]/20 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-[#b060ff]">
                  <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-[#b060ff] uppercase tracking-wider">
                Plan Elite
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {data.strategy}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
