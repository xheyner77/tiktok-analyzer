'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getProductUpdateStats,
  productUpdateCategories,
  productUpdates,
  upcomingProductUpdates,
  type ProductUpdate,
  type ProductUpdateCategory,
  type ProductUpdateStatus,
  type RoadmapStatus,
} from '@/lib/product-updates';

type CategoryFilter = ProductUpdateCategory | 'Tout';

const stats = getProductUpdateStats();
const latestRelease = stats.latestRelease;
const impactUpdates = productUpdates.filter((update) => update.featured).slice(0, 4);

const filterLabels: CategoryFilter[] = ['Tout', ...productUpdateCategories];

function Badge({
  children,
  tone = 'violet',
}: {
  children: React.ReactNode;
  tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate';
}) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/18 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status: ProductUpdateStatus | RoadmapStatus): 'violet' | 'cyan' | 'green' | 'amber' | 'slate' {
  if (status === 'Livré') return 'green';
  if (status === 'Nouveau') return 'cyan';
  if (status === 'Amélioré') return 'violet';
  if (status === 'Recherche') return 'amber';
  if (status === 'Bientôt') return 'cyan';
  return 'slate';
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="m9 4 4 4-4 4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" />
    </svg>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">{eyebrow}</p>
        <h2 className="mt-2 text-[28px] font-black tracking-[-0.05em] text-white sm:text-[34px]">{title}</h2>
      </div>
      <p className="max-w-xl text-[13.5px] leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(13,21,41,0.98),rgba(5,9,20,0.99)_54%,rgba(28,13,54,0.96))] p-5 shadow-[0_42px_132px_-86px_rgba(124,58,237,1),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.22),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_430px] xl:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="cyan">Dernière release</Badge>
            <Badge tone="slate">Journal produit</Badge>
            <Badge tone="violet">{latestRelease.version}</Badge>
          </div>

          <h1 className="mt-5 max-w-4xl text-[38px] font-black leading-[0.96] tracking-[-0.065em] text-white sm:text-[56px] lg:text-[68px]">
            {latestRelease.version} clarifie le support, le billing et le dashboard.
          </h1>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-[17px]">
            Cette release rend Viralynz plus lisible, plus utile et plus cohérent dans les surfaces produit les plus consultées.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#release-changelog" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[12px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_22px_52px_-26px_rgba(139,92,246,1)] transition hover:-translate-y-0.5 hover:brightness-110">
              Explorer les changements
              <ArrowIcon />
            </a>
            <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[12px] border border-white/[0.10] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:border-cyan-200/20 hover:bg-white/[0.075]">
              Donner mon feedback
            </Link>
          </div>
        </div>

        <aside className="rounded-[22px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_90px_-68px_rgba(34,211,238,0.82)] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Version actuelle</p>
              <p className="mt-2 text-[34px] font-black tracking-[-0.06em] text-white">{latestRelease.version}</p>
              <time dateTime={latestRelease.isoDate} className="mt-1 block text-[12px] font-semibold text-slate-500">{latestRelease.date}</time>
            </div>
            <Badge tone={statusTone(latestRelease.status)}>{latestRelease.status}</Badge>
          </div>

          <div className="mt-5 rounded-[16px] border border-violet-300/14 bg-violet-400/[0.075] p-4">
            <p className="text-[13px] font-black text-white">{latestRelease.title}</p>
            <p className="mt-2 text-[12.5px] leading-5 text-slate-400">{latestRelease.summary}</p>
          </div>

          <div className="mt-4 space-y-2.5">
            {latestRelease.bullets.slice(0, 3).map((bullet) => (
              <p key={bullet} className="flex gap-2 rounded-[13px] border border-white/[0.065] bg-black/18 px-3 py-2.5 text-[12.5px] leading-5 text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                {bullet}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function ImpactCard({ update, featured }: { update: ProductUpdate; featured: boolean }) {
  return (
    <article className={`group relative overflow-hidden rounded-[22px] border p-4 transition duration-200 hover:-translate-y-0.5 sm:p-5 ${
      featured
        ? 'border-violet-300/20 bg-[linear-gradient(135deg,rgba(124,58,237,0.18),rgba(8,13,28,0.98)_58%,rgba(8,47,73,0.18))] shadow-[0_30px_96px_-76px_rgba(168,85,247,1),inset_0_1px_0_rgba(255,255,255,0.06)] md:col-span-2'
        : 'border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.99))] hover:border-cyan-200/18 hover:bg-white/[0.045]'
    }`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.36),transparent)] opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{update.category}</Badge>
        <Badge tone={statusTone(update.status)}>{update.status}</Badge>
      </div>
      <h3 className={`mt-4 font-black tracking-[-0.035em] text-white ${featured ? 'text-[27px] sm:text-[32px]' : 'text-[18px]'}`}>
        {update.title}
      </h3>
      <p className="mt-3 max-w-3xl text-[13px] leading-6 text-slate-400">{update.summary}</p>
      <div className={`mt-5 grid gap-2 ${featured ? 'lg:grid-cols-3' : ''}`}>
        {update.bullets.slice(0, featured ? 3 : 2).map((bullet) => (
          <p key={bullet} className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] px-3 py-2.5 text-[12.5px] leading-5 text-slate-300">
            {bullet}
          </p>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.065] pt-4">
        <span className="text-[12px] font-black text-slate-300">{update.version}</span>
        <time dateTime={update.isoDate} className="text-[12px] font-semibold text-slate-500">{update.date}</time>
      </div>
    </article>
  );
}

function FilterBar({ selected, onSelect }: { selected: CategoryFilter; onSelect: (category: CategoryFilter) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {filterLabels.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-[12px] font-black transition ${
            selected === category
              ? 'border-cyan-200/36 bg-cyan-300/14 text-cyan-50 shadow-[0_0_28px_-18px_rgba(34,211,238,0.95)]'
              : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/[0.14] hover:bg-white/[0.07]'
          }`}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function ReleaseRow({ update, open, onToggle }: { update: ProductUpdate; open: boolean; onToggle: () => void }) {
  return (
    <article className="overflow-hidden rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.99))] shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <button type="button" onClick={onToggle} className="grid w-full gap-4 p-4 text-left transition hover:bg-white/[0.035] sm:grid-cols-[120px_minmax(0,1fr)_120px] sm:items-center sm:p-5">
        <div>
          <p className="text-[16px] font-black text-white">{update.version}</p>
          <time dateTime={update.isoDate} className="mt-1 block text-[12px] font-semibold text-slate-500">{update.date}</time>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">{update.category}</Badge>
            <Badge tone={statusTone(update.status)}>{update.status}</Badge>
            {update.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} tone="violet">{tag}</Badge>
            ))}
          </div>
          <h3 className="mt-3 text-[18px] font-black tracking-[-0.025em] text-white">{update.title}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-slate-400">{update.summary}</p>
        </div>
        <span className="inline-flex items-center justify-start gap-2 text-[12px] font-black text-cyan-100 sm:justify-end">
          {open ? 'Réduire' : 'Voir les détails'}
          <ArrowIcon className={`h-4 w-4 transition ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>

      {open ? (
        <div className="border-t border-white/[0.065] px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="mt-4 grid gap-2 lg:grid-cols-3">
            {update.bullets.slice(0, 3).map((bullet) => (
              <p key={bullet} className="rounded-[13px] border border-white/[0.065] bg-black/18 px-3 py-2.5 text-[12.5px] leading-5 text-slate-300">
                {bullet}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Roadmap() {
  return (
    <section className="mt-8">
      <SectionHeading
        eyebrow="En préparation"
        title="Ce qu’on affine ensuite."
        description="Une roadmap courte, sans promesse artificielle."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {upcomingProductUpdates.slice(0, 4).map((item) => (
          <article key={item.id} className="rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.99))] p-4 transition hover:border-cyan-200/16 hover:bg-white/[0.045]">
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              <Badge tone="slate">{item.category}</Badge>
            </div>
            <h3 className="mt-4 text-[16px] font-black text-white">{item.title}</h3>
            <p className="mt-2 text-[12.5px] leading-5 text-slate-400">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeedbackBlock() {
  return (
    <section className="relative mt-8 overflow-hidden rounded-[26px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(76,29,149,0.24),rgba(5,9,20,0.98)_56%,rgba(8,47,73,0.28))] p-5 shadow-[0_32px_100px_-78px_rgba(34,211,238,0.86),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(34,211,238,0.14),transparent_34%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="grid h-10 w-10 place-items-center rounded-[13px] border border-cyan-200/18 bg-cyan-300/10 text-cyan-100">
            <SparkIcon />
          </div>
          <h2 className="mt-4 text-[28px] font-black tracking-[-0.05em] text-white sm:text-[38px]">
            Tu veux influencer les prochaines nouveautés ?
          </h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-300">
            Dis-nous ce qui t’aiderait à transformer un diagnostic en meilleure V2. Les idées concrètes nourrissent la roadmap.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white transition hover:-translate-y-0.5 hover:brightness-110">
            Envoyer une idée
          </Link>
          <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[12px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
            Contacter le support
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function UpdatesPageClient() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('Tout');
  const [openReleaseId, setOpenReleaseId] = useState<string>(latestRelease.id);
  const filteredUpdates = useMemo(() => {
    if (selectedCategory === 'Tout') return productUpdates;
    return productUpdates.filter((update) => update.tags.includes(selectedCategory) || update.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <section className="mx-auto w-full max-w-[1460px] pb-12 pt-4 text-white">
      <Hero />

      <section className="mt-8">
        <SectionHeading
          eyebrow="Ce qui change vraiment"
          title="Les évolutions qui modifient l’expérience Viralynz."
          description="Moins de friction. Plus de clarté. Les changements importants avant le détail chronologique."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {impactUpdates.map((update, index) => (
            <ImpactCard key={update.id} update={update} featured={index === 0} />
          ))}
        </div>
      </section>

      <section id="release-changelog" className="mt-8 rounded-[24px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
        <SectionHeading
          eyebrow="Changelog compact"
          title="Le journal complet, sans noyer l’essentiel."
          description="Filtre par module et ouvre seulement les releases qui t’intéressent."
        />
        <div className="mt-5">
          <FilterBar selected={selectedCategory} onSelect={setSelectedCategory} />
        </div>
        <div className="mt-4 space-y-3">
          {filteredUpdates.map((update) => (
            <ReleaseRow
              key={update.id}
              update={update}
              open={openReleaseId === update.id}
              onToggle={() => setOpenReleaseId((current) => current === update.id ? '' : update.id)}
            />
          ))}
        </div>
      </section>

      <Roadmap />
      <FeedbackBlock />
    </section>
  );
}
