import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAnalyses, getLatestAnalysisPreview } from '@/lib/analyses';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { canAccessTrendRadar } from '@/lib/feature-access';
import { getSession } from '@/lib/session';
import { getTikTokDashboardState } from '@/lib/tiktok-accounts';
import { trendRadarEngine } from '@/lib/trend-radar-engine';
import TrendRadarClient from '@/components/trend-radar/TrendRadarClient';

export const dynamic = 'force-dynamic';

export default async function RadarTendancesPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/radar');

  const user = await getUserById(session.userId);
  const plan = user ? getEffectivePlan(user) : 'free';
  if (!canAccessTrendRadar(plan)) {
    return <RadarLockedPage />;
  }

  const analyses = await getAnalyses(session.userId, plan);
  const latestPreview = analyses.length === 0 && (user?.analyses_count ?? 0) > 0
    ? await getLatestAnalysisPreview(session.userId)
    : null;
  const radarAnalyses = analyses.length > 0 ? analyses : latestPreview ? [latestPreview] : [];
  const tiktok = await getTikTokDashboardState(session.userId, plan);
  const radar = trendRadarEngine({ analyses: radarAnalyses, tiktok, plan });

  return (
    <TrendRadarClient
      opportunities={radar.opportunities}
      sourceLabel={radar.sourceLabel}
      hasPersonalData={radar.hasPersonalData}
      tiktok={tiktok}
      plan={plan}
    />
  );
}

function RadarLockedPage() {
  return (
    <main className="min-h-screen bg-[#020611] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(124,58,237,0.24),transparent_62%),radial-gradient(ellipse_60%_45%_at_100%_18%,rgba(34,211,238,0.13),transparent_58%)]" />
      <section className="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.026)_52%,rgba(34,211,238,0.07))] p-6 shadow-[0_34px_140px_-86px_rgba(124,58,237,0.95)] sm:p-9">
          <div className="max-w-2xl">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
              Disponible avec Pro et Scale
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">Radar Tendances</h1>
            <p className="mt-4 text-sm leading-relaxed text-gray-400 sm:text-base">
              Le Radar croise tes analyses, ta mémoire créateur et les patterns observés pour repérer les angles à tester. Cette couche de décision est réservée aux plans Pro et Scale.
            </p>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ['Hooks à tester', 'Angles priorisés selon tes analyses.'],
              ['Formats à pousser', 'Patterns utiles pour décider quoi publier.'],
              ['Reconstructions prioritaires', 'Vidéos à retravailler avec le meilleur opportunity score.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-vn-indigo px-5 text-sm font-black text-[#050508] transition hover:brightness-110">
              Débloquer le Radar
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
