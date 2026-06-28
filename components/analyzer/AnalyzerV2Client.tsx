'use client';

import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PremiumGate from '@/components/PremiumGate';
import AnalysisCounter from '@/components/AnalysisCounter';
import GuestGate, { PENDING_URL_KEY } from '@/components/GuestGate';
import FloatingParticles from '@/components/FloatingParticles';
import { ReconstructionExperience } from '@/components/reconstruction/ReconstructionExperience';
import { ReconstructionPaywall as ReconstructionPaywallPremium } from '@/components/reconstruction/ReconstructionPaywall';
import { AnalysisPipelineState, AnalysisPipelineStepStatus, AnalysisResult, ReconstructionIAOutput, RepostVersion } from '@/lib/types';
import { normalizeReconstructionPlan } from '@/lib/reconstruction/normalize';
import { normalizeTikTokUrl, isTikTokVideoUrl } from '@/lib/tiktok-url';
import { extractVideoFramesFromFile, extractAudioFromVideo } from '@/lib/extract-video-frames';
import { PLAN_LIMITS, RECONSTRUCTION_LIMITS } from '@/lib/plan-limits';
import { hasProOrLifetimeAccess, isLifetimePlan, type AppPlan } from '@/lib/plans';

const STORAGE_KEY = 'tiktok_analysis_count';
const GUEST_LIMIT = 3;
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const premiumEase = [0.22, 1, 0.36, 1] as const;
const cardHover = {
  y: -3,
  scale: 1.006,
  transition: { duration: 0.32, ease: premiumEase },
};

type ObjectiveId = 'views' | 'hook' | 'retention' | 'comments' | 'clicks' | 'repost';

interface AuthUser {
  id: string;
  email: string;
  plan: AppPlan;
  analyses_count: number;
  reconstructions_count?: number;
  tiktok?: {
    connected: boolean;
    activeAccounts?: number;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

interface AnalysisHistoryItem {
  id: string;
  video_url: string;
  created_at: string;
  result: AnalysisResult;
}

type AnalyzeSource = 'upload' | 'tiktok';

interface TikTokPublishedVideo {
  id: string;
  tiktokVideoId: string;
  title: string | null;
  coverUrl: string | null;
  shareUrl: string | null;
  duration: number | null;
  publishedAt: string | null;
  views: number | null;
}

interface AnalyzerMeta {
  objective?: ObjectiveId;
  objectiveLabel?: string;
  niche?: string;
  nicheLabel?: string;
  fileName?: string;
  fileSizeMb?: number;
  status?: 'completed' | 'processing' | 'failed';
  verdictShort?: string;
  recommendations?: string[];
  analysisMode?: 'vision' | 'metadata' | 'fallback' | 'demo';
  analysisModeLabel?: string;
  isFallback?: boolean;
  analysisConfidence?: {
    score: number;
    level: 'faible' | 'moyenne' | 'elevee';
    reasons: string[];
  };
  signalDisclosure?: {
    observedData: string[];
    aiHypotheses: string[];
    simulations: string[];
    previews: string[];
  };
}

type AnalyzerResult = AnalysisResult & {
  analyzerMeta?: AnalyzerMeta;
  repostVersion?: RepostVersion;
  actionPlan?: string[];
};

const objectives: { id: ObjectiveId; label: string; detail: string }[] = [
  { id: 'views', label: 'Comprendre le décrochage', detail: 'Scroll risk et payoff' },
  { id: 'hook', label: 'Corriger le hook', detail: '0-3 secondes' },
  { id: 'retention', label: 'Repérer les drops', detail: 'Rythme et transitions' },
  { id: 'comments', label: 'Clarifier le CTA', detail: 'Question et engagement' },
  { id: 'clicks', label: 'Rendre l’action évidente', detail: 'CTA et intention' },
  { id: 'repost', label: 'Préparer le plan de remontage', detail: 'Ordre + corrections' },
];

const analysisSteps = [
  'Lecture du hook et de la promesse',
  'Analyse des 3 premières secondes',
  'Détection du drop probable',
  'Lecture du rythme vidéo',
  'Évaluation du CTA et de la tension',
  'Simulation de la structure',
  'Génération des hooks alternatifs',
];

const pipelineStepTemplates = [
  { id: 'prepare', label: 'Preparation de la video', microcopy: 'Verification du fichier, du poids et du contexte.', durationMs: 700 },
  { id: 'frames', label: 'Reperage des moments importants', microcopy: 'Lecture des images utiles pour comprendre le visuel.', durationMs: 1400 },
  { id: 'ocr', label: 'Detection des textes visibles', microcopy: 'Lecture des textes presents a l ecran quand ils sont exploitables.', durationMs: 1200 },
  { id: 'transcript', label: 'Comprehension du message', microcopy: 'Lecture de la voix quand une piste audio exploitable existe.', durationMs: 1600 },
  { id: 'format', label: 'Identification du format TikTok', microcopy: 'Facecam, tuto, sans parole, demo ou format hybride.', durationMs: 900 },
  { id: 'opening', label: 'Analyse du hook', microcopy: 'Tension, promesse, friction et premiere preuve.', durationMs: 1200 },
  { id: 'timeline', label: 'Lecture du rythme video', microcopy: 'Segments cles, relances et zones ou l attention peut chuter.', durationMs: 1200 },
  { id: 'weak-moments', label: 'Reperage des pertes d attention', microcopy: 'Drop probable, surcharge, payoff tardif et contradictions.', durationMs: 900 },
  { id: 'repost', label: 'Creation du plan de repost', microcopy: 'Structure, cuts, angle, CTA et texte ecran.', durationMs: 1100 },
  { id: 'hooks', label: 'Preparation des hooks alternatifs', microcopy: 'Variantes testables selon les signaux vraiment disponibles.', durationMs: 900 },
] as const;

type PipelineStepId = typeof pipelineStepTemplates[number]['id'];
type UxPhaseId = 'prepare' | 'signals' | 'hook' | 'repost' | 'final';

interface AnalysisPreviewSignals {
  fileName?: string;
  fileSizeMb?: number;
  durationSec?: number;
  hasFrames?: boolean;
  hasTranscript?: boolean;
  hasText?: boolean;
  formatDetected?: boolean;
  hookDetected?: boolean;
}

const uxPhaseDefinitions: Array<{
  id: UxPhaseId;
  title: string;
  detail: string;
  from: number;
  to: number;
  stepIds: PipelineStepId[];
}> = [
  {
    id: 'prepare',
    title: 'Preparation de la video',
    detail: 'On verifie le fichier et le contexte avant lecture.',
    from: 0,
    to: 15,
    stepIds: ['prepare'],
  },
  {
    id: 'signals',
    title: 'Lecture des signaux visuels',
    detail: 'On repere les moments importants, le texte visible et le format.',
    from: 15,
    to: 55,
    stepIds: ['frames', 'ocr', 'transcript', 'format'],
  },
  {
    id: 'hook',
    title: 'Analyse du hook et de la retention',
    detail: 'On cherche les endroits ou l attention peut chuter.',
    from: 55,
    to: 75,
    stepIds: ['opening', 'timeline', 'weak-moments'],
  },
  {
    id: 'repost',
    title: 'Generation du plan de repost',
    detail: 'On transforme le diagnostic en decisions de remontage.',
    from: 75,
    to: 90,
    stepIds: ['repost'],
  },
  {
    id: 'final',
    title: 'Finalisation des hooks alternatifs',
    detail: 'On prepare les variantes a tester avec la V2.',
    from: 90,
    to: 100,
    stepIds: ['hooks'],
  },
];

const analysisReassuranceMessages = [
  'On repere les moments ou l attention peut chuter...',
  'On analyse les 3 premieres secondes de ta video...',
  'On compare le rythme avec des patterns TikTok performants...',
  'On prepare un plan de remontage actionnable...',
  'Encore quelques secondes, l analyse se finalise...',
];

function pipelineProgress(steps: AnalysisPipelineState['steps']) {
  const total = steps.length;
  const completed = steps.filter((step) => ['done', 'warning', 'failed'].includes(step.status)).length;
  const running = steps.some((step) => step.status === 'running') ? 0.45 : 0;
  return Math.min(100, Math.round(((completed + running) / total) * 100));
}

function createPipelineState(): AnalysisPipelineState {
  const steps = pipelineStepTemplates.map((step) => ({ ...step, status: 'pending' as AnalysisPipelineStepStatus }));
  return {
    currentStep: 'prepare',
    progress: 0,
    steps,
    warnings: [],
    signalsAvailable: [],
    limitations: [],
    startedAt: new Date().toISOString(),
  };
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
}

function scoreTone(score: number) {
  if (score >= 78) return 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20';
  if (score >= 58) return 'text-amber-300 bg-amber-400/10 border-amber-400/20';
  return 'text-red-300 bg-red-400/10 border-red-400/20';
}

function scoreBar(score: number) {
  if (score >= 78) return 'from-emerald-400 to-emerald-300';
  if (score >= 58) return 'from-amber-400 to-orange-300';
  return 'from-red-400 to-orange-300';
}

function verdictFor(score: number, weakest: string) {
  if (score >= 80) return `Base solide. Resserre encore ${weakest.toLowerCase()} avant remontage.`;
  if (score >= 60) return `Vidéo récupérable, mais ${weakest.toLowerCase()} ralentit la rétention.`;
  if (score >= 40) return `La structure doit d’abord corriger ${weakest.toLowerCase()}.`;
  return `Reconstruction conseillée après refonte du ${weakest.toLowerCase()}.`;
}

function getObjectiveLabel(id: ObjectiveId | '') {
  return objectives.find((item) => item.id === id)?.label ?? '';
}

function buildFallbackRepost(objective: ObjectiveId | ''): RepostVersion {
  const objectiveHook: Record<ObjectiveId, string> = {
    views: `Le viewer ne voit pas assez vite pourquoi rester.`,
    hook: `Tes 3 premières secondes expliquent avant de créer une tension.`,
    retention: `Le milieu de la vidéo manque probablement de rupture claire.`,
    comments: `La question arrive trop tard ou reste trop générale.`,
    clicks: `Le CTA demande une action sans bénéfice assez visible.`,
    repost: `Reconstruis cette vidéo avec la preuve avant le contexte.`,
  };
  return {
    hook: objective ? objectiveHook[objective] : `Le problème arrive avant la valeur: corrige ça d’abord.`,
    structure: [
      '0-3 sec : problème direct + tension visible',
      '3-8 sec : preuve, exemple ou contraste concret',
      '8-18 sec : explication courte avec 2 cuts minimum',
      '18-25 sec : solution claire adaptée au format détecté',
      '25-30 sec : CTA commentaire simple et spécifique',
    ],
    onScreenText: [
      'Erreur que ton audience doit voir maintenant',
      'Le vrai problème arrive avant la valeur',
      'À couper / reformuler avant remontage',
    ],
    cta: 'Commente "PLAN" si tu veux la structure à recopier.',
    angle: "Reconstruire avec un angle plus frontal : partir de l'erreur la plus douloureuse pour ton audience, puis montrer la correction en moins de 20 secondes.",
  };
}

function TikTokRequiredAccess({ email }: { email: string }) {
  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="absolute top-0 inset-x-0 h-[620px] pointer-events-none overflow-hidden">
        <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-cyan-300/12 via-vn-violet/10 to-vn-fuchsia/10 blur-[110px]" />
        <FloatingParticles count={22} />
      </div>
      <section className="relative mx-auto flex min-h-dvh max-w-5xl items-center px-4 py-10 sm:px-6">
        <div className="w-full overflow-hidden rounded-[2rem] border border-white/[0.09] bg-[linear-gradient(135deg,rgba(255,255,255,0.075),rgba(255,255,255,0.025)_50%,rgba(34,211,238,0.075))] p-6 shadow-[0_34px_140px_-86px_rgba(34,211,238,0.95)] sm:p-9">
          <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100">
            TikTok optionnel
          </span>
          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
            Connecte TikTok quand tu veux enrichir tes analyses.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            Viralynz a besoin d’un compte TikTok connecté pour associer tes analyses à ton vrai profil, préparer tes structures retravaillées et construire ta mémoire créateur.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Vidéos reliées', 'Tes analyses restent attachées à ton compte.'],
              ['Structures utiles', 'Les opportunités sont priorisées avec tes signaux.'],
              ['Mémoire créateur', 'Viralynz apprend ton style au fil des analyses.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
                <p className="text-sm font-black text-white">{title}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/api/tiktok/connect" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_60px_-34px_rgba(34,211,238,0.95)] transition hover:brightness-110">
              Connecter mon TikTok
            </Link>
            <Link href="/dashboard" className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
              Retour au dashboard
            </Link>
          </div>
          <p className="mt-5 text-xs text-gray-600">
            Connecté avec {email}. Les tokens TikTok restent côté serveur et ne sont jamais exposés dans l’interface.
          </p>
        </div>
      </section>
    </main>
  );
}

function TikTokCreatorMemoryCard({ connected, email }: { connected: boolean; email?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025)_48%,rgba(34,211,238,0.07))] p-4 shadow-[0_22px_80px_-58px_rgba(34,211,238,0.72)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Memoire createur</p>
          <p className="mt-2 text-sm font-black text-white">
            {connected ? 'TikTok connecte' : 'TikTok devient puissant en Pro'}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${connected ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'}`}>
          {connected ? 'Actif' : 'Optionnel'}
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        {connected
          ? `Connecte avec ${email}. Viralynz peut relier tes analyses a ton historique createur.`
          : 'Teste sans connexion. En Pro, TikTok ajoute historique contenu, suivi long terme, multi-comptes et signaux de progression.'}
      </p>
      {!connected && (
        <Link href="/api/tiktok/connect" className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-xs font-black text-cyan-50 transition hover:bg-cyan-300/14">
          Connecter TikTok plus tard
        </Link>
      )}
    </div>
  );
}

function enrichResult(
  result: AnalysisResult,
  objective: ObjectiveId | '',
  file: File | null
): AnalyzerResult {
  const sections = [
    { label: 'Hook', score: result.hook?.score ?? 0 },
    { label: 'Rétention', score: result.retention?.score ?? 0 },
    { label: 'Rythme', score: result.editing?.score ?? 0 },
  ].sort((a, b) => a.score - b.score);
  const weakest = sections[0]?.label ?? 'hook';
  const verdictShort = result.finalVerdict?.split('.')[0] || verdictFor(result.viralityScore, weakest);
  const recommendations = result.coachAnalysis?.detectedProblems?.slice(0, 4).map((item) => item.action)
    ?? (result.improvements ?? []).slice(0, 4).map((item) => item.tip);

  return {
    ...result,
    analyzerMeta: {
      ...result.analyzerMeta,
      objective: objective || undefined,
      objectiveLabel: getObjectiveLabel(objective) || result.analyzerMeta?.objectiveLabel,
      fileName: file?.name,
      fileSizeMb: file ? Number((file.size / 1024 / 1024).toFixed(1)) : undefined,
      status: 'completed',
      verdictShort,
      recommendations,
    },
    repostVersion: result.repostVersion ?? buildFallbackRepost(objective),
    actionPlan: result.actionPlan ?? result.coachAnalysis?.repostEngine?.priorityChanges ?? [
      "Couper l'intro inutile et démarrer sur la tension principale.",
      'Ajouter une phrase choc dès la première seconde.',
      "Mettre le bénéfice dans le texte à l'écran.",
      'Ajouter une rupture visuelle autour de 5 secondes.',
      'Finir avec une question simple qui appelle un commentaire.',
    ],
  };
}

function VideoIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 7.8C4 6.25 5.25 5 6.8 5h7.4C15.75 5 17 6.25 17 7.8v8.4c0 1.55-1.25 2.8-2.8 2.8H6.8A2.8 2.8 0 0 1 4 16.2V7.8Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="m17 10 3.2-1.85c.8-.46 1.8.12 1.8 1.04v5.62c0 .92-1 1.5-1.8 1.04L17 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.31a1 1 0 0 1-1.42 0l-3.75-3.78a1 1 0 1 1 1.42-1.41l3.04 3.06 6.54-6.59a1 1 0 0 1 1.414-.005Z" clipRule="evenodd" />
    </svg>
  );
}

type AnalyzeIconName =
  | 'bell'
  | 'upload'
  | 'play'
  | 'spark'
  | 'chevron'
  | 'home'
  | 'zap'
  | 'user'
  | 'clock'
  | 'target'
  | 'shield'
  | 'eye'
  | 'chart'
  | 'check'
  | 'trophy';

function AnalyzeIcon({ name, className = 'h-4 w-4' }: { name: AnalyzeIconName; className?: string }) {
  const stroke = {
    className,
    fill: 'none',
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (name === 'bell') return <svg {...stroke}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z" /><path d="M10 21h4" /></svg>;
  if (name === 'upload') return <svg {...stroke}><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 15v4h14v-4" /></svg>;
  if (name === 'play') return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden><path d="M8 5.2v13.6c0 .82.92 1.3 1.58.82l9.47-6.8a1 1 0 0 0 0-1.64L9.58 4.38C8.92 3.9 8 4.38 8 5.2Z" /></svg>;
  if (name === 'spark') return <svg {...stroke}><path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" /></svg>;
  if (name === 'chevron') return <svg {...stroke}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === 'home') return <svg {...stroke}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></svg>;
  if (name === 'zap') return <svg {...stroke}><path d="M13 2 4 14h7l-1 8 10-13h-7V2Z" /></svg>;
  if (name === 'user') return <svg {...stroke}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
  if (name === 'clock') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === 'target') return <svg {...stroke}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></svg>;
  if (name === 'shield') return <svg {...stroke}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
  if (name === 'eye') return <svg {...stroke}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
  if (name === 'chart') return <svg {...stroke}><path d="M4 19V5" /><path d="M8 17V9" /><path d="M12 17V4" /><path d="M16 17v-6" /><path d="M20 17V7" /></svg>;
  if (name === 'check') return <CheckIcon className={className} />;
  if (name === 'trophy') return <svg {...stroke}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M5 5H3v2a4 4 0 0 0 4 4" /><path d="M19 5h2v2a4 4 0 0 1-4 4" /></svg>;
  return null;
}

function AnalyzeLogoMark() {
  return (
    <div className="relative h-9 w-9 shrink-0">
      <div className="absolute inset-0 rounded-[12px] bg-cyan-300/20 blur-md" />
      <div className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-[12px] border border-cyan-200/20 bg-[#050816] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
        <span className="block h-5 w-6 bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_44%,#8b5cf6_100%)] [clip-path:polygon(0_0,42%_0,50%_44%,70%_0,100%_0,58%_100%,42%_100%)]" />
      </div>
    </div>
  );
}

function formatPlanBadge(plan?: AppPlan) {
  if (plan === 'pro') return 'Pro';
  if (plan === 'lifetime' || plan === 'scale') return 'Lifetime';
  if (plan === 'starter' || plan === 'creator') return 'Starter';
  return 'Free';
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDurationCompact(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) return '--';
  const mins = Math.floor(seconds / 60);
  const sec = Math.max(0, Math.round(seconds % 60));
  return mins > 0 ? `${mins}:${String(sec).padStart(2, '0')}` : `00:${String(sec).padStart(2, '0')}`;
}

function formatAnalysisDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date non disponible';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getAnalysisScore(item?: AnalysisHistoryItem | null) {
  const score = item?.result?.viralityScore;
  return typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function getAnalysisTitle(item?: AnalysisHistoryItem | null) {
  const meta = item?.result?.analyzerMeta as AnalyzerMeta | undefined;
  const title = meta?.verdictShort || meta?.fileName || item?.result?.coachAnalysis?.patternLabel || item?.video_url;
  if (!title) return 'Analyse Viralynz';
  return title.replace(/^upload:/, '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 72);
}

function getRetentionValue(item?: AnalysisHistoryItem | null) {
  const score = item?.result?.retention?.score;
  return typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null;
}

function getObservedViews(item?: AnalysisHistoryItem | null) {
  const views = item?.result?.observedMetrics?.views;
  return typeof views === 'number' && Number.isFinite(views) ? views : null;
}

function SectionCard({
  title,
  children,
  eyebrow,
}: {
  title: string;
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.025] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_60px_-40px_rgba(0,0,0,0.9)] sm:p-5">
      {eyebrow && <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-vn-violet/70">{eyebrow}</p>}
      <h2 className="text-base font-bold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CollapsibleInsight({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[52px] w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.035]"
        aria-expanded={open}
      >
        <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-300">{title}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-full border border-white/[0.08] bg-black/20 text-sm font-black text-cyan-100 transition ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: premiumEase }}
        className="overflow-hidden"
      >
        <div className="border-t border-white/[0.06] px-4 py-4">{children}</div>
      </motion.div>
    </div>
  );
}

function UploadCard({
  file,
  disabled,
  onSelect,
  onClear,
}: {
  file: File | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyFile = (incoming?: File) => {
    if (!incoming) return;
    onSelect(incoming);
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!disabled) applyFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 transition-all sm:p-5 ${
        isDragging
          ? 'border-vn-fuchsia/45 bg-vn-fuchsia/[0.08]'
          : file
          ? 'border-vn-violet/25 bg-vn-violet/[0.045]'
          : 'border-dashed border-white/[0.14] bg-[#080810]/80 hover:border-vn-violet/35 hover:bg-white/[0.04]'
      }`}
    >
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/*" className="hidden" disabled={disabled} onChange={onChange} />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/40 to-transparent" />
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-vn-violet/25 bg-vn-violet/15 text-vn-violet sm:h-12 sm:w-12">
            <VideoIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            {file ? (
              <>
                <p className="truncate text-sm font-semibold text-white" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs text-gray-500">{formatFileSize(file.size)} · vidéo sélectionnée</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-white">Dépose ta vidéo ici</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">MP4, MOV ou export TikTok · max 500 Mo</p>
              </>
            )}
          </div>
        </div>
        <div className="flex w-full min-w-0 gap-2 sm:w-auto sm:shrink-0">
          {file && (
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="min-h-[42px] flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50 sm:flex-none"
            >
              Retirer
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="min-h-[42px] flex-1 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:bg-gray-200 disabled:opacity-50 sm:flex-none"
          >
            {file ? 'Changer la vidéo' : 'Sélectionner'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoiceGrid<T extends string>({
  value,
  items,
  onChange,
  compact,
  disabled,
}: {
  value: T | '';
  items: { id: T; label: string; detail?: string }[];
  onChange: (value: T) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`grid gap-2.5 ${compact ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
      {items.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(item.id)}
            className={`group rounded-2xl border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? 'border-vn-fuchsia/45 bg-vn-fuchsia/[0.11] shadow-[0_0_28px_-18px_rgba(232,121,249,0.9)]'
                : 'border-white/[0.08] bg-white/[0.035] hover:border-vn-violet/30 hover:bg-white/[0.055]'
            } ${compact ? 'min-h-[4rem]' : 'min-h-[5.5rem]'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-white`}>{item.label}</p>
                {item.detail && <p className="mt-1 text-[11px] text-gray-500">{item.detail}</p>}
              </div>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
                selected ? 'border-vn-fuchsia bg-vn-fuchsia text-black' : 'border-white/[0.13] text-transparent group-hover:border-vn-violet/45'
              }`}>
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function AnalysisProgress({ currentStep, progress }: { currentStep: number; progress: number }) {
  const activeDetail = [
    'On vérifie si le viewer comprend pourquoi rester.',
    'On cherche la tension, le mouvement et le texte écran.',
    'On repère le moment où le pouce risque de swiper.',
    'On compare les cuts à un rythme TikTok natif.',
    'On mesure si la fin déclenche une action simple.',
    'On estime le score avant/après correction.',
    'On prépare une version immédiatement testable.',
  ][Math.min(currentStep, analysisSteps.length - 1)];
  return (
    <section className="rounded-3xl border border-vn-violet/20 bg-[#080810]/95 p-5 sm:p-7 shadow-[0_20px_90px_-50px_rgba(99,102,241,0.75)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-vn-fuchsia/70">Analyse en cours</p>
          <h2 className="mt-2 text-xl font-black text-white">Diagnostic TikTok profond</h2>
          <p className="mt-1 text-sm text-gray-500">{analysisSteps[Math.min(currentStep, analysisSteps.length - 1)]}</p>
          <p className="mt-2 text-xs text-vn-violet/80">{activeDetail}</p>
        </div>
        <p className="text-3xl font-black tabular-nums text-white">{progress}%</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-6 grid gap-2">
        {analysisSteps.map((step, index) => {
          const done = index < currentStep;
          const active = index === currentStep;
          return (
            <div key={step} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
              done
                ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
                : active
                ? 'border-vn-violet/30 bg-vn-violet/[0.08]'
                : 'border-white/[0.06] bg-white/[0.025]'
            }`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                done
                  ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                  : active
                  ? 'border-vn-violet/35 bg-vn-violet/15 text-vn-violet'
                  : 'border-white/[0.1] text-gray-600'
              }`}>
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : active ? <span className="h-2 w-2 animate-pulse rounded-full bg-vn-violet" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />}
              </span>
              <p className={`text-sm ${done || active ? 'text-white' : 'text-gray-500'}`}>{step}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatDurationLabel(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '-';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

function statusBadgeClass(status: AnalysisPipelineStepStatus) {
  if (status === 'done') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300';
  if (status === 'warning') return 'border-amber-400/25 bg-amber-400/10 text-amber-300';
  if (status === 'failed') return 'border-red-400/25 bg-red-400/10 text-red-300';
  if (status === 'running') return 'border-vn-violet/30 bg-vn-violet/12 text-vn-violet';
  return 'border-white/[0.08] bg-white/[0.03] text-gray-500';
}

function phaseForPipeline(pipeline: AnalysisPipelineState, now: number) {
  if (pipeline.progress >= 100) return uxPhaseDefinitions[uxPhaseDefinitions.length - 1];

  const serverStep = pipeline.steps.find((step) => step.id === 'ocr' && step.startedAt);
  const runningServerSteps = pipeline.steps.filter((step) => ['ocr', 'format', 'opening', 'timeline', 'weak-moments', 'repost', 'hooks'].includes(step.id) && step.status === 'running');
  if (serverStep?.startedAt && runningServerSteps.length >= 4) {
    const elapsed = now - new Date(serverStep.startedAt).getTime();
    if (elapsed > 50000) return uxPhaseDefinitions.find((phase) => phase.id === 'final') ?? uxPhaseDefinitions[4];
    if (elapsed > 30000) return uxPhaseDefinitions.find((phase) => phase.id === 'repost') ?? uxPhaseDefinitions[3];
    if (elapsed > 14000) return uxPhaseDefinitions.find((phase) => phase.id === 'hook') ?? uxPhaseDefinitions[2];
    return uxPhaseDefinitions.find((phase) => phase.id === 'signals') ?? uxPhaseDefinitions[1];
  }

  const activeStep = pipeline.steps.find((step) => step.status === 'running') ?? pipeline.steps.find((step) => step.id === pipeline.currentStep) ?? pipeline.steps[0];
  return uxPhaseDefinitions.find((phase) => phase.stepIds.includes(activeStep?.id as PipelineStepId)) ?? uxPhaseDefinitions[0];
}

function smoothedPipelineProgress(pipeline: AnalysisPipelineState, phase: (typeof uxPhaseDefinitions)[number], now: number) {
  if (pipeline.progress >= 100) return 100;

  const phaseStep = pipeline.steps.find((step) => phase.stepIds.includes(step.id as PipelineStepId) && step.status === 'running')
    ?? pipeline.steps.find((step) => phase.stepIds.includes(step.id as PipelineStepId) && step.startedAt);
  const startedAt = phaseStep?.startedAt ? new Date(phaseStep.startedAt).getTime() : new Date(pipeline.startedAt).getTime();
  const elapsed = Math.max(0, now - startedAt);
  const durationByPhase: Record<UxPhaseId, number> = {
    prepare: 9000,
    signals: 18000,
    hook: 20000,
    repost: 16000,
    final: 14000,
  };
  const phaseRatio = Math.min(0.92, elapsed / durationByPhase[phase.id]);
  const phaseProgress = Math.round(phase.from + (phase.to - phase.from) * phaseRatio);
  const cap = phase.to >= 100 ? 99 : phase.to - 1;
  return Math.max(1, Math.min(cap, Math.max(pipeline.progress, phaseProgress)));
}

function phaseVisualStatus(phaseId: UxPhaseId, activePhaseId: UxPhaseId, progress: number) {
  const phase = uxPhaseDefinitions.find((item) => item.id === phaseId);
  if (!phase) return 'pending';
  if (progress >= phase.to) return 'done';
  if (phaseId === activePhaseId) return 'running';
  if (progress > phase.from) return 'done';
  return 'pending';
}

function readableStepStatus(status: AnalysisPipelineStepStatus) {
  if (status === 'done' || status === 'warning') return 'Termine';
  if (status === 'running') return 'En cours';
  if (status === 'failed') return 'Erreur';
  return 'A suivre';
}

function AnalysisPipelineProgress({ pipeline, preview }: { pipeline: AnalysisPipelineState; preview: AnalysisPreviewSignals }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1300);
    return () => window.clearInterval(timer);
  }, []);

  const now = Date.now();
  const activePhase = phaseForPipeline(pipeline, now);
  const displayProgress = smoothedPipelineProgress(pipeline, activePhase, now);
  const message = analysisReassuranceMessages[Math.floor(tick / 5) % analysisReassuranceMessages.length];
  const timeLabel = displayProgress < 40 ? 'Environ 1 min restante' : displayProgress < 75 ? 'Encore quelques secondes' : 'Finalisation en cours';
  const failedStep = pipeline.steps.find((step) => step.status === 'failed');
  const signalRows = [
    { label: 'Format', value: preview.formatDetected ? 'Detecte' : displayProgress >= 35 ? 'En lecture' : 'A suivre' },
    { label: 'Hook', value: preview.hookDetected ? 'Analyse' : displayProgress >= 55 ? 'En cours d analyse' : 'A suivre' },
    { label: 'Duree', value: formatDurationLabel(preview.durationSec) },
    { label: 'Texte ecran', value: preview.hasText ? 'Detecte' : displayProgress >= 35 ? 'Verification en cours' : '-' },
    { label: 'Transcription', value: preview.hasTranscript ? 'Disponible' : 'Selon audio exploitable' },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-vn-violet/20 bg-[radial-gradient(circle_at_18%_0%,rgba(167,139,250,0.15),transparent_32%),radial-gradient(circle_at_86%_12%,rgba(34,211,238,0.12),transparent_30%),linear-gradient(180deg,rgba(8,8,16,0.98),rgba(8,8,16,0.92))] p-4 shadow-[0_24px_100px_-64px_rgba(99,102,241,0.9)] sm:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-stretch">
        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.9)]" />
                </span>
                Analyse en cours
              </div>
              <h2 className="mt-4 text-xl font-black leading-tight text-white sm:text-2xl">{activePhase.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{activePhase.detail}</p>
            </div>
            <p className="shrink-0 text-3xl font-black tabular-nums text-white sm:text-4xl">{displayProgress}%</p>
          </div>

          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.065] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <motion.div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-vn-fuchsia via-vn-violet to-cyan-300"
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.75, ease: premiumEase }}
              >
                <div className="absolute inset-0 -translate-x-full animate-[vnProgressShimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/45 to-transparent" />
              </motion.div>
            </div>
            <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-cyan-100">{timeLabel}</p>
              <p className="text-slate-500">En general : 45 a 90 secondes selon la duree de la video</p>
            </div>
          </div>

          <motion.p
            key={message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: premiumEase }}
            className="mt-5 rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.055] px-4 py-3 text-sm font-semibold leading-relaxed text-cyan-50/90"
          >
            {failedStep ? "L'analyse a rencontre un blocage. On garde l'etat propre pour relancer." : message}
          </motion.p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {uxPhaseDefinitions.slice(0, 4).map((phase) => {
              const status = phaseVisualStatus(phase.id, activePhase.id, displayProgress);
              const done = status === 'done';
              const active = status === 'running';
              return (
                <div key={phase.id} className={`flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-3 ${
                  done
                    ? 'border-emerald-400/18 bg-emerald-400/[0.055]'
                    : active
                    ? 'border-vn-violet/26 bg-vn-violet/[0.075]'
                    : 'border-white/[0.06] bg-white/[0.025]'
                }`}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${
                    done
                      ? 'border-emerald-400/30 bg-emerald-400/12 text-emerald-300'
                      : active
                      ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                      : 'border-white/[0.08] text-slate-600'
                  }`}>
                    {done ? <CheckIcon className="h-3.5 w-3.5" /> : active ? <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-700" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`truncate text-sm font-black ${done || active ? 'text-white' : 'text-slate-500'}`}>{phase.title}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                      {done ? 'Termine' : active ? 'En cours' : 'A suivre'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-black/22 p-4 sm:p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">Premiers signaux detectes</p>
          <p className="mt-2 truncate text-sm font-black text-white" title={preview.fileName}>
            {preview.fileName ?? 'Video en lecture'}
          </p>
          {preview.fileSizeMb && <p className="mt-1 text-xs text-slate-500">{preview.fileSizeMb} Mo analyses localement avant envoi serveur</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {signalRows.map((row) => (
              <div key={row.label} className="min-w-0 rounded-xl border border-white/[0.065] bg-white/[0.035] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{row.label}</p>
                <p className="mt-1 truncate text-xs font-black text-slate-200" title={row.value}>{row.value}</p>
              </div>
            ))}
          </div>
          {(pipeline.signalsAvailable.length > 0 || pipeline.limitations.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {pipeline.signalsAvailable.slice(0, 5).map((signal) => (
                <span key={signal} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{signal}</span>
              ))}
              {pipeline.limitations.slice(0, 2).map((item) => (
                <span key={item} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">{item}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <CollapsibleInsight title="Voir les details techniques">
          <div className="grid gap-2">
            {pipeline.steps.map((step) => {
              const done = step.status === 'done';
              const active = step.status === 'running';
              const warning = step.status === 'warning';
              const failed = step.status === 'failed';
              const muted = step.status === 'pending';
          return (
            <div key={step.id} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
              done
                ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
                : warning
                ? 'border-amber-400/20 bg-amber-400/[0.06]'
                : failed
                ? 'border-red-400/20 bg-red-400/[0.06]'
                : active
                ? 'border-vn-violet/30 bg-vn-violet/[0.08]'
                : 'border-white/[0.06] bg-white/[0.025]'
            }`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-black ${
                done
                  ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300'
                  : warning
                  ? 'border-amber-400/30 bg-amber-400/15 text-amber-300'
                  : failed
                  ? 'border-red-400/30 bg-red-400/15 text-red-300'
                  : active
                  ? 'border-vn-violet/35 bg-vn-violet/15 text-vn-violet'
                  : 'border-white/[0.1] text-gray-600'
              }`}>
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : warning ? '!' : failed ? 'x' : active ? <span className="h-2 w-2 animate-pulse rounded-full bg-vn-violet" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-sm ${done || active || warning || failed ? 'text-white' : 'text-gray-500'}`}>{step.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${statusBadgeClass(step.status)}`}>
                    {readableStepStatus(step.status)}
                  </span>
                </div>
                {!muted && <p className="mt-1 text-xs text-gray-500">{step.microcopy}</p>}
                {(step.warning || step.error) && <p className="mt-1 text-xs text-amber-300/80">{step.warning ?? step.error}</p>}
              </div>
            </div>
              );
            })}
          </div>
        </CollapsibleInsight>
      </div>
      <style jsx>{`
        @keyframes vnProgressShimmer {
          100% {
            transform: translateX(180%);
          }
        }
      `}</style>
    </section>
  );
}

function AnalysisErrorCard({
  message,
  canRetry,
  onRetry,
  onChangeVideo,
}: {
  message: string;
  canRetry: boolean;
  onRetry: () => void;
  onChangeVideo: () => void;
}) {
  const cleanMessage = message && message.length < 140 ? message : "Le traitement a ete interrompu avant la fin.";
  return (
    <div className="rounded-3xl border border-red-400/22 bg-[linear-gradient(135deg,rgba(248,113,113,0.12),rgba(8,8,16,0.94)_42%,rgba(167,139,250,0.08))] p-4 shadow-[0_24px_90px_-62px_rgba(248,113,113,0.9)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200/80">Analyse interrompue</p>
          <h2 className="mt-2 text-xl font-black text-white">L'analyse n'a pas pu se terminer</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{cleanMessage}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-[170px]">
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry}
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-red-200/20 bg-red-300/10 px-4 text-xs font-black text-red-50 transition hover:bg-red-300/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Reessayer
          </button>
          <button
            type="button"
            onClick={onChangeVideo}
            className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-4 text-xs font-black text-white transition hover:bg-white/[0.07]"
          >
            Changer de video
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan?: AppPlan }) {
  return (
    <span className="inline-flex h-9 items-center rounded-full border border-cyan-200/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.15),rgba(139,92,246,0.23))] px-4 text-[0.82rem] font-black text-white shadow-[0_0_24px_-10px_rgba(59,130,246,0.95),inset_0_1px_0_rgba(255,255,255,0.2)]">
      {formatPlanBadge(plan)}
    </span>
  );
}

function AnalyzePageHeader({ authUser }: { authUser: AuthUser | null }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <AnalyzeLogoMark />
        <span className="truncate text-[1.18rem] font-black tracking-[-0.03em] text-white">Viralynz</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <PlanBadge plan={authUser?.plan} />
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          <AnalyzeIcon name="bell" className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
        </button>
      </div>
    </header>
  );
}

function AnalyzeHeroArt() {
  return (
    <div className="pointer-events-none absolute right-0 top-14 hidden h-40 w-40 min-[390px]:block">
      <div className="absolute bottom-6 right-3 h-24 w-28 -rotate-6 rounded-[24px] border border-violet-200/18 bg-[linear-gradient(145deg,rgba(59,130,246,0.16),rgba(139,92,246,0.18))] shadow-[0_0_45px_-16px_rgba(59,130,246,0.9)]" />
      <div className="absolute bottom-10 right-16 grid h-20 w-20 place-items-center rounded-full border border-cyan-200/30 bg-[radial-gradient(circle_at_50%_36%,rgba(34,211,238,0.5),rgba(59,130,246,0.18)_48%,rgba(6,10,24,0.8)_70%)] text-[1.5rem] font-black text-cyan-50 shadow-[0_0_42px_-10px_rgba(34,211,238,1)]">
        AI
      </div>
      <div className="absolute right-1 top-8 grid h-16 w-14 rotate-12 place-items-center rounded-[14px] border border-white/12 bg-white/[0.045] text-cyan-100">
        <AnalyzeIcon name="play" className="h-7 w-7" />
      </div>
      <div className="absolute bottom-2 right-10 h-7 w-24 rounded-full border border-cyan-200/12 bg-cyan-300/10 blur-sm" />
    </div>
  );
}

function SourceTabs({
  value,
  onChange,
  disabled,
}: {
  value: AnalyzeSource;
  onChange: (value: AnalyzeSource) => void;
  disabled: boolean;
}) {
  const tabs: Array<{ id: AnalyzeSource; label: string }> = [
    { id: 'upload', label: 'Importer' },
    { id: 'tiktok', label: 'Depuis TikTok' },
  ];
  return (
    <div className="grid h-12 grid-cols-2 rounded-[14px] border border-white/[0.08] bg-black/22 p-1">
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={`rounded-[11px] text-[0.9rem] font-black transition duration-200 ${
              active
                ? 'bg-[linear-gradient(135deg,#22d3ee,#3b82f6_52%,#8b5cf6)] text-white shadow-[0_14px_34px_-18px_rgba(34,211,238,0.9),inset_0_1px_0_rgba(255,255,255,0.24)]'
                : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function UploadedVideoDropzone({
  file,
  disabled,
  onSelect,
  onClear,
}: {
  file: File | null;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const applyFile = (incoming?: File) => {
    if (!incoming) return;
    onSelect(incoming);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) applyFile(event.dataTransfer.files?.[0]);
      }}
      className={`relative min-h-[182px] overflow-hidden rounded-[20px] border p-5 transition duration-200 ${
        isDragging
          ? 'border-cyan-200/45 bg-cyan-300/[0.085]'
          : file
          ? 'border-violet-300/35 bg-violet-300/[0.07]'
          : 'border-dashed border-cyan-100/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))]'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          applyFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/45 to-transparent" />
      <div className="flex h-full min-h-[140px] flex-col items-center justify-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-[18px] border border-cyan-200/22 bg-cyan-300/10 text-cyan-100 shadow-[0_0_28px_-16px_rgba(34,211,238,0.9)]">
          <AnalyzeIcon name="upload" className="h-7 w-7" />
        </div>
        {file ? (
          <>
            <p className="mt-4 max-w-full truncate text-[0.95rem] font-black text-white" title={file.name}>{file.name}</p>
            <p className="mt-1 text-[0.8rem] font-semibold text-slate-400">{formatFileSize(file.size)} · fichier prêt</p>
            <div className="mt-4 flex w-full gap-2">
              <button type="button" disabled={disabled} onClick={onClear} className="h-11 flex-1 rounded-[14px] border border-white/10 bg-white/[0.045] text-[0.82rem] font-black text-slate-200">
                Retirer
              </button>
              <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="h-11 flex-1 rounded-[14px] bg-white text-[0.82rem] font-black text-[#050711]">
                Changer
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-[1rem] font-black text-white">Glisse ta vidéo ici</p>
            <p className="mt-1 text-[0.86rem] font-medium text-slate-400">ou importe un fichier</p>
            <p className="mt-2 text-[0.74rem] font-semibold text-slate-500">MP4, MOV, WebM · Max 500 Mo</p>
            <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="mt-4 h-11 rounded-[14px] bg-white px-5 text-[0.84rem] font-black text-[#050711] transition hover:bg-slate-200 disabled:opacity-50">
              Importer une vidéo
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TikTokVideoThumb({ index }: { index: number }) {
  const gradients = [
    'from-cyan-300/35 via-violet-400/20 to-slate-950',
    'from-fuchsia-300/30 via-blue-400/22 to-slate-950',
    'from-emerald-300/24 via-cyan-400/16 to-slate-950',
  ];
  return (
    <div className={`h-full w-full bg-gradient-to-br ${gradients[index % gradients.length]}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_36%_24%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(140deg,transparent_0%,rgba(0,0,0,0.38)_68%)]" />
      <div className="absolute bottom-3 left-3 h-8 w-16 rounded-full bg-white/10 blur-xl" />
    </div>
  );
}

function TikTokVideoPicker({
  videos,
  selectedId,
  onSelect,
  connected,
  loading,
  onConnect,
  onSwitchUpload,
}: {
  videos: TikTokPublishedVideo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onSwitchUpload: () => void;
}) {
  if (!connected) {
    return (
      <div className="rounded-[18px] border border-cyan-200/14 bg-cyan-300/[0.055] p-4">
        <p className="text-[0.92rem] font-black text-white">Connecte TikTok pour analyser une vidéo déjà publiée.</p>
        <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">Viralynz affichera seulement les vidéos réellement synchronisées.</p>
        <Link href="/api/tiktok/connect?review=1" className="mt-4 inline-flex h-11 items-center rounded-[14px] bg-[linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6)] px-4 text-[0.84rem] font-black text-white">
          Connecter TikTok
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-[132px] animate-pulse rounded-[15px] border border-white/[0.06] bg-white/[0.04]" />)}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.035] p-4">
        <p className="text-[0.94rem] font-black text-white">Aucune vidéo TikTok disponible</p>
        <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">Ton compte est connecté, mais aucune vidéo publiable n’est synchronisée pour l’instant.</p>
        <button type="button" onClick={onSwitchUpload} className="mt-4 h-11 rounded-[14px] border border-cyan-200/18 bg-cyan-300/10 px-4 text-[0.84rem] font-black text-cyan-100">
          Importer une vidéo
        </button>
      </div>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-3">
        {videos.slice(0, 8).map((video, index) => {
          const selected = selectedId === video.id;
          return (
            <button
              key={video.id}
              type="button"
              onClick={() => onSelect(video.id)}
              className={`relative h-[132px] w-[118px] overflow-hidden rounded-[15px] border text-left transition duration-200 active:scale-[0.98] ${
                selected ? 'border-cyan-300 shadow-[0_0_28px_-14px_rgba(34,211,238,0.95)]' : 'border-white/[0.08] hover:border-white/[0.18]'
              }`}
            >
              {video.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <TikTokVideoThumb index={index} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/8 to-transparent" />
              <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/42 text-white backdrop-blur-md">
                <AnalyzeIcon name="play" className="h-5 w-5" />
              </span>
              {selected && (
                <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(135deg,#22d3ee,#3b82f6)] text-white shadow-[0_0_18px_rgba(34,211,238,0.7)]">
                  <AnalyzeIcon name="check" className="h-4 w-4" />
                </span>
              )}
              <span className="absolute bottom-2 right-2 rounded-[8px] bg-black/70 px-1.5 py-1 text-[0.68rem] font-black text-white">{formatDurationCompact(video.duration)}</span>
              {video.views !== null && <span className="absolute bottom-2 left-2 max-w-[70px] truncate rounded-[8px] bg-black/62 px-1.5 py-1 text-[0.65rem] font-black text-cyan-100">{formatCount(video.views)} vues</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnalyzeSourceCard({
  source,
  onSourceChange,
  file,
  disabled,
  onFileSelect,
  onFileClear,
  authUser,
  videos,
  videosLoading,
  selectedVideoId,
  onSelectVideo,
  onAnalyzeUpload,
  onAnalyzeTikTok,
  canAnalyzeUpload,
  canAnalyzeTikTok,
  isLoading,
}: {
  source: AnalyzeSource;
  onSourceChange: (value: AnalyzeSource) => void;
  file: File | null;
  disabled: boolean;
  onFileSelect: (file: File | null) => void;
  onFileClear: () => void;
  authUser: AuthUser | null;
  videos: TikTokPublishedVideo[];
  videosLoading: boolean;
  selectedVideoId: string | null;
  onSelectVideo: (id: string) => void;
  onAnalyzeUpload: () => void;
  onAnalyzeTikTok: () => void;
  canAnalyzeUpload: boolean;
  canAnalyzeTikTok: boolean;
  isLoading: boolean;
}) {
  const tiktokConnected = Boolean(authUser?.tiktok?.connected);
  const displayName = authUser?.tiktok?.displayName?.trim() || 'Compte TikTok';
  const ctaDisabled = source === 'upload' ? !canAnalyzeUpload : !canAnalyzeTikTok;
  const ctaLabel = source === 'upload' ? 'Analyser cette vidéo' : videos.length > 0 ? 'Analyser cette vidéo' : 'Importer une vidéo';

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-cyan-200/20 bg-[linear-gradient(180deg,rgba(9,15,35,0.86),rgba(5,8,18,0.93))] p-4 shadow-[0_0_56px_-34px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
      <div className="flex items-start gap-3">
        <span className="mt-1 text-cyan-200">✦</span>
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-black tracking-[-0.03em] text-white">Analyse automatique</h2>
          <p className="mt-2 text-[0.84rem] leading-5 text-slate-400">Choisis une source, Viralynz détecte automatiquement les signaux qui font performer ta vidéo.</p>
        </div>
      </div>

      <div className="mt-4">
        <SourceTabs value={source} onChange={onSourceChange} disabled={isLoading} />
      </div>

      <div className="mt-4 space-y-4">
        {source === 'upload' ? (
          <UploadedVideoDropzone file={file} disabled={disabled} onSelect={onFileSelect} onClear={onFileClear} />
        ) : (
          <>
            {tiktokConnected && (
              <button type="button" className="flex h-12 w-full items-center gap-3 rounded-[15px] border border-white/[0.09] bg-white/[0.035] px-3 text-left">
                <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(34,197,94,0.8)]" />
                <span className="min-w-0 flex-1 truncate text-[0.9rem] font-black text-white">Compte TikTok connecté</span>
                <span className="max-w-[118px] truncate text-[0.8rem] font-black text-blue-300">{displayName}</span>
                <AnalyzeIcon name="chevron" className="h-4 w-4 shrink-0 text-slate-500" />
              </button>
            )}
            <div>
              <h3 className="mb-3 text-[0.96rem] font-black text-white">Choisir une vidéo publiée</h3>
              <TikTokVideoPicker
                videos={videos}
                selectedId={selectedVideoId}
                onSelect={onSelectVideo}
                connected={tiktokConnected}
                loading={videosLoading}
                onConnect={() => undefined}
                onSwitchUpload={() => onSourceChange('upload')}
              />
            </div>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={source === 'upload' ? onAnalyzeUpload : videos.length > 0 ? onAnalyzeTikTok : () => onSourceChange('upload')}
        disabled={isLoading || ctaDisabled}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-[17px] bg-[linear-gradient(135deg,#22d3ee_0%,#3b82f6_48%,#8b5cf6_100%)] text-[1rem] font-black text-white shadow-[0_18px_46px_-24px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <AnalyzeIcon name="spark" className="h-4 w-4" />
        {isLoading ? 'Analyse en cours...' : ctaLabel}
      </button>
      <p className="mt-3 flex items-center justify-center gap-2 text-center text-[0.78rem] font-semibold text-slate-400">
        <AnalyzeIcon name="shield" className="h-4 w-4 text-slate-500" />
        Analyse 100% automatique · Sécurisée et privée
      </p>
    </section>
  );
}

function MiniSparkline({ tone = 'cyan' }: { tone?: 'cyan' | 'violet' | 'green' }) {
  const stroke = tone === 'green' ? '#86efac' : tone === 'violet' ? '#a78bfa' : '#22d3ee';
  return (
    <svg viewBox="0 0 120 34" className="mt-3 h-8 w-full" fill="none" aria-hidden>
      <path d="M2 25 C18 23 22 14 34 19 C46 24 54 24 66 13 C78 2 84 18 95 16 C106 14 110 9 118 11" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2 25 C18 23 22 14 34 19 C46 24 54 24 66 13 C78 2 84 18 95 16 C106 14 110 9 118 11 V34 H2 Z" fill={`url(#spark-${tone})`} opacity=".28" />
      <defs>
        <linearGradient id={`spark-${tone}`} x1="60" y1="0" x2="60" y2="34">
          <stop stopColor={stroke} />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function InsightMetricCard({ icon, label, value, tone }: { icon: AnalyzeIconName; label: string; value: string; tone: 'cyan' | 'violet' | 'green' }) {
  const toneClass = tone === 'green' ? 'text-emerald-300 bg-emerald-300/10 border-emerald-300/18' : tone === 'violet' ? 'text-violet-200 bg-violet-300/10 border-violet-300/18' : 'text-cyan-200 bg-cyan-300/10 border-cyan-300/18';
  return (
    <div className="min-w-0 rounded-[17px] border border-white/[0.075] bg-white/[0.035] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]">
      <div className={`grid h-10 w-10 place-items-center rounded-[13px] border ${toneClass}`}>
        <AnalyzeIcon name={icon} className="h-5 w-5" />
      </div>
      <p className="mt-3 text-[0.76rem] font-semibold text-slate-400">{label}</p>
      <p className="mt-1 truncate text-[0.98rem] font-black text-white" title={value}>{value}</p>
      <MiniSparkline tone={tone} />
    </div>
  );
}

function RealtimeInsights({ latest }: { latest: AnalysisHistoryItem | null }) {
  const retention = getRetentionValue(latest);
  const format = latest?.result?.coachAnalysis?.patternLabel || null;
  const hookValue = latest?.result?.hook?.score !== undefined ? `Hook ${Math.round(latest.result.hook.score)}/100` : 'À détecter';
  const retentionValue = retention !== null ? `Rétention ${retention}/100` : 'À détecter';
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.05rem] font-black text-white">Insights IA en temps réel</h2>
        <span className="text-[0.76rem] font-semibold text-slate-500">{latest ? 'Dernière analyse' : 'Prêt à analyser'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 min-[430px]:grid-cols-3">
        <InsightMetricCard icon="target" label="Hook détecté" value={hookValue} tone="violet" />
        <InsightMetricCard icon="clock" label="Fenêtre virale" value="Après analyse" tone="cyan" />
        <InsightMetricCard icon="trophy" label="Format gagnant" value={format ?? 'À détecter'} tone="green" />
      </div>
    </section>
  );
}

function ScoreRing({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const display = score === null ? '--' : String(score);
  const angle = score === null ? 52 : Math.max(8, Math.min(100, score)) * 3.6;
  const outer = compact ? 'h-16 w-16' : 'h-28 w-28';
  const inner = compact ? 'h-12 w-12' : 'h-[86px] w-[86px]';
  const scoreSize = compact ? 'text-[1.15rem]' : 'text-[2rem]';
  const suffixSize = compact ? 'text-[0.58rem]' : 'text-[0.78rem]';
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${outer}`} style={{ background: `conic-gradient(#22d3ee 0deg, #3b82f6 ${Math.max(0, angle - 60)}deg, #8b5cf6 ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)` }}>
      <div className={`grid place-items-center rounded-full bg-[#070b18] shadow-[inset_0_0_28px_rgba(15,23,42,0.9)] ${inner}`}>
        <div className="text-center">
          <p className={`${scoreSize} font-black leading-none text-white`}>{display}</p>
          <p className={`${suffixSize} font-bold text-slate-400`}>/100</p>
        </div>
      </div>
    </div>
  );
}

function RetentionPreviewLine({ hasData }: { hasData: boolean }) {
  return (
    <svg viewBox="0 0 132 92" className="h-24 w-full" fill="none" aria-hidden>
      <path d="M14 8v72h110" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
      <path d="M14 28h110M14 54h110" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
      <path d={hasData ? 'M16 18 C25 30 32 37 43 40 C58 44 68 45 80 54 C94 65 108 66 122 78' : 'M18 66 C42 66 48 42 66 46 C82 49 91 33 118 33'} stroke={hasData ? '#3b82f6' : 'rgba(148,163,184,0.55)'} strokeWidth="3" strokeLinecap="round" />
      <text x="0" y="12" fill="rgba(203,213,225,0.72)" fontSize="10">100%</text>
      <text x="4" y="84" fill="rgba(203,213,225,0.72)" fontSize="10">0%</text>
    </svg>
  );
}

function ResultPreviewCard({ latest }: { latest: AnalysisHistoryItem | null }) {
  const score = getAnalysisScore(latest);
  const hasData = Boolean(latest);
  const description = latest?.result?.hook?.analysis || latest?.result?.coachAnalysis?.openingAnalysis?.exactCorrection || 'Lance une analyse pour transformer le score en décisions de montage concrètes.';
  const checklist = latest?.result?.actionPlan?.slice(0, 3) ?? latest?.result?.analyzerMeta?.recommendations?.slice(0, 3) ?? [
    'Détecter le hook et le rythme',
    'Repérer les pertes d’attention',
    'Générer le plan de repost',
  ];
  return (
    <section className="mt-5 rounded-[22px] border border-blue-300/18 bg-[linear-gradient(180deg,rgba(9,15,35,0.78),rgba(5,8,18,0.9))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <h2 className="text-[1.05rem] font-black text-white">Aperçu du résultat</h2>
      <div className="mt-4 grid gap-4 min-[390px]:grid-cols-[112px_minmax(0,1fr)]">
        <ScoreRing score={score} compact />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[1rem] font-black text-white">Potentiel de repost</h3>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[0.68rem] font-black text-cyan-200">Insight IA</span>
          </div>
          <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">{description}</p>
          <div className="mt-3 space-y-1.5">
            {checklist.map((item) => (
              <div key={item} className="flex min-w-0 items-start gap-2 text-[0.78rem] font-semibold text-slate-300">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cyan-300 text-[#05101b]"><AnalyzeIcon name="check" className="h-3 w-3" /></span>
                <span className="min-w-0">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-[17px] border border-white/[0.06] bg-white/[0.025] p-3">
        <p className="mb-2 text-[0.74rem] font-bold text-slate-500">Rétention</p>
        <RetentionPreviewLine hasData={hasData} />
      </div>
    </section>
  );
}

function RecentAnalysisCard({ item, index }: { item: AnalysisHistoryItem; index: number }) {
  const score = getAnalysisScore(item);
  const retention = getRetentionValue(item);
  const views = getObservedViews(item);
  return (
    <button type="button" className="flex w-full items-center gap-3 rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-2.5 text-left transition hover:border-cyan-200/18 hover:bg-white/[0.055]">
      <div className="relative h-[72px] w-[86px] shrink-0 overflow-hidden rounded-[13px]">
        <TikTokVideoThumb index={index} />
        <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-md">
          <AnalyzeIcon name="play" className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9rem] font-black text-white">{getAnalysisTitle(item)}</p>
        <p className="mt-1 text-[0.76rem] font-medium text-slate-400">{formatAnalysisDate(item.created_at)} · <span className="text-emerald-300">Terminée</span></p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[0.74rem] font-semibold text-slate-400">
          <span className="inline-flex items-center gap-1"><AnalyzeIcon name="eye" className="h-3.5 w-3.5" />{views === null ? 'Vues --' : `${formatCount(views)} vues`}</span>
          <span className="inline-flex items-center gap-1"><AnalyzeIcon name="chart" className="h-3.5 w-3.5" />{retention === null ? 'Rétention --' : `${retention}% rétention`}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ScoreRing score={score} />
        <AnalyzeIcon name="chevron" className="h-4 w-4 text-slate-500" />
      </div>
    </button>
  );
}

function RecentAnalysesSection({ history }: { history: AnalysisHistoryItem[] }) {
  const items = history.slice(0, 2);
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-black text-white">Analyses récentes</h2>
        <Link href="/dashboard/library" className="inline-flex items-center gap-1 text-[0.86rem] font-black text-violet-300">
          Voir tout <AnalyzeIcon name="chevron" className="h-4 w-4" />
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="rounded-[18px] border border-white/[0.075] bg-white/[0.035] p-4">
          <p className="text-[0.94rem] font-black text-white">Aucune analyse récente</p>
          <p className="mt-2 text-[0.82rem] leading-5 text-slate-400">Importe une vidéo pour créer ton premier diagnostic Viralynz.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => <RecentAnalysisCard key={item.id} item={item} index={index} />)}
        </div>
      )}
    </section>
  );
}

function MobileBottomNav() {
  const items: Array<{ label: string; href: string; icon: AnalyzeIconName; active?: boolean }> = [
    { label: 'Accueil', href: '/dashboard', icon: 'home' },
    { label: 'Analyser', href: '/dashboard/analyze', icon: 'chart', active: true },
    { label: 'Hooks', href: '/dashboard/hooks', icon: 'zap' },
    { label: 'Compte', href: '/dashboard/settings', icon: 'user' },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="grid h-[76px] grid-cols-4 rounded-[24px] border border-white/[0.085] bg-[#06101f]/86 px-2 py-2 shadow-[0_-18px_52px_-34px_rgba(34,211,238,0.8),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center gap-1 rounded-[18px] text-[0.74rem] font-semibold transition ${item.active ? 'bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(139,92,246,0.28))] text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : 'text-slate-400'}`}>
            <AnalyzeIcon name={item.icon} className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ResultCard({ title, score, verdict, analysis, advice }: { title: string; score: number; verdict: string; analysis: string; advice: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-vn-violet/80">{verdict}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black tabular-nums ${scoreTone(score)}`}>{score}/100</span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className={`h-full rounded-full bg-gradient-to-r ${scoreBar(score)}`} style={{ width: `${score}%` }} />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-gray-400">{analysis}</p>
      <p className="mt-3 rounded-xl border border-vn-violet/15 bg-vn-violet/[0.055] p-3 text-xs leading-relaxed text-vn-violet/90">
        {advice}
      </p>
    </div>
  );
}

function PremiumPreview({
  children,
  label,
  className = '',
  intensity = 'medium',
}: {
  children: ReactNode;
  label: string;
  className?: string;
  intensity?: 'light' | 'medium';
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className={intensity === 'light' ? 'blur-[1.5px] opacity-70' : 'blur-[3px] opacity-55'}>
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0b0b12]/38 to-[#0b0b12]/92" />
      <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/[0.1] bg-black/45 px-4 py-3 shadow-[0_18px_70px_-42px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-violet/80">Preview Pro</p>
        <p className="mt-1 text-sm font-black text-white">{label}</p>
      </div>
    </div>
  );
}

function PremiumTeaserBand() {
  return (
    <div className="rounded-2xl border border-vn-violet/18 bg-[linear-gradient(135deg,rgba(167,139,250,0.105),rgba(34,211,238,0.045)_52%,rgba(232,121,249,0.09))] p-4 shadow-[0_24px_90px_-64px_rgba(167,139,250,0.85)]">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-vn-violet/80">Analyse gratuite</p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-black text-white">Tu vois le diagnostic. Le plan complet reste en Pro.</p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-400">
            Debloque la timeline complete, tous les drops detectes, les hooks reecrits et la structure prete a remonter.
          </p>
        </div>
        <Link href="/dashboard/billing" className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/[0.12] bg-white/[0.075] px-4 text-sm font-black text-white transition hover:bg-white/[0.1]">
          Voir Pro
        </Link>
      </div>
    </div>
  );
}

interface ReconstructionTimelineItem {
  time: string;
  label: string;
  action: string;
  badge: string;
  goal: string;
  expectedImpact: string;
  sourceIssue?: string;
}

function buildReconstructionTimeline(repost: RepostVersion, reconstruction?: ReconstructionIAOutput): ReconstructionTimelineItem[] {
  if (reconstruction?.optimizedStructure?.length) {
    return reconstruction.optimizedStructure.map((step) => ({
      time: `${step.start}-${step.end}`,
      label: step.type.replace('_', ' '),
      action: step.recommendation,
      badge: step.move === 'advance' ? 'Avancer' : step.move === 'cut' ? 'Couper' : step.move === 'insert' ? 'Relancer' : step.move === 'move_cta' ? 'CTA' : 'Optimiser',
      goal: step.goal,
      expectedImpact: step.expectedImpact,
      sourceIssue: step.sourceIssue,
    }));
  }

  const fallback = [
    ['0:00-0:02', 'HOOK VISUEL', 'Montrer le résultat final immédiatement.', 'Avancer'],
    ['0:02-0:05', 'PREUVE RAPIDE', 'Afficher la transformation, la preuve ou le contraste avant le contexte.', 'Déplacer'],
    ['0:05-0:08', 'ERREUR COMMUNE', 'Supprimer l’introduction actuelle et nommer le blocage en une phrase.', 'Couper'],
    ['0:08-0:12', 'CORRECTION', 'Ajouter une relance visuelle et un texte écran dynamique.', 'Relancer'],
    ['0:12-0:15', 'CTA', 'Déplacer le CTA avant le drop principal avec une question courte.', 'Optimiser'],
  ];

  return fallback.map(([time, label, action, badge], index) => ({
    time,
    label,
    action: repost.structure[index] ?? action,
    badge,
    goal: label,
    expectedImpact: 'Simulation IA : meilleure tenue de la rétention.',
  }));
}

function ReconstructionPaywall({ plan }: { plan?: AppPlan }) {
  const isCreator = plan === 'creator';
  const badge = isCreator ? 'Plan Starter' : 'Preview Pro';
  return (
    <SectionCard title="Structure optimisée" eyebrow="Reconstruction IA">
      <div className="relative overflow-hidden rounded-3xl border border-vn-fuchsia/22 bg-[radial-gradient(circle_at_12%_0%,rgba(232,121,249,0.16),transparent_35%),radial-gradient(circle_at_88%_15%,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4 shadow-[0_28px_110px_-76px_rgba(168,85,247,0.95)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-vn-fuchsia/25 bg-vn-fuchsia/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-fuchsia-100">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_16px_rgba(232,121,249,0.9)]" />
              {badge}
            </div>
            <h3 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">Générer une structure optimisée</h3>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              {isCreator
                ? 'Starter garde le diagnostic. La Reconstruction IA débloque la nouvelle structure, les hooks alternatifs, les cuts recommandés et le plan seconde par seconde.'
                : 'Connecte-toi ou passe en Pro pour transformer le diagnostic en plan de remontage complet.'}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Link href="/dashboard/billing" className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_65px_-34px_rgba(232,121,249,0.95)] transition hover:brightness-110">
                Debloquer la reconstruction IA
              </Link>
              <Link href="/dashboard" className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
                Voir mon plan
              </Link>
            </div>
          </div>

          <div className="relative rounded-2xl border border-white/[0.08] bg-black/24 p-3">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-vn-violet/[0.03] to-vn-fuchsia/[0.06]" />
            <div className="relative space-y-2">
              {[
                ['0:00', 'Hook visuel', 'verrouillé'],
                ['0:03', 'Preuve avancée', 'Pro'],
                ['0:07', 'Cut prioritaire', 'Pro'],
                ['0:12', 'CTA optimisé', 'Lifetime'],
              ].map(([time, label, badge], index) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0.65, x: index % 2 ? 10 : -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: index * 0.07, ease: premiumEase }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] font-black text-cyan-100">{time}</span>
                    <span className="text-sm font-black text-white">{label}</span>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase text-gray-400">{badge}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ReconstructionIASection({ result, repost, plan }: { result: AnalyzerResult; repost: RepostVersion; plan?: AppPlan }) {
  const reconstruction = result.reconstructionIA;
  const timeline = buildReconstructionTimeline(repost, reconstruction);
  const lifetimeOnly = isLifetimePlan(plan);
  const cuts = reconstruction?.cutsRecommended?.length
    ? reconstruction.cutsRecommended.map((cut) => `${cut.timeRange} : ${cut.reason}${cut.replacement ? ` → ${cut.replacement}` : ''}`)
    : [
      'Supprimer les secondes de contexte avant la tension.',
      'Avancer la preuve avant le premier décrochage.',
      'Couper la phrase qui répète la promesse sans ajouter de valeur.',
    ];
  const relances = reconstruction?.patternInterrupts?.length
    ? reconstruction.patternInterrupts.map((item) => `${item.at} : ${item.instruction} (${item.reason})`)
    : [
      'Texte écran choc au moment où le rythme baisse.',
      'Pattern interrupt juste avant le segment explicatif.',
      'Question courte avant la sortie probable.',
    ];
  const prediction = reconstruction?.predictedImprovements;

  return (
    <SectionCard title="Structure optimisée" eyebrow="Reconstruction IA">
      <div className="relative overflow-hidden rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(232,121,249,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.018))] p-4 shadow-[0_34px_130px_-82px_rgba(34,211,238,0.92)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
              Reconstruction active
            </div>
            <h3 className="mt-4 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">
              Viralynz reconstruit l’ordre, pas la vidéo finale.
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
              Nouvelle séquence, hooks alternatifs, cuts recommandés, relances d’attention et CTA optimisés pour remonter une version plus forte.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/[0.08] bg-black/22 p-2">
            {[
              ['Avant', `${result.viralityScore}/100`],
              ['Structure', `${Math.min(96, Math.max(72, result.viralityScore + 18))}/100`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/[0.045] px-4 py-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-black text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative rounded-2xl border border-white/[0.08] bg-black/22 p-3 sm:p-4">
            <div className="absolute bottom-6 left-[1.72rem] top-6 w-px bg-gradient-to-b from-cyan-300/10 via-cyan-300/45 to-fuchsia-300/10" />
            <div className="space-y-3">
              {timeline.map((item, index) => (
                <motion.div
                  key={`${item.time}-${item.label}`}
                  initial={{ opacity: 0, y: 16, filter: 'blur(5px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.48, delay: index * 0.08, ease: premiumEase }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  className="group relative grid gap-3 rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))] p-3 transition hover:border-cyan-300/24 hover:bg-white/[0.055] sm:grid-cols-[6.2rem_1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full border border-cyan-300/35 bg-cyan-300/12 text-[10px] font-black text-cyan-100 shadow-[0_0_30px_-12px_rgba(34,211,238,0.95)]">{index + 1}</span>
                    <span className="text-xs font-black text-cyan-100">{item.time}</span>
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.12em] text-white">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{item.action}</p>
                    <p className="mt-1 text-[11px] leading-4 text-cyan-100/70">{item.expectedImpact}</p>
                    {item.sourceIssue && (
                      <p className="mt-2 rounded-lg border border-white/[0.06] bg-black/18 px-2.5 py-2 text-[11px] leading-4 text-gray-500 opacity-90 transition group-hover:border-cyan-300/18 group-hover:text-gray-300">
                        Signal source : {item.sourceIssue}
                      </p>
                    )}
                  </div>
                  <span className="w-fit rounded-full border border-vn-fuchsia/22 bg-vn-fuchsia/10 px-2.5 py-1 text-[10px] font-black uppercase text-fuchsia-100">
                    {item.badge}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <motion.div whileHover={cardHover} className="rounded-2xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.055] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-fuchsia/80">Hooks alternatifs</p>
              <div className="mt-3 space-y-2">
                {(reconstruction?.alternativeHooks?.length
                  ? reconstruction.alternativeHooks.map((item) => item.hook)
                  : (repost.hookVariants?.length ? repost.hookVariants : [repost.hook, 'Le meilleur moment de ta vidéo arrive trop tard.', 'Tu n’as pas un problème d’idée, tu as un problème d’ordre.'])
                ).slice(0, lifetimeOnly ? 4 : 3).map((hook) => (
                  <p key={hook} className="rounded-xl border border-white/[0.07] bg-black/18 px-3 py-2 text-sm font-semibold text-white">"{hook}"</p>
                ))}
              </div>
            </motion.div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <motion.div whileHover={cardHover} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Cuts recommandés</p>
                <div className="mt-3 space-y-2">
                  {cuts.map((cut) => <p key={cut} className="text-xs leading-5 text-gray-300">• {cut}</p>)}
                </div>
              </motion.div>
              <motion.div whileHover={cardHover} className="rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.045] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/80">Relances d’attention</p>
                <div className="mt-3 space-y-2">
                  {relances.map((item) => <p key={item} className="text-xs leading-5 text-gray-300">• {item}</p>)}
                </div>
              </motion.div>
            </div>

            <motion.div whileHover={cardHover} className="rounded-2xl border border-cyan-300/16 bg-cyan-300/[0.045] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">CTA optimisé</p>
              <p className="mt-2 text-sm font-black leading-6 text-white">{reconstruction?.ctaRecommendations?.[0]?.cta ?? repost.cta}</p>
              {reconstruction?.ctaRecommendations?.[0]?.why && <p className="mt-2 text-xs leading-5 text-gray-400">{reconstruction.ctaRecommendations[0].why}</p>}
              {lifetimeOnly && <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-xs font-bold text-cyan-100">Lifetime : variantes CTA + multi-structures pour comparer plusieurs comptes.</p>}
            </motion.div>
            {reconstruction?.retentionFixes?.length ? (
              <CollapsibleInsight title="Fixes retention" defaultOpen>
                <div className="space-y-3">
                  {reconstruction.retentionFixes.slice(0, 3).map((fix) => (
                    <div key={`${fix.timeRange}-${fix.problem}`} className="rounded-xl border border-white/[0.06] bg-black/18 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-[11px] font-black text-amber-100">{fix.timeRange}</span>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">drop logic</span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-5 text-white">{fix.problem}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-400">{fix.fix}</p>
                      <p className="mt-2 text-[11px] leading-4 text-emerald-100/70">{fix.expectedImpact}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleInsight>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div whileHover={cardHover} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">Pourquoi cette structure performera mieux</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-gray-300">
              <p>{reconstruction?.whyThisStructureWorks?.retentionLogic ?? 'Le résultat final est déplacé au début pour réduire la perte des viewers durant les 3 premières secondes.'}</p>
              <p>{reconstruction?.whyThisStructureWorks?.viewerPsychology ?? 'Le viewer reçoit une preuve avant l’explication, ce qui augmente la tension et la curiosité.'}</p>
              <p className="text-gray-500">{reconstruction?.whyThisStructureWorks?.changeJustification ?? 'Les changements suivent les drops, le hook et le CTA détectés dans l’analyse.'}</p>
            </div>
          </motion.div>
          <motion.div whileHover={cardHover} className="rounded-2xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.055] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-fuchsia/80">Simulation IA</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ['Rétention', prediction?.retentionPotential ?? Math.min(96, result.viralityScore + 16)],
                ['Watch time', prediction?.watchTimePotential ?? Math.min(96, result.retention.score + 18)],
                ['Engagement', prediction?.engagementPotential ?? 78],
                ['Commentaires', prediction?.commentPotential ?? 74],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.07] bg-black/18 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
                  <p className="mt-1 text-2xl font-black text-white">{value}<span className="text-xs text-gray-500">/100</span></p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-gray-500">{prediction?.label ?? 'Simulation IA, pas une garantie de performance.'}</p>
          </motion.div>
        </div>
      </div>
    </SectionCard>
  );
}

function ResultsView({
  result,
  onReset,
  isFreePreview,
  canUseReconstruction,
  plan,
}: {
  result: AnalyzerResult;
  onReset: () => void;
  isFreePreview: boolean;
  canUseReconstruction: boolean;
  plan?: AppPlan;
}) {
  const subScores = result.coachAnalysis?.subScores;
  const hookScore = subScores?.hook ?? result.hook?.score ?? 0;
  const retentionScore = subScores?.retention ?? result.retention?.score ?? 0;
  const rhythmScore = result.editing?.score ?? 0;
  const clarityScore = subScores?.clarity ?? Math.round((hookScore * 0.35 + retentionScore * 0.25 + rhythmScore * 0.2 + result.viralityScore * 0.2));
  const ctaScore = subScores?.cta ?? (result.improvements?.some((item) => item.tip.toLowerCase().includes('cta')) ? 48 : Math.max(42, result.viralityScore - 8));
  const repostScore = subScores?.repostPotential ?? Math.min(92, Math.max(46, Math.round((100 - result.viralityScore) * 0.45 + 52)));
  const verdict = result.coachAnalysis?.verdict || result.analyzerMeta?.verdictShort || verdictFor(result.viralityScore, hookScore <= retentionScore ? 'hook' : 'retention');
  const repost = result.repostVersion ?? buildFallbackRepost(result.analyzerMeta?.objective ?? '');
  const reconstructionPlan = useMemo(
    () => result.structuredReconstructionIA ?? normalizeReconstructionPlan({
      legacy: result.reconstructionIA,
      repost,
      currentRetentionScore: retentionScore,
      currentViralityScore: result.viralityScore,
    }),
    [repost, result.reconstructionIA, result.structuredReconstructionIA, result.viralityScore, retentionScore]
  );
  const diagnostic = result.coachAnalysis?.detectedProblems?.map((item) => `${item.title} : ${item.explanation}`) ?? [
    result.hook?.weaknesses?.[0] || "Le début manque de tension immédiate : la promesse doit arriver avant l'explication.",
    result.hook?.weaknesses?.[1] || 'La première phrase ne crée pas assez de curiosité dans les 3 premières secondes.',
    result.retention?.weaknesses?.[0] || 'Le rythme baisse au milieu : ajoute un micro-reset visuel entre 5 et 7 secondes.',
    result.editing?.weaknesses?.[0] || 'Il manque un pattern interrupt visible : zoom, cut brutal, texte choc ou changement de cadrage.',
    result.improvements?.find((item) => item.tip.toLowerCase().includes('cta'))?.tip || "Le CTA n'incite pas assez à commenter avec une réponse simple.",
  ];

  const detailCards = [
    {
      title: 'Hook',
      score: hookScore,
      verdict: hookScore >= 70 ? 'Accroche solide mais perfectible' : 'Hook trop lent pour stopper le scroll',
      analysis: result.hook?.analysis || "Les 3 premières secondes ne créent pas assez de tension. L'audience comprend le sujet avant de comprendre pourquoi elle devrait rester.",
      advice: "Ouvre avec la conséquence ou l'erreur, pas avec le contexte. La première phrase doit tenir en 6 à 8 mots.",
    },
    {
      title: 'Rétention',
      score: retentionScore,
      verdict: retentionScore >= 70 ? 'Courbe correcte' : 'Drop probable au milieu',
      analysis: result.retention?.analysis || 'La valeur est présente, mais elle arrive par blocs trop longs. TikTok favorise les vidéos qui relancent la curiosité toutes les 5 à 7 secondes.',
      advice: 'Ajoute un changement visuel, une stat ou une objection au milieu pour replanter une raison de rester.',
    },
    {
      title: 'Clarte du message',
      score: clarityScore,
      verdict: clarityScore >= 70 ? 'Message lisible' : 'Promesse pas assez explicite',
      analysis: "La vidéo gagnerait à annoncer plus vite le bénéfice final. Le viewer doit savoir ce qu'il obtient avant la seconde 4.",
      advice: "Mets le bénéfice exact en texte à l'écran et réduis les formulations générales.",
    },
    {
      title: 'Rythme',
      score: rhythmScore,
      verdict: rhythmScore >= 70 ? 'Montage fluide' : 'Plans trop longs',
      analysis: result.editing?.analysis || 'Le rythme visuel manque de ruptures. Un plan qui ne change pas pendant plusieurs secondes devient un signal de sortie.',
      advice: 'Coupe les respirations, ajoute 2 zooms subtils et synchronise les cuts avec les mots importants.',
    },
    {
      title: 'CTA',
      score: ctaScore,
      verdict: ctaScore >= 70 ? 'Action claire' : 'Incitation trop faible',
      analysis: "La fin ne transforme pas assez l'attention en action. Un CTA vague cree peu de commentaires et peu de signaux algorithmiques.",
      advice: 'Pose une question binaire ou demande un mot-clé précis en commentaire.',
    },
    {
      title: 'Potentiel de reconstruction',
      score: repostScore,
      verdict: repostScore >= 70 ? 'Reconstruction fortement recommandée' : 'Structure à retravailler après coupe',
      analysis: "Le sujet peut mieux performer si l'angle est plus frontal et si la promesse est visible dès la première frame.",
      advice: "Remonte une version plus courte avec un nouveau hook et un texte écran plus direct.",
    },
  ];
  const visibleDiagnosticCount = isFreePreview ? 2 : 5;
  const visibleDetailCards = isFreePreview ? detailCards.slice(0, 2) : detailCards;
  const lockedDetailCards = isFreePreview ? detailCards.slice(2) : [];
  const engineScoreAfter = result.coachAnalysis?.repostEngine?.scoreAfter;
  const potentialAfterCorrection = Math.min(
    96,
    Math.max(result.viralityScore + 12, typeof engineScoreAfter === 'number' && engineScoreAfter > result.viralityScore ? engineScoreAfter : result.viralityScore + 18)
  );
  const estimatedGain = Math.max(0, potentialAfterCorrection - result.viralityScore);
  const primaryPriority = result.coachAnalysis?.openingAnalysis?.mainProblem
    ?? result.coachAnalysis?.detectedProblems?.[0]?.title
    ?? (hookScore <= retentionScore ? 'Hook trop lent' : 'Rythme trop plat');
  const priorityActions = [
    {
      title: 'Réécrire le hook',
      why: result.coachAnalysis?.openingAnalysis?.whyItBlocks ?? detailCards[0].analysis,
      correction: result.coachAnalysis?.openingAnalysis?.exactCorrection ?? 'Ouvre avec la preuve, pas le contexte. Phrase de 3 à 6 mots + texte écran direct.',
      impact: 'Impact fort',
    },
    {
      title: 'Avancer la preuve',
      why: result.retention?.weaknesses?.[0] ?? 'La valeur arrive trop tard pour retenir les viewers froids.',
      correction: result.actionPlan?.find((item) => /preuve|avancer|cut|couper/i.test(item)) ?? 'Montre le résultat ou le contraste avant l’explication.',
      impact: 'Rétention',
    },
    {
      title: 'Renforcer le CTA',
      why: result.improvements?.find((item) => /cta|comment/i.test(item.tip))?.tip ?? 'La fin ne pousse pas assez à commenter.',
      correction: 'Pose une question binaire ou demande un mot-clé précis.',
      impact: 'Commentaires',
    },
  ];
  const repostPreview = [
    ['Hook', repost.hook],
    ['Preuve', repost.structure[1] ?? 'Avancer la preuve avant le contexte.'],
    ['Contexte', repost.structure[2] ?? 'Garder uniquement ce qui sert la promesse.'],
    ['Relance', repost.structure[3] ?? 'Ajouter une rupture visuelle au milieu.'],
    ['CTA', repost.cta],
  ];

  return (
    <section className="animate-fade-in space-y-5">
      <div className="overflow-hidden rounded-3xl border border-cyan-300/14 bg-[radial-gradient(circle_at_14%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(232,121,249,0.15),transparent_34%),linear-gradient(180deg,rgba(11,11,18,0.98),rgba(11,11,18,0.94))] shadow-[0_24px_110px_-70px_rgba(34,211,238,0.85)]">
        <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/50 to-transparent" />
        <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[0.76fr_1.24fr] lg:items-stretch">
          <div className="relative flex min-h-[13rem] items-center justify-center rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.065] to-transparent p-4">
            <div className="absolute inset-6 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative w-full text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Résultat</p>
              <p className="mt-2 text-6xl font-black tracking-tight text-white tabular-nums sm:text-7xl">{result.viralityScore}<span className="text-2xl text-gray-600">/100</span></p>
              <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-300/16 bg-emerald-300/[0.055] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-100/75">Après correction</p>
                  <p className="mt-1 text-lg font-black text-emerald-200">{potentialAfterCorrection}/100</p>
                </div>
                <div className="rounded-xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.07] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-fuchsia-100/75">Gain estimé</p>
                  <p className="mt-1 text-lg font-black text-white">+{estimatedGain} pts</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {[
                result.coachAnalysis?.patternLabel,
                result.analyzerMeta?.objectiveLabel,
                result.analysisSource === 'vision_upload' ? 'Vision upload' : 'Analyse structurée',
              ].filter(Boolean).map((item) => (
                <span key={item} className="rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-gray-300">{item}</span>
              ))}
            </div>
            <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-white">Ta vidéo a du potentiel, mais l’ouverture doit donner une raison de rester plus vite.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{verdict}</p>
            <div className="mt-4 rounded-2xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.065] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-fuchsia/80">Priorité n°1</p>
              <p className="mt-1 text-sm font-black text-white">{primaryPriority}</p>
              <p className="mt-1 text-xs leading-5 text-gray-400">Coupe l’intro, avance la preuve, puis reposte une V2 plus tendue.</p>
            </div>
            {result.analyzerMeta?.analysisModeLabel && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-semibold text-gray-300">
                  Mode : {result.analyzerMeta.analysisModeLabel}
                </span>
                {result.analyzerMeta.analysisConfidence && (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 font-semibold text-gray-300">
                    Confiance : {result.analyzerMeta.analysisConfidence.score}/100
                  </span>
                )}
              </div>
            )}
            {result.analyzerMeta?.isFallback && (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs leading-relaxed text-amber-100">
                {result.analyzerMeta.validationWarnings?.[0] ?? 'Analyse degradee : certaines conclusions sont des hypotheses prudentes, pas des observations completes.'}
              </div>
            )}
            {result.analyzerMeta?.signalDisclosure && (
              <div className="mt-3 hidden gap-2 text-xs text-gray-400 lg:grid lg:grid-cols-2">
                {[
                  ['Données observées', result.analyzerMeta.signalDisclosure.observedData],
                  ['Hypothèses IA', result.analyzerMeta.signalDisclosure.aiHypotheses],
                  ['Simulations', result.analyzerMeta.signalDisclosure.simulations],
                  ['Previews', result.analyzerMeta.signalDisclosure.previews],
                ].filter(([, items]) => Array.isArray(items) && items.length > 0).map(([label, items]) => (
                  <div key={label as string} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="mb-1 font-bold uppercase tracking-[0.16em] text-gray-500">{label as string}</p>
                    <p>{(items as string[]).slice(0, 2).join(' · ')}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 hidden space-y-2.5 lg:block">
              {diagnostic.slice(0, visibleDiagnosticCount).map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-vn-violet/15 text-vn-violet">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-sm leading-relaxed text-gray-300">{item}</p>
                </div>
              ))}
              {isFreePreview && diagnostic[visibleDiagnosticCount] && (
                <PremiumPreview label="Voir tous les diagnostics detectes." className="rounded-xl border border-white/[0.06] bg-white/[0.03]">
                  <div className="space-y-2.5 p-1">
                    {diagnostic.slice(visibleDiagnosticCount, visibleDiagnosticCount + 3).map((item) => (
                      <div key={item} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-vn-violet/15 text-vn-violet">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-sm leading-relaxed text-gray-300">{item}</p>
                      </div>
                    ))}
                  </div>
                </PremiumPreview>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <a href="#repost-plan" className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-vn-violet to-vn-fuchsia px-5 text-sm font-black text-white shadow-[0_18px_65px_-34px_rgba(34,211,238,0.95)] transition hover:brightness-110">
                Générer le plan de repost
              </a>
              <a href="#advanced-details" className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.045] px-5 text-sm font-black text-white transition hover:bg-white/[0.07]">
                Voir le détail
              </a>
            </div>
          </div>
        </div>
      </div>

      <SectionCard title="À corriger en priorité" eyebrow="3 décisions">
        <div className="grid gap-3 lg:grid-cols-3">
          {priorityActions.map((action, index) => (
            <motion.div key={action.title} whileHover={cardHover} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-lg border border-cyan-300/18 bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-100">0{index + 1}</span>
                  <h3 className="mt-3 text-base font-black text-white">{action.title}</h3>
                </div>
                <span className="rounded-full border border-vn-fuchsia/18 bg-vn-fuchsia/10 px-2.5 py-1 text-[10px] font-black uppercase text-fuchsia-100">{action.impact}</span>
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-gray-400">{action.why}</p>
              <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/18 p-3 text-sm font-semibold leading-5 text-white">{action.correction}</p>
            </motion.div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Plan de repost IA" eyebrow="Reconstruction">
        <div id="repost-plan" className="scroll-mt-24">
          <div className="mb-4 rounded-2xl border border-cyan-300/14 bg-cyan-300/[0.045] p-4">
            <h3 className="text-lg font-black text-white">Transforme ce diagnostic en plan de repost prêt à monter.</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">Viralynz reconstruit l’ordre de ta vidéo : nouvel ordre, hook alternatif, relances d’attention et CTA plus clair.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {repostPreview.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.065] bg-black/18 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/75">{label}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-gray-200">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {canUseReconstruction ? (
            <ReconstructionExperience
              plan={reconstructionPlan}
              scaleMode={isLifetimePlan(plan)}
            />
          ) : (
            <ReconstructionPaywallPremium plan={plan} access={result.reconstructionAccess} />
          )}
        </div>
      </SectionCard>

      {isFreePreview && <PremiumTeaserBand />}

      <div id="advanced-details" className="scroll-mt-24">
      <CollapsibleInsight title="Analyse par levier — Hook, rétention, CTA">
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleDetailCards.map((card) => <ResultCard key={card.title} {...card} />)}
          {lockedDetailCards.length > 0 && (
            <PremiumPreview label="Debloque les analyses avancees." className="rounded-2xl lg:col-span-2" intensity="light">
              <div className="grid gap-3 lg:grid-cols-2">
                {lockedDetailCards.map((card) => <ResultCard key={card.title} {...card} />)}
              </div>
            </PremiumPreview>
          )}
        </div>
      </CollapsibleInsight>
      </div>

      {isFreePreview && result.coachAnalysis?.timeline && (
        <CollapsibleInsight title="Timeline — les secondes qui font décrocher">
          <div className="grid gap-3 sm:grid-cols-2">
            {result.coachAnalysis.timeline.slice(0, 1).map((marker) => (
              <div key={`${marker.time}-${marker.label}`} className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4">
                <p className="text-[11px] font-black text-amber-200">{marker.time}</p>
                <p className="mt-2 text-sm font-black text-white">{marker.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{marker.insight}</p>
              </div>
            ))}
            <PremiumPreview label="Debloque la timeline complete." className="rounded-2xl border border-white/[0.08] bg-white/[0.025]" intensity="light">
              <div className="grid gap-2 p-3">
                {result.coachAnalysis.timeline.slice(1, 4).map((marker) => (
                  <div key={`${marker.time}-${marker.label}`} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-[11px] font-black text-vn-violet">{marker.time}</p>
                    <p className="mt-1 text-xs font-bold text-white">{marker.label}</p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-gray-500">{marker.insight}</p>
                  </div>
                ))}
              </div>
            </PremiumPreview>
          </div>
        </CollapsibleInsight>
      )}

      {result.coachAnalysis && !isFreePreview && (
        <CollapsibleInsight title="Détails avancés — signaux, timeline et mémoire">
          <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-sm font-bold text-white">Pourquoi ça bloque</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{result.coachAnalysis.coachSummary}</p>
              {result.videoIntelligence && (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Signaux analysés</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.coachAnalysis?.detectedVideoFormat && (
                      <span className="rounded-full border border-vn-violet/25 bg-vn-violet/10 px-2.5 py-1 text-[10px] font-bold text-vn-violet">
                        Format {result.coachAnalysis.detectedVideoFormat.primary === 'autre_ambigu' ? 'probable' : 'détecté'} : {result.coachAnalysis.patternLabel}
                      </span>
                    )}
                    {result.videoIntelligence.confidence.signalsUsed.map((signal) => (
                      <span key={signal} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{signal}</span>
                    ))}
                    {result.videoIntelligence.confidence.missingSignals.slice(0, 2).map((signal) => {
                      const label = signal === 'transcript'
                        ? 'Transcript non disponible'
                        : signal === 'optical_flow'
                          ? 'Mouvement estimé'
                          : signal === 'ocr_texte_ecran'
                            ? 'Texte écran non lisible'
                            : signal === 'face_detection_reelle'
                              ? 'Visage non confirmé'
                              : `${signal} limité`;
                      return (
                        <span key={signal} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-gray-500">{label}</span>
                      );
                    })}
                  </div>
                  {result.coachAnalysis?.detectedVideoFormat?.reasons?.[0] && (
                    <p className="mt-2 text-[11px] leading-relaxed text-gray-500">{result.coachAnalysis.detectedVideoFormat.reasons[0]}</p>
                  )}
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Avant</p>
                  <p className="mt-1 text-xl font-black text-white">{result.coachAnalysis.repostEngine.scoreBefore}/100</p>
                </div>
                <div className="rounded-xl bg-emerald-400/10 p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">Après reconstruction</p>
                  <p className="mt-1 text-xl font-black text-emerald-300">{result.coachAnalysis.repostEngine.scoreAfter}/100</p>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              {result.coachAnalysis.benchmarks.map((benchmark) => (
                <div key={benchmark.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-white">{benchmark.label}</p>
                    <span className="rounded-md bg-vn-violet/15 px-2 py-1 text-[10px] font-black text-vn-violet">{benchmark.delta}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{benchmark.insight}</p>
                </div>
              ))}
            </div>
          </div>
          {result.coachAnalysis.timeline && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
              <p className="text-sm font-bold text-white">Timeline intelligente</p>
                  <p className="mt-1 text-xs text-gray-500">Lecture des moments qui changent la rétention.</p>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300">
                  Confiance {result.coachAnalysis.formatConfidence?.level ?? 'moyenne'}
                </span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {result.coachAnalysis.timeline.map((marker) => (
                  <div key={`${marker.time}-${marker.label}`} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-vn-violet">{marker.time}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        marker.severity === 'critique'
                          ? 'bg-red-400/10 text-red-300'
                          : marker.severity === 'important'
                          ? 'bg-amber-400/10 text-amber-300'
                          : 'bg-white/[0.06] text-gray-500'
                      }`}>
                        {marker.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-white">{marker.label}</p>
                    <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-gray-500">{marker.insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.coachAnalysis.openingAnalysis && (
            <div className="mt-4 rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.045] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Ouverture 0-3s</p>
                  <p className="mt-1 text-xs text-gray-500">{result.coachAnalysis.openingAnalysis.firstFrame}</p>
                </div>
                <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-black tabular-nums ${scoreTone(result.coachAnalysis.openingAnalysis.stopScrollScore)}`}>
                  {result.coachAnalysis.openingAnalysis.stopScrollScore}/100
                </span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Probleme principal</p>
                  <p className="mt-2 text-sm font-semibold text-white">{result.coachAnalysis.openingAnalysis.mainProblem}</p>
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">{result.coachAnalysis.openingAnalysis.whyItBlocks}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Correction exacte</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-300">{result.coachAnalysis.openingAnalysis.exactCorrection}</p>
                  <p className="mt-2 text-xs font-semibold text-vn-violet">{result.coachAnalysis.openingAnalysis.recommendedFirstFrame}</p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">Nouvelle ouverture</p>
                  <p className="mt-2 text-sm font-black text-white">"{result.coachAnalysis.openingAnalysis.newHook}"</p>
                  <p className="mt-2 text-xs text-gray-400">Texte ecran: {result.coachAnalysis.openingAnalysis.newOnScreenText}</p>
                </div>
              </div>
            </div>
          )}
          {result.coachAnalysis.videoSegments && (
            <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/15 p-4">
              <p className="text-sm font-bold text-white">Timeline segmentee</p>
              <p className="mt-1 text-xs text-gray-500">Chaque segment indique les signaux vraiment disponibles et la correction a tester.</p>
              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                {result.coachAnalysis.videoSegments.map((segment) => (
                  <div key={`${segment.range}-${segment.role}`} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-vn-violet">{segment.range}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${scoreTone(100 - segment.dropRisk)}`}>drop {segment.dropRisk}</span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-white">{segment.role}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{segment.mainProblem}</p>
                    {(segment.onScreenText || segment.transcriptExcerpt) && (
                      <p className="mt-2 text-[10px] leading-relaxed text-gray-600">{segment.onScreenText ?? segment.transcriptExcerpt}</p>
                    )}
                    <p className="mt-2 text-[11px] font-semibold text-gray-300">{segment.concreteCorrection ?? segment.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.coachAnalysis.detailedScores && (
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {result.coachAnalysis.detailedScores.map((item) => (
                <div key={item.key} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white">{item.label}</p>
                    <p className="text-xs font-black text-gray-300">{item.value}/100</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo" style={{ width: `${item.value}%` }} />
                  </div>
                  <p className="mt-2 text-[10px] leading-relaxed text-gray-500">{item.reason}</p>
                  <p className="mt-2 text-[10px] font-semibold text-gray-600">Confiance {item.confidence}%</p>
                </div>
              ))}
            </div>
          )}
          {result.coachAnalysis.scoreBreakdown && (
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {result.coachAnalysis.scoreBreakdown.slice(0, 8).map((item) => (
                <div key={item.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white">{item.label}</p>
                    <p className="text-xs font-black text-gray-300">{item.score}/100</p>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo" style={{ width: `${item.score}%` }} />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold text-gray-600">Poids {item.weight}%</p>
                </div>
              ))}
            </div>
          )}
          {result.coachAnalysis.memory && (
            <div className="mt-4 rounded-2xl border border-vn-violet/15 bg-vn-violet/[0.04] p-4">
              <p className="text-sm font-bold text-white">Mémoire Viralynz</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-400">{result.coachAnalysis.memory.creatorEvolution}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.coachAnalysis.memory.recurrentWeaknesses.map((weakness) => (
                  <span key={weakness} className="rounded-full border border-white/[0.08] bg-black/15 px-3 py-1 text-[11px] font-semibold text-gray-300">{weakness}</span>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-vn-violet">{result.coachAnalysis.memory.nextRecommendation}</p>
            </div>
          )}
        </CollapsibleInsight>
      )}

      {false && (
      <SectionCard title="Structure optimisée à remonter" eyebrow="Plan de remontage">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.06] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-vn-fuchsia/75">Nouveau hook recommandé</p>
            <p className="mt-3 text-xl font-black leading-tight text-white">"{repost.hook}"</p>
            {!isFreePreview && (repost.hookVariants?.length ?? 0) > 1 && (
              <div className="mt-4 space-y-2">
                {repost.hookVariants!.slice(1, 4).map((hook) => (
                  <p key={hook} className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2 text-xs text-gray-300">"{hook}"</p>
                ))}
              </div>
            )}
            <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500">CTA recommandé</p>
              <p className="mt-2 text-sm font-semibold text-white">{repost.cta}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Structure de script</p>
              <div className="mt-3 space-y-2">
                {repost.structure.slice(0, isFreePreview ? 2 : undefined).map((item) => (
                  <p key={item} className="rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-gray-300">{item}</p>
                ))}
                {isFreePreview && repost.structure.length > 2 && (
                  <PremiumPreview label="Structure complete disponible dans Pro." className="rounded-xl" intensity="light">
                    <div className="space-y-2">
                      {repost.structure.slice(2).map((item) => (
                        <p key={item} className="rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-gray-300">{item}</p>
                      ))}
                    </div>
                  </PremiumPreview>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Texte à l'écran</p>
                <div className="mt-3 space-y-2">
                  {repost.onScreenText.map((item) => <p key={item} className="text-sm text-gray-300">• {item}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Angle conseille</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">{repost.angle}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
      )}

      <CollapsibleInsight title="Checklist complète — avant remontage">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {(result.actionPlan ?? []).slice(0, isFreePreview ? 2 : undefined).map((item) => (
            <label key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-vn-violet/25 bg-vn-violet/10 text-vn-violet">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm leading-relaxed text-gray-300">{item}</span>
            </label>
          ))}
          {isFreePreview && (result.actionPlan ?? []).length > 2 && (
            <PremiumPreview label="Voir la checklist complete avant remontage." className="rounded-xl sm:col-span-2" intensity="light">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(result.actionPlan ?? []).slice(2).map((item) => (
                  <label key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-vn-violet/25 bg-vn-violet/10 text-vn-violet">
                      <CheckIcon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm leading-relaxed text-gray-300">{item}</span>
                  </label>
                ))}
              </div>
            </PremiumPreview>
          )}
        </div>
      </CollapsibleInsight>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-white">Prochaine étape de la boucle Viralynz</p>
          <p className="mt-1 text-xs text-gray-500">Crée une ouverture, prépare le plan de remontage ou retourne au dashboard pour suivre la progression.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/hooks?objective=repost&trendHook=${encodeURIComponent(repost.hook)}&trendTitle=${encodeURIComponent(verdict)}`} className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-4 py-3 text-sm font-bold text-white transition hover:brightness-110">Créer un Hook Pack</Link>
          <Link href="/dashboard#growth-loop" className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:bg-white/[0.07]">Voir dans le dashboard</Link>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3 text-sm font-bold text-gray-300 transition hover:bg-white/[0.07]"
          >
            Analyser une autre vidéo
          </button>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-[#080810]/88 px-4 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <a href="#repost-plan" className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 via-vn-violet to-vn-fuchsia px-4 text-sm font-black text-white shadow-[0_18px_65px_-34px_rgba(34,211,238,0.95)]">
          Générer le plan de repost
        </a>
      </div>
    </section>
  );
}

interface AnalyzerV2ClientProps {
  embedded?: boolean;
}

export default function AnalyzerV2Client({ embedded = false }: AnalyzerV2ClientProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadTiktokUrl, setUploadTiktokUrl] = useState('');
  const [activeSource, setActiveSource] = useState<AnalyzeSource>('upload');
  const [tiktokVideos, setTikTokVideos] = useState<TikTokPublishedVideo[]>([]);
  const [tiktokVideosLoaded, setTikTokVideosLoaded] = useState(false);
  const [selectedTikTokVideoId, setSelectedTikTokVideoId] = useState<string | null>(null);
  const [objective] = useState<ObjectiveId>('repost');
  const [extractStatus, setExtractStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState('');
  const [guestCount, setGuestCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyLocked, setHistoryLocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [pipelineState, setPipelineState] = useState<AnalysisPipelineState>(() => createPipelineState());
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisPreviewSignals>({});
  const requestedAnalysisIdRef = useRef<string | null>(null);

  const updatePipelineStep = (
    id: PipelineStepId,
    status: AnalysisPipelineStepStatus,
    meta: { warning?: string; error?: string; signalsAvailable?: string[]; limitations?: string[]; completed?: boolean } = {}
  ) => {
    setPipelineState((prev) => {
      const now = new Date().toISOString();
      const steps = prev.steps.map((step) => {
        if (step.id !== id) return step;
        return {
          ...step,
          status,
          startedAt: step.startedAt ?? (status === 'running' ? now : undefined),
          completedAt: ['done', 'warning', 'failed'].includes(status) ? now : step.completedAt,
          warning: meta.warning,
          error: meta.error,
        };
      });
      const current = steps.find((step) => step.status === 'running') ?? steps.find((step) => step.status === 'pending') ?? steps[steps.length - 1];
      const signalsAvailable = Array.from(new Set([...prev.signalsAvailable, ...(meta.signalsAvailable ?? [])]));
      const limitations = Array.from(new Set([...prev.limitations, ...(meta.limitations ?? []), ...(meta.warning ? [meta.warning] : [])]));
      return {
        ...prev,
        currentStep: current?.id ?? id,
        progress: meta.completed ? 100 : pipelineProgress(steps),
        steps,
        warnings: limitations,
        signalsAvailable,
        limitations,
        completedAt: meta.completed ? now : prev.completedAt,
      };
    });
  };

  function refreshHistory() {
    fetch('/api/analyze/history')
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.analyses ?? []);
        setHistoryLocked(!!d.locked);
      })
      .catch(() => {});
  }

  useEffect(() => {
    const pendingUrl = localStorage.getItem(PENDING_URL_KEY);
    if (pendingUrl) {
      setUploadTiktokUrl(pendingUrl);
      localStorage.removeItem(PENDING_URL_KEY);
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      setGuestCount(Number.isFinite(n) ? Math.max(0, n) : 0);
    }
    setMounted(true);
    requestedAnalysisIdRef.current = new URLSearchParams(window.location.search).get('analysisId');

    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setAuthUser(data.user);
          refreshHistory();
        }
      })
      .catch((err) => console.error('[AnalyzerV2] /api/auth/me failed:', err))
      .finally(() => setAuthLoaded(true));
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(94, prev + Math.max(2, Math.round((100 - prev) * 0.08)));
        setStepIndex(Math.min(analysisSteps.length - 1, Math.floor((next / 100) * analysisSteps.length)));
        return next;
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const isReady = mounted && authLoaded;
  const effectiveCount = authUser ? authUser.analyses_count : guestCount;
  const effectiveLimit = authUser ? (PLAN_LIMITS[authUser.plan] ?? GUEST_LIMIT) : GUEST_LIMIT;
  const isLimitReached = isReady && effectiveCount >= effectiveLimit;
  const canSubmit = !!videoFile && !isLoading && !isLimitReached;
  const isFreePreview = !authUser || authUser.plan === 'free';
  const planCanUseReconstruction = authUser ? hasProOrLifetimeAccess(authUser.plan) : false;
  const reconstructionLimit = authUser ? RECONSTRUCTION_LIMITS[authUser.plan] ?? 0 : 0;
  const reconstructionUsed = authUser?.reconstructions_count ?? 0;
  const loadingButtonText = isLoading ? phaseForPipeline(pipelineState, Date.now()).title : 'Lancer le diagnostic';

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [history]
  );
  const selectedTikTokVideo = useMemo(
    () => tiktokVideos.find((video) => video.id === selectedTikTokVideoId) ?? null,
    [selectedTikTokVideoId, tiktokVideos]
  );
  const canAnalyzeSelectedTikTok = Boolean(selectedTikTokVideo?.shareUrl && !isLoading && !isLimitReached);
  const latestHistoryItem = sortedHistory[0] ?? null;

  useEffect(() => {
    if (!authUser) {
      setTikTokVideos([]);
      setTikTokVideosLoaded(true);
      return;
    }

    let cancelled = false;
    setTikTokVideosLoaded(false);
    fetch('/api/tiktok/videos')
      .then((response) => response.ok ? response.json() : { videos: [] })
      .then((data: { videos?: TikTokPublishedVideo[] }) => {
        if (cancelled) return;
        const videos = Array.isArray(data.videos) ? data.videos : [];
        setTikTokVideos(videos);
        setSelectedTikTokVideoId((current) => current ?? videos[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setTikTokVideos([]);
      })
      .finally(() => {
        if (!cancelled) setTikTokVideosLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    const requestedAnalysisId = requestedAnalysisIdRef.current;
    if (!requestedAnalysisId || results || historyLocked || sortedHistory.length === 0) return;

    const requestedAnalysis = sortedHistory.find((item) => item.id === requestedAnalysisId);
    if (!requestedAnalysis) return;

    setResults(enrichResult(requestedAnalysis.result, '', null));
    requestedAnalysisIdRef.current = null;
  }, [historyLocked, results, sortedHistory]);

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('La vidéo dépasse 500 Mo. Compresse-la ou exporte une version plus légère.');
      return;
    }
    setError('');
    setVideoFile(file);
    setAnalysisPreview({
      fileName: file.name,
      fileSizeMb: Number((file.size / 1024 / 1024).toFixed(1)),
    });
    setResults(null);
  };

  const processAnalyzeResponse = async (response: Response, currentFile: File | null) => {
    if (response.status === 429) {
      const data = await response.json().catch(() => ({} as Record<string, unknown>));
      if (authUser) {
        const used = typeof data.used === 'number' ? data.used : effectiveLimit;
        setAuthUser({ ...authUser, analyses_count: used });
      }
      setError(
        typeof data?.error === 'string' && data.error
          ? data.error
          : data?.limit
          ? `Limite atteinte (${data.used ?? data.limit}/${data.limit}). Passe à un plan supérieur.`
          : 'Limite atteinte pour ton plan.'
      );
      return;
    }
    if (response.status === 401) { setError('Ta session a expiré. Reconnecte-toi.'); return; }
    if (response.status === 400) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Requête invalide.'); return;
    }
    if (response.status === 403) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      setError(data?.error ?? 'Action non autorisée.'); return;
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({} as { error?: string }));
      throw new Error(data?.error ?? 'Analyse échouée');
    }

    const rawText = await response.text();
    let data: AnalysisResult;
    try { data = JSON.parse(rawText) as AnalysisResult; }
    catch (e) { console.error('[analyze] JSON.parse failed:', rawText.slice(0, 200)); throw e; }

    const usedSignals = data.videoIntelligence?.confidence.signalsUsed ?? [];
    const missingSignals = data.videoIntelligence?.confidence.missingSignals ?? [];
    setAnalysisPreview((prev) => ({
      ...prev,
      hasText: Boolean(data.videoIntelligence?.onScreenText.available),
      formatDetected: Boolean(data.coachAnalysis?.detectedVideoFormat),
      hookDetected: Boolean(data.coachAnalysis?.openingAnalysis),
    }));
    updatePipelineStep('ocr', data.videoIntelligence?.onScreenText.available ? 'done' : 'warning', {
      signalsAvailable: data.videoIntelligence?.onScreenText.available ? ['OCR texte ecran'] : [],
      warning: data.videoIntelligence?.onScreenText.available ? undefined : 'Texte ecran indisponible ou lecture partielle.',
      limitations: data.videoIntelligence?.onScreenText.available ? [] : ['OCR limite'],
    });
    updatePipelineStep('format', data.coachAnalysis?.detectedVideoFormat ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.detectedVideoFormat ? ['Format detecte'] : [],
      warning: data.coachAnalysis?.detectedVideoFormat ? undefined : 'Format estime avec prudence.',
    });
    updatePipelineStep('opening', data.coachAnalysis?.openingAnalysis ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.openingAnalysis ? ['Opening 0-3s'] : [],
      warning: data.coachAnalysis?.openingAnalysis ? undefined : 'Ouverture analysee avec signaux limites.',
    });
    updatePipelineStep('timeline', data.coachAnalysis?.videoSegments?.length ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.videoSegments?.length ? ['Timeline segmentee'] : [],
      warning: data.coachAnalysis?.videoSegments?.length ? undefined : 'Timeline detaillee indisponible.',
    });
    updatePipelineStep('weak-moments', data.coachAnalysis?.detectedProblems?.length ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.detectedProblems?.length ? ['Moments faibles'] : [],
      warning: data.coachAnalysis?.detectedProblems?.length ? undefined : 'Aucun moment faible fiable detecte.',
    });
      updatePipelineStep('repost', data.repostVersion || data.coachAnalysis?.repostEngine ? 'done' : 'warning', {
      signalsAvailable: data.repostVersion || data.coachAnalysis?.repostEngine ? ['Plan de remontage'] : [],
      warning: data.repostVersion || data.coachAnalysis?.repostEngine ? undefined : 'Plan de remontage genere en fallback.',
    });
    updatePipelineStep('hooks', data.coachAnalysis?.hookVariants?.length || data.repostVersion?.hook ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.hookVariants?.length || data.repostVersion?.hook ? ['Hooks generes'] : [],
      limitations: missingSignals.slice(0, 2),
      warning: usedSignals.length ? undefined : 'Hooks bases sur fallback structurel.',
      completed: true,
    });

    setProgress(100);
    setStepIndex(analysisSteps.length - 1);

    if (authUser) {
      setAuthUser((prev) => prev ? {
        ...prev,
        analyses_count: prev.analyses_count + 1,
        reconstructions_count: prev.reconstructions_count !== undefined && data.reconstructionIA ? prev.reconstructions_count + 1 : prev.reconstructions_count,
      } : prev);
      fetch('/api/auth/me').then((r) => r.json()).then((d) => {
        if (d.user) {
          setAuthUser((prev) => prev
            ? { ...d.user, analyses_count: Math.max(prev.analyses_count, d.user.analyses_count ?? 0) }
            : d.user);
        }
      }).catch(() => {});
      refreshHistory();
    } else {
      const next = guestCount + 1;
      setGuestCount(next);
      localStorage.setItem(STORAGE_KEY, next.toString());
    }
    setResults(enrichResult(data, objective, currentFile));
  };

  const analyzeFromUpload = async () => {
    if (isLimitReached) return;
    if (!videoFile) { setError('Choisis un fichier vidéo MP4 ou MOV.'); return; }

    let normalized = '';
    if (uploadTiktokUrl.trim()) {
      normalized = normalizeTikTokUrl(uploadTiktokUrl.trim());
      if (!isTikTokVideoUrl(normalized)) {
        setError('Lien TikTok invalide. Utilise un lien vm.tiktok.com, vt.tiktok.com ou une URL contenant /video/ ou /t/.');
        return;
      }
    }

    const currentFile = videoFile;
    setPipelineState(createPipelineState());
    setAnalysisPreview({
      fileName: currentFile.name,
      fileSizeMb: Number((currentFile.size / 1024 / 1024).toFixed(1)),
    });
    updatePipelineStep('prepare', 'running');
    setError('');
    setIsLoading(true);
    setResults(null);
    setExtractStatus('Préparation de la vidéo...');

    try {
      updatePipelineStep('prepare', 'done', { signalsAvailable: ['Fichier video'] });
      updatePipelineStep('frames', 'running');
      setExtractStatus("Extraction des images et de l'audio...");
      const [{ frames, durationSec }, audioResult] = await Promise.all([
        extractVideoFramesFromFile(currentFile),
        extractAudioFromVideo(currentFile),
      ]);
      setAnalysisPreview((prev) => ({
        ...prev,
        durationSec,
        hasFrames: frames.length > 0,
      }));
      updatePipelineStep('frames', frames.length ? 'done' : 'warning', {
        signalsAvailable: frames.length ? ['Frames cles'] : [],
        warning: frames.length ? undefined : 'Aucune frame exploitable extraite.',
        limitations: frames.length ? [] : ['Frames indisponibles'],
      });

      let transcript = '';
      if (audioResult && authUser && authUser.plan !== 'free') {
        updatePipelineStep('transcript', 'running');
        setExtractStatus('Transcription audio...');
        try {
          const tRes = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: audioResult.audioBase64, mimeType: audioResult.mimeType }),
          });
          if (tRes.ok) {
            const tData = await tRes.json() as { transcript?: string };
            transcript = tData.transcript?.trim() ?? '';
            setAnalysisPreview((prev) => ({ ...prev, hasTranscript: Boolean(transcript) }));
            updatePipelineStep('transcript', transcript ? 'done' : 'warning', {
              signalsAvailable: transcript ? ['Transcript audio'] : [],
              warning: transcript ? undefined : 'Audio traite, mais aucun transcript fiable.',
              limitations: transcript ? [] : ['Transcript indisponible'],
            });
          } else {
            setAnalysisPreview((prev) => ({ ...prev, hasTranscript: false }));
            updatePipelineStep('transcript', 'warning', {
              warning: 'Transcription indisponible, analyse poursuivie avec vision/OCR.',
              limitations: ['Whisper indisponible'],
            });
          }
        } catch (tErr) {
          console.warn('[analyze] transcription failed (non-blocking):', tErr);
          setAnalysisPreview((prev) => ({ ...prev, hasTranscript: false }));
          updatePipelineStep('transcript', 'warning', {
            warning: 'Transcription indisponible, analyse poursuivie avec vision/OCR.',
            limitations: ['Whisper indisponible'],
          });
        }
      } else {
        setAnalysisPreview((prev) => ({ ...prev, hasTranscript: false }));
        updatePipelineStep('transcript', 'warning', {
          warning: 'Aucune piste audio exploitable detectee avant analyse serveur.',
          limitations: ['Audio indisponible'],
        });
      }

      updatePipelineStep('ocr', 'running');
      updatePipelineStep('format', 'running');
      updatePipelineStep('opening', 'running');
      updatePipelineStep('timeline', 'running');
      updatePipelineStep('weak-moments', 'running');
      updatePipelineStep('repost', 'running');
      updatePipelineStep('hooks', 'running');
      setExtractStatus('Analyse par vision IA...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          durationSec,
          fileName: currentFile.name,
          fileSizeMb: Number((currentFile.size / 1024 / 1024).toFixed(1)),
          mimeType: currentFile.type,
          tiktokUrl: normalized || undefined,
          transcript: transcript || undefined,
          objective,
          objectiveLabel: getObjectiveLabel(objective),
        }),
      });
      await processAnalyzeResponse(response, currentFile);
    } catch (err) {
      const runningStep = pipelineState.steps.find((step) => step.status === 'running')?.id as PipelineStepId | undefined;
      if (runningStep) {
        updatePipelineStep(runningStep, 'failed', { error: err instanceof Error ? err.message : 'Analyse interrompue.' });
      }
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setExtractStatus('');
      setTimeout(() => setIsLoading(false), 350);
    }
  };

  const analyzeFromTikTok = async () => {
    if (isLimitReached || isLoading) return;
    if (!selectedTikTokVideo?.shareUrl) {
      setError('Cette vidéo TikTok n’a pas de lien exploitable. Importe le fichier vidéo pour lancer une analyse complète.');
      return;
    }

    setPipelineState(createPipelineState());
    setAnalysisPreview({
      fileName: selectedTikTokVideo.title ?? selectedTikTokVideo.shareUrl,
      durationSec: selectedTikTokVideo.duration ?? undefined,
    });
    updatePipelineStep('prepare', 'running');
    setError('');
    setIsLoading(true);
    setResults(null);
    setExtractStatus('Analyse de la vidéo TikTok...');

    try {
      updatePipelineStep('prepare', 'done', { signalsAvailable: ['Lien TikTok'] });
      updatePipelineStep('format', 'running');
      updatePipelineStep('opening', 'running');
      updatePipelineStep('timeline', 'running');
      updatePipelineStep('weak-moments', 'running');
      updatePipelineStep('repost', 'running');
      updatePipelineStep('hooks', 'running');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: selectedTikTokVideo.shareUrl,
          objective,
          objectiveLabel: getObjectiveLabel(objective),
        }),
      });
      await processAnalyzeResponse(response, null);
    } catch (err) {
      const runningStep = pipelineState.steps.find((step) => step.status === 'running')?.id as PipelineStepId | undefined;
      if (runningStep) {
        updatePipelineStep(runningStep, 'failed', { error: err instanceof Error ? err.message : 'Analyse interrompue.' });
      }
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setExtractStatus('');
      setTimeout(() => setIsLoading(false), 350);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGuestCount(0);
    setResults(null);
    setError('');
  };

  const handleAnalysisReset = () => {
    setResults(null);
    setError('');
    setVideoFile(null);
    setUploadTiktokUrl('');
    setProgress(0);
    setStepIndex(0);
    setPipelineState(createPipelineState());
    setAnalysisPreview({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeVideoAfterError = () => {
    setError('');
    setVideoFile(null);
    setPipelineState(createPipelineState());
    setAnalysisPreview({});
  };

  const content = (
    <>
      <GuestGate show={showGuestGate} pendingUrl={uploadTiktokUrl} onClose={() => setShowGuestGate(false)} />

      {!embedded && (
        <div className="absolute top-0 inset-x-0 h-[620px] pointer-events-none overflow-hidden">
          <div className="absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/10 via-vn-violet/7 to-vn-indigo/8 blur-[110px]" />
          <div className="absolute top-72 -right-44 h-[360px] w-[520px] rounded-full bg-vn-indigo/6 blur-[90px]" />
          <FloatingParticles count={28} />
        </div>
      )}

      <div className={embedded ? 'relative mx-auto w-full max-w-[1120px] min-w-0 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-8 min-[1280px]:px-0 min-[1280px]:pb-10 min-[1280px]:pt-2' : 'relative mx-auto max-w-6xl min-w-0 px-4 py-8 pb-20 sm:px-6 sm:py-10'}>
        <header className={embedded ? 'mt-0' : 'mt-4'}>
          <div>
            <h1 className={embedded ? 'max-w-3xl text-[28px] font-black leading-[1.04] tracking-[-0.04em] text-white min-[390px]:text-[30px] sm:text-[38px]' : 'max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl'}>
              Analyser une vidéo <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">TikTok</span>
            </h1>
            <p className={embedded ? 'mt-2 max-w-xl text-[13px] leading-relaxed text-slate-400 sm:mt-3 sm:text-[15px]' : 'mt-3 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg'}>
              Upload ta vidéo. Viralynz te dit quoi couper, quoi garder et quoi reposter.
            </p>
          </div>
        </header>

        <div className="mt-7 grid min-w-0 gap-5 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="min-w-0 space-y-5">
            <SectionCard title="Importer la vidéo" eyebrow="Étape 1">
              <UploadCard
                file={videoFile}
                disabled={isLoading || isLimitReached}
                onSelect={handleFileSelect}
                onClear={() => {
                  setVideoFile(null);
                  setAnalysisPreview({});
                }}
              />
              <div className="mt-4">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                  Lien TikTok optionnel
                </label>
                <input
                  type="url"
                  value={uploadTiktokUrl}
                  onChange={(e) => setUploadTiktokUrl(e.target.value)}
                  placeholder="https://vm.tiktok.com/..."
                  disabled={isLoading || isLimitReached}
                  className="block w-full min-w-0 rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 hover:border-white/[0.15] focus:border-vn-violet/50 focus:ring-2 focus:ring-vn-violet/10 disabled:opacity-50 sm:px-4"
                />
              </div>
            </SectionCard>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080810]/90 p-3.5 sm:p-4">
              <button
                type="button"
                onClick={() => void analyzeFromUpload()}
                disabled={!canSubmit}
                className={`relative w-full min-w-0 overflow-hidden rounded-2xl px-4 py-4 text-sm font-black text-white shadow-[0_16px_50px_-24px_rgba(232,121,249,0.9)] transition active:scale-[0.99] sm:px-5 ${
                  isLoading
                    ? 'cursor-not-allowed border border-cyan-300/20 bg-[linear-gradient(110deg,rgba(34,211,238,0.16),rgba(167,139,250,0.2),rgba(232,121,249,0.14))]'
                    : 'bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40'
                }`}
              >
                {isLoading && <span className="absolute inset-0 -translate-x-full animate-[vnButtonShimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/18 to-transparent" />}
                <span className="relative inline-flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center leading-snug">
                  {isLoading && <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.9)]" />}
                  {isLoading ? (
                    <>
                      <span>Analyse en cours</span>
                      <span className="hidden sm:inline">- {loadingButtonText}</span>
                    </>
                  ) : "Lancer l’analyse"}
                </span>
              </button>
              <p className="mt-3 text-center text-xs text-gray-600">
                {canSubmit ? 'Prêt : Viralynz détecte le format automatiquement.' : 'Sélectionne une vidéo pour lancer l’analyse.'}
              </p>
              <style jsx>{`
                @keyframes vnButtonShimmer {
                  100% {
                    transform: translateX(180%);
                  }
                }
              `}</style>
            </div>

            {error && (
              <AnalysisErrorCard
                message={error}
                canRetry={!!videoFile && !isLoading && !isLimitReached}
                onRetry={() => void analyzeFromUpload()}
                onChangeVideo={handleChangeVideoAfterError}
              />
            )}

            {isLoading && <AnalysisPipelineProgress pipeline={pipelineState} preview={analysisPreview} />}
            {results && !isLoading && !isLimitReached && (
              <ResultsView
                result={results}
                onReset={handleAnalysisReset}
                isFreePreview={isFreePreview}
                canUseReconstruction={planCanUseReconstruction && !!results.reconstructionIA}
                plan={authUser?.plan}
              />
            )}
          </div>

          <aside className={`min-w-0 space-y-4 lg:sticky ${embedded ? 'lg:top-5' : 'lg:top-6'}`}>
            {isReady && !isLimitReached && (
              <AnalysisCounter used={effectiveCount} limit={effectiveLimit === Infinity ? undefined : effectiveLimit} />
            )}

            {authUser && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Reconstructions IA</p>
                    <p className="mt-2 text-sm font-black text-white">
                      {reconstructionUsed}/{reconstructionLimit} utilisees
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${reconstructionLimit > 0 ? 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100' : 'border-vn-fuchsia/25 bg-vn-fuchsia/10 text-vn-fuchsia'}`}>
                    {reconstructionLimit > 0 ? `${Math.max(0, reconstructionLimit - reconstructionUsed)} restantes` : 'Verrouille'}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  {reconstructionLimit > 0
                    ? 'Reset mensuel avec ton abonnement. Une reconstruction est comptee quand la structure optimisee complete est generee.'
                    : 'La Reconstruction IA est disponible avec Pro et Lifetime.'}
                </p>
              </div>
            )}

            {isLimitReached && !isLoading && <PremiumGate onReset={authUser ? undefined : handleReset} />}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Résumé analyse</p>
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Vidéo', value: videoFile ? videoFile.name : 'Non sélectionnée' },
                  { label: 'Objectif', value: getObjectiveLabel(objective) || 'À choisir' },
                  { label: 'Format', value: results?.coachAnalysis?.patternLabel ?? 'Détecté après analyse' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600">{item.label}</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white" title={item.value}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {authUser && (
              <TikTokCreatorMemoryCard connected={!!authUser.tiktok?.connected} email={authUser.email} />
            )}

            {authUser && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Historique rapide</p>
                  {historyLocked && <span className="text-[10px] font-semibold text-vn-violet">Pro</span>}
                </div>
                {historyLocked ? (
                  <p className="mt-3 text-xs leading-relaxed text-gray-600">L'historique complet est disponible avec un plan payant.</p>
                ) : sortedHistory.length === 0 ? (
                  <p className="mt-3 text-xs leading-relaxed text-gray-600">Aucune analyse recente.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {sortedHistory.slice(0, 4).map((item) => {
                      const meta = item.result?.analyzerMeta;
                      const firstWarning = meta?.validationWarnings?.[0];
                      const disclosure = meta?.signalDisclosure;
                      const isDegraded = meta?.isFallback || meta?.analysisMode === 'fallback' || meta?.analysisMode === 'demo' || Boolean(firstWarning);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setResults(enrichResult(item.result, '', null))}
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                        >
                          <p className="truncate text-xs font-semibold text-white">{item.video_url}</p>
                          <p className="mt-1 text-[11px] text-gray-600">
                            Score <span className="text-vn-violet">{item.result?.viralityScore ?? 0}</span> · {new Date(item.created_at).toLocaleDateString('fr-FR')}
                          </p>
                          {(meta?.analysisModeLabel || meta?.analysisConfidence || firstWarning) && (
                            <p className={`mt-1 text-[10px] font-semibold ${isDegraded ? 'text-amber-300' : 'text-gray-500'}`}>
                              {meta?.analysisModeLabel ?? 'Mode analyse'}{meta?.analysisConfidence ? ` · confiance ${meta.analysisConfidence.score}/100` : ''}{firstWarning ? ' · analyse dégradée' : ''}
                            </p>
                          )}
                          {disclosure && (
                            <p className="mt-1 truncate text-[10px] text-gray-600">
                              {(disclosure.observedData?.length ?? 0) > 0 ? 'données observées' : 'données limitées'}
                              {(disclosure.aiHypotheses?.length ?? 0) > 0 ? ' · hypothèses IA' : ''}
                              {(disclosure.simulations?.length ?? 0) > 0 ? ' · simulation non mesurée' : ''}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );

  const premiumAnalyzeContent = (
    <>
      <GuestGate show={showGuestGate} pendingUrl={uploadTiktokUrl} onClose={() => setShowGuestGate(false)} />
      <div className="relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[radial-gradient(circle_at_78%_8%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_14%_18%,rgba(139,92,246,0.16),transparent_30%),linear-gradient(180deg,#050711_0%,#070a18_48%,#050711_100%)] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 text-white shadow-[0_0_90px_-60px_rgba(34,211,238,0.95)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.09),transparent_62%)]" />
        <div className="relative">
          <AnalyzePageHeader authUser={authUser} />

          <section className="relative mt-8 min-h-[170px]">
            <AnalyzeHeroArt />
            <div className="max-w-[300px]">
              <h1 className="text-[3.05rem] font-black leading-[0.96] tracking-[-0.055em] text-white min-[390px]:text-[3.35rem]">Analyser</h1>
              <p className="mt-4 max-w-[320px] text-[1rem] font-medium leading-6 text-slate-300">
                L’IA détecte automatiquement le hook, le rythme, la rétention et le potentiel de repost.
              </p>
            </div>
          </section>

          <AnalyzeSourceCard
            source={activeSource}
            onSourceChange={setActiveSource}
            file={videoFile}
            disabled={isLoading || isLimitReached}
            onFileSelect={handleFileSelect}
            onFileClear={() => {
              setVideoFile(null);
              setAnalysisPreview({});
            }}
            authUser={authUser}
            videos={tiktokVideos}
            videosLoading={!tiktokVideosLoaded}
            selectedVideoId={selectedTikTokVideoId}
            onSelectVideo={setSelectedTikTokVideoId}
            onAnalyzeUpload={() => void analyzeFromUpload()}
            onAnalyzeTikTok={() => void analyzeFromTikTok()}
            canAnalyzeUpload={canSubmit}
            canAnalyzeTikTok={canAnalyzeSelectedTikTok}
            isLoading={isLoading}
          />

          {error && (
            <div className="mt-4">
              <AnalysisErrorCard
                message={error}
                canRetry={(activeSource === 'upload' ? !!videoFile : !!selectedTikTokVideo?.shareUrl) && !isLoading && !isLimitReached}
                onRetry={() => activeSource === 'upload' ? void analyzeFromUpload() : void analyzeFromTikTok()}
                onChangeVideo={handleChangeVideoAfterError}
              />
            </div>
          )}

          {isLoading && (
            <div className="mt-5">
              <AnalysisPipelineProgress pipeline={pipelineState} preview={analysisPreview} />
            </div>
          )}

          {!isLoading && (
            <>
              <RealtimeInsights latest={latestHistoryItem} />
              <ResultPreviewCard latest={latestHistoryItem} />
              <RecentAnalysesSection history={sortedHistory} />
            </>
          )}

          {isLimitReached && !isLoading && (
            <div className="mt-5">
              <PremiumGate onReset={authUser ? undefined : handleReset} />
            </div>
          )}

          {results && !isLoading && !isLimitReached && (
            <div className="mt-6">
              <ResultsView
                result={results}
                onReset={handleAnalysisReset}
                isFreePreview={isFreePreview}
                canUseReconstruction={planCanUseReconstruction && !!results.reconstructionIA}
                plan={authUser?.plan}
              />
            </div>
          )}
        </div>
        <MobileBottomNav />
      </div>
    </>
  );

  if (embedded) {
    return (
      <section data-dashboard-analyze-section="true" className="relative min-w-0 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        {premiumAnalyzeContent}
      </section>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      {premiumAnalyzeContent}
    </main>
  );
}
