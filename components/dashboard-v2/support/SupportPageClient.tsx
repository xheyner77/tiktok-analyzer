'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type SupportType = 'account' | 'billing' | 'analysis_bug' | 'tiktok' | 'product_feedback' | 'other';
type SupportPriority = 'standard' | 'important' | 'blocking';

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
  };
};

const typeOptions: Array<{ id: SupportType; title: string; description: string }> = [
  { id: 'account', title: 'Problème compte / accès', description: 'Connexion, mot de passe, profil, données.' },
  { id: 'billing', title: 'Billing / abonnement', description: 'Plan, facture, abonnement, Stripe.' },
  { id: 'analysis_bug', title: 'Bug analyse', description: 'Upload bloqué, diagnostic étrange, analyse qui échoue.' },
  { id: 'tiktok', title: 'TikTok / connexion', description: 'Connexion TikTok, permissions, compte relié.' },
  { id: 'product_feedback', title: 'Suggestion produit', description: 'Propose une amélioration pour le coach de repost.' },
  { id: 'other', title: 'Autre', description: 'Un sujet qui ne rentre pas dans les catégories.' },
];

const quickCards: Array<{ type: SupportType; title: string; body: string; cta: string; href?: string }> = [
  { type: 'account', title: 'Compte & accès', body: 'Connexion, mot de passe, profil, données.', cta: 'Demander de l’aide' },
  { type: 'billing', title: 'Billing', body: 'Plan, facture, abonnement, Stripe.', cta: 'Gérer l’abonnement', href: '/dashboard/billing' },
  { type: 'analysis_bug', title: 'Bug analyse', body: 'Résultat incohérent, upload bloqué, analyse qui échoue.', cta: 'Signaler un bug' },
  { type: 'tiktok', title: 'TikTok Sync', body: 'Connexion TikTok, permissions, compte relié.', cta: 'Gérer TikTok' },
  { type: 'product_feedback', title: 'Idée produit', body: 'Propose une amélioration pour le coach de repost.', cta: 'Envoyer une idée' },
];

const resources = [
  { title: 'Première analyse', body: 'Comment importer une vidéo et lire ton diagnostic.', status: 'Support guidé' },
  { title: 'Comprendre la V2', body: 'Comment utiliser la version recommandée avant de republier.', status: 'Bientôt' },
  { title: 'TikTok connecté', body: 'Ce que Viralynz peut lire avec les permissions actuelles.', status: 'Disponible ici' },
  { title: 'Abonnement', body: 'Comprendre les quotas et les modules inclus.', status: 'Dashboard billing' },
];

const feedbackSignals = ['Analyse plus précise', 'Meilleurs hooks', 'Plus de dashboard', 'Publication TikTok', 'Autre'];

function formatQuota(used: number, limit: number | null): string {
  return `${used} / ${limit ?? '∞'}`;
}

function Badge({ children, tone = 'violet' }: { children: React.ReactNode; tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate' }) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/20 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${tones[tone]}`}>{children}</span>;
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

function scrollToForm() {
  document.getElementById('support-request-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SupportPageClient({ context }: SupportPageClientProps) {
  const [type, setType] = useState<SupportType>('account');
  const [priority, setPriority] = useState<SupportPriority>('standard');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackSignal, setFeedbackSignal] = useState<string>('Analyse plus précise');
  const [status, setStatus] = useState<{ tone: 'success' | 'error' | 'info'; text: string; mailto?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestDateLabel, setRequestDateLabel] = useState('Ajoutée à l’envoi');

  const selectedType = useMemo(() => typeOptions.find((item) => item.id === type) ?? typeOptions[0], [type]);

  useEffect(() => {
    setRequestDateLabel(new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()));
  }, []);

  function applyQuickType(nextType: SupportType) {
    setType(nextType);
    if (!subject.trim()) {
      const label = typeOptions.find((item) => item.id === nextType)?.title ?? 'Support';
      setSubject(label);
    }
    scrollToForm();
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    if (!subject.trim() || !message.trim()) {
      setStatus({ tone: 'error', text: 'Ajoute un sujet et un message avant d’envoyer.' });
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
          subject,
          message,
          feedbackSignal,
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

      setStatus({ tone: 'success', text: 'Demande envoyée. L’équipe Viralynz répondra avec le contexte de ton compte.' });
      setSubject('');
      setMessage('');
      setPriority('standard');
    } catch {
      setStatus({ tone: 'error', text: 'Erreur réseau. Réessaie dans un instant.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[1500px] pb-12 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(5,10,24,0.98)_56%,rgba(20,11,42,0.96))] p-5 shadow-[0_34px_110px_-72px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_10%_0%,rgba(168,85,247,0.22),transparent_34%)]" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <span className="inline-flex rounded-full border border-cyan-200/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
              ASSISTANCE
            </span>
            <h1 className="mt-5 text-[36px] font-black tracking-[-0.055em] text-white sm:text-[50px]">Support</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-300">
              Contacte l’équipe Viralynz, signale un bug ou envoie une idée produit.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge>Compte {context.planLabel}</Badge>
              <Badge tone={context.tiktokConnected ? 'green' : 'slate'}>{context.tiktokConnected ? 'TikTok connecté' : 'TikTok non connecté'}</Badge>
              <Badge tone="cyan">Réponse sous 24–48h</Badge>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={scrollToForm} className="min-h-[46px] rounded-[10px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-22px_rgba(139,92,246,0.95)] transition hover:brightness-110">
                Ouvrir une demande
              </button>
              <button type="button" onClick={() => applyQuickType('analysis_bug')} className="min-h-[46px] rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-5 text-[14px] font-black text-slate-100 transition hover:bg-white/[0.075]">
                Signaler un bug
              </button>
            </div>
          </div>
          <div className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Comment peut-on t’aider ?</p>
            <h2 className="mt-3 text-[25px] font-black tracking-[-0.04em] text-white">Choisis le sujet, décris le problème.</h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-400">
              Viralynz ajoute automatiquement le contexte de ton compte: plan, quota, état TikTok et route dashboard.
            </p>
            <div className="mt-5 grid gap-2">
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 px-3 py-2.5 text-[13px] text-slate-300">
                Billing et accès traités avec priorité.
              </div>
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 px-3 py-2.5 text-[13px] text-slate-300">
                Le support voit l’état TikTok, jamais les tokens.
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <SectionTitle
          eyebrow="Raccourcis"
          title="Choisis ton raccourci"
          description="Préremplis la demande ou ouvre directement la section utile."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {quickCards.map((card) => (
            <article key={card.title} className="rounded-[16px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-4 transition hover:border-violet-300/20 hover:bg-white/[0.055]">
              <h3 className="text-[15px] font-black text-white">{card.title}</h3>
              <p className="mt-2 min-h-[54px] text-[12.5px] leading-5 text-slate-400">{card.body}</p>
              {card.href ? (
                <Link href={card.href} className="mt-4 inline-flex text-[12px] font-black text-cyan-100 transition hover:text-white">{card.cta}</Link>
              ) : (
                <button type="button" onClick={() => applyQuickType(card.type)} className="mt-4 text-left text-[12px] font-black text-cyan-100 transition hover:text-white">{card.cta}</button>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <main className="space-y-6">
          <section id="support-request-form" className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(5,9,20,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_28px_96px_-72px_rgba(124,58,237,0.72)] sm:p-5">
            <SectionTitle
              eyebrow="Nouvelle demande"
              title="Décris ce qui bloque"
              description="Explique le contexte. Plus le signal est précis, plus la réponse peut être utile."
            />
            <form onSubmit={submitRequest} className="mt-5 space-y-5">
              <div>
                <p className="text-[13px] font-black text-white">Type de demande</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {typeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setType(option.id)}
                      className={`rounded-[14px] border px-4 py-3 text-left transition ${
                        type === option.id
                          ? 'border-violet-300/35 bg-violet-400/12 shadow-[0_0_34px_-20px_rgba(168,85,247,0.95)]'
                          : 'border-white/[0.065] bg-white/[0.035] hover:bg-white/[0.055]'
                      }`}
                    >
                      <span className="block text-[14px] font-black text-white">{option.title}</span>
                      <span className="mt-1 block text-[12px] leading-5 text-slate-400">{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-[13px] font-black text-white">Priorité</span>
                  <select value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)} className="mt-2 h-12 w-full rounded-[12px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-bold text-slate-100 outline-none focus:border-violet-300/35">
                    <option value="standard">Standard</option>
                    <option value="important">Important</option>
                    <option value="blocking">Bloquant</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[13px] font-black text-white">Sujet</span>
                  <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={140} placeholder={selectedType.title} className="mt-2 h-12 w-full rounded-[12px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-semibold text-white outline-none placeholder:text-slate-600 focus:border-violet-300/35" />
                </label>
              </div>

              <label className="block">
                <span className="text-[13px] font-black text-white">Message</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={4000} rows={8} placeholder="Explique ce qui se passe, ce que tu attendais et ce que tu as essayé." className="mt-2 w-full resize-y rounded-[14px] border border-white/[0.08] bg-[#070d1c] px-3 py-3 text-[13px] font-medium leading-6 text-white outline-none placeholder:text-slate-600 focus:border-violet-300/35" />
                <span className="mt-2 block text-[12px] text-slate-500">{message.length} / 4000 caractères</span>
              </label>

              <div className="rounded-[16px] border border-cyan-200/[0.10] bg-cyan-300/[0.045] p-4">
                <p className="text-[13px] font-black text-white">Contexte automatique</p>
                <div className="mt-3 grid gap-2 text-[12.5px] text-slate-300 sm:grid-cols-2">
                  <span>Email: {context.email}</span>
                  <span>Plan: {context.planLabel}</span>
                  <span>TikTok: {context.tiktokConnected ? 'connecté' : 'non connecté'}</span>
                  <span>Route: /dashboard/support</span>
                  <span>Date: {requestDateLabel}</span>
                  <span>Navigateur: ajouté à l’envoi</span>
                </div>
              </div>

              {status ? (
                <div className={`rounded-[14px] border px-4 py-3 text-[13px] font-semibold ${
                  status.tone === 'success'
                    ? 'border-emerald-300/18 bg-emerald-400/10 text-emerald-50'
                    : status.tone === 'error'
                      ? 'border-rose-300/18 bg-rose-400/10 text-rose-50'
                      : 'border-cyan-300/18 bg-cyan-400/10 text-cyan-50'
                }`}>
                  {status.text}
                  {status.mailto ? <a href={status.mailto} className="ml-2 underline underline-offset-4">Ouvrir l’email</a> : null}
                </div>
              ) : null}

              <button type="submit" disabled={submitting} className="min-h-[48px] w-full rounded-[12px] bg-[linear-gradient(135deg,#e879f9,#8b5cf6_55%,#2563eb)] px-5 text-[14px] font-black text-white shadow-[0_18px_42px_-22px_rgba(139,92,246,0.95)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {submitting ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </form>
          </section>

          <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-4 sm:p-5">
            <SectionTitle
              eyebrow="Ressources"
              title="Ressources utiles"
              description="Les guides complets arrivent progressivement. Pour l’instant, chaque sujet peut ouvrir une demande contextualisée."
            />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {resources.map((resource) => (
                <article key={resource.title} className="rounded-[15px] border border-white/[0.065] bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-black text-white">{resource.title}</h3>
                    <Badge tone={resource.status === 'Bientôt' ? 'amber' : 'cyan'}>{resource.status}</Badge>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-400">{resource.body}</p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(5,9,20,0.98))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Compte</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Contexte de ton compte</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">Ce contexte accompagne ta demande. Aucun token ni secret n’est exposé.</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Email</p>
                <p className="mt-1 truncate text-[14px] font-black text-white">{context.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Plan</p>
                  <p className="mt-1 text-[14px] font-black text-white">{context.planLabel}</p>
                </div>
                <div className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Analyses</p>
                  <p className="mt-1 text-[14px] font-black text-white">{formatQuota(context.quotaUsed, context.quotaLimit)}</p>
                </div>
              </div>
              <div className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">TikTok</p>
                <p className="mt-1 text-[14px] font-black text-white">{context.tiktokConnected ? (context.tiktokDisplayName || 'Compte relié') : 'Non connecté'}</p>
                <p className="mt-1 text-[12px] text-slate-500">{context.tiktokConnected ? `${context.tiktokModeLabel} · ${context.tiktokScopes.length ? context.tiktokScopes.join(', ') : 'profil basique'}` : 'Aucune permission TikTok active'}</p>
              </div>
              <div className="rounded-[13px] border border-white/[0.065] bg-white/[0.035] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Billing</p>
                <p className="mt-1 text-[14px] font-black text-white">{context.billingStatus || 'Non disponible'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(160deg,rgba(8,47,73,0.30),rgba(8,13,28,0.98))] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">Feedback produit</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Aide-nous à améliorer Viralynz</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">Choisis le signal principal; il sera ajouté à ta demande.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {feedbackSignals.map((signal) => (
                <button
                  key={signal}
                  type="button"
                  onClick={() => {
                    setFeedbackSignal(signal);
                    setType('product_feedback');
                  }}
                  className={`rounded-full border px-3 py-2 text-[12px] font-black transition ${
                    feedbackSignal === signal
                      ? 'border-cyan-200/35 bg-cyan-300/14 text-cyan-50'
                      : 'border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  {signal}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.88),rgba(5,9,20,0.98))] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-200/70">Délais</p>
            <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white">Réponse 24–48h</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">
              Les demandes billing, accès bloqué et bugs d’analyse sont priorisées. Les idées produit nourrissent la roadmap Viralynz.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
}
