import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getAnalyses, type AnalysisRow } from '@/lib/analyses';
import { getPlanLabel, hasProOrLifetimeAccess, isLifetimePlan, normalizePlan } from '@/lib/plans';
import { getSession } from '@/lib/session';
import { getTikTokDashboardState, type TikTokDashboardState } from '@/lib/tiktok-accounts';

export const dynamic = 'force-dynamic';

type V2Item = {
  id: string;
  title: string;
  sourceLabel: string;
  status: 'V2 prête' | 'À compléter' | 'Brouillon';
  action: string;
  createdAt: string;
};

const shellCard =
  'relative overflow-hidden rounded-[14px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(9,16,31,0.94),rgba(5,8,17,0.985))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_32px_90px_-64px_rgba(0,0,0,0.95)]';

const softCard =
  'rounded-[12px] border border-white/[0.075] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

const primaryButton =
  'inline-flex items-center justify-center rounded-[9px] bg-[linear-gradient(135deg,#e05cff_0%,#8b5cf6_52%,#5b21e8_100%)] px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_18px_42px_-20px_rgba(139,92,246,0.95),inset_0_1px_0_rgba(255,255,255,0.22)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/45';

const secondaryButton =
  'inline-flex items-center justify-center rounded-[9px] border border-white/[0.11] bg-white/[0.055] px-4 py-2.5 text-[13px] font-bold text-slate-100 transition hover:border-cyan-200/25 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-200/25';

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function shorten(value: string, length = 82): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trim()}…`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date indisponible';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function getAnalysisTitle(row: AnalysisRow): string {
  const result = row.result;
  const caption = cleanText(result.detectedVideoMeta?.caption);
  const fileName = cleanText(result.analyzerMeta?.fileName);
  const shareTitle = cleanText(result.coachAnalysis?.shareables?.screenshotTitle);
  const verdict = cleanText(result.finalVerdict);
  const url = cleanText(row.video_url);

  return shorten(caption ?? fileName ?? shareTitle ?? verdict ?? url ?? 'Analyse TikTok', 74);
}

function getSourceLabel(row: AnalysisRow): string {
  const niche = cleanText(row.result.analyzerMeta?.nicheLabel);
  const objective = cleanText(row.result.analyzerMeta?.objectiveLabel);
  if (niche && objective) return `${niche} · ${objective}`;
  return niche ?? objective ?? 'Analyse sauvegardée';
}

function getPrimaryAction(row: AnalysisRow): string {
  const reconstructionStep = row.reconstruction?.recommendedOrder?.[0] ?? row.result.reconstructionIA?.recommendedOrder?.[0];
  const repostHook = cleanText(row.result.repostVersion?.hook);
  const priority = row.result.coachAnalysis?.priorityActions?.critical?.[0]
    ?? row.result.coachAnalysis?.priorityActions?.important?.[0]
    ?? row.result.actionPlan?.[0];

  return shorten(cleanText(reconstructionStep) ?? repostHook ?? cleanText(priority) ?? 'Préparer la structure avant publication.', 96);
}

function buildV2Items(analyses: AnalysisRow[]): V2Item[] {
  return analyses
    .filter((row) => Boolean(
      row.reconstruction
      || row.result.reconstructionIA
      || row.result.structuredReconstructionIA
      || row.result.repostVersion
      || row.result.actionPlan?.length
    ))
    .slice(0, 6)
    .map((row) => {
      const ready = Boolean(row.reconstruction || row.result.reconstructionIA || row.result.repostVersion);
      const partial = !ready && Boolean(row.result.actionPlan?.length);

      return {
        id: row.id,
        title: getAnalysisTitle(row),
        sourceLabel: getSourceLabel(row),
        status: ready ? 'V2 prête' : partial ? 'À compléter' : 'Brouillon',
        action: getPrimaryAction(row),
        createdAt: row.created_at,
      };
    });
}

function getTikTokLabel(tiktok: TikTokDashboardState): string {
  const activeAccount = tiktok.accounts.find((account) => account.status === 'active');
  if (!activeAccount) return 'Non connecté';
  return activeAccount.displayName ? `Connecté · ${activeAccount.displayName}` : 'Connecté';
}

function hasAdvancedTikTokScopes(tiktok: TikTokDashboardState): boolean {
  return tiktok.accounts.some((account) => account.status === 'active' && account.canSyncVideos);
}

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'cyan' | 'amber' | 'green' | 'muted' }) {
  const tones = {
    violet: 'border-violet-300/20 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-200/20 bg-cyan-300/10 text-cyan-100',
    amber: 'border-amber-200/20 bg-amber-300/10 text-amber-100',
    green: 'border-emerald-200/20 bg-emerald-300/10 text-emerald-100',
    muted: 'border-white/[0.1] bg-white/[0.05] text-slate-300',
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MiniStatus({ label, value, detail, tone = 'muted' }: { label: string; value: string; detail?: string; tone?: 'cyan' | 'green' | 'amber' | 'muted' }) {
  const dot = {
    cyan: 'bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.55)]',
    green: 'bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.55)]',
    amber: 'bg-amber-300 shadow-[0_0_16px_rgba(245,158,11,0.45)]',
    muted: 'bg-slate-500',
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-[10px] border border-white/[0.07] bg-white/[0.035] px-3 py-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 text-[13px] font-extrabold text-white">{value}</p>
        {detail ? <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{detail}</p> : null}
      </div>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot[tone]}`} />
    </div>
  );
}

function EmptyBlock({ title, text, cta }: { title: string; text: string; cta?: ReactNode }) {
  return (
    <div className="rounded-[12px] border border-dashed border-white/[0.12] bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.07),transparent_36%),rgba(255,255,255,0.025)] p-5">
      <p className="text-[15px] font-black text-white">{title}</p>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-slate-400">{text}</p>
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  );
}

function V2Card({ item, compact = false }: { item: V2Item; compact?: boolean }) {
  const tone = item.status === 'V2 prête' ? 'green' : item.status === 'À compléter' ? 'amber' : 'muted';

  return (
    <article className={`${softCard} p-4`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{item.status}</Badge>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{formatDate(item.createdAt)}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-black leading-snug text-white">{item.title}</h3>
      <p className="mt-2 text-[12px] font-semibold text-cyan-100/75">{item.sourceLabel}</p>
      {!compact ? <p className="mt-3 text-[13px] leading-relaxed text-slate-400">{item.action}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/analyses/${item.id}`} className="rounded-[8px] border border-white/[0.1] bg-white/[0.045] px-3 py-2 text-[12px] font-bold text-slate-100 transition hover:bg-white/[0.08]">
          Voir l'analyse
        </Link>
        <Link href="/dashboard/rewrite" className="rounded-[8px] border border-violet-300/20 bg-violet-400/10 px-3 py-2 text-[12px] font-bold text-violet-100 transition hover:bg-violet-400/15">
          Préparer la V2
        </Link>
      </div>
    </article>
  );
}

function PlanningLane({ title, detail, items }: { title: string; detail: string; items: V2Item[] }) {
  return (
    <div className="min-h-[220px] rounded-[13px] border border-white/[0.075] bg-black/18 p-3">
      <div className="mb-3">
        <p className="text-[13px] font-black text-white">{title}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{detail}</p>
      </div>
      <div className="space-y-3">
        {items.length > 0 ? items.map((item) => <V2Card key={`${title}-${item.id}`} item={item} compact />) : (
          <div className="rounded-[10px] border border-dashed border-white/[0.12] bg-white/[0.025] p-4">
            <div className="h-2.5 w-24 rounded-full bg-white/[0.08]" />
            <div className="mt-3 h-2 w-full rounded-full bg-white/[0.055]" />
            <div className="mt-2 h-2 w-2/3 rounded-full bg-white/[0.045]" />
            <p className="mt-4 text-[12px] leading-relaxed text-slate-500">Aucun contenu réel dans cet état pour le moment.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineStep({ index, title, text, status }: { index: string; title: string; text: string; status: string }) {
  return (
    <div className={`${softCard} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200/75">{index}</span>
        <Badge tone="muted">{status}</Badge>
      </div>
      <h3 className="mt-4 text-[15px] font-black text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}

function ModuleCard({ title, text, badge }: { title: string; text: string; badge: string }) {
  return (
    <div className={`${softCard} p-4`}>
      <Badge tone={badge === 'Lifetime' ? 'cyan' : badge === 'Pro' ? 'violet' : 'muted'}>{badge}</Badge>
      <h3 className="mt-4 text-[15px] font-black text-white">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}

export default async function DashboardSharePage() {
  const session = await getSession();

  if (!session) {
    redirect('/login?redirect=/dashboard/share');
  }

  const user = await getUserById(session.userId);
  const plan = normalizePlan(user ? getEffectivePlan(user) : 'free');
  const [analyses, tiktok] = await Promise.all([
    getAnalyses(session.userId, plan),
    getTikTokDashboardState(session.userId, plan),
  ]);

  const planLabel = getPlanLabel(plan);
  const v2Items = buildV2Items(analyses);
  const readyItems = v2Items.filter((item) => item.status === 'V2 prête');
  const partialItems = v2Items.filter((item) => item.status !== 'V2 prête');
  const activeTikTok = tiktok.active > 0;
  const advancedScopes = hasAdvancedTikTokScopes(tiktok);
  const isLifetime = isLifetimePlan(plan);
  const isProOrLifetime = hasProOrLifetimeAccess(plan);

  const planningLanes = [
    {
      title: 'À préparer',
      detail: 'Analyses qui peuvent devenir une V2.',
      items: partialItems.slice(0, 2),
    },
    {
      title: 'V2 prêtes',
      detail: 'Versions retravaillées disponibles dans tes analyses.',
      items: readyItems.slice(0, 2),
    },
    {
      title: 'Planifiable',
      detail: 'La programmation sera activée quand le module sera branché.',
      items: [],
    },
    {
      title: 'Comparaison en attente',
      detail: 'V1/V2 apparaîtra uniquement après publication et données autorisées.',
      items: [],
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1460px] px-0 pb-10 pt-2 text-white">
      <section className={`${shellCard} p-5 sm:p-6 lg:p-7`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_8%,rgba(217,70,239,0.18),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(34,211,238,0.12),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_430px] lg:items-stretch">
          <div className="flex min-h-[330px] flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="violet">Planification & publication</Badge>
                <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100">
                  Publication
                </span>
              </div>
              <h1 className="mt-5 max-w-4xl text-[34px] font-black leading-[0.95] tracking-tight text-white sm:text-[46px] lg:text-[58px]">
                Planifie tes reposts et pilote tes V2
              </h1>
              <p className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-[16px]">
                Prépare tes versions retravaillées, organise leur sortie et compare leurs résultats quand les données sont disponibles.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/dashboard/rewrite" className={primaryButton}>
                Préparer une V2
              </Link>
              <Link href="/dashboard/library?tab=analyses" className={secondaryButton}>
                Voir les analyses
              </Link>
            </div>
          </div>

          <aside className={`${softCard} relative p-4 sm:p-5`}>
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/30 to-transparent" />
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">État publication</p>
                <h2 className="mt-2 text-[20px] font-black text-white">Workflow de sortie</h2>
              </div>
              <Badge tone={isProOrLifetime ? 'green' : 'amber'}>{planLabel}</Badge>
            </div>

            <div className="mt-5 grid gap-3">
              <MiniStatus
                label="Compte TikTok"
                value={getTikTokLabel(tiktok)}
                detail={activeTikTok ? `${tiktok.active} / ${tiktok.limitLabel} compte actif` : 'Connecte TikTok pour préparer la suite du workflow.'}
                tone={activeTikTok ? 'green' : 'amber'}
              />
              <MiniStatus
                label="Publications planifiées"
                value="Aucune"
                detail="Aucune donnée de scheduling active n'est inventée."
                tone="muted"
              />
              <MiniStatus
                label="Comparaison V1/V2"
                value="Disponible après publication"
                detail="La comparaison s'affichera quand une V2 publiée aura des données autorisées."
                tone="cyan"
              />
              <MiniStatus
                label="Plan actif"
                value={planLabel}
                detail={plan === 'creator' ? 'Préparation accessible. Publication enrichie avec Pro.' : isLifetime ? 'Workflow avancé et multi-comptes.' : isProOrLifetime ? 'Publication enrichie prête à être activée.' : 'Teste l’analyse avant le workflow publication.'}
                tone={isProOrLifetime ? 'green' : 'amber'}
              />
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`${shellCard} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="cyan">Planning de sortie</Badge>
              <h2 className="mt-3 text-[24px] font-black tracking-tight text-white">Calendrier de publication</h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-400">
                Les V2 prêtes à republier apparaîtront ici pour être planifiées au bon moment. Aucune publication réelle n'est affichée tant que le module n'est pas branché.
              </p>
            </div>
            <Badge tone="muted">Aucune performance n'est inventée</Badge>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            {planningLanes.map((lane) => (
              <PlanningLane key={lane.title} title={lane.title} detail={lane.detail} items={lane.items} />
            ))}
          </div>
        </div>

        <aside className={`${shellCard} p-4 sm:p-5`}>
          <Badge tone="violet">Pré-requis</Badge>
          <h2 className="mt-3 text-[21px] font-black text-white">Prêt pour publier ?</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            Publie avec méthode, pas au hasard. Les blocages restent visibles sans promettre une automatisation déjà active.
          </p>

          <div className="mt-5 space-y-3">
            <MiniStatus
              label="TikTok"
              value={activeTikTok ? 'Connecté' : 'Non connecté'}
              detail={activeTikTok ? getTikTokLabel(tiktok) : 'Connexion requise pour la suite du publishing.'}
              tone={activeTikTok ? 'green' : 'amber'}
            />
            <MiniStatus
              label="Permissions avancées"
              value={advancedScopes ? 'Disponibles' : 'En attente de validation TikTok'}
              detail={advancedScopes ? 'Les vidéos autorisées peuvent enrichir le workflow.' : 'Les métriques publication restent masquées tant que TikTok ne valide pas les permissions.'}
              tone={advancedScopes ? 'green' : 'amber'}
            />
            <MiniStatus
              label="V2 disponible"
              value={v2Items.length > 0 ? `${v2Items.length} piste${v2Items.length > 1 ? 's' : ''}` : 'Aucune'}
              detail={v2Items.length > 0 ? 'Issues uniquement de tes analyses réelles.' : 'Lance une analyse pour alimenter le pipeline.'}
              tone={v2Items.length > 0 ? 'green' : 'muted'}
            />
            <MiniStatus
              label="Plan compatible"
              value={plan === 'creator' ? 'Starter · préparation' : isLifetime ? 'Lifetime · multi-comptes' : isProOrLifetime ? 'Pro · publication enrichie' : 'Free · analyse test'}
              detail={isProOrLifetime ? 'Les modules avancés pourront être activés côté produit.' : 'Pro débloquera les workflows enrichis.'}
              tone={isProOrLifetime ? 'green' : 'amber'}
            />
          </div>

          {!activeTikTok ? (
            <Link href="/api/tiktok/connect" className={`${secondaryButton} mt-5 w-full`}>
              Connecter TikTok
            </Link>
          ) : null}
        </aside>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-4">
        <PipelineStep
          index="01"
          title="Analyse"
          text="Diagnostic de la vidéo source : hook, drop, CTA et moments récupérables."
          status={analyses.length > 0 ? 'Disponible' : 'À lancer'}
        />
        <PipelineStep
          index="02"
          title="Recommandation V2"
          text="Version améliorée à retravailler avant de préparer une sortie."
          status={v2Items.length > 0 ? 'À exploiter' : 'Après analyse'}
        />
        <PipelineStep
          index="03"
          title="Planification"
          text="Choix de la date et du créneau quand le module publication sera actif."
          status="Bientôt"
        />
        <PipelineStep
          index="04"
          title="Suivi"
          text="Comparaison des résultats uniquement quand la donnée TikTok existe."
          status="En attente"
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className={`${shellCard} p-4 sm:p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="green">V2 à republier</Badge>
              <h2 className="mt-3 text-[24px] font-black text-white">V2 prêtes à publier</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                Chaque carte vient de tes analyses sauvegardées. Si rien n'existe, le pipeline reste vide.
              </p>
            </div>
            <Link href="/dashboard/analyze" className={secondaryButton}>
              Analyser une vidéo
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {v2Items.length > 0 ? v2Items.slice(0, 4).map((item) => (
              <V2Card key={item.id} item={item} />
            )) : (
              <EmptyBlock
                title="Aucune V2 prête pour le moment."
                text="Lance une analyse pour alimenter ton pipeline de publication. Viralynz affichera ici uniquement les V2 et plans issus de tes vraies analyses."
                cta={<Link href="/dashboard/analyze" className={primaryButton}>Analyser une vidéo</Link>}
              />
            )}
          </div>
        </div>

        <div className={`${shellCard} p-4 sm:p-5`}>
          <Badge tone="cyan">Comparaison de performance</Badge>
          <h2 className="mt-3 text-[24px] font-black text-white">Comparaison V1 / V2</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
            La comparaison V1/V2 apparaîtra une fois la V2 publiée et les données TikTok disponibles.
          </p>

          <div className="mt-5 overflow-hidden rounded-[13px] border border-white/[0.075] bg-black/20">
            <div className="grid grid-cols-4 gap-px bg-white/[0.06] text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              <div className="bg-[#070b16] p-3">Vidéo source</div>
              <div className="bg-[#070b16] p-3">V2 repostée</div>
              <div className="bg-[#070b16] p-3">Statut comparaison</div>
              <div className="bg-[#070b16] p-3">Donnée disponible</div>
            </div>
            <div className="grid grid-cols-4 gap-px bg-white/[0.06] text-[13px] text-slate-300">
              <div className="bg-[#080d19] p-4">{analyses.length > 0 ? 'Analyse réelle sauvegardée' : 'En attente d’analyse'}</div>
              <div className="bg-[#080d19] p-4">{v2Items.length > 0 ? 'V2 détectée dans tes analyses' : 'Aucune V2 publiée'}</div>
              <div className="bg-[#080d19] p-4">Comparaison en attente</div>
              <div className="bg-[#080d19] p-4">Aucune métrique publication disponible</div>
            </div>
          </div>

          <div className="mt-5 rounded-[13px] border border-cyan-200/10 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.11),transparent_35%),rgba(255,255,255,0.025)] p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-20 rounded-[10px] border border-white/[0.07] bg-white/[0.035] p-3">
                <div className="h-2 w-20 rounded-full bg-white/[0.09]" />
                <div className="mt-4 h-2 w-full rounded-full bg-cyan-200/12" />
                <div className="mt-2 h-2 w-2/3 rounded-full bg-violet-200/10" />
              </div>
              <div className="h-20 rounded-[10px] border border-white/[0.07] bg-white/[0.035] p-3">
                <div className="h-2 w-24 rounded-full bg-white/[0.09]" />
                <div className="mt-4 h-2 w-5/6 rounded-full bg-cyan-200/12" />
                <div className="mt-2 h-2 w-1/2 rounded-full bg-violet-200/10" />
              </div>
              <div className="h-20 rounded-[10px] border border-white/[0.07] bg-white/[0.035] p-3">
                <div className="h-2 w-16 rounded-full bg-white/[0.09]" />
                <div className="mt-4 h-2 w-full rounded-full bg-cyan-200/12" />
                <div className="mt-2 h-2 w-3/4 rounded-full bg-violet-200/10" />
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-relaxed text-slate-500">
              Ces formes montrent l'emplacement futur du suivi. Elles ne représentent aucun résultat réel.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-4">
        <ModuleCard
          title="Programmation des reposts"
          text="Centraliser les prochaines sorties quand la programmation sera active."
          badge="Bientôt"
        />
        <ModuleCard
          title="Suivi des V2 publiées"
          text="Relier une V2 publiée à son analyse d'origine quand TikTok autorise la donnée."
          badge="Après validation"
        />
        <ModuleCard
          title="Comparaison V1 / V2"
          text="Voir ce qui change entre la vidéo source et la version repostée, sans chiffre inventé."
          badge="Pro"
        />
        <ModuleCard
          title="Publication multi-comptes"
          text="Préparer des workflows de sortie pour plusieurs comptes TikTok."
          badge="Lifetime"
        />
      </section>
    </main>
  );
}
