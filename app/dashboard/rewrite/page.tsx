import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAnalyses, getLatestAnalysisPreview, type AnalysisRow } from '@/lib/analyses';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function analysisTitle(row: AnalysisRow): string {
  return cleanText(row.result.detectedVideoMeta?.caption)
    ?? cleanText(row.result.analyzerMeta?.fileName)
    ?? cleanText(row.result.coachAnalysis?.shareables?.screenshotTitle)
    ?? `Analyse du ${formatDate(row.created_at)}`;
}

function primaryDecision(row: AnalysisRow): string | null {
  return cleanText(row.result.coachAnalysis?.priorityActions?.critical?.[0])
    ?? cleanText(row.result.coachAnalysis?.priorityActions?.important?.[0])
    ?? cleanText(row.result.actionPlan?.[0])
    ?? cleanText(row.result.finalVerdict);
}

function rewriteHook(row: AnalysisRow): string | null {
  return cleanText(row.result.repostVersion?.hook)
    ?? cleanText(row.result.coachAnalysis?.hookVariants?.[0])
    ?? cleanText(row.result.reconstructionIA?.alternativeHooks?.[0]?.hook);
}

export default async function DashboardRewritePage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/rewrite');

  const profile = await getUserById(session.userId);
  const plan = getEffectivePlan(profile ?? { plan: 'free' });
  const analyses = plan === 'free'
    ? [await getLatestAnalysisPreview(session.userId)].filter((row): row is AnalysisRow => Boolean(row))
    : await getAnalyses(session.userId, plan);
  const candidates = analyses
    .filter((row) => primaryDecision(row) || rewriteHook(row))
    .slice(0, 6);

  return (
    <section className="mx-auto w-full max-w-[1040px] pb-10 text-white">
      <header className="rounded-[22px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(88,28,135,0.24),rgba(5,10,23,0.96)_48%,rgba(6,182,212,0.10))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Rewrite / V2</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">Transforme un diagnostic réel en V2</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300 sm:text-[15px]">
          Viralynz reprend uniquement les décisions issues de tes analyses : quoi couper, quoi avancer et quel hook retester.
        </p>
      </header>

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-[22px] border border-dashed border-violet-300/20 bg-white/[0.03] px-5 py-12 text-center sm:px-8">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.08] text-xl" aria-hidden>↗</div>
          <h2 className="mt-5 text-xl font-black">Aucune V2 à préparer</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
            Lance une analyse vidéo. Les hooks et décisions affichés ici viendront du diagnostic enregistré, jamais d’un exemple inventé.
          </p>
          <Link href="/dashboard/analyze" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 text-sm font-black text-white transition hover:brightness-110">
            Analyser une vidéo
          </Link>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {candidates.map((row) => {
            const hook = rewriteHook(row);
            const decision = primaryDecision(row);
            return (
              <article key={row.id} className="flex min-w-0 flex-col rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,17,33,0.95),rgba(5,9,19,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-violet-200/70">Analyse réelle</p>
                  <time className="text-xs font-semibold text-slate-500">{formatDate(row.created_at)}</time>
                </div>
                <h2 className="mt-3 line-clamp-2 text-lg font-black leading-6">{analysisTitle(row)}</h2>
                <div className="mt-4 flex-1 space-y-3">
                  <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Décision prioritaire</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">{decision ?? 'Décision non disponible dans cette analyse.'}</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.055] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100/70">Hook V2</p>
                    <p className="mt-2 text-base font-black leading-6 text-white">{hook ? `« ${hook} »` : 'Hook V2 non disponible.'}</p>
                  </div>
                </div>
                <Link href={`/analyses/${encodeURIComponent(row.id)}#v2-recommandee`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 text-sm font-black text-violet-50 transition hover:border-violet-200/35 hover:bg-violet-400/15">
                  Ouvrir le plan de remontage
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
