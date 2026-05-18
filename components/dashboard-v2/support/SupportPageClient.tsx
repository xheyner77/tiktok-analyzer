'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type SupportType = 'analysis_bug' | 'ai_result' | 'tiktok' | 'billing' | 'quotas' | 'product_feedback';
type SupportPriority = 'standard' | 'important' | 'blocking';
type IconName = 'analysis' | 'spark' | 'tiktok' | 'billing' | 'quota' | 'idea' | 'shield' | 'route' | 'arrow' | 'check' | 'clock';

type SupportPageClientProps = {
  context: {
    email: string;
    planLabel: string;
    quotaUsed: number;
    quotaLimit: number | null;
    tiktokConnected: boolean;
    tiktokDisplayName: string | null;
    tiktokModeLabel: string;
    tiktokScopes: string[];
    billingStatus: string | null;
    hasLatestAnalysis: boolean;
    latestAnalysisTitle: string;
    latestAnalysisDate: string;
  };
};

const typeOptions: Array<{
  id: SupportType;
  title: string;
  description: string;
  subject: string;
  badge?: string;
  icon: IconName;
  helper: string;
}> = [
  {
    id: 'analysis_bug',
    title: 'Analyse bloquée',
    description: 'Upload, traitement, résultat vide ou analyse qui échoue.',
    subject: 'Analyse bloquée ou résultat vide',
    badge: 'Fréquent',
    icon: 'analysis',
    helper: 'Ajoute ce que tu as envoyé, à quel moment ça bloque, et ce que tu attendais comme résultat.',
  },
  {
    id: 'ai_result',
    title: 'Résultat IA étrange',
    description: 'Diagnostic trop vague, mauvais contexte, recommandations incohérentes.',
    subject: 'Résultat IA à vérifier',
    icon: 'spark',
    helper: 'Indique ce qui paraît incohérent : hook, diagnostic, V2, CTA ou contexte de la vidéo.',
  },
  {
    id: 'tiktok',
    title: 'TikTok Sync',
    description: 'Connexion, permissions, compte relié, données manquantes.',
    subject: 'Problème TikTok Sync',
    icon: 'tiktok',
    helper: 'Précise si le problème vient de la connexion, des permissions ou du compte relié.',
  },
  {
    id: 'billing',
    title: 'Abonnement / Stripe',
    description: 'Plan, facture, paiement, portail Stripe.',
    subject: 'Question abonnement ou Stripe',
    icon: 'billing',
    helper: 'Ne partage jamais tes informations de carte. Utilise uniquement le portail Stripe pour les paiements.',
  },
  {
    id: 'quotas',
    title: 'Quotas',
    description: 'Analyses restantes, hooks, limite mensuelle.',
    subject: 'Question sur mes quotas',
    icon: 'quota',
    helper: 'Ajoute le quota concerné : analyses, hooks, reconstructions IA ou synchronisation TikTok.',
  },
  {
    id: 'product_feedback',
    title: 'Idée produit',
    description: 'Proposer une amélioration du coach de repost.',
    subject: 'Idée produit Viralynz',
    icon: 'idea',
    helper: 'Décris le workflow que tu veux accélérer : analyse, hook, V2, repost ou reporting.',
  },
];

const quickResources = [
  { title: 'Première analyse', body: 'Importer une vidéo et lire le diagnostic.', href: '/dashboard/analyze' },
  { title: 'Comprendre la V2', body: 'Transformer le diagnostic en version à republier.', href: '/dashboard/rewrite' },
  { title: 'TikTok connecté', body: 'Vérifier le compte relié et les permissions.', href: '/dashboard/settings' },
  { title: 'Abonnement', body: 'Voir les quotas, le plan et la facturation.', href: '/dashboard/billing' },
];

function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const stroke = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'analysis') return <svg {...stroke}><path d="M4 19V5" /><path d="M8 17V9" /><path d="M12 17V4" /><path d="M16 17v-6" /><path d="M20 17V7" /></svg>;
  if (name === 'spark') return <svg {...stroke}><path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" /></svg>;
  if (name === 'tiktok') return <svg {...stroke}><path d="M15 4v9.5a4.5 4.5 0 1 1-4.5-4.5" /><path d="M15 4c.8 2.8 2.4 4.5 5 5" /></svg>;
  if (name === 'billing') return <svg {...stroke}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18" /><path d="M7 15h3" /></svg>;
  if (name === 'quota') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l4 2" /></svg>;
  if (name === 'idea') return <svg {...stroke}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14c-.9.8-1.5 1.7-1.5 3h-4c0-1.2-.6-2-1.5-2.5Z" /></svg>;
  if (name === 'shield') return <svg {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === 'route') return <svg {...stroke}><path d="M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M8.5 15h4A3.5 3.5 0 0 0 16 11.5V11" /></svg>;
  if (name === 'arrow') return <svg {...stroke}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
  if (name === 'check') return <svg {...stroke}><path d="m5 12 4 4L19 6" /></svg>;
  if (name === 'clock') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  return null;
}

function formatQuota(used: number, limit: number | null): string {
  return `${used} / ${limit ?? '∞'}`;
}

function billingLabel(status: string | null): string {
  if (status === 'active') return 'Actif';
  if (status === 'trialing') return 'Essai actif';
  if (status === 'canceled') return 'Annulé';
  if (status === 'past_due' || status === 'unpaid') return 'À vérifier';
  return 'Aucun abonnement actif';
}

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'cyan' | 'green' | 'slate' | 'amber' }) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
    amber: 'border-amber-300/18 bg-amber-400/10 text-amber-100',
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-white/[0.065] bg-white/[0.035] px-3 py-2.5">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <span className="max-w-[210px] truncate text-right text-[12.5px] font-black text-white">{value}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-black text-white">{children}</span>;
}

function scrollToForm() {
  document.getElementById('support-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SupportPageClient({ context }: SupportPageClientProps) {
  const [type, setType] = useState<SupportType>('analysis_bug');
  const [priority, setPriority] = useState<SupportPriority>('standard');
  const [subject, setSubject] = useState('Analyse bloquée ou résultat vide');
  const [message, setMessage] = useState('');
  const [issueReference, setIssueReference] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string; mailto?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [routeLabel, setRouteLabel] = useState('/dashboard/support');

  const selectedType = useMemo(() => typeOptions.find((item) => item.id === type) ?? typeOptions[0], [type]);
  const tiktokLabel = context.tiktokConnected
    ? context.tiktokDisplayName ? `Connecté · ${context.tiktokDisplayName}` : 'Connecté'
    : 'Non connecté';
  const latestAnalysis = context.hasLatestAnalysis ? `${context.latestAnalysisTitle} · ${context.latestAnalysisDate}` : 'Aucune analyse';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRouteLabel(window.location.pathname || '/dashboard/support');
    }
  }, []);

  function selectType(nextType: SupportType) {
    const option = typeOptions.find((item) => item.id === nextType);
    setType(nextType);
    if (!subject.trim() || typeOptions.some((item) => item.subject === subject)) {
      setSubject(option?.subject ?? '');
    }
    setStatus(null);
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const cleanReference = issueReference.trim();

    if (!cleanSubject || !cleanMessage) {
      setStatus({ tone: 'error', text: 'Choisis un sujet, ajoute un titre et décris ce qui bloque.' });
      return;
    }

    setSubmitting(true);
    try {
      const browserContext = typeof navigator !== 'undefined'
        ? `${navigator.userAgent.slice(0, 220)} | ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
        : '';
      const currentRoute = typeof window !== 'undefined' ? window.location.pathname : '/dashboard/support';

      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          priority,
          subject: cleanSubject,
          message: cleanMessage,
          issueReference: cleanReference,
          feedbackSignal: selectedType.title,
          browserContext,
          currentRoute,
        }),
      });
      const data = (await response.json()) as { error?: string; mailto?: string };

      if (!response.ok) {
        setStatus({
          tone: 'error',
          text: data.error || 'Impossible d’envoyer la demande pour le moment.',
          mailto: data.mailto,
        });
        return;
      }

      setStatus({ tone: 'success', text: 'Demande envoyée. On revient vers toi dès que possible.' });
      setSubject(selectedType.subject);
      setMessage('');
      setIssueReference('');
      setPriority('standard');
    } catch {
      setStatus({ tone: 'error', text: 'Erreur réseau. Réessaie dans un instant.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1460px] pb-10 pt-4 text-white">
      <section className="relative overflow-hidden rounded-[26px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(12,19,38,0.97),rgba(4,8,19,0.99)_56%,rgba(28,13,54,0.96))] p-5 shadow-[0_38px_124px_-82px_rgba(124,58,237,0.98),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_12%,rgba(34,211,238,0.14),transparent_32%),radial-gradient(circle_at_9%_4%,rgba(168,85,247,0.2),transparent_34%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.13] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:42px_42px]" />

        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="cyan">Support Center</Badge>
              <Badge tone="slate">Réponse 24-48h</Badge>
              <Badge tone="green">Contexte compte attaché</Badge>
              <Badge tone="slate">Aucun token secret envoyé</Badge>
              <Badge tone={context.tiktokConnected ? 'green' : 'amber'}>{context.tiktokConnected ? 'TikTok connecté' : 'TikTok non connecté'}</Badge>
              <Badge tone="violet">Plan {context.planLabel}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-[36px] font-black leading-[0.95] tracking-[-0.06em] text-white sm:text-[52px] lg:text-[64px]">
              Un blocage ? Viralynz joint déjà le contexte.
            </h1>
            <p className="mt-5 max-w-3xl text-[15px] leading-7 text-slate-300 sm:text-[17px]">
              Décris le problème. Ton plan, ton quota, ton état TikTok et la route actuelle sont ajoutés automatiquement pour accélérer la réponse.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={scrollToForm} className="min-h-[46px] rounded-[12px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_22px_52px_-26px_rgba(139,92,246,1)] transition hover:-translate-y-0.5 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-300/40">
                Ouvrir une demande
              </button>
              <button type="button" onClick={() => { selectType('analysis_bug'); scrollToForm(); }} className="min-h-[46px] rounded-[12px] border border-white/[0.10] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:border-cyan-200/20 hover:bg-white/[0.075]">
                Diagnostiquer mon problème
              </button>
            </div>
          </div>

          <aside className="rounded-[20px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.065),0_30px_88px_-66px_rgba(34,211,238,0.8)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Contexte joint automatiquement</p>
                <p className="mt-1 text-[12px] font-semibold text-slate-400">Capsule intelligente de support</p>
              </div>
              <Badge tone="green">Auto-joint</Badge>
            </div>
            <div className="mt-4 grid gap-2.5">
              <ContextRow label="Email" value={context.email} />
              <ContextRow label="Plan" value={context.planLabel} />
              <ContextRow label="TikTok" value={tiktokLabel} />
              <ContextRow label="Analyses" value={formatQuota(context.quotaUsed, context.quotaLimit)} />
              <ContextRow label="Route" value={routeLabel} />
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.985))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Résoudre vite</p>
            <h2 className="mt-2 text-[26px] font-black tracking-[-0.045em] text-white">Choisis le signal le plus proche.</h2>
          </div>
          <p className="max-w-xl text-[13px] leading-6 text-slate-400">Viralynz prépare la demande avec les bons détails.</p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {typeOptions.map((option) => {
            const active = type === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectType(option.id)}
                className={`group relative overflow-hidden rounded-[17px] border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                  active
                    ? 'border-violet-300/35 bg-violet-400/[0.10] shadow-[0_28px_82px_-60px_rgba(168,85,247,1),inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border-white/[0.065] bg-white/[0.032] hover:border-cyan-200/16 hover:bg-white/[0.052]'
                }`}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_18%_0%,rgba(34,211,238,0.12),transparent_38%)]" />
                <div className="relative flex items-start gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border ${active ? 'border-violet-200/25 bg-violet-300/[0.12] text-violet-100' : 'border-white/[0.08] bg-white/[0.045] text-cyan-100'}`}>
                    <Icon name={option.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-black text-white">{option.title}</span>
                      {option.badge ? <span className="rounded-full border border-amber-300/18 bg-amber-300/[0.08] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-100">{option.badge}</span> : null}
                    </span>
                    <span className="mt-2 block text-[12.5px] leading-5 text-slate-400">{option.description}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main id="support-request-form" className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.94),rgba(5,9,20,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_96px_-74px_rgba(124,58,237,0.72)] sm:p-5 lg:p-6">
          <div>
            <Badge tone="cyan">Smart Request</Badge>
            <h2 className="mt-3 text-[30px] font-black tracking-[-0.05em] text-white">Demande intelligente</h2>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-slate-400">Plus le signal est précis, plus la réponse est utile.</p>
          </div>

          <div className="mt-5 rounded-[16px] border border-cyan-300/12 bg-cyan-300/[0.055] px-4 py-3 text-[13px] font-semibold leading-6 text-cyan-50/88">
            {selectedType.helper}
          </div>

          <form onSubmit={submitRequest} className="mt-5 space-y-4">
            <div className="grid gap-3 md:grid-cols-[190px_minmax(0,1fr)]">
              <label className="block">
                <FieldLabel>Priorité</FieldLabel>
                <select value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)} className="mt-2 h-12 w-full rounded-[13px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-bold text-slate-100 outline-none transition focus:border-violet-300/40 focus:ring-2 focus:ring-violet-300/10">
                  <option value="standard">Standard</option>
                  <option value="important">Important</option>
                  <option value="blocking">Bloquant</option>
                </select>
              </label>
              <label className="block">
                <FieldLabel>Sujet</FieldLabel>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} placeholder={selectedType.subject} className="mt-2 h-12 w-full rounded-[13px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/40 focus:ring-2 focus:ring-violet-300/10" />
              </label>
            </div>

            <label className="block">
              <FieldLabel>Lien vidéo / ID analyse / référence</FieldLabel>
              <input value={issueReference} onChange={(event) => setIssueReference(event.target.value)} maxLength={500} placeholder="Optionnel : URL TikTok, /analyses/..., ID, détail utile" className="mt-2 h-12 w-full rounded-[13px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/40 focus:ring-2 focus:ring-violet-300/10" />
            </label>

            <label className="block">
              <FieldLabel>Message</FieldLabel>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={8} placeholder="Décris ce qui se passe, ce que tu attendais et ce que tu as essayé." className="mt-2 w-full resize-y rounded-[15px] border border-white/[0.08] bg-[#070d1c] px-3 py-3 text-[13px] font-medium leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/40 focus:ring-2 focus:ring-violet-300/10" />
              <span className="mt-2 block text-right text-[12px] text-slate-500">{message.length} / 4000 caractères</span>
            </label>

            {status ? (
              <div className={`rounded-[15px] border px-4 py-3 text-[13px] font-semibold ${
                status.tone === 'success'
                  ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-50'
                  : 'border-rose-300/18 bg-rose-400/10 text-rose-50'
              }`}>
                {status.text}
                {status.mailto ? <a href={status.mailto} className="ml-2 underline underline-offset-4">Ouvrir l’email</a> : null}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="min-h-[50px] w-full rounded-[13px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_22px_54px_-24px_rgba(139,92,246,1)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Envoi en cours...' : 'Envoyer la demande'}
            </button>
            <p className="text-center text-[12px] font-semibold text-slate-500">Le contexte compte est joint automatiquement. Aucun token ni secret n’est envoyé.</p>
          </form>
        </main>

        <aside className="space-y-5 xl:sticky xl:top-[104px] xl:self-start">
          <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.94),rgba(5,9,20,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Contexte attaché</p>
                <h2 className="mt-2 text-[22px] font-black tracking-[-0.04em] text-white">Ces infos accompagnent ta demande.</h2>
              </div>
              <Badge tone="green">Auto-joint</Badge>
            </div>
            <div className="mt-4 grid gap-2.5">
              <ContextRow label="Email" value={context.email} />
              <ContextRow label="Plan" value={context.planLabel} />
              <ContextRow label="TikTok" value={tiktokLabel} />
              <ContextRow label="Analyses utilisées" value={formatQuota(context.quotaUsed, context.quotaLimit)} />
              <ContextRow label="Route actuelle" value={routeLabel} />
              <ContextRow label="Stripe" value={billingLabel(context.billingStatus)} />
              <ContextRow label="Dernière analyse" value={latestAnalysis} />
            </div>
            <div className="mt-4 rounded-[14px] border border-white/[0.065] bg-black/18 px-3 py-3">
              <div className="flex gap-2 text-[12px] leading-5 text-slate-400">
                <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                <span>Aucun token, secret ou moyen de paiement n’est envoyé.</span>
              </div>
            </div>
          </section>

          <section className="rounded-[22px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.99))] p-4 sm:p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">Besoin rapide ?</p>
            <div className="mt-4 grid gap-2.5">
              {quickResources.map((resource) => (
                <Link key={resource.title} href={resource.href} className="group rounded-[14px] border border-white/[0.065] bg-white/[0.035] px-3 py-3 transition hover:border-cyan-200/20 hover:bg-white/[0.06]">
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-black text-white">{resource.title}</span>
                    <Icon name="arrow" className="h-4 w-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
                  </span>
                  <span className="mt-1 block text-[12px] leading-5 text-slate-500">{resource.body}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[18px] border border-white/[0.065] bg-white/[0.032] p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-white/[0.08] bg-white/[0.045] text-cyan-100">
                <Icon name="clock" />
              </span>
              <div>
                <p className="text-[13px] font-black text-white">Historique support bientôt disponible</p>
                <p className="mt-1 text-[12px] leading-5 text-slate-500">Les demandes envoyées seront regroupées ici quand le suivi ticket sera branché.</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
