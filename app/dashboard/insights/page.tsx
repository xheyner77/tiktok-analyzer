import Link from 'next/link';
import { redirect } from 'next/navigation';
import CreatorMemoryActions from '@/components/dashboard-v2/CreatorMemoryActions';
import { getEffectivePlan, getUserById } from '@/lib/auth';
import { getCreatorMemory, getCreatorMemoryEvents, getCreatorMemoryLevelLabel } from '@/lib/creator-memory';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

type Tone = 'violet' | 'cyan' | 'green' | 'amber' | 'slate';

const shellCard =
  'relative overflow-hidden rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(8,15,30,0.94),rgba(4,8,18,0.99))] shadow-[inset_0_1px_0_rgba(255,255,255,0.055),0_34px_96px_-74px_rgba(0,0,0,0.98)]';

const primaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#f36cff_0%,#8b5cf6_52%,#2563eb_100%)] px-5 text-[13px] font-black text-white shadow-[0_24px_58px_-28px_rgba(139,92,246,1),inset_0_1px_0_rgba(255,255,255,0.24)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110';

const secondaryButton =
  'inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-white/[0.10] bg-white/[0.045] px-5 text-[13px] font-black text-slate-100 transition duration-200 hover:border-cyan-200/20 hover:bg-white/[0.075]';

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    violet: 'border-violet-300/22 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/22 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/22 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/22 bg-amber-400/10 text-amber-100',
    slate: 'border-white/[0.12] bg-white/[0.055] text-slate-200',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tones[tone]}`}>{children}</span>;
}

function formatDate(value?: string | null) {
  if (!value) return 'Aucun apprentissage';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aucun apprentissage';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function MemoryListCard({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  const visible = items.filter(Boolean).slice(0, 4);
  return (
    <article className="rounded-[17px] border border-white/[0.075] bg-white/[0.035] p-4">
      <h3 className="text-[16px] font-black tracking-[-0.02em] text-white">{title}</h3>
      {visible.length ? (
        <ul className="mt-4 space-y-3">
          {visible.map((item) => (
            <li key={item} className="flex gap-2 text-[13px] leading-6 text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[linear-gradient(135deg,#22d3ee,#a855f7)] shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] leading-6 text-slate-500">{empty}</p>
      )}
    </article>
  );
}

export default async function DashboardInsightsPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/dashboard/insights');

  const [profile, memory, events] = await Promise.all([
    getUserById(session.userId),
    getCreatorMemory(session.userId),
    getCreatorMemoryEvents(session.userId, 6),
  ]);

  const effectivePlan = profile ? getEffectivePlan(profile) : 'free';
  const hasFullMemory = effectivePlan === 'pro' || effectivePlan === 'scale';
  const hasMemory = Boolean(memory && memory.total_analyses_learned_from > 0);
  const memoryLevel = memory?.memory_level ?? 0;
  const levelLabel = getCreatorMemoryLevelLabel(memoryLevel);
  const latestLearning = events[0]?.extracted_insights_json.new_learnings[0];

  return (
    <section className="mx-auto w-full max-w-[1440px] pb-10 pt-3 text-white">
      <section className={`${shellCard} p-5 sm:p-6 lg:p-7`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(217,70,239,0.24),transparent_32%),radial-gradient(circle_at_88%_14%,rgba(34,211,238,0.18),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="cyan">Memoire Createur</Badge>
              <Badge tone={hasFullMemory ? 'green' : 'amber'}>{hasFullMemory ? 'Pro actif' : 'Preview Creator'}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-[36px] font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-[54px] lg:text-[66px]">
              Viralynz apprend de chaque analyse.
            </h1>
            <p className="mt-5 max-w-3xl text-[17px] font-black leading-7 text-white sm:text-[20px]">
              Plus tu analyses de videos, plus Viralynz comprend ton style, tes erreurs et les V2 a tester.
            </p>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              La memoire ne remplace pas ton jugement. Elle evite les conseils generiques et garde uniquement les patterns observes dans tes vraies analyses.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/analyze" className={primaryButton}>Analyser une video</Link>
              {!hasFullMemory ? <Link href="/dashboard/billing" className={secondaryButton}>Debloquer la memoire complete</Link> : null}
            </div>
          </div>

          <aside className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_28px_76px_-58px_rgba(34,211,238,0.75)]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Etat memoire</p>
            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-[52px] font-black tracking-[-0.07em] text-white">{memoryLevel}<span className="text-[20px] text-slate-500">/100</span></div>
                <Badge tone={memoryLevel >= 30 ? 'green' : memoryLevel >= 10 ? 'cyan' : 'slate'}>{levelLabel}</Badge>
              </div>
              <div className="text-right text-[12px] font-semibold text-slate-400">
                <p>{memory?.total_analyses_learned_from ?? 0} analyses apprises</p>
                <p className="mt-1">Dernier : {formatDate(memory?.last_learned_at)}</p>
              </div>
            </div>
            <div className="mt-5 h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#f0abfc)] shadow-[0_0_22px_rgba(139,92,246,0.65)]"
                style={{ width: `${Math.max(4, memoryLevel)}%` }}
              />
            </div>
          </aside>
        </div>
      </section>

      {!hasMemory ? (
        <section className={`${shellCard} mt-5 p-6 text-center`}>
          <Badge tone="slate">Etat vide</Badge>
          <h2 className="mt-4 text-[30px] font-black tracking-[-0.05em] text-white">Analyse 3 videos pour que Viralynz commence a comprendre ton style.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-slate-400">
            La memoire se construit uniquement avec tes vraies analyses. Aucun score, aucune audience et aucun pattern ne sont inventes.
          </p>
          <div className="mt-6">
            <Link href="/dashboard/analyze" className={primaryButton}>Analyser une video</Link>
          </div>
        </section>
      ) : (
        <>
          {!hasFullMemory ? (
            <section className="mt-5 rounded-[18px] border border-violet-300/16 bg-violet-400/[0.065] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-[13px] font-bold leading-6 text-violet-50/85">
                  Creator garde une preview. Pro permet a Viralynz d apprendre de toutes tes analyses et de reconstruire tes V2 avec ce contexte.
                </p>
                <Link href="/dashboard/billing" className={secondaryButton}>Voir Pro</Link>
              </div>
            </section>
          ) : null}

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-4 md:grid-cols-2">
              <MemoryListCard
                title="Ce que Viralynz comprend de ton style"
                items={[memory?.creator_voice, memory?.content_style, memory?.hook_style, memory?.cta_style].filter(Boolean) as string[]}
                empty="Ton style apparaitra apres plusieurs analyses coherentes."
              />
              <MemoryListCard
                title="Tes erreurs qui reviennent"
                items={[...(memory?.recurring_mistakes ?? []), ...(memory?.weakest_patterns ?? [])]}
                empty="Aucune erreur recurrente fiable pour le moment."
              />
              <MemoryListCard
                title="Tes patterns a renforcer"
                items={[...(memory?.strongest_patterns ?? []), ...(memory?.do_more_of ?? [])]}
                empty="Les patterns forts apparaitront quand ils seront observes."
              />
              <MemoryListCard
                title="Tes prochains tests recommandes"
                items={memory?.next_experiments ?? []}
                empty="Viralynz proposera des tests quand les analyses donnent assez de signal."
              />
              <MemoryListCard
                title="A eviter dans tes prochaines videos"
                items={memory?.avoid_doing ?? []}
                empty="Aucun interdit produit : Viralynz attend des preuves."
              />
            </div>

            <aside className={`${shellCard} p-5`}>
              <Badge tone="cyan">Dernier apprentissage</Badge>
              {latestLearning ? (
                <div className="mt-5">
                  <h2 className="text-[22px] font-black tracking-[-0.035em] text-white">{latestLearning.insight}</h2>
                  <p className="mt-3 text-[13px] leading-6 text-slate-400">{latestLearning.evidence}</p>
                  <div className="mt-4 rounded-[14px] border border-white/[0.075] bg-black/20 p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Confiance</p>
                    <p className="mt-1 text-[18px] font-black text-white">{Math.round(latestLearning.confidence * 100)}%</p>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-[13px] leading-6 text-slate-400">Le prochain apprentissage apparaitra apres une analyse sauvegardee.</p>
              )}
              <div className="mt-5">
                <CreatorMemoryActions latestEventId={events[0]?.id} />
              </div>
            </aside>
          </section>
        </>
      )}
    </section>
  );
}
