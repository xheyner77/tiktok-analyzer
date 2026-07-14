import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import CopyHookButton from '@/components/analysis-detail/CopyHookButton';
import {
  getAnalysisDetailData,
  type AnalysisCriterionDetail,
  type AnalysisDetailData,
  type AnalysisDiagnostic,
  type AnalysisMoment,
  type AnalysisSectionDetail,
  type EditingDecision,
  type GroundedV2Item,
  type RecommendedV2Step,
} from '@/lib/analysis-detail-data';

export const dynamic = 'force-dynamic';

const pageBg = 'min-h-screen overflow-x-hidden bg-[#020611] text-white';
const shell = 'relative overflow-hidden rounded-[24px] border border-white/[0.085] bg-[linear-gradient(180deg,rgba(12,18,34,0.92),rgba(3,7,18,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_34px_110px_-72px_rgba(0,0,0,0.95)]';
const card = 'relative overflow-hidden rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,17,32,0.88),rgba(4,8,18,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_26px_90px_-64px_rgba(0,0,0,0.96)]';
const eyebrow = 'text-[11px] font-black uppercase tracking-[0.18em] text-violet-200/80';
const primaryButton = 'inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-5 text-sm font-black text-white shadow-[0_24px_70px_-34px_rgba(168,85,247,0.95)] transition hover:brightness-110';
const secondaryButton = 'inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.055] px-5 text-sm font-bold text-slate-200 transition hover:border-cyan-200/20 hover:bg-white/[0.085] hover:text-white';

function transparencyBadgeClass(level: AnalysisDetailData['transparency']['level']) {
  if (level === 'real') return 'border-emerald-300/22 bg-emerald-400/12 text-emerald-100';
  if (level === 'partial') return 'border-amber-300/22 bg-amber-300/12 text-amber-100';
  if (level === 'estimated') return 'border-cyan-300/18 bg-cyan-300/10 text-cyan-100';
  return 'border-orange-300/22 bg-orange-400/12 text-orange-100';
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getAnalysisDetailData(id);

  if (result.status === 'unauthenticated') {
    redirect(`/login?redirect=/analyses/${encodeURIComponent(id)}`);
  }

  if (result.status === 'not_found' || result.status === 'forbidden') {
    notFound();
  }

  if (!result.data) {
    notFound();
  }

  return <AnalysisDetailView analysis={result.data} />;
}

function AnalysisDetailView({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <main className={pageBg}>
      <div className="pointer-events-none fixed inset-0 opacity-45 [background-image:linear-gradient(rgba(139,92,246,.075)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.075)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.25),rgba(2,6,17,0)_68%)]" />
      <div className="pointer-events-none fixed inset-y-0 right-0 w-[42vw] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.08),rgba(2,6,17,0)_64%)]" />

      <div className="relative mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <Hero analysis={analysis} />

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <Timeline moments={analysis.keyMoments} />
          <Diagnostics diagnostics={analysis.diagnostics} />
        </section>

        <AnalysisSections sections={analysis.analysisSections} />

        <RecommendedV2 analysis={analysis} />
        <ImprovedVersionWorkspace analysis={analysis} />

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <EditingDecisions decisions={analysis.editingDecisions} />
          <HooksSection analysis={analysis} />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <CtaCard analysis={analysis} />
          <RepostPlan analysis={analysis} />
        </section>

        <FooterActions analysis={analysis} />
      </div>
    </main>
  );
}

function Hero({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <header className={`${shell} p-4 sm:p-5 lg:p-6`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(232,121,249,0.18),transparent_30%),radial-gradient(circle_at_84%_12%,rgba(34,211,238,0.13),transparent_32%)]" />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/dashboard" className="inline-flex h-10 w-fit items-center rounded-xl border border-white/[0.10] bg-black/25 px-4 text-xs font-bold text-slate-300 transition hover:border-violet-200/20 hover:bg-white/[0.06] hover:text-white">
            Retour au dashboard
          </Link>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${transparencyBadgeClass(analysis.transparency.level)}`}>
              {analysis.transparency.label}
            </span>
            {typeof analysis.transparency.confidenceScore === 'number' && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-3 py-1 text-[11px] font-bold text-slate-300">
                Confiance {Math.round(analysis.transparency.confidenceScore)}/100
              </span>
            )}
            <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-bold text-cyan-100">{analysis.sourceLabel}</span>
          </div>
        </div>

        {analysis.transparency.warning && (
          <div className="rounded-2xl border border-amber-300/18 bg-amber-300/[0.06] px-4 py-3 text-sm font-semibold leading-6 text-amber-50">
            {analysis.transparency.warning}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)_360px]">
          <VideoPreview analysis={analysis} />
          <HeroSummary analysis={analysis} />
          <HeroDecision analysis={analysis} />
        </div>
      </div>
    </header>
  );
}

function VideoPreview({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <article className="relative mx-auto w-full max-w-[330px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#050816] shadow-[0_28px_90px_-44px_rgba(168,85,247,0.85)]">
        {analysis.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={analysis.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(232,121,249,0.45),transparent_28%),radial-gradient(circle_at_80%_42%,rgba(6,182,212,0.24),transparent_30%),linear-gradient(145deg,rgba(88,28,135,0.62),rgba(4,8,18,0.92)_48%,rgba(6,182,212,0.20))]" />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,17,0.08),rgba(2,6,17,0.36)_45%,rgba(2,6,17,0.92))]" />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="rounded-full border border-white/[0.16] bg-black/35 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/90">
            Analyse vidéo
          </span>
          <span className="rounded-full border border-cyan-200/20 bg-cyan-300/12 px-3 py-1 text-[11px] font-black text-cyan-100">
            {analysis.duration}
          </span>
        </div>
        {!analysis.thumbnailUrl && (
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.14] bg-black/42 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 shadow-[0_0_50px_rgba(232,121,249,0.24)]">
            Aperçu indisponible
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-300/80">{analysis.niche}</p>
              <h2 className="mt-2 line-clamp-3 text-xl font-black leading-tight tracking-[-0.025em] text-white">{analysis.title}</h2>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-violet-200/25 bg-violet-400/18 text-2xl font-black text-white">
              {analysis.score ?? '—'}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PreviewSignal label="Hook" value={analysis.diagnostics[0]?.score ?? null} />
            <PreviewSignal label="Preuve" value={analysis.diagnostics[3]?.score ?? null} />
            <PreviewSignal label="CTA" value={analysis.diagnostics[4]?.score ?? null} />
          </div>
        </div>
      </div>
      {analysis.videoUrl ? (
        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Source</p>
          {analysis.videoUrl.startsWith('http') ? (
            <a href={analysis.videoUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-semibold text-cyan-200 transition hover:text-white">
              {analysis.videoUrl}
            </a>
          ) : (
            <p className="mt-1 truncate text-xs font-semibold text-slate-300">{analysis.videoUrl}</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function HeroSummary({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <section className="flex min-w-0 flex-col justify-between rounded-[22px] border border-white/[0.075] bg-white/[0.035] p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={eyebrow}>{analysis.transparency.label}</span>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[11px] font-bold text-slate-300">{analysis.createdAt}</span>
        </div>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl">
          Ton diagnostic vidéo, sans métrique inventée.
        </h1>
        <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-200">{analysis.verdict}</p>
        <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-400">{analysis.summary}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <MetaItem label="Objectif" value={analysis.objective} />
        <MetaItem label="Format détecté" value={analysis.formatLabel} />
        <MetaItem label="Durée" value={analysis.duration} />
        <MetaItem label="Niche" value={analysis.niche} />
      </div>
    </section>
  );
}

function HeroDecision({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <aside className="rounded-[22px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(88,28,135,0.28),rgba(7,13,29,0.88))] p-5 sm:p-6">
      <p className={eyebrow}>Décision Viralynz</p>
      <div className="mt-5 flex items-center gap-5">
        <ScoreDial score={analysis.score} />
        <div>
          <p className="text-2xl font-black tracking-[-0.035em] text-white">{analysis.scoreLevel}</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{analysis.scoreExplanation}</p>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.065] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100/80">À faire maintenant</p>
        <p className="mt-2 text-lg font-black leading-7 text-white">{primaryDecision(analysis)}</p>
      </div>
      <div className="mt-5 grid gap-3">
        <Link href={analysis.prepareHref} className={primaryButton}>
          Préparer ma V2
        </Link>
        <Link href={analysis.hooksHref} className={secondaryButton}>
          Générer 5 hooks
        </Link>
      </div>
    </aside>
  );
}

function Timeline({ moments }: { moments: AnalysisMoment[] }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Risques éditoriaux</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Carte des risques éditoriaux</h2>
        </div>
        <p className="max-w-xs text-sm leading-6 text-slate-400">Chaque timestamp vient du diagnostic enregistré. Ce n’est pas une courbe de rétention mesurée.</p>
      </div>
      {moments.length === 0 ? (
        <div className="mt-6 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.025] p-5 text-sm leading-6 text-slate-400">
          Aucun timestamp fiable n’est disponible dans cette analyse. Viralynz n’invente pas de moment de drop.
        </div>
      ) : null}
      <div className="relative mt-6 space-y-4">
        <div className="absolute bottom-5 left-[38px] top-5 hidden w-px bg-gradient-to-b from-violet-300/40 via-cyan-300/20 to-transparent md:block" />
        {moments.map((moment, index) => (
          <article key={`${moment.time}-${moment.title}`} className="relative grid gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-4 md:grid-cols-[78px_1fr]">
            <div className="relative">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-violet-200/18 bg-violet-400/14 text-xs font-black text-violet-100">{moment.time}</span>
              <span className="mt-3 hidden text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 md:block">Point {index + 1}</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-white">{moment.title}</h3>
                <SeverityBadge severity={moment.severity} />
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                <InsightBlock label="Problème" body={moment.diagnostic} />
                <InsightBlock label="Correction" body={moment.correction} accent />
              </div>
              {(moment.transcript || moment.observation || moment.objectiveFit || moment.example || moment.evidence?.length || moment.frameUrl) ? (
                <details className="group mt-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-black/18">
                  <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black uppercase tracking-[0.13em] text-cyan-100 marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      Ouvrir les preuves du segment
                      <span aria-hidden className="text-lg font-medium text-slate-500 transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <div className="grid gap-3 border-t border-white/[0.06] p-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                    <div>
                      {moment.frameUrl ? (
                        <div
                          role="img"
                          aria-label={`Frame observée pour le segment ${moment.time}`}
                          className="aspect-video w-full rounded-xl border border-white/[0.08] bg-slate-950 bg-cover bg-center"
                          style={{ backgroundImage: `url(${moment.frameUrl})` }}
                        />
                      ) : (
                        <div className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-white/[0.10] bg-slate-950/70 px-4 text-center text-xs text-slate-500">
                          Frame indisponible pour ce segment.
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {moment.nature ? <span className="rounded-full border border-white/[0.08] px-2.5 py-1">{moment.nature}</span> : null}
                        {moment.confidence ? <span className="rounded-full border border-white/[0.08] px-2.5 py-1">Confiance {moment.confidence}</span> : null}
                      </div>
                    </div>
                    <div className="min-w-0 space-y-3">
                      {moment.transcript ? <InsightBlock label="Transcript" body={moment.transcript} /> : null}
                      {moment.observation ? <InsightBlock label="Observation" body={moment.observation} /> : null}
                      {moment.objectiveFit ? <InsightBlock label="Lien avec l’objectif" body={moment.objectiveFit} /> : null}
                      {moment.example ? <InsightBlock label="Exemple directement applicable" body={moment.example} accent /> : null}
                      {moment.evidence?.length ? (
                        <div className="rounded-2xl border border-white/[0.07] bg-black/16 p-3.5">
                          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Preuves citées</p>
                          <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-5 text-slate-300">
                            {moment.evidence.map((evidence) => <li key={evidence}>• {evidence}</li>)}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Diagnostics({ diagnostics }: { diagnostics: AnalysisDiagnostic[] }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <p className={eyebrow}>Ce qui bloque</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Chaque score devient une decision</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {diagnostics.map((item) => (
          <article key={item.label} className={`rounded-[18px] border p-4 ${diagnosticTone(item.score)}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-black text-white">{item.label}</h3>
              <span className="rounded-full border border-white/[0.12] bg-black/22 px-2.5 py-1 text-xs font-black text-white">{item.score === null ? '—' : `${item.score}/100`}</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" style={{ width: `${item.score ?? 0}%` }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{item.problem}</p>
            <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/18 px-3 py-2 text-sm font-semibold leading-6 text-violet-100">{item.correction}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalysisSections({ sections }: { sections: AnalysisSectionDetail[] }) {
  const totalCriteria = sections.reduce((total, section) => total + section.criteria.length, 0);
  const unavailableCriteria = sections.reduce(
    (total, section) => total + section.criteria.filter((criterion) => criterion.status === 'unavailable').length,
    0,
  );
  const availableSections = sections.filter((section) => section.status === 'available').length;

  return (
    <section className={`${card} mt-5 p-5 sm:p-6`} aria-labelledby="analyse-par-rubrique">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className={eyebrow}>Diagnostic par rubrique</p>
          <h2 id="analyse-par-rubrique" className="mt-2 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            8 rubriques, 78 critères, aucune case inventée
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Chaque critère indique ce qui a été observé, ce qui ne l’a pas été et ce que la vidéo ne permet pas de conclure.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
          <span className="rounded-full border border-emerald-300/18 bg-emerald-400/[0.07] px-3 py-1.5 text-emerald-100">
            {availableSections}/8 rubriques disponibles
          </span>
          <span className="rounded-full border border-white/[0.09] bg-black/20 px-3 py-1.5 text-slate-300">
            {totalCriteria} critères
          </span>
          {unavailableCriteria > 0 ? (
            <span className="rounded-full border border-amber-300/18 bg-amber-300/[0.07] px-3 py-1.5 text-amber-100">
              {unavailableCriteria} indisponible{unavailableCriteria > 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sections.map((section, sectionIndex) => {
          const observed = section.criteria.filter((criterion) => criterion.status === 'observed').length;
          const notObserved = section.criteria.filter((criterion) => criterion.status === 'not_observed').length;
          const unavailable = section.criteria.filter((criterion) => criterion.status === 'unavailable').length;

          return (
            <details
              key={section.key}
              className="group overflow-hidden rounded-[20px] border border-white/[0.075] bg-white/[0.028]"
              open={sectionIndex === 0}
            >
              <summary className="cursor-pointer list-none px-4 py-4 marker:hidden sm:px-5">
                <span className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-black text-white">{section.label}</span>
                      <SectionStatusBadge status={section.status} />
                    </span>
                    <span className="mt-1 block break-words text-xs leading-5 text-slate-500">{section.summary}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
                    <span className="rounded-full border border-emerald-300/14 px-2.5 py-1 text-emerald-200">{observed} observé{observed > 1 ? 's' : ''}</span>
                    <span className="rounded-full border border-slate-300/12 px-2.5 py-1 text-slate-400">{notObserved} non observé{notObserved > 1 ? 's' : ''}</span>
                    {unavailable > 0 ? <span className="rounded-full border border-amber-300/14 px-2.5 py-1 text-amber-200">{unavailable} indisponible{unavailable > 1 ? 's' : ''}</span> : null}
                    <span aria-hidden className="ml-1 text-lg font-medium text-slate-500 transition group-open:rotate-45">+</span>
                  </span>
                </span>
              </summary>

              <div className="border-t border-white/[0.06] p-4 sm:p-5">
                {section.status === 'available' ? (
                  <SectionEditorialSummary section={section} />
                ) : (
                  <p className="rounded-2xl border border-dashed border-amber-300/16 bg-amber-300/[0.04] p-4 text-sm leading-6 text-amber-50/75">
                    {section.summary} Aucun diagnostic de remplacement n’a été fabriqué.
                  </p>
                )}

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">Matrice des critères</h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">{section.criteria.length} critères obligatoires</span>
                  </div>
                  <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                    {section.criteria.map((criterion) => (
                      <CriterionCard key={criterion.criterionId} criterion={criterion} />
                    ))}
                  </div>
                </div>

                {section.limitations.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-300/12 bg-amber-300/[0.035] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-100/70">Limites</p>
                    <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-50/70">
                      {section.limitations.map((limitation) => <li key={limitation} className="break-words">• {limitation}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function SectionEditorialSummary({ section }: { section: AnalysisSectionDetail }) {
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-3">
      <EditorialList title="Forces" items={section.strengths} empty="Aucune force suffisamment étayée." tone="positive" />
      <EditorialList title="Problèmes" items={section.problems} empty="Aucun problème suffisamment étayé." tone="warning" />
      <div className="min-w-0 rounded-2xl border border-violet-300/12 bg-violet-400/[0.04] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-100/75">Recommandations</p>
        {section.recommendations.length > 0 ? (
          <div className="mt-3 space-y-3">
            {section.recommendations.map((recommendation) => (
              <article key={recommendation.id} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/18 p-3">
                <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.05] px-2 py-1 text-[10px] font-black text-cyan-100">{recommendation.timeRange}</span>
                <p className="mt-3 break-words text-xs font-black leading-5 text-white">{recommendation.action}</p>
                <p className="mt-2 break-words text-xs leading-5 text-slate-400">Pourquoi : {recommendation.why}</p>
                <p className="mt-2 break-words text-xs font-semibold leading-5 text-violet-100/85">Exemple : {recommendation.example}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs leading-5 text-slate-500">Aucune recommandation supplémentaire justifiée.</p>
        )}
      </div>
    </div>
  );
}

function EditorialList({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: 'positive' | 'warning';
}) {
  const toneClass = tone === 'positive'
    ? 'border-emerald-300/12 bg-emerald-400/[0.035] text-emerald-100/75'
    : 'border-amber-300/12 bg-amber-300/[0.035] text-amber-100/75';
  return (
    <div className={`min-w-0 rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
          {items.map((item) => <li key={item} className="break-words">• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">{empty}</p>
      )}
    </div>
  );
}

function CriterionCard({ criterion }: { criterion: AnalysisCriterionDetail }) {
  return (
    <article className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/18 p-3.5">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 break-words text-sm font-black leading-5 text-white">{criterion.label}</h4>
        <CriterionStatusBadge status={criterion.status} />
      </div>
      <p className="mt-3 break-words text-xs leading-5 text-slate-400">{criterion.note}</p>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
        <span className="rounded-full border border-white/[0.08] px-2 py-1">Confiance {criterion.confidence}</span>
        <span className="rounded-full border border-white/[0.08] px-2 py-1">{criterion.timeRange ?? 'Aucun timestamp fiable'}</span>
      </div>
      {criterion.evidence.length > 0 ? (
        <details className="group/evidence mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/75 marker:hidden">
            {criterion.evidence.length} preuve{criterion.evidence.length > 1 ? 's' : ''} lisible{criterion.evidence.length > 1 ? 's' : ''}
          </summary>
          <ul className="space-y-1.5 border-t border-white/[0.05] px-3 py-2.5 text-[11px] leading-5 text-slate-400">
            {criterion.evidence.map((evidence) => <li key={evidence} className="break-words">• {evidence}</li>)}
          </ul>
        </details>
      ) : (
        <p className="mt-3 text-[11px] leading-5 text-slate-600">Aucune preuve disponible pour ce critère.</p>
      )}
    </article>
  );
}

function SectionStatusBadge({ status }: { status: AnalysisSectionDetail['status'] }) {
  return status === 'available'
    ? <span className="rounded-full border border-emerald-300/16 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100">Disponible</span>
    : <span className="rounded-full border border-amber-300/16 bg-amber-300/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100">Indisponible</span>;
}

function CriterionStatusBadge({ status }: { status: AnalysisCriterionDetail['status'] }) {
  const label = status === 'observed' ? 'Observé' : status === 'not_observed' ? 'Non observé' : 'Indisponible';
  const tone = status === 'observed'
    ? 'border-emerald-300/16 bg-emerald-400/[0.07] text-emerald-100'
    : status === 'not_observed'
      ? 'border-slate-300/12 bg-white/[0.035] text-slate-300'
      : 'border-amber-300/16 bg-amber-300/[0.07] text-amber-100';
  return <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${tone}`}>{label}</span>;
}

function RecommendedV2({ analysis }: { analysis: AnalysisDetailData }) {
  const structureText = analysis.recommendedV2
    .map((step, index) => `${index + 1}. ${step.timing} - ${step.title}: ${step.detail}`)
    .join('\n');

  return (
    <section id="v2-recommandee" className="mt-5 overflow-hidden rounded-[28px] border border-violet-200/20 bg-[linear-gradient(135deg,rgba(88,28,135,0.42),rgba(8,16,31,0.97)_45%,rgba(6,182,212,0.18))] p-5 shadow-[0_42px_130px_-72px_rgba(168,85,247,0.95)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(232,121,249,0.20),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.12),transparent_35%)]" />
      <div className="relative">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className={eyebrow}>V2 recommandée</p>
            <h2 className="mt-3 max-w-2xl text-4xl font-black leading-none tracking-[-0.055em] text-white">
              {analysis.recommendedV2.length > 0 ? 'Le plan de remontage issu de ton analyse.' : 'Aucune structure V2 calculée.'}
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-300">
              {analysis.recommendedV2.length > 0
                ? 'Chaque étape ci-dessous provient du diagnostic enregistré pour cette vidéo.'
                : 'Relance une analyse exploitable pour obtenir des décisions de montage liées à ta vidéo.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {analysis.recommendedV2.length > 0 ? <CopyHookButton value={structureText} label="Copier la structure" /> : null}
              <Link href={analysis.prepareHref} className={primaryButton}>
                Préparer ma V2
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {analysis.recommendedV2.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-white/[0.12] bg-black/20 p-5 text-sm leading-6 text-slate-400">
                Structure indisponible dans cette analyse. Aucun segment générique n’a été ajouté.
              </div>
            ) : null}
            {analysis.recommendedV2.map((step, index) => (
              <V2StepCard key={`${step.title}-${index}`} step={step} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function EditingDecisions({ decisions }: { decisions: EditingDecision[] }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <p className={eyebrow}>Montage</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Ce que tu changes avant de republier</h2>
      {decisions.length === 0 ? (
        <p className="mt-6 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
          Aucune décision de montage fiable n’est disponible dans cette analyse.
        </p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {decisions.map((decision) => (
          <article key={decision.label} className="rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-cyan-100/75">{decision.label}</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">{decision.decision}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HooksSection({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Hooks alternatifs</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Des ouvertures plus tendues</h2>
        </div>
        <Link href={analysis.hooksHref} className={secondaryButton}>
          Générer 5 hooks
        </Link>
      </div>
      {analysis.hooks.length === 0 ? (
        <p className="mt-6 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
          Aucun hook alternatif n’a été enregistré. Génère-en à partir de cette analyse.
        </p>
      ) : null}
      <div className="mt-6 grid gap-3">
        {analysis.hooks.map((item, index) => (
          <article key={item.hook} className="rounded-[18px] border border-white/[0.075] bg-white/[0.032] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Hook {index + 1}</p>
                <p className="mt-2 text-lg font-black leading-7 text-white">"{item.hook}"</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{item.why}</p>
              </div>
              <CopyHookButton value={item.hook} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CtaCard({ analysis }: { analysis: AnalysisDetailData }) {
  if (analysis.cta.main === '—') {
    return (
      <section className={`${card} p-5 sm:p-6`}>
        <p className={eyebrow}>CTA recommandé</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">CTA non disponible</h2>
        <p className="mt-6 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
          Cette analyse ne contient aucun CTA calculé. Viralynz n’en ajoute pas un générique.
        </p>
      </section>
    );
  }

  return (
    <section className={`${card} p-5 sm:p-6`}>
      <p className={eyebrow}>CTA recommandé</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">La sortie doit vendre la suite</h2>
      <div className="mt-6 rounded-[20px] border border-fuchsia-300/18 bg-fuchsia-400/[0.075] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-fuchsia-100/80">Principal</p>
        <p className="mt-3 text-xl font-black leading-8 text-white">"{analysis.cta.main}"</p>
        <p className="mt-3 text-sm leading-6 text-slate-300">{analysis.cta.why}</p>
        <div className="mt-4">
          <CopyHookButton value={analysis.cta.main} />
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-1">
        <Variant title="Variante directe" body={analysis.cta.directVariant} />
        <Variant title="Variante curiosité" body={analysis.cta.curiosityVariant} />
      </div>
    </section>
  );
}

function RepostPlan({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <p className={eyebrow}>Plan de repost</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Checklist avant de republier</h2>
      {analysis.repostPlan.length === 0 ? (
        <p className="mt-6 rounded-[18px] border border-dashed border-white/[0.10] bg-white/[0.025] p-4 text-sm leading-6 text-slate-400">
          Aucun plan de repost fiable n’est disponible dans cette analyse.
        </p>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {analysis.repostPlan.map((item, index) => (
          <div key={`${index}-${item}`} className="flex gap-3 rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-400/14 text-xs font-black text-violet-100">{index + 1}</span>
            <p className="text-sm font-semibold leading-6 text-slate-300">{shortenAction(item)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FooterActions({ analysis }: { analysis: AnalysisDetailData }) {
  return (
    <footer className="mt-5 flex flex-col gap-4 rounded-[22px] border border-white/[0.08] bg-white/[0.035] p-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-black text-white">Prochaine action</p>
        <p className="mt-1 text-sm text-slate-400">Consulte les décisions enregistrées avant de préparer ta V2.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={analysis.prepareHref} className={primaryButton}>
          Préparer ma V2
        </Link>
        <Link href={analysis.hooksHref} className={secondaryButton}>
          Générer 5 hooks
        </Link>
        <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.09] bg-black/20 px-5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
          Retour au dashboard
        </Link>
      </div>
    </footer>
  );
}

function ScoreDial({ score }: { score: number | null }) {
  const value = score ?? 0;
  return (
    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-[7px]" style={{ background: score === null ? 'rgba(255,255,255,.08)' : `conic-gradient(#22d3ee 0 ${value}%, rgba(255,255,255,.08) ${value}% 100%)` }}>
      <div className="grid h-full w-full place-items-center rounded-full bg-[#071221]">
        <div className="text-center">
          <div className="text-4xl font-black tracking-[-0.06em] text-white">{score ?? '—'}</div>
          <div className="text-xs font-bold text-slate-500">{score === null ? 'score' : '/100'}</div>
        </div>
      </div>
    </div>
  );
}

function GroundedPlan({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: GroundedV2Item[];
}) {
  return (
    <details className="group overflow-hidden rounded-[20px] border border-white/[0.075] bg-white/[0.032]" open={items.length > 0 && items.length <= 4}>
      <summary className="cursor-pointer list-none px-4 py-4 marker:hidden sm:px-5">
        <span className="flex items-center justify-between gap-4">
          <span className="min-w-0">
            <span className="block text-sm font-black text-white">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
          </span>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[10px] font-black text-slate-300">
            {items.length}
          </span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-white/[0.06] p-4 sm:p-5">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/[0.09] p-3 text-xs leading-5 text-slate-500">
            Aucun élément fiable n’a été produit pour cette partie.
          </p>
        ) : null}
        {items.map((item, index) => (
          <article key={item.id} className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/18 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.06] px-2.5 py-1 text-[10px] font-black text-cyan-100">{item.time}</span>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">Action {index + 1}</span>
              <span className="text-[10px] font-bold text-slate-500">Confiance {item.confidence}</span>
            </div>
            <p className="mt-3 break-words text-sm font-black leading-6 text-white">{item.action}</p>
            <p className="mt-2 break-words text-xs leading-5 text-slate-400">Observé : {item.observation}</p>
            <p className="mt-2 break-words text-xs leading-5 text-violet-100/80">Pourquoi : {item.why}</p>
            <p className="mt-2 break-words rounded-xl border border-violet-300/12 bg-violet-400/[0.055] px-3 py-2 text-xs font-semibold leading-5 text-slate-200">
              Exemple : {item.example}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}

function ImprovedVersionWorkspace({ analysis }: { analysis: AnalysisDetailData }) {
  const improved = analysis.improvedVersion;
  if (!improved) return null;

  return (
    <section className={`${card} mt-5 p-5 sm:p-6`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className={eyebrow}>Livrables V2</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em]">Ton script et ton plan de tournage complets</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Ces livrables restent reliés aux observations horodatées de cette vidéo. Ils ne sont pas remplacés par un modèle générique.
          </p>
        </div>
        <CopyHookButton value={improved.fullScript} label="Copier le script V2" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <article className="min-w-0 rounded-[22px] border border-violet-300/16 bg-[linear-gradient(180deg,rgba(88,28,135,0.18),rgba(2,6,17,0.58))] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100/75">Script réécrit complet</p>
          <p className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap break-words pr-1 text-sm font-semibold leading-7 text-slate-100">
            {improved.fullScript}
          </p>
        </article>

        <article className="min-w-0 rounded-[22px] border border-white/[0.075] bg-white/[0.03] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/75">Découpage du script</p>
          <div className="mt-4 space-y-3">
            {improved.scriptSegments.map((segment, index) => (
              <div key={segment.id} className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/18 p-3.5">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{index + 1}. {segment.purpose}</p>
                <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-200">{segment.text}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <GroundedPlan title="Plan de montage" description="Cuts, déplacements et rythme à appliquer." items={improved.editPlan} />
        <GroundedPlan title="Shot list" description="Plans à tourner ou à remplacer précisément." items={improved.shotList} />
        <GroundedPlan title="Texte à l’écran" description="Formulations, timing et hiérarchie visuelle." items={improved.onScreenText} />
        <GroundedPlan title="Effets et B-roll" description="Renforts visuels justifiés par la séquence." items={improved.effectsAndBRoll} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <article className="min-w-0 rounded-[20px] border border-white/[0.075] bg-white/[0.032] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Première ligne</p>
          <p className="mt-3 break-words text-lg font-black leading-7 text-white">{improved.firstLine.action}</p>
          <p className="mt-2 break-words text-xs leading-5 text-slate-400">{improved.firstLine.why}</p>
          <div className="mt-4"><CopyHookButton value={improved.firstLine.action} /></div>
        </article>
        <article className="min-w-0 rounded-[20px] border border-white/[0.075] bg-white/[0.032] p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Légende TikTok</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm font-semibold leading-6 text-white">{improved.caption.action}</p>
          <p className="mt-2 break-words text-xs leading-5 text-slate-400">{improved.caption.why}</p>
          <div className="mt-4"><CopyHookButton value={improved.caption.action} /></div>
        </article>
      </div>

      <div className="mt-4 rounded-[20px] border border-white/[0.075] bg-white/[0.032] p-4 sm:p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Variantes A/B</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {improved.abTests.map((test) => (
            <article key={test.id} className="min-w-0 rounded-2xl border border-white/[0.07] bg-black/18 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-cyan-100/75">Test {test.variable}</p>
              <p className="mt-3 break-words text-sm font-semibold leading-6 text-slate-200">A — {test.versionA}</p>
              <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-200">B — {test.versionB}</p>
              <p className="mt-3 break-words text-xs leading-5 text-slate-500">Mesure : {test.successCriterion}</p>
            </article>
          ))}
        </div>
      </div>

      {improved.limitations.length ? (
        <p className="mt-4 rounded-2xl border border-amber-300/14 bg-amber-300/[0.05] px-4 py-3 text-xs leading-5 text-amber-50/80">
          Limites : {improved.limitations.join(' · ')}
        </p>
      ) : null}
    </section>
  );
}

function PreviewSignal({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-white/[0.09] bg-black/28 p-2">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value ?? '—'}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.075] bg-black/18 p-3.5">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function InsightBlock({ label, body, accent = false }: { label: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3.5 ${accent ? 'border-cyan-300/14 bg-cyan-300/[0.055]' : 'border-white/[0.07] bg-black/16'}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.15em] ${accent ? 'text-cyan-100/80' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-2 text-sm font-semibold leading-6 ${accent ? 'text-cyan-50' : 'text-slate-300'}`}>{body}</p>
    </div>
  );
}

function V2StepCard({ step, index }: { step: RecommendedV2Step; index: number }) {
  return (
    <article className="grid gap-3 rounded-[18px] border border-white/[0.10] bg-black/22 p-4 sm:grid-cols-[92px_1fr]">
      <div>
        <span className="inline-flex rounded-xl border border-cyan-200/20 bg-cyan-300/12 px-3 py-1 text-xs font-black text-cyan-100">{step.timing}</span>
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Étape {index + 1}</p>
      </div>
      <div>
        <h3 className="text-lg font-black leading-tight text-white">{step.title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">{step.detail}</p>
      </div>
    </article>
  );
}

function Variant({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.032] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">"{body}"</p>
        </div>
        <CopyHookButton value={body} />
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: AnalysisMoment['severity'] }) {
  const label = severity === 'critique' ? 'Critique' : severity === 'important' ? 'Important' : 'À resserrer';
  const tone = severity === 'critique'
    ? 'border-red-300/20 bg-red-400/10 text-red-200'
    : severity === 'important'
      ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
      : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';

  return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${tone}`}>{label}</span>;
}

function diagnosticTone(score: number | null): string {
  if (score === null) return 'border-white/[0.08] bg-white/[0.035]';
  if (score >= 75) return 'border-emerald-300/16 bg-emerald-400/[0.045]';
  if (score >= 55) return 'border-amber-300/16 bg-amber-300/[0.055]';
  return 'border-red-300/16 bg-red-400/[0.055]';
}

function primaryDecision(analysis: AnalysisDetailData): string {
  const advance = analysis.editingDecisions.find((item) => item.label === 'À avancer')?.decision;
  const cut = analysis.editingDecisions.find((item) => item.label === 'À couper')?.decision;

  if (cut && advance) {
    return `${cut} ${advance}`;
  }

  return advance ?? cut ?? analysis.verdict ?? 'Diagnostic non disponible.';
}

function shortenAction(value: string): string {
  if (value.length <= 126) return value;
  return `${value.slice(0, 123).trim()}...`;
}
