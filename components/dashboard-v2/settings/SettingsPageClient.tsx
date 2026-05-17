'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AppPlan } from '@/lib/plans';

type ToggleKey =
  | 'compactDashboard'
  | 'restoreLastTab'
  | 'advancedAnimations'
  | 'confirmImportantActions'
  | 'focusAnalysis'
  | 'creatorMemory'
  | 'autoV2'
  | 'hookAlternatives'
  | 'ctaAlternatives'
  | 'shortVersion'
  | 'productNewsEmail'
  | 'importantAlertsEmail'
  | 'billingEmail'
  | 'analysisDoneEmail'
  | 'aiNewsEmail';

type SettingsPreferenceState = Record<ToggleKey, boolean>;

type SettingsPageClientProps = {
  account: {
    name: string;
    email: string;
    plan: AppPlan;
    planLabel: string;
    createdAt: string | null;
    subscriptionStatus: string | null;
  };
  tiktok: {
    connected: boolean;
    displayName: string | null;
    avatarUrl: string | null;
    connectedAt: string | null;
    modeLabel: string;
    scopes: string[];
    hasAdvancedMetrics: boolean;
  };
  memory: {
    active: boolean;
    summary: string;
    sourceAnalysisCount: number;
    updatedAt: string | null;
    remembered: string[];
  };
  expertMode: {
    exists: boolean;
    enabled: boolean;
    analysisDepth: string;
    updatedAt: string | null;
    weights: {
      hook: number;
      retention: number;
      cta: number;
      payoff: number;
    };
  };
};

const defaultPreferences: SettingsPreferenceState = {
  compactDashboard: false,
  restoreLastTab: true,
  advancedAnimations: true,
  confirmImportantActions: true,
  focusAnalysis: false,
  creatorMemory: true,
  autoV2: false,
  hookAlternatives: true,
  ctaAlternatives: true,
  shortVersion: false,
  productNewsEmail: true,
  importantAlertsEmail: true,
  billingEmail: true,
  analysisDoneEmail: false,
  aiNewsEmail: true,
};

const preferenceStorageKey = 'viralynz.settings.preferences.v1';

function formatDate(value: string | null): string {
  if (!value) return 'Non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function initials(name: string, email: string): string {
  const base = name.trim() || email.split('@')[0] || 'V';
  return base.slice(0, 2).toUpperCase();
}

function statusLabel(status: string | null): string {
  if (status === 'active') return 'Abonnement actif';
  if (status === 'trialing') return 'Essai actif';
  if (status === 'canceled') return 'Abonnement annulé';
  if (status === 'past_due' || status === 'unpaid') return 'Paiement à vérifier';
  return 'Compte actif';
}

function safeScopes(scopes: string[]): string {
  if (!scopes.length) return 'Profil basique';
  return scopes.join(', ');
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(10,18,34,0.9),rgba(5,9,20,0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.045),0_28px_96px_-72px_rgba(124,58,237,0.72)] sm:p-5">
      <div className="mb-5">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200/70">{eyebrow}</p>
        <h2 className="mt-2 text-[22px] font-black tracking-[-0.035em] text-white sm:text-[26px]">{title}</h2>
        <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">{description}</p>
      </div>
      {children}
    </section>
  );
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

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  badge,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="group flex w-full items-center justify-between gap-4 rounded-[14px] border border-white/[0.065] bg-white/[0.035] px-4 py-3 text-left transition hover:border-violet-300/18 hover:bg-white/[0.055]"
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-black text-white">
          {title}
          {badge ? <span className="rounded-full bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">{badge}</span> : null}
        </span>
        <span className="mt-1 block text-[12.5px] leading-5 text-slate-400">{description}</span>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full border transition ${checked ? 'border-violet-300/40 bg-violet-500/70 shadow-[0_0_24px_rgba(139,92,246,0.45)]' : 'border-white/10 bg-white/[0.055]'}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </button>
  );
}

function SelectRow({ label, value, options, note }: { label: string; value: string; options: string[]; note: string }) {
  return (
    <label className="block rounded-[14px] border border-white/[0.065] bg-white/[0.035] px-4 py-3">
      <span className="text-[14px] font-black text-white">{label}</span>
      <select
        value={value}
        disabled
        className="mt-3 h-11 w-full rounded-[10px] border border-white/[0.08] bg-[#070d1c] px-3 text-[13px] font-bold text-slate-200 outline-none"
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      <span className="mt-2 block text-[12px] leading-5 text-slate-500">{note}</span>
    </label>
  );
}

function SliderRow({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="rounded-[14px] border border-white/[0.065] bg-white/[0.035] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[14px] font-black text-white">{label}</p>
        <span className="text-[12px] font-black text-violet-100">{value}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#8b5cf6,#e879f9)]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <p className="mt-2 text-[12px] leading-5 text-slate-500">{note}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  href,
  tone = 'default',
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
}) {
  const classes = {
    default: 'border-white/[0.09] bg-white/[0.045] text-slate-100 hover:bg-white/[0.075]',
    primary: 'border-violet-300/20 bg-[linear-gradient(135deg,#e879f9,#7c3aed)] text-white hover:brightness-110',
    danger: 'border-rose-300/18 bg-rose-400/[0.08] text-rose-100 hover:bg-rose-400/[0.12]',
  };
  const className = `inline-flex min-h-[42px] items-center justify-center rounded-[10px] border px-4 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${classes[tone]}`;

  if (href && !disabled) {
    return <Link href={href} className={className}>{children}</Link>;
  }

  return <button type="button" onClick={onClick} disabled={disabled} className={className}>{children}</button>;
}

function IntegrationAvatar({ tiktok }: { tiktok: SettingsPageClientProps['tiktok'] }) {
  if (tiktok.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tiktok.avatarUrl} alt="" className="h-14 w-14 rounded-full border border-white/12 object-cover" />
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan-200/18 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.35),rgba(139,92,246,0.22),rgba(2,6,17,0.95))] text-[22px] font-black text-white">
      ♪
    </div>
  );
}

export default function SettingsPageClient({ account, tiktok, memory, expertMode }: SettingsPageClientProps) {
  const [preferences, setPreferences] = useState<SettingsPreferenceState>(defaultPreferences);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'disconnectTikTok' | null>(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(preferenceStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<SettingsPreferenceState>;
      setPreferences({ ...defaultPreferences, ...parsed });
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  function updatePreference(key: ToggleKey) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(next));
    setMessage('Préférences enregistrées sur cet appareil.');
  }

  function resetLocalPreferences() {
    setPreferences(defaultPreferences);
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(defaultPreferences));
    setMessage('Préférences locales réinitialisées.');
  }

  async function sendPasswordReset() {
    setBusyAction('password');
    setMessage(null);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Impossible d’envoyer l’email.');
      setMessage('Email de changement de mot de passe envoyé.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Impossible d’envoyer l’email.');
    } finally {
      setBusyAction(null);
    }
  }

  async function disconnectTikTok() {
    setConfirmAction(null);
    setBusyAction('tiktok');
    setMessage(null);
    try {
      const response = await fetch('/api/tiktok/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error('Impossible de déconnecter TikTok pour le moment.');
      setMessage('TikTok déconnecté.');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Impossible de déconnecter TikTok.');
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction('logout');
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const rememberedItems = useMemo(() => (
    memory.remembered.length ? memory.remembered : [
      'Hooks et angles récurrents',
      'Drops d’attention détectés',
      'CTA et patterns de repost',
    ]
  ), [memory.remembered]);

  const tiktokName = tiktok.displayName?.trim() || 'Compte TikTok';

  return (
    <section className="mx-auto w-full max-w-[1500px] pb-12 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[22px] border border-white/[0.075] bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(5,10,24,0.98)_56%,rgba(20,11,42,0.96))] p-5 shadow-[0_34px_110px_-72px_rgba(124,58,237,0.95),inset_0_1px_0_rgba(255,255,255,0.07)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_12%,rgba(34,211,238,0.15),transparent_36%),radial-gradient(circle_at_8%_0%,rgba(168,85,247,0.22),transparent_34%)]" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <span className="inline-flex rounded-full border border-cyan-200/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">
              SETTINGS
            </span>
            <h1 className="mt-5 text-[36px] font-black tracking-[-0.055em] text-white sm:text-[50px]">Paramètres</h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-300">
              Gère ton compte, tes préférences et le comportement du moteur Viralynz.
            </p>
          </div>
          <div className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">État produit</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 p-3">
                <p className="text-[11px] text-slate-500">Plan</p>
                <p className="mt-1 text-[15px] font-black text-white">{account.planLabel}</p>
              </div>
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 p-3">
                <p className="text-[11px] text-slate-500">TikTok</p>
                <p className="mt-1 text-[15px] font-black text-white">{tiktok.connected ? 'Connecté' : 'Non connecté'}</p>
              </div>
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 p-3">
                <p className="text-[11px] text-slate-500">Mémoire</p>
                <p className="mt-1 text-[15px] font-black text-white">{memory.active ? 'Active' : 'En attente'}</p>
              </div>
              <div className="rounded-[12px] border border-white/[0.065] bg-black/15 p-3">
                <p className="text-[11px] text-slate-500">Expert</p>
                <p className="mt-1 text-[15px] font-black text-white">{expertMode.enabled ? 'Actif' : 'Préparé'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-[14px] border border-cyan-200/[0.12] bg-cyan-300/[0.06] px-4 py-3 text-[13px] font-semibold text-cyan-50">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-5">
          <SettingsSection
            eyebrow="Compte"
            title="Profil & compte"
            description="Les informations affichées viennent du profil Viralynz et de la session active."
          >
            <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4 sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-violet-300/18 bg-[radial-gradient(circle_at_30%_20%,rgba(232,121,249,0.38),rgba(124,58,237,0.18),rgba(3,7,18,0.98))] text-[26px] font-black text-white shadow-[0_0_36px_rgba(124,58,237,0.24)]">
                  {initials(account.name, account.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[24px] font-black tracking-[-0.04em] text-white">{account.name}</h2>
                    <Badge>{account.planLabel}</Badge>
                    <Badge tone="green">{statusLabel(account.subscriptionStatus)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-[14px] text-slate-400">{account.email}</p>
                  <p className="mt-2 text-[12px] text-slate-500">Inscription: {formatDate(account.createdAt)}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <ActionButton href="/dashboard/support">Modifier le profil</ActionButton>
                <ActionButton onClick={() => void sendPasswordReset()} disabled={busyAction === 'password'}>
                  {busyAction === 'password' ? 'Envoi...' : 'Changer le mot de passe'}
                </ActionButton>
                <ActionButton href="/dashboard/billing">Gérer mon abonnement</ActionButton>
                <ActionButton href="/dashboard/support">Ouvrir le support</ActionButton>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Préférences"
            title="Préférences produit"
            description="Ajuste les préférences qui influencent ton expérience produit. Elles sont enregistrées localement sur cet appareil pour l’instant."
          >
            <div className="grid gap-3 lg:grid-cols-2">
              <SelectRow label="Langue interface" value="Français" options={['Français', 'English']} note="Le français est actif. L’anglais est prévu pour une prochaine version." />
              <SelectRow label="Format date / heure" value="France — 24h" options={['France — 24h', 'International — 12h']} note="Format affiché selon l’interface actuelle." />
              <ToggleRow title="Affichage compact du dashboard" description="Réduit la densité visuelle des sections longues." checked={preferences.compactDashboard} onChange={() => updatePreference('compactDashboard')} />
              <ToggleRow title="Ouvrir le dernier onglet actif" description="Prépare la reprise de contexte dans les pages dashboard." checked={preferences.restoreLastTab} onChange={() => updatePreference('restoreLastTab')} />
              <ToggleRow title="Animations avancées" description="Garde les transitions premium quand ton appareil le permet." checked={preferences.advancedAnimations} onChange={() => updatePreference('advancedAnimations')} />
              <ToggleRow title="Confirmation avant actions importantes" description="Protège les actions sensibles comme déconnexion ou réinitialisation." checked={preferences.confirmImportantActions} onChange={() => updatePreference('confirmImportantActions')} />
              <ToggleRow title="Mode focus analyse" description="Réduit les distractions autour du module d’analyse vidéo." checked={preferences.focusAnalysis} onChange={() => updatePreference('focusAnalysis')} />
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Moteur Viralynz"
            title="Réglages du moteur Viralynz"
            description="Contrôle comment Viralynz apprend de tes analyses et prépare les futures préférences d’analyse."
          >
            <div className="grid gap-4">
              <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[18px] font-black text-white">Mémoire créateur</h3>
                    <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-400">
                      Viralynz retient les hooks, erreurs récurrentes, CTA, drops d’attention et patterns utiles pour éviter les conseils génériques.
                    </p>
                  </div>
                  <Badge tone={memory.active ? 'green' : 'slate'}>{memory.active ? 'Actif' : 'En apprentissage'}</Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-[14px] border border-white/[0.065] bg-black/15 p-4">
                    <p className="text-[13px] leading-6 text-slate-300">{memory.summary || 'Analyse une vidéo pour construire une mémoire créateur exploitable.'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {rememberedItems.slice(0, 5).map((item) => <Badge key={item} tone="cyan">{item}</Badge>)}
                    </div>
                  </div>
                  <div className="rounded-[14px] border border-white/[0.065] bg-black/15 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Analyses utilisées</p>
                    <p className="mt-2 text-[28px] font-black text-white">{memory.sourceAnalysisCount}</p>
                    <p className="mt-2 text-[12px] leading-5 text-slate-500">Dernière mise à jour: {formatDate(memory.updatedAt)}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ToggleRow title="Mémoire active" description="Préférence locale; le moteur continue d’utiliser la mémoire serveur disponible." checked={preferences.creatorMemory} onChange={() => updatePreference('creatorMemory')} badge="local" />
                  <ActionButton href="/dashboard">Gérer depuis le dashboard</ActionButton>
                  <ActionButton disabled>Réinitialiser la mémoire</ActionButton>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[18px] font-black text-white">Expert Mode</h3>
                      <p className="mt-2 text-[13px] leading-6 text-slate-400">Contrôle plus fin du comportement du moteur d’analyse.</p>
                    </div>
                    <Badge tone={expertMode.exists ? 'cyan' : 'amber'}>{expertMode.exists ? 'Préférences lues' : 'Bientôt disponible'}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <SliderRow label="Poids du hook" value={expertMode.weights.hook} note="Lecture des réglages serveur si disponibles. Modification UI à venir." />
                    <SliderRow label="Poids de la rétention" value={expertMode.weights.retention} note="La rétention reste centrale dans le diagnostic Viralynz." />
                    <SliderRow label="Poids du CTA" value={expertMode.weights.cta} note="Contrôle prévu pour ajuster les décisions orientées conversion." />
                    <SliderRow label="Poids du payoff" value={expertMode.weights.payoff} note="Prépare la pondération des moments de preuve et révélation." />
                    <SelectRow label="Priorité moteur" value="Repost" options={['Repost', 'Clarté', 'Conversion', 'Viral']} note={`Mode actuel: ${expertMode.analysisDepth || 'standard'}. Édition bientôt disponible.`} />
                  </div>
                </div>

                <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[18px] font-black text-white">Recommandations V2</h3>
                      <p className="mt-2 text-[13px] leading-6 text-slate-400">Prépare la façon dont Viralynz transforme un diagnostic en version corrigée.</p>
                    </div>
                    <Badge tone="violet">Local</Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <ToggleRow title="Autoriser V2 automatique" description="Prépare une V2 dès qu’une analyse est suffisamment complète." checked={preferences.autoV2} onChange={() => updatePreference('autoV2')} />
                    <ToggleRow title="Proposer hooks alternatifs" description="Génère plusieurs angles de hook quand le sujet manque de tension." checked={preferences.hookAlternatives} onChange={() => updatePreference('hookAlternatives')} />
                    <ToggleRow title="Proposer CTA alternatifs" description="Prépare plusieurs appels à l’action selon le format." checked={preferences.ctaAlternatives} onChange={() => updatePreference('ctaAlternatives')} />
                    <ToggleRow title="Proposer version courte" description="Priorise une V2 plus tendue quand l’intro dilue le payoff." checked={preferences.shortVersion} onChange={() => updatePreference('shortVersion')} />
                  </div>
                </div>
              </div>
            </div>
          </SettingsSection>
        </div>

        <aside className="space-y-5">
          <SettingsSection
            eyebrow="Connexions"
            title="Connexions & intégrations"
            description="Gère les comptes qui enrichissent ton dashboard Viralynz."
          >
            <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
              <div className="flex items-center gap-4">
                <IntegrationAvatar tiktok={tiktok} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[18px] font-black text-white">{tiktok.connected ? tiktokName : 'TikTok non connecté'}</h3>
                    <Badge tone={tiktok.connected ? 'green' : 'slate'}>{tiktok.connected ? 'Compte relié' : 'Non connecté'}</Badge>
                    {tiktok.connected ? <Badge tone="cyan">{tiktok.modeLabel}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">Dernière connexion: {formatDate(tiktok.connectedAt)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[14px] border border-white/[0.065] bg-black/15 p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Permissions actuelles</p>
                  <p className="mt-2 text-[13px] font-semibold text-white">{safeScopes(tiktok.scopes)}</p>
                  <p className="mt-2 text-[12px] leading-5 text-slate-400">
                    {tiktok.hasAdvancedMetrics
                      ? 'Les permissions avancées permettent de synchroniser plus de données TikTok.'
                      : 'Le compte est relié, mais seules les données de profil sont autorisées pour l’instant.'}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ActionButton href="/api/tiktok/connect" tone="primary">{tiktok.connected ? 'Reconnecter' : 'Connecter TikTok'}</ActionButton>
                  <ActionButton onClick={() => setConfirmAction('disconnectTikTok')} disabled={!tiktok.connected || busyAction === 'tiktok'} tone="danger">
                    {busyAction === 'tiktok' ? 'Déconnexion...' : 'Déconnecter'}
                  </ActionButton>
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Sécurité"
            title="Sécurité & notifications"
            description="Contrôle les accès et les emails importants."
          >
            <div className="space-y-4">
              <div className="rounded-[16px] border border-white/[0.075] bg-white/[0.035] p-4">
                <h3 className="text-[16px] font-black text-white">Connexion</h3>
                <p className="mt-2 text-[13px] leading-6 text-slate-400">Email de connexion: <span className="font-semibold text-slate-200">{account.email}</span></p>
                <div className="mt-4 grid gap-2">
                  <ActionButton onClick={() => void sendPasswordReset()} disabled={busyAction === 'password'}>Changer le mot de passe</ActionButton>
                  <ActionButton disabled>Déconnecter tous les appareils</ActionButton>
                </div>
              </div>
              <div className="grid gap-3">
                <ToggleRow title="Nouveautés produit" description="Recevoir les changements importants de Viralynz." checked={preferences.productNewsEmail} onChange={() => updatePreference('productNewsEmail')} badge="local" />
                <ToggleRow title="Alertes importantes" description="Recevoir les alertes qui touchent l’accès ou la sécurité." checked={preferences.importantAlertsEmail} onChange={() => updatePreference('importantAlertsEmail')} badge="local" />
                <ToggleRow title="Billing / facturation" description="Conserver les emails liés au plan et aux paiements." checked={preferences.billingEmail} onChange={() => updatePreference('billingEmail')} badge="local" />
                <ToggleRow title="Analyse terminée" description="Préférence prête pour les traitements asynchrones." checked={preferences.analysisDoneEmail} onChange={() => updatePreference('analysisDoneEmail')} badge="local" />
                <ToggleRow title="Nouveautés IA" description="Recevoir les annonces liées au moteur Viralynz." checked={preferences.aiNewsEmail} onChange={() => updatePreference('aiNewsEmail')} badge="local" />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            eyebrow="Support"
            title="Support / zone sensible"
            description="Actions utiles et opérations qui méritent confirmation."
          >
            <div className="grid gap-3">
              <ActionButton href="/dashboard/support">Contacter le support</ActionButton>
              <ActionButton href="/dashboard/updates">Voir la documentation</ActionButton>
              <ActionButton href="/dashboard/support">Envoyer un feedback</ActionButton>
              <ActionButton href="/dashboard/support">Signaler un bug</ActionButton>
            </div>
            <div className="mt-5 rounded-[16px] border border-rose-300/[0.12] bg-rose-400/[0.045] p-4">
              <h3 className="text-[16px] font-black text-rose-50">Zone sensible</h3>
              <p className="mt-2 text-[12.5px] leading-5 text-rose-100/70">Ces actions ne suppriment jamais tes analyses sans confirmation explicite.</p>
              <div className="mt-4 grid gap-2">
                <ActionButton onClick={() => setConfirmAction('disconnectTikTok')} disabled={!tiktok.connected || busyAction === 'tiktok'} tone="danger">Déconnecter TikTok</ActionButton>
                <ActionButton onClick={resetLocalPreferences} tone="danger">Réinitialiser mes préférences</ActionButton>
                <ActionButton disabled tone="danger">Réinitialiser la mémoire créateur</ActionButton>
                <ActionButton disabled tone="danger">Supprimer mon compte</ActionButton>
                <ActionButton onClick={() => void logout()} disabled={busyAction === 'logout'} tone="danger">
                  {busyAction === 'logout' ? 'Déconnexion...' : 'Se déconnecter'}
                </ActionButton>
              </div>
            </div>
          </SettingsSection>
        </aside>
      </div>

      {confirmAction === 'disconnectTikTok' ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/72 px-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-disconnect-tiktok-title"
            className="w-full max-w-[460px] overflow-hidden rounded-[22px] border border-rose-200/[0.14] bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(7,10,22,0.99))] p-5 shadow-[0_34px_120px_-58px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-rose-100/70">Connexion TikTok</p>
                <h3 id="settings-disconnect-tiktok-title" className="mt-3 text-[24px] font-black tracking-[-0.04em] text-white">Déconnecter TikTok ?</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.045] text-slate-300 transition hover:bg-white/[0.08]"
                aria-label="Fermer la confirmation"
              >
                ×
              </button>
            </div>
            <p className="mt-4 text-[14px] leading-6 text-slate-300">
              Ton compte TikTok ne sera plus relié à Viralynz. Tes analyses déjà créées restent disponibles, mais les futures données TikTok ne seront plus associées à ce compte.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="min-h-[44px] rounded-[10px] border border-white/[0.09] bg-white/[0.045] px-4 text-[13px] font-black text-white transition hover:bg-white/[0.08]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void disconnectTikTok()}
                disabled={busyAction === 'tiktok'}
                className="min-h-[44px] rounded-[10px] border border-rose-300/18 bg-rose-400/[0.10] px-4 text-[13px] font-black text-rose-50 transition hover:bg-rose-400/[0.16] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {busyAction === 'tiktok' ? 'Déconnexion...' : 'Déconnecter'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
