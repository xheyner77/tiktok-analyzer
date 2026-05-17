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
const featuredUpdates = productUpdates.filter((update) => update.featured).slice(0, 4);

const categoryDescriptions: Record<ProductUpdateCategory, string> = {
  Dashboard: 'Shell, navigation, états vides et surfaces internes.',
  Analyse: 'Diagnostic vidéo, pipeline, décisions de montage.',
  'TikTok Sync': 'Connexion TikTok, permissions et compte relié.',
  Hooks: 'Premières secondes, angles et hook studio.',
  'Rewrite / V2': 'Transformation des diagnostics en versions à republier.',
  Publication: 'Préparation des reposts et workflows de sortie.',
  Billing: 'Plans, quotas, Stripe et accès produit.',
  'Expérience utilisateur': 'Support, paramètres, feedback et clarté produit.',
};

function Badge({
  children,
  tone = 'violet',
}: {
  children: React.ReactNode;
  tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate' | 'rose';
}) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
    rose: 'border-rose-300/18 bg-rose-400/10 text-rose-100',
  };

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${tones[tone]}`}>{children}</span>;
}

function statusTone(status: ProductUpdateStatus | RoadmapStatus): 'violet' | 'cyan' | 'green' | 'amber' | 'slate' {
  if (status === 'Livré') return 'green';
  if (status === 'Nouveau') return 'cyan';
  if (status === 'Amélioré') return 'violet';
  if (status === 'Recherche') return 'amber';
  if (status === 'Bientôt') return 'cyan';
  return 'slate';
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p>
      <h2 className="mt-2 text-[24px] font-black tracking-[-0.035em] text-white sm:text-[28px]">{title}</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8h10" />
      <path d="m9 4 4 4-4 4" />
    </svg>
  );
}

function Hero() {
  const heroStats = [
    { label: 'Dernière release', value: stats.latestRelease.version, detail: stats.latestRelease.date },
    { label: 'Fonctionnalités livrées', value: `${stats.totalReleases}`, detail: 'releases listées' },
    { label: 'Améliorations dashboard', value: `${stats.dashboardImprovements}`, detail: 'modules touchés' },
    { label: 'En préparation', value: `${stats.upcomingCount}`, detail: 'chantiers suivis' },
  ];

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(5,10,24,0.98)_56%,rgba(20,11,42,0.96))] p-5 shadow-[0_34px_110px_-72px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.24),transparent_35%)]" />
      <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_470px]">
        <div>
          <span className="inline-flex rounded-full border border-cyan-200/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
            JOURNAL PRODUIT
          </span>
          <h1 className="mt-5 text-[36px] font-black tracking-[-0.055em] text-white sm:text-[50px]">Nouveautés</h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-300">
            Suis les dernières améliorations produit, les nouvelles fonctionnalités et les évolutions du moteur Viralynz.
          </p>
          <p className="mt-4 max-w-3xl text-[13px] leading-6 text-slate-400">
            Découvre les dernières améliorations de l’analyse, du dashboard, des hooks, de la mémoire créateur et des workflows Viralynz.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#latest-releases" className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-22px_rgba(139,92,246,0.95)] transition hover:brightness-110">
              Voir les dernières releases
              <ArrowIcon />
            </a>
            <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
              Donner mon feedback
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {heroStats.map((item) => (
            <div key={item.label} className="rounded-[16px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
              <p className="mt-3 text-[28px] font-black tracking-[-0.05em] text-white">{item.value}</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ update }: { update: ProductUpdate }) {
  return (
    <article className="group relative overflow-hidden rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-4 transition hover:border-violet-300/22 hover:bg-white/[0.055]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.32),transparent)] opacity-0 transition group-hover:opacity-100" />
      <div className="flex flex-wrap gap-2">
        <Badge tone="cyan">{update.category}</Badge>
        <Badge tone={statusTone(update.status)}>{update.status}</Badge>
      </div>
      <h3 className="mt-4 text-[17px] font-black tracking-[-0.02em] text-white">{update.title}</h3>
      <p className="mt-3 min-h-[72px] text-[13px] leading-6 text-slate-400">{update.summary}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.065] pt-4">
        <span className="text-[12px] font-black text-slate-300">{update.version}</span>
        <time dateTime={update.isoDate} className="text-[12px] font-semibold text-slate-500">{update.date}</time>
      </div>
    </article>
  );
}

function TimelineCard({ update, index }: { update: ProductUpdate; index: number }) {
  return (
    <article className="relative grid gap-4 rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:grid-cols-[150px_minmax(0,1fr)] sm:p-5">
      <div className="flex gap-3 sm:block">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-violet-300/24 bg-violet-400/12 text-[12px] font-black text-violet-50 sm:mb-4">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div>
          <p className="text-[15px] font-black text-white">{update.version}</p>
          <time dateTime={update.isoDate} className="mt-1 block text-[12px] font-semibold leading-5 text-slate-500">{update.date}</time>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          <Badge>{update.category}</Badge>
          <Badge tone={statusTone(update.status)}>{update.status}</Badge>
          {update.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone="slate">{tag}</Badge>
          ))}
        </div>
        <h3 className="mt-4 text-[21px] font-black tracking-[-0.03em] text-white">{update.title}</h3>
        <p className="mt-2 text-[14px] leading-6 text-slate-400">{update.summary}</p>
        <div className="mt-5 grid gap-2 lg:grid-cols-3">
          {update.bullets.map((bullet) => (
            <p key={bullet} className="flex gap-2 rounded-[13px] border border-white/[0.065] bg-black/15 p-3 text-[13px] leading-6 text-slate-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.7)]" />
              {bullet}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}

function CategoryPanel({ selected, onSelect }: { selected: CategoryFilter; onSelect: (category: CategoryFilter) => void }) {
  return (
    <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.98))] p-4 sm:p-5">
      <SectionTitle
        eyebrow="Catégories"
        title="Filtrer le journal"
        description="Chaque catégorie suit une zone du produit. Le filtre reste local à cette page."
      />
      <div className="mt-5 flex flex-wrap gap-2">
        {(['Tout', ...productUpdateCategories] as CategoryFilter[]).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={`rounded-full border px-3 py-2 text-[12px] font-black transition ${
              selected === category
                ? 'border-cyan-200/36 bg-cyan-300/14 text-cyan-50 shadow-[0_0_28px_-18px_rgba(34,211,238,0.9)]'
                : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {productUpdateCategories.map((category) => (
          <div key={category} className="rounded-[14px] border border-white/[0.065] bg-white/[0.035] p-3">
            <p className="text-[13px] font-black text-white">{category}</p>
            <p className="mt-2 text-[12px] leading-5 text-slate-500">{categoryDescriptions[category]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-4 sm:p-5">
      <SectionTitle
        eyebrow="Prochainement"
        title="En préparation"
        description="Une roadmap légère, sans promesse artificielle. Les prochaines étapes restent liées au coach de repost."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {upcomingProductUpdates.map((item) => (
          <article key={item.id} className="rounded-[16px] border border-white/[0.065] bg-white/[0.035] p-4">
            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              <Badge tone="slate">{item.category}</Badge>
            </div>
            <h3 className="mt-4 text-[16px] font-black text-white">{item.title}</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function SidePanel() {
  const modules = ['Dashboard', 'Analyse', 'TikTok Sync', 'Billing', 'Support'];

  return (
    <aside className="space-y-5">
      <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(5,9,20,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Résumé</p>
        <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Version actuelle</h2>
        <div className="mt-5 rounded-[15px] border border-violet-300/16 bg-violet-400/[0.08] p-4">
          <p className="text-[34px] font-black tracking-[-0.06em] text-white">{stats.latestRelease.version}</p>
          <p className="mt-1 text-[13px] font-semibold text-violet-100">{stats.latestRelease.title}</p>
          <time dateTime={stats.latestRelease.isoDate} className="mt-2 block text-[12px] text-slate-500">{stats.latestRelease.date}</time>
        </div>
      </section>

      <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(160deg,rgba(8,47,73,0.30),rgba(8,13,28,0.98))] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Focus</p>
        <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Focus du moment</h2>
        <p className="mt-3 text-[13px] leading-6 text-slate-400">
          Rendre chaque section dashboard plus claire, plus actionnable et plus honnête sur les données disponibles.
        </p>
      </section>

      <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-200/70">Modules</p>
        <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Récemment améliorés</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {modules.map((module) => (
            <Badge key={module} tone={module === 'TikTok Sync' ? 'cyan' : 'violet'}>{module}</Badge>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-5">
        <div className="grid h-10 w-10 place-items-center rounded-[12px] border border-cyan-200/18 bg-cyan-300/10 text-cyan-100">
          <SparkIcon />
        </div>
        <h2 className="mt-4 text-[22px] font-black tracking-[-0.035em] text-white">Besoin d’une fonctionnalité ?</h2>
        <p className="mt-3 text-[13px] leading-6 text-slate-400">
          Envoie une idée concrète : ce que tu veux décider plus vite, ce qui bloque ton repost, ce qu’il manque au dashboard.
        </p>
        <Link href="/dashboard/support" className="mt-5 inline-flex min-h-[42px] w-full items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.055] px-4 text-[13px] font-black text-white transition hover:bg-white/[0.08]">
          Envoyer une idée
        </Link>
      </section>
    </aside>
  );
}

function FeedbackBlock() {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(76,29,149,0.26),rgba(5,9,20,0.98)_56%,rgba(8,47,73,0.28))] p-5 shadow-[0_32px_100px_-78px_rgba(34,211,238,0.86),inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_10%,rgba(34,211,238,0.14),transparent_34%)]" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Feedback</p>
          <h2 className="mt-3 text-[26px] font-black tracking-[-0.045em] text-white sm:text-[34px]">Tu veux influencer les prochaines nouveautés ?</h2>
          <p className="mt-3 max-w-2xl text-[14px] leading-6 text-slate-300">
            Dis-nous ce qui t’aiderait à transformer une analyse en meilleure V2. Les idées concrètes nourrissent la roadmap.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white transition hover:brightness-110">
            Envoyer une idée
          </Link>
          <Link href="/dashboard/support" className="inline-flex min-h-[46px] items-center justify-center rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
            Contacter le support
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function UpdatesPageClient() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('Tout');
  const filteredUpdates = useMemo(() => {
    if (selectedCategory === 'Tout') return productUpdates;
    return productUpdates.filter((update) => update.tags.includes(selectedCategory) || update.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <section className="mx-auto w-full max-w-[1500px] pb-12 pt-4 text-white">
      <Hero />

      <section className="mt-8">
        <SectionTitle
          eyebrow="À la une"
          title="Highlights récents"
          description="Les changements qui structurent le plus l’expérience produit actuelle."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {featuredUpdates.map((update) => (
            <FeaturedCard key={update.id} update={update} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <CategoryPanel selected={selectedCategory} onSelect={setSelectedCategory} />
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main id="latest-releases" className="space-y-5">
          <section>
            <SectionTitle
              eyebrow="Changelog"
              title="Timeline produit"
              description="Une lecture chronologique des releases livrées dans l’app dashboard."
            />
            <div className="mt-5 space-y-4">
              {filteredUpdates.map((update, index) => (
                <TimelineCard key={update.id} update={update} index={index} />
              ))}
            </div>
          </section>

          <Roadmap />
          <FeedbackBlock />
        </main>

        <SidePanel />
      </div>
    </section>
  );
}
