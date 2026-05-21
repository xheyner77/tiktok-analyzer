'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TikTokConnectionManager } from '@/components/dashboard-v2/TikTokConnectionManager';
import type { AppPlan } from '@/lib/plans';

type PreferenceKey = 'premiumAnimations' | 'confirmSensitiveActions' | 'importantProductNotifications';
type Preferences = Record<PreferenceKey, boolean>;

type SettingsPageClientProps = {
  account: {
    name: string;
    email: string;
    plan: AppPlan;
    planLabel: string;
    createdAt: string | null;
    subscriptionStatus: string | null;
    quotaUsed: number;
    quotaLimit: number | null;
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
};

type StoredPreferences = Partial<Preferences> & {
  advancedAnimations?: boolean;
  confirmImportantActions?: boolean;
  importantAlertsEmail?: boolean;
};

const defaultPreferences: Preferences = {
  premiumAnimations: true,
  confirmSensitiveActions: true,
  importantProductNotifications: true,
};

const preferenceStorageKey = 'viralynz.settings.preferences.v1';

function formatDate(value: string | null): string {
  if (!value) return 'Non disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Non disponible';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function formatLimit(value: number | null): string {
  if (typeof value !== 'number') return '—';
  return Number.isFinite(value) ? String(value) : 'Illimité';
}

function initials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'VN';
  return source.slice(0, 2).toUpperCase();
}

function accountStatusLabel(status: string | null): string {
  if (status === 'active') return 'Compte actif';
  if (status === 'trialing') return 'Essai actif';
  if (status === 'canceled') return 'Abonnement annulé';
  if (status === 'past_due' || status === 'unpaid') return 'Paiement à vérifier';
  return 'Compte actif';
}

function normalizePreferences(stored: StoredPreferences): Preferences {
  return {
    premiumAnimations: stored.premiumAnimations ?? stored.advancedAnimations ?? defaultPreferences.premiumAnimations,
    confirmSensitiveActions: stored.confirmSensitiveActions ?? stored.confirmImportantActions ?? defaultPreferences.confirmSensitiveActions,
    importantProductNotifications: stored.importantProductNotifications ?? stored.importantAlertsEmail ?? defaultPreferences.importantProductNotifications,
  };
}

function activeScopes(scopes: string[]): string {
  const cleaned = scopes.map((scope) => (scope === 'user.info.basic' ? 'user.info.basic' : scope.trim())).filter(Boolean);
  return cleaned.length ? cleaned.join(', ') : 'user.info.basic';
}

function Badge({ children, tone = 'violet' }: { children: ReactNode; tone?: 'violet' | 'cyan' | 'green' | 'amber' | 'slate' | 'rose' }) {
  const tones = {
    violet: 'border-violet-300/18 bg-violet-400/10 text-violet-100',
    cyan: 'border-cyan-300/18 bg-cyan-400/10 text-cyan-100',
    green: 'border-emerald-300/18 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-300/18 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/14 bg-slate-400/10 text-slate-200',
    rose: 'border-rose-300/18 bg-rose-400/10 text-rose-100',
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

function StatusDot({ tone }: { tone: 'green' | 'cyan' | 'slate' }) {
  const colors = {
    green: 'bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.72)]',
    cyan: 'bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.58)]',
    slate: 'bg-slate-500',
  };
  return <span className={`h-2 w-2 shrink-0 rounded-full ${colors[tone]}`} />;
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[18px] border border-white/[0.075] bg-[linear-gradient(180deg,rgba(9,16,31,0.94),rgba(4,8,18,0.99))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_28px_94px_-76px_rgba(124,58,237,0.72)] sm:p-5 ${className}`}>
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">{eyebrow}</p>
        <h2 className="mt-2 text-[20px] font-black tracking-[-0.035em] text-white sm:text-[23px]">{title}</h2>
        {description ? <p className="mt-2 text-[13px] leading-6 text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[12px] border border-white/[0.065] bg-white/[0.035] px-3.5 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-[13px] font-bold text-slate-100">{value}</p>
    </div>
  );
}

function ActionLink({
  href,
  children,
  tone = 'default',
  subtle = false,
}: {
  href: string;
  children: ReactNode;
  tone?: 'default' | 'primary' | 'danger';
  subtle?: boolean;
}) {
  if (subtle) {
    return <Link href={href} className="inline-flex min-h-[34px] items-center text-[12.5px] font-black text-slate-300 underline-offset-4 transition hover:text-white hover:underline">{children}</Link>;
  }

  const tones = {
    default: 'border-white/[0.09] bg-white/[0.045] text-slate-100 hover:bg-white/[0.075]',
    primary: 'border-violet-300/20 bg-[linear-gradient(135deg,#e879f9,#7c3aed_58%,#2563eb)] text-white shadow-[0_18px_44px_-24px_rgba(124,58,237,0.88)] hover:brightness-110',
    danger: 'border-rose-300/16 bg-rose-400/[0.065] text-rose-100 hover:bg-rose-400/[0.10]',
  };

  return (
    <Link href={href} className={`inline-flex min-h-[40px] items-center justify-center rounded-[10px] border px-4 text-center text-[12.5px] font-black transition ${tones[tone]}`}>
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  onClick,
  tone = 'default',
  disabled = false,
  subtle = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  subtle?: boolean;
}) {
  if (subtle) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className="inline-flex min-h-[34px] items-center text-left text-[12.5px] font-black text-slate-300 underline-offset-4 transition hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-55">
        {children}
      </button>
    );
  }

  const tones = {
    default: 'border-white/[0.09] bg-white/[0.045] text-slate-100 hover:bg-white/[0.075]',
    primary: 'border-violet-300/20 bg-[linear-gradient(135deg,#e879f9,#7c3aed_58%,#2563eb)] text-white shadow-[0_18px_44px_-24px_rgba(124,58,237,0.88)] hover:brightness-110',
    danger: 'border-rose-300/16 bg-rose-400/[0.065] text-rose-100 hover:bg-rose-400/[0.10]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[40px] items-center justify-center rounded-[10px] border px-4 text-center text-[12.5px] font-black transition disabled:cursor-not-allowed disabled:opacity-55 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function PreferenceRow({
  title,
  description,
  checked,
  onChange,
  value,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: () => void;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-1 py-3.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] font-black text-white">{title}</p>
        <p className="mt-1 text-[12px] leading-5 text-slate-400">{description}</p>
      </div>
      {value ? (
        <span className="shrink-0 rounded-[9px] border border-white/[0.08] bg-white/[0.045] px-3 py-2 text-[12px] font-black text-slate-100">{value}</span>
      ) : (
        <button
          type="button"
          onClick={onChange}
          className="relative h-7 w-12 shrink-0 rounded-full border border-violet-300/30 bg-violet-500/60 shadow-[0_0_22px_rgba(139,92,246,0.28)] transition data-[checked=false]:border-white/10 data-[checked=false]:bg-white/[0.055]"
          data-checked={checked ? 'true' : 'false'}
          aria-pressed={checked}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${checked ? 'left-6' : 'left-1'}`} />
        </button>
      )}
    </div>
  );
}

function TikTokAvatar({ tiktok }: { tiktok: SettingsPageClientProps['tiktok'] }) {
  if (tiktok.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tiktok.avatarUrl} alt="" className="h-14 w-14 rounded-[16px] border border-white/12 object-cover" />
    );
  }

  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px] border border-cyan-200/18 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.32),rgba(139,92,246,0.2),rgba(2,6,17,0.96))] text-[22px] font-black text-white">
      ♪
    </div>
  );
}

function EngineItem({ title, copy, badge, tone }: { title: string; copy: string; badge: string; tone: 'violet' | 'green' | 'cyan' }) {
  return (
    <div className="rounded-[14px] border border-white/[0.07] bg-black/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[14px] font-black text-white">{title}</h3>
        <Badge tone={tone}>{badge}</Badge>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-slate-400">{copy}</p>
    </div>
  );
}

export default function SettingsPageClient({ account, tiktok }: SettingsPageClientProps) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'disconnectTikTok' | 'resetPreferences' | null>(null);
  const [tiktokManagerOpen, setTikTokManagerOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(preferenceStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as StoredPreferences;
      setPreferences(normalizePreferences(parsed));
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  function savePreferences(next: Preferences, successMessage = 'Préférences enregistrées sur cet appareil.') {
    setPreferences(next);
    window.localStorage.setItem(preferenceStorageKey, JSON.stringify(next));
    setMessage(successMessage);
  }

  function updatePreference(key: PreferenceKey) {
    savePreferences({ ...preferences, [key]: !preferences[key] });
  }

  function resetLocalPreferences() {
    setConfirmAction(null);
    savePreferences(defaultPreferences, 'Préférences réinitialisées sur cet appareil.');
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
      const response = await fetch('/api/tiktok/disconnect', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
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

  const tiktokName = tiktok.connected ? tiktok.displayName?.trim() || 'Compte TikTok' : 'TikTok non connecté';
  const tiktokStatus = tiktok.connected ? 'Connecté' : 'Non connecté';

  return (
    <section className="mx-auto w-full max-w-[1480px] pb-10 pt-4 text-white">
      <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(135deg,rgba(13,21,39,0.96),rgba(4,8,19,0.99)_58%,rgba(20,11,42,0.96))] p-5 shadow-[0_34px_120px_-76px_rgba(124,58,237,0.96),inset_0_1px_0_rgba(255,255,255,0.075)] sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_12%,rgba(34,211,238,0.15),transparent_34%),radial-gradient(circle_at_9%_0%,rgba(168,85,247,0.21),transparent_34%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
          <div className="min-w-0">
            <Badge tone="cyan">Control Center</Badge>
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.055em] text-white sm:text-[48px]">Paramètres</h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-slate-300 sm:text-[15px]">
              Contrôle ton compte, tes connexions et les préférences qui influencent l’expérience Viralynz.
            </p>
          </div>

          <aside className="rounded-[18px] border border-white/[0.09] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_70px_-58px_rgba(34,211,238,0.7)]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">État du workspace</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <FieldLine label="Plan" value={account.planLabel} />
              <div className="min-w-0 rounded-[12px] border border-white/[0.065] bg-white/[0.035] px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">TikTok</p>
                <p className="mt-1 flex items-center gap-2 text-[13px] font-bold text-slate-100">
                  <StatusDot tone={tiktok.connected ? 'green' : 'slate'} />
                  {tiktokStatus}
                </p>
              </div>
              <FieldLine label="Analyses" value={`${account.quotaUsed} / ${formatLimit(account.quotaLimit)}`} />
              <div className="min-w-0 rounded-[12px] border border-cyan-200/[0.10] bg-cyan-300/[0.045] px-3.5 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/60">Moteur</p>
                <p className="mt-1 flex items-center gap-2 text-[13px] font-bold text-cyan-50">
                  <StatusDot tone="cyan" />
                  Prêt à apprendre
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-[13px] border border-cyan-200/[0.12] bg-cyan-300/[0.06] px-4 py-3 text-[13px] font-semibold text-cyan-50">
          {message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_410px]">
        <SectionCard
          eyebrow="Compte"
          title="Identité du compte"
          description="Ton accès Viralynz, ton email et le plan qui contrôle tes quotas."
          className="xl:col-start-1 xl:row-start-1"
        >
          <div className="rounded-[16px] border border-white/[0.065] bg-white/[0.032] p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-violet-300/18 bg-[radial-gradient(circle_at_30%_20%,rgba(232,121,249,0.36),rgba(124,58,237,0.18),rgba(3,7,18,0.98))] text-[22px] font-black text-white shadow-[0_0_34px_rgba(124,58,237,0.22)]">
                {initials(account.name, account.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[20px] font-black tracking-[-0.035em] text-white">{account.name || 'Créateur Viralynz'}</h3>
                  <Badge>{account.planLabel}</Badge>
                  <Badge tone="green">{accountStatusLabel(account.subscriptionStatus)}</Badge>
                </div>
                <p className="mt-1 truncate text-[13px] text-slate-400">{account.email}</p>
                <p className="mt-2 text-[12px] text-slate-500">Inscription : {formatDate(account.createdAt)}</p>
              </div>
              <ActionLink href="/dashboard/billing" tone="primary">Gérer mon abonnement</ActionLink>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/[0.06] pt-3">
              <ActionButton onClick={() => void sendPasswordReset()} disabled={busyAction === 'password'} subtle>
                {busyAction === 'password' ? 'Envoi...' : 'Changer le mot de passe'}
              </ActionButton>
              <ActionLink href="/account" subtle>Voir mon compte</ActionLink>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Connexion"
          title="Connexion TikTok"
          description="TikTok est relié. Les métriques avancées arriveront après validation."
          className="xl:col-start-2 xl:row-start-1"
        >
          <div className="rounded-[16px] border border-white/[0.065] bg-white/[0.032] p-4">
            <div className="flex items-center gap-3">
              <TikTokAvatar tiktok={tiktok} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[17px] font-black text-white">{tiktokName}</h3>
                  <Badge tone={tiktok.connected ? 'green' : 'slate'}>{tiktok.connected ? 'Connecté' : 'Non connecté'}</Badge>
                  {tiktok.connected && tiktok.modeLabel ? <Badge tone="amber">{tiktok.modeLabel}</Badge> : null}
                </div>
                <p className="mt-1 text-[12px] text-slate-500">Permission active : {activeScopes(tiktok.scopes)}</p>
              </div>
            </div>

            <p className="mt-4 text-[13px] leading-6 text-slate-300">
              Ton compte TikTok est relié à Viralynz. Les données de profil sont actives, les métriques avancées arriveront après validation TikTok.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="rounded-[13px] border border-emerald-300/[0.12] bg-emerald-400/[0.055] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Disponible maintenant</p>
                <p className="mt-2 text-[12px] leading-5 text-emerald-50/80">Profil TikTok · Avatar · Nom du compte</p>
              </div>
              <div className="rounded-[13px] border border-cyan-300/[0.12] bg-cyan-400/[0.045] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">En attente de validation</p>
                <p className="mt-2 text-[12px] leading-5 text-cyan-50/80">Vidéos · Stats · Performances</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {tiktok.connected ? (
                <ActionButton onClick={() => setTikTokManagerOpen(true)}>Gérer</ActionButton>
              ) : (
                <ActionLink href="/api/tiktok/connect" tone="primary">Connecter</ActionLink>
              )}
              <ActionButton
                onClick={() => {
                  if (preferences.confirmSensitiveActions) setConfirmAction('disconnectTikTok');
                  else void disconnectTikTok();
                }}
                disabled={!tiktok.connected || busyAction === 'tiktok'}
                tone="danger"
              >
                {busyAction === 'tiktok' ? 'Déconnexion...' : 'Déconnecter'}
              </ActionButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Préférences"
          title="Préférences essentielles"
          description="Les préférences restent simples : uniquement ce qui change vraiment ton usage."
          className="xl:col-start-1 xl:row-start-2"
        >
          <div className="rounded-[16px] border border-white/[0.065] bg-white/[0.026] px-3 sm:px-4">
            <PreferenceRow title="Langue" description="Interface et textes produit." value="Français" />
            <PreferenceRow
              title="Animations premium"
              description="Garde les transitions subtiles de l’interface."
              checked={preferences.premiumAnimations}
              onChange={() => updatePreference('premiumAnimations')}
            />
            <PreferenceRow
              title="Confirmation actions sensibles"
              description="Demande une validation avant déconnexion ou réinitialisation."
              checked={preferences.confirmSensitiveActions}
              onChange={() => updatePreference('confirmSensitiveActions')}
            />
            <PreferenceRow
              title="Notifications produit importantes"
              description="Alertes liées au compte, au plan et aux changements majeurs."
              checked={preferences.importantProductNotifications}
              onChange={() => updatePreference('importantProductNotifications')}
            />
          </div>
          <p className="mt-3 text-[12px] font-semibold text-slate-500">Enregistré sur cet appareil.</p>
        </SectionCard>

        <SectionCard
          eyebrow="Sécurité"
          title="Sécurité & support"
          description="Actions utiles, sans transformer la page en panneau d’administration."
          className="xl:col-start-2 xl:row-start-2"
        >
          <div className="grid gap-2">
            <ActionButton onClick={() => void sendPasswordReset()} disabled={busyAction === 'password'}>
              Changer le mot de passe
            </ActionButton>
            <ActionLink href="/dashboard/support">Contacter le support</ActionLink>
            <ActionLink href="/dashboard/support">Signaler un bug</ActionLink>
            <ActionButton onClick={() => void logout()} disabled={busyAction === 'logout'}>
              {busyAction === 'logout' ? 'Déconnexion...' : 'Se déconnecter'}
            </ActionButton>
          </div>

          <div className="mt-4 rounded-[14px] border border-white/[0.07] bg-black/15 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Zone sensible</p>
            <div className="mt-2 grid gap-1">
              <ActionButton
                onClick={() => {
                  if (preferences.confirmSensitiveActions) setConfirmAction('disconnectTikTok');
                  else void disconnectTikTok();
                }}
                disabled={!tiktok.connected || busyAction === 'tiktok'}
                subtle
              >
                Déconnecter TikTok
              </ActionButton>
              <ActionButton
                onClick={() => {
                  if (preferences.confirmSensitiveActions) setConfirmAction('resetPreferences');
                  else resetLocalPreferences();
                }}
                subtle
              >
                Réinitialiser mes préférences
              </ActionButton>
              <ActionLink href="/dashboard/support" subtle>Demander la suppression du compte</ActionLink>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Moteur"
          title="Moteur Viralynz"
          description="Le moteur apprend de tes analyses, pas de données inventées."
          className="xl:col-start-1 xl:row-start-3"
        >
          <div className="rounded-[17px] border border-violet-300/[0.12] bg-[linear-gradient(135deg,rgba(124,58,237,0.11),rgba(34,211,238,0.055),rgba(255,255,255,0.025))] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <p className="max-w-2xl text-[13px] leading-6 text-slate-300">
                Viralynz apprend de tes analyses pour repérer les patterns qui reviennent : hooks faibles, drops, CTA vagues et structures à republier.
              </p>
              <ActionLink href="/dashboard/analyze" tone="primary">Analyser une vidéo</ActionLink>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <EngineItem title="Mémoire créateur" copy="Se construit après tes premières analyses." badge="En préparation" tone="violet" />
              <EngineItem title="Recommandations V2" copy="Actives dès qu’une analyse est terminée." badge="Prêt" tone="green" />
              <EngineItem title="Expert Mode" copy="Réglages avancés du diagnostic." badge="Bientôt" tone="cyan" />
            </div>
          </div>
        </SectionCard>
      </div>

      <TikTokConnectionManager
        open={tiktokManagerOpen}
        connection={tiktok}
        onClose={() => setTikTokManagerOpen(false)}
        onDisconnected={() => {
          setTikTokManagerOpen(false);
          setMessage('TikTok déconnecté.');
          router.refresh();
        }}
      />

      {confirmAction ? (
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-slate-950/72 px-4 backdrop-blur-xl">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-confirm-title"
            className="w-full max-w-[430px] overflow-hidden rounded-[20px] border border-white/[0.11] bg-[linear-gradient(145deg,rgba(15,23,42,0.98),rgba(7,10,22,0.99))] p-5 shadow-[0_34px_120px_-58px_rgba(124,58,237,0.65),inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-100/70">Confirmation</p>
            <h3 id="settings-confirm-title" className="mt-3 text-[23px] font-black tracking-[-0.04em] text-white">
              {confirmAction === 'disconnectTikTok' ? 'Déconnecter TikTok ?' : 'Réinitialiser les préférences ?'}
            </h3>
            <p className="mt-3 text-[13px] leading-6 text-slate-300">
              {confirmAction === 'disconnectTikTok'
                ? 'Tes analyses restent disponibles. Seule la connexion au compte TikTok sera retirée.'
                : 'Les préférences locales de cet appareil reviendront aux valeurs par défaut.'}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => setConfirmAction(null)}>Annuler</ActionButton>
              <ActionButton
                onClick={() => {
                  if (confirmAction === 'disconnectTikTok') void disconnectTikTok();
                  else resetLocalPreferences();
                }}
                tone="danger"
                disabled={busyAction === 'tiktok'}
              >
                Confirmer
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
