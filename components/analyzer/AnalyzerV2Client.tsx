'use client';

import { ChangeEvent, DragEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import PremiumGate from '@/components/PremiumGate';
import AnalysisCounter from '@/components/AnalysisCounter';
import GuestGate, { PENDING_URL_KEY } from '@/components/GuestGate';
import FloatingParticles from '@/components/FloatingParticles';
import { ReconstructionExperience } from '@/components/reconstruction/ReconstructionExperience';
import { ReconstructionPaywall as ReconstructionPaywallPremium } from '@/components/reconstruction/ReconstructionPaywall';
import { AnalysisPipelineState, AnalysisPipelineStepStatus, AnalysisResult, ReconstructionIAOutput, RepostVersion } from '@/lib/types';
import { normalizeTikTokUrl, isTikTokVideoUrl } from '@/lib/tiktok-url';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { PLAN_LIMITS, RECONSTRUCTION_LIMITS } from '@/lib/plan-limits';
import { hasProOrLifetimeAccess, isLifetimePlan, type AppPlan } from '@/lib/plans';

const STORAGE_KEY = 'tiktok_analysis_count';
const GUEST_LIMIT = 3;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const SUPPORTED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/mpeg']);
const premiumEase = [0.22, 1, 0.36, 1] as const;
const cardHover = {
  y: -3,
  scale: 1.006,
  transition: { duration: 0.32, ease: premiumEase },
};

type ObjectiveId = 'retention' | 'views' | 'comments' | 'followers' | 'leads' | 'sales' | 'authority' | 'advertising' | 'clip' | 'other';
type KnowledgeLevel = 'beginner' | 'intermediate' | 'expert' | 'mixed';
type CreatorTone = 'direct' | 'pedagogique' | 'storytelling' | 'humour' | 'inspirant';
type TargetPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'other';
type ContentLanguage = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar' | 'mul';
type ConfirmedFormat = 'facecam' | 'ugc' | 'clip' | 'demo' | 'storytelling' | 'advertising' | 'other';

interface CreatorContextInput {
  objectiveDetails: string;
  niche: string;
  audience: string;
  audienceKnowledge: KnowledgeLevel | '';
  tone: CreatorTone | '';
  platform: TargetPlatform;
  platformDetails: string;
  language: ContentLanguage;
  format: ConfirmedFormat | '';
  formatDetails: string;
  memoryConsent: boolean;
}

type AnalysisJobStatus = 'uploading' | 'queued' | 'preprocessing' | 'transcribing' | 'visual_analysis' | 'audio_analysis' | 'segment_analysis' | 'synthesis' | 'validation' | 'completed' | 'failed';

interface PublicAnalysisJobState {
  id: string;
  status: AnalysisJobStatus;
  progress: number;
  currentStep: string;
  analysisId: string | null;
  quota: { state: string; used: number | null; limit: number | null; restored: boolean };
  error: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
}

type UploadClientStage = 'initializing' | 'uploading' | 'starting' | 'processing';

interface AnalysisJobApiResponse {
  job: PublicAnalysisJobState;
  upload?: { bucket: string; path: string; token: string } | null;
  reused?: boolean;
  started?: boolean;
  trackingPending?: boolean;
  retryUpload?: boolean;
  error?: string;
}

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
  audience?: string;
  objectiveDetails?: string;
  audienceKnowledge?: KnowledgeLevel;
  tone?: CreatorTone;
  platform?: TargetPlatform;
  language?: ContentLanguage;
  format?: ConfirmedFormat;
  memoryConsent?: boolean;
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
  { id: 'retention', label: 'Resserrer la rétention', detail: 'Rythme et payoff' },
  { id: 'views', label: 'Gagner des vues', detail: 'Scroll et promesse' },
  { id: 'comments', label: 'Obtenir des commentaires', detail: 'Question et tension' },
  { id: 'followers', label: 'Gagner des abonnés', detail: 'Autorité et suite' },
  { id: 'leads', label: 'Générer des leads', detail: 'Intention et CTA' },
  { id: 'sales', label: 'Déclencher des ventes', detail: 'Preuve et offre' },
  { id: 'authority', label: 'Renforcer l’autorité', detail: 'Clarté et preuve' },
  { id: 'advertising', label: 'Créer une publicité', detail: 'Offre et conversion' },
  { id: 'clip', label: 'Créer un clip', detail: 'Moment fort et contexte' },
  { id: 'other', label: 'Autre objectif', detail: 'À préciser' },
];

const pipelineStepTemplates = [
  { id: 'prepare', label: 'Préparation de la vidéo', microcopy: 'Vérification du fichier, du poids et du contexte.' },
  { id: 'frames', label: 'Lecture des images', microcopy: 'Lecture des images uniquement quand le fichier original est disponible.' },
  { id: 'ocr', label: 'Traitement côté serveur', microcopy: 'Le détail des signaux est confirmé uniquement par la réponse serveur.' },
  { id: 'transcript', label: 'Lecture de la piste audio', microcopy: 'Transcription uniquement quand une piste audio exploitable existe.' },
  { id: 'format', label: 'Identification du format', microcopy: 'Le format est confirmé à partir des signaux réellement extraits.' },
  { id: 'opening', label: 'Lecture de l’ouverture', microcopy: 'Le hook est évalué à partir des preuves disponibles.' },
  { id: 'timeline', label: 'Segmentation de la vidéo', microcopy: 'Les segments sont construits sans inventer de courbe de rétention.' },
  { id: 'weak-moments', label: 'Carte des risques éditoriaux', microcopy: 'Les risques restent des hypothèses éditoriales, pas des pertes mesurées.' },
  { id: 'repost', label: 'Création du plan de repost', microcopy: 'Structure, coupes, angle, CTA et texte écran.' },
  { id: 'hooks', label: 'Préparation des hooks alternatifs', microcopy: 'Variantes testables selon les signaux vraiment disponibles.' },
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

function getObjectiveLabel(id: ObjectiveId | '') {
  return objectives.find((item) => item.id === id)?.label ?? '';
}

function creatorContextIsComplete(objective: ObjectiveId, context: CreatorContextInput) {
  return context.niche.trim().length >= 2
    && context.audience.trim().length >= 2
    && Boolean(context.audienceKnowledge)
    && context.tone.trim().length >= 2
    && Boolean(context.platform)
    && (context.platform !== 'other' || context.platformDetails.trim().length >= 2)
    && context.language.trim().length >= 2
    && Boolean(context.format)
    && (context.format !== 'other' || context.formatDetails.trim().length >= 2)
    && (objective !== 'other' || context.objectiveDetails.trim().length >= 3);
}

function buildCreatorContextPayload(objective: ObjectiveId, context: CreatorContextInput) {
  if (!creatorContextIsComplete(objective, context)) {
    throw new Error('Complète le contexte créateur avant de lancer l’analyse.');
  }

  const niche = context.niche.trim();
  const audience = context.audience.trim();
  const objectiveDetails = objective === 'other' ? context.objectiveDetails.trim() : undefined;
  const platformDetails = context.platform === 'other' ? context.platformDetails.trim() : undefined;
  const formatDetails = context.format === 'other' ? context.formatDetails.trim() : undefined;
  const creatorContext = {
    objective,
    ...(objectiveDetails ? { objectiveDetails } : {}),
    niche,
    audience,
    audienceKnowledge: context.audienceKnowledge as KnowledgeLevel,
    tone: context.tone as CreatorTone,
    platform: context.platform,
    ...(platformDetails ? { platformDetails } : {}),
    language: context.language,
    format: context.format as ConfirmedFormat,
    ...(formatDetails ? { formatDetails } : {}),
    memoryConsent: context.memoryConsent,
  };

  return {
    objective,
    objectiveDetails,
    objectiveLabel: getObjectiveLabel(objective),
    niche,
    nicheLabel: niche,
    audience,
    audienceKnowledge: creatorContext.audienceKnowledge,
    tone: creatorContext.tone,
    platform: creatorContext.platform,
    platformDetails,
    language: creatorContext.language,
    format: creatorContext.format,
    formatDetails,
    memoryConsent: creatorContext.memoryConsent,
    creatorContext,
  };
}

function waitForPollingInterval(signal: AbortSignal, delayMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Polling annulé.', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Polling annulé.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
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
            <a href="/api/tiktok/connect" className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-cyan-300 to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_60px_-34px_rgba(34,211,238,0.95)] transition hover:brightness-110">
              Connecter mon TikTok
            </a>
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
        <a href="/api/tiktok/connect" className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 text-xs font-black text-cyan-50 transition hover:bg-cyan-300/14">
          Connecter TikTok plus tard
        </a>
      )}
    </div>
  );
}

function enrichResult(
  result: AnalysisResult,
  objective: ObjectiveId | '',
  file: File | null
): AnalyzerResult {
  const recommendations = result.coachAnalysis?.detectedProblems?.slice(0, 4).map((item) => item.action)
    ?? (result.improvements ?? []).slice(0, 4).map((item) => item.tip);
  const previousObjective = objectives.some((item) => item.id === result.analyzerMeta?.objective)
    ? result.analyzerMeta?.objective as ObjectiveId
    : undefined;

  return {
    ...result,
    analyzerMeta: {
      ...result.analyzerMeta,
      objective: objective || previousObjective,
      objectiveLabel: getObjectiveLabel(objective) || result.analyzerMeta?.objectiveLabel,
      fileName: file?.name ?? result.analyzerMeta?.fileName,
      fileSizeMb: file ? Number((file.size / 1024 / 1024).toFixed(1)) : result.analyzerMeta?.fileSizeMb,
      status: 'completed',
      verdictShort: result.analyzerMeta?.verdictShort ?? result.finalVerdict?.split('.')[0],
      recommendations,
    },
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

function isDeterministicEditorialAnalysis(item?: AnalysisHistoryItem | null) {
  return item?.result?.scoreSemantics === 'deterministic_editorial_rubric';
}

function getAnalysisTitle(item?: AnalysisHistoryItem | null) {
  const meta = item?.result?.analyzerMeta as AnalyzerMeta | undefined;
  const title = meta?.verdictShort || meta?.fileName || item?.result?.coachAnalysis?.patternLabel || item?.video_url;
  if (!title) return 'Analyse Viralynz';
  return title.replace(/^upload:/, '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 72);
}

function getRetentionValue(item?: AnalysisHistoryItem | null) {
  if (isDeterministicEditorialAnalysis(item)) return null;
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
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/mpeg" className="hidden" disabled={disabled} onChange={onChange} />
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
                <p className="mt-1 text-xs leading-5 text-gray-500">MP4, MOV, WebM, MKV ou MPEG · max 250 Mo</p>
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

function phaseForPipeline(pipeline: AnalysisPipelineState) {
  if (pipeline.progress >= 100) return uxPhaseDefinitions[uxPhaseDefinitions.length - 1];
  const activeStep = pipeline.steps.find((step) => step.status === 'running') ?? pipeline.steps.find((step) => step.id === pipeline.currentStep) ?? pipeline.steps[0];
  return uxPhaseDefinitions.find((phase) => phase.stepIds.includes(activeStep?.id as PipelineStepId)) ?? uxPhaseDefinitions[0];
}

function phaseVisualStatus(phaseId: UxPhaseId, pipeline: AnalysisPipelineState) {
  const phase = uxPhaseDefinitions.find((item) => item.id === phaseId);
  if (!phase) return 'pending';
  const steps = pipeline.steps.filter((step) => phase.stepIds.includes(step.id as PipelineStepId));
  if (steps.some((step) => step.status === 'failed')) return 'failed';
  if (steps.length > 0 && steps.every((step) => step.status === 'done' || step.status === 'warning')) return 'done';
  if (steps.some((step) => step.status === 'running')) return 'running';
  return 'pending';
}

function readableStepStatus(status: AnalysisPipelineStepStatus) {
  if (status === 'done' || status === 'warning') return 'Termine';
  if (status === 'running') return 'En cours';
  if (status === 'failed') return 'Erreur';
  return 'A suivre';
}

const jobStatusLabels: Record<AnalysisJobStatus, string> = {
  uploading: 'Envoi du fichier',
  queued: 'Analyse en file d’attente',
  preprocessing: 'Prétraitement vidéo',
  transcribing: 'Transcription horodatée',
  visual_analysis: 'Analyse visuelle',
  audio_analysis: 'Analyse audio',
  segment_analysis: 'Analyse des segments',
  synthesis: 'Synthèse du diagnostic',
  validation: 'Validation des preuves',
  completed: 'Analyse terminée',
  failed: 'Analyse interrompue',
};

function AsyncAnalysisJobProgress({
  job,
  stage,
  fileName,
}: {
  job: PublicAnalysisJobState | null;
  stage: UploadClientStage;
  fileName?: string;
}) {
  const progress = job && Number.isFinite(job.progress)
    ? Math.max(0, Math.min(100, Math.round(job.progress)))
    : null;
  const quotaLabel = !job
    || job.quota.limit === null
    || job.quota.used === null
    || !Number.isFinite(job.quota.limit)
    || !Number.isFinite(job.quota.used)
    ? 'Réservé au démarrage'
    : `${job.quota.used}/${job.quota.limit}`;
  const stageLabel = stage === 'initializing'
    ? 'Préparation de l’envoi privé'
    : stage === 'uploading'
      ? 'Envoi du fichier original'
      : stage === 'starting'
        ? 'Démarrage du traitement durable'
        : job
          ? jobStatusLabels[job.status]
          : 'Traitement en cours';

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-300/18 bg-[radial-gradient(circle_at_16%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(139,92,246,0.15),transparent_34%),linear-gradient(180deg,rgba(8,12,27,0.98),rgba(5,8,18,0.96))] p-4 shadow-[0_24px_100px_-64px_rgba(34,211,238,0.9)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            Statut réel
          </div>
          <h2 className="mt-4 text-xl font-black text-white sm:text-2xl">{stageLabel}</h2>
          <p className="mt-2 truncate text-sm text-slate-400" title={fileName}>{fileName ?? 'Vidéo sélectionnée'}</p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-3xl font-black tabular-nums text-white">{progress === null ? '—' : `${progress}%`}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Progression serveur</p>
        </div>
      </div>

      <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.065]">
        {progress !== null && (
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-violet-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: premiumEase }}
          />
        )}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">État</p>
          <p className="mt-1 text-xs font-black text-white">{job ? jobStatusLabels[job.status] : 'Initialisation'}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Étape renvoyée</p>
          <p className="mt-1 break-words text-xs font-black text-white">{job?.currentStep || 'En attente du serveur'}</p>
        </div>
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">Quota</p>
          <p className="mt-1 text-xs font-black text-white">{quotaLabel}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">Cette progression vient du job serveur. Fermer la page n’interrompt pas le traitement durable.</p>
    </section>
  );
}

function AnalysisPipelineProgress({ pipeline, preview }: { pipeline: AnalysisPipelineState; preview: AnalysisPreviewSignals }) {
  const activePhase = phaseForPipeline(pipeline);
  const displayProgress = pipeline.progress;
  const activeStep = pipeline.steps.find((step) => step.status === 'running');
  const message = activeStep?.microcopy ?? 'En attente du prochain statut confirme.';
  const failedStep = pipeline.steps.find((step) => step.status === 'failed');
  const signalRows = [
    { label: 'Format', value: preview.formatDetected ? 'Detecte' : 'En attente' },
    { label: 'Hook', value: preview.hookDetected ? 'Analyse' : 'En attente' },
    { label: 'Duree', value: formatDurationLabel(preview.durationSec) },
    { label: 'Texte ecran', value: preview.hasText ? 'Detecte' : '—' },
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
              <p className="font-semibold text-cyan-100">Progression confirmee par les etapes terminees</p>
              <p className="text-slate-500">Aucune duree restante n'est simulee.</p>
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
              const status = phaseVisualStatus(phase.id, pipeline);
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
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/mpeg"
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
            <p className="mt-2 text-[0.74rem] font-semibold text-slate-500">MP4, MOV, WebM, MKV, MPEG · max 250 Mo</p>
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
        <a href="/api/tiktok/connect?review=1" className="mt-4 inline-flex h-11 items-center rounded-[14px] bg-[linear-gradient(135deg,#22d3ee,#3b82f6,#8b5cf6)] px-4 text-[0.84rem] font-black text-white">
          Connecter TikTok
        </a>
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

function CreatorContextPanel({
  objective,
  context,
  disabled,
  onObjectiveChange,
  onContextChange,
}: {
  objective: ObjectiveId;
  context: CreatorContextInput;
  disabled: boolean;
  onObjectiveChange: (value: ObjectiveId) => void;
  onContextChange: (patch: Partial<CreatorContextInput>) => void;
}) {
  const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-white/[0.09] bg-[#080d1d] px-3 text-[0.8rem] font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-50';
  const ready = creatorContextIsComplete(objective, context);

  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.92rem] font-black text-white">Contexte créateur</p>
          <p className="mt-1 text-[0.74rem] leading-5 text-slate-500">Ces champs obligatoires relient le diagnostic à ton audience et à ton objectif réel.</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.64rem] font-black uppercase tracking-[0.12em] ${ready ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-amber-300/18 bg-amber-300/[0.08] text-amber-100'}`}>
          {ready ? 'Prêt' : 'À compléter'}
        </span>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2.5">
        <label className="col-span-2 min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Objectif</span>
          <select value={objective} disabled={disabled} onChange={(event) => onObjectiveChange(event.target.value as ObjectiveId)} className={fieldClass}>
            {objectives.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>

        {objective === 'other' && (
          <label className="col-span-2 min-w-0">
            <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Précise l’objectif</span>
            <input value={context.objectiveDetails} disabled={disabled} maxLength={160} onChange={(event) => onContextChange({ objectiveDetails: event.target.value })} placeholder="Ex. faire télécharger mon guide" className={fieldClass} />
          </label>
        )}

        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Niche</span>
          <input value={context.niche} disabled={disabled} maxLength={100} onChange={(event) => onContextChange({ niche: event.target.value })} placeholder="Ex. fitness" className={fieldClass} />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Audience</span>
          <input value={context.audience} disabled={disabled} maxLength={180} onChange={(event) => onContextChange({ audience: event.target.value })} placeholder="Ex. débutants pressés" className={fieldClass} />
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Niveau</span>
          <select value={context.audienceKnowledge} disabled={disabled} onChange={(event) => onContextChange({ audienceKnowledge: event.target.value as KnowledgeLevel | '' })} className={fieldClass}>
            <option value="">À préciser</option>
            <option value="beginner">Débutant</option>
            <option value="intermediate">Intermédiaire</option>
            <option value="expert">Expert</option>
            <option value="mixed">Mixte</option>
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Ton</span>
          <select value={context.tone} disabled={disabled} onChange={(event) => onContextChange({ tone: event.target.value as CreatorTone | '' })} className={fieldClass}>
            <option value="">À préciser</option>
            <option value="direct">Direct</option>
            <option value="pedagogique">Pédagogique</option>
            <option value="storytelling">Storytelling</option>
            <option value="humour">Humour</option>
            <option value="inspirant">Inspirant</option>
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Plateforme</span>
          <select value={context.platform} disabled={disabled} onChange={(event) => onContextChange({ platform: event.target.value as TargetPlatform })} className={fieldClass}>
            <option value="tiktok">TikTok</option>
            <option value="instagram_reels">Instagram Reels</option>
            <option value="youtube_shorts">YouTube Shorts</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Langue</span>
          <select value={context.language} disabled={disabled} onChange={(event) => onContextChange({ language: event.target.value as ContentLanguage })} className={fieldClass}>
            <option value="fr">Français</option>
            <option value="en">Anglais</option>
            <option value="es">Espagnol</option>
            <option value="de">Allemand</option>
            <option value="it">Italien</option>
            <option value="pt">Portugais</option>
            <option value="ar">Arabe</option>
            <option value="mul">Multilingue / détection automatique</option>
          </select>
        </label>

        {context.platform === 'other' && (
          <label className="col-span-2 min-w-0">
            <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Précise la plateforme</span>
            <input value={context.platformDetails} disabled={disabled} maxLength={80} onChange={(event) => onContextChange({ platformDetails: event.target.value })} placeholder="Ex. Snapchat Spotlight" className={fieldClass} />
          </label>
        )}

        <label className="col-span-2 min-w-0">
          <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Format confirmé</span>
          <select value={context.format} disabled={disabled} onChange={(event) => onContextChange({ format: event.target.value as ConfirmedFormat | '' })} className={fieldClass}>
            <option value="">À préciser</option>
            <option value="facecam">Facecam</option>
            <option value="ugc">UGC</option>
            <option value="clip">Clip</option>
            <option value="storytelling">Storytelling</option>
            <option value="demo">Démo produit</option>
            <option value="advertising">Publicité</option>
            <option value="other">Autre</option>
          </select>
        </label>

        {context.format === 'other' && (
          <label className="col-span-2 min-w-0">
            <span className="mb-1.5 block text-[0.68rem] font-bold text-slate-400">Précise le format</span>
            <input value={context.formatDetails} disabled={disabled} maxLength={80} onChange={(event) => onContextChange({ formatDetails: event.target.value })} placeholder="Ex. capture d’écran commentée" className={fieldClass} />
          </label>
        )}

        <label className="col-span-2 flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.07] bg-black/15 p-3">
          <input type="checkbox" checked={context.memoryConsent} disabled={disabled} onChange={(event) => onContextChange({ memoryConsent: event.target.checked })} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-cyan-400" />
          <span className="text-[0.72rem] leading-5 text-slate-400">
            Utiliser ma mémoire existante et apprendre de cette analyse. Désactivé par défaut.
          </span>
        </label>
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
  objective,
  creatorContext,
  onObjectiveChange,
  onCreatorContextChange,
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
  objective: ObjectiveId;
  creatorContext: CreatorContextInput;
  onObjectiveChange: (value: ObjectiveId) => void;
  onCreatorContextChange: (patch: Partial<CreatorContextInput>) => void;
}) {
  const tiktokConnected = Boolean(authUser?.tiktok?.connected);
  const displayName = authUser?.tiktok?.displayName?.trim() || 'Compte TikTok';
  const ctaDisabled = source === 'upload' ? !canAnalyzeUpload : !canAnalyzeTikTok;
  const ctaLabel = source === 'upload'
    ? 'Analyser cette vidéo'
    : videos.length > 0
      ? 'Lire les données disponibles'
      : 'Importer une vidéo';

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-cyan-200/20 bg-[linear-gradient(180deg,rgba(9,15,35,0.86),rgba(5,8,18,0.93))] p-4 shadow-[0_0_56px_-34px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
      <div className="flex items-start gap-3">
        <span className="mt-1 text-cyan-200">✦</span>
        <div className="min-w-0">
          <h2 className="text-[1.35rem] font-black tracking-[-0.03em] text-white">Analyse automatique</h2>
          <p className="mt-2 text-[0.84rem] leading-5 text-slate-400">Choisis une source. Viralynz relie chaque signal disponible a une decision de montage.</p>
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
              <div className="mt-3 rounded-[14px] border border-amber-200/15 bg-amber-200/[0.055] px-3 py-2.5 text-[0.74rem] font-semibold leading-5 text-amber-50/80">
                Sans le fichier original, Viralynz ne lit ni les images ni l’audio. Cette source exploite seulement les métadonnées TikTok disponibles. Importe le fichier pour une analyse complète.
              </div>
            </div>
          </>
        )}
        <CreatorContextPanel
          objective={objective}
          context={creatorContext}
          disabled={isLoading}
          onObjectiveChange={onObjectiveChange}
          onContextChange={onCreatorContextChange}
        />
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
        Vidéo traitée pour le diagnostic · jamais publiée
      </p>
    </section>
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
      <div className="mt-3 h-px bg-gradient-to-r from-white/[0.10] to-transparent" aria-hidden />
    </div>
  );
}

function RealtimeInsights({ latest }: { latest: AnalysisHistoryItem | null }) {
  const format = latest?.result?.coachAnalysis?.patternLabel || null;
  const hookValue = latest?.result?.hook?.score !== undefined ? `Hook ${Math.round(latest.result.hook.score)}/100` : 'À détecter';
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-[1.05rem] font-black text-white">Signaux de la dernière analyse</h2>
        <span className="text-[0.76rem] font-semibold text-slate-500">{latest ? 'Dernière analyse' : 'Prêt à analyser'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 min-[430px]:grid-cols-3">
        <InsightMetricCard icon="target" label="Score hook" value={hookValue} tone="violet" />
        <InsightMetricCard icon="clock" label="Risques horodatés" value={latest ? 'Timeline prête' : 'Après analyse'} tone="cyan" />
        <InsightMetricCard icon="trophy" label="Format observé" value={format ?? 'À confirmer'} tone="green" />
      </div>
    </section>
  );
}

function ScoreRing({ score, compact = false }: { score: number | null; compact?: boolean }) {
  const display = score === null ? '--' : String(score);
  const angle = score === null ? 0 : Math.max(8, Math.min(100, score)) * 3.6;
  const outer = compact ? 'h-16 w-16' : 'h-28 w-28';
  const inner = compact ? 'h-12 w-12' : 'h-[86px] w-[86px]';
  const scoreSize = compact ? 'text-[1.15rem]' : 'text-[2rem]';
  const suffixSize = compact ? 'text-[0.58rem]' : 'text-[0.78rem]';
  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full ${outer}`} style={{ background: score === null ? 'rgba(255,255,255,0.08)' : `conic-gradient(#22d3ee 0deg, #3b82f6 ${Math.max(0, angle - 60)}deg, #8b5cf6 ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)` }}>
      <div className={`grid place-items-center rounded-full bg-[#070b18] shadow-[inset_0_0_28px_rgba(15,23,42,0.9)] ${inner}`}>
        <div className="text-center">
          <p className={`${scoreSize} font-black leading-none text-white`}>{display}</p>
          <p className={`${suffixSize} font-bold text-slate-400`}>/100</p>
        </div>
      </div>
    </div>
  );
}

function ResultPreviewCard({ latest }: { latest: AnalysisHistoryItem | null }) {
  const score = getAnalysisScore(latest);
  const editorialV2 = isDeterministicEditorialAnalysis(latest);
  const description = latest?.result?.hook?.analysis || latest?.result?.coachAnalysis?.openingAnalysis?.exactCorrection || 'Lance une analyse pour transformer le score en décisions de montage concrètes.';
  const checklist = latest?.result?.actionPlan?.slice(0, 3) ?? latest?.result?.analyzerMeta?.recommendations?.slice(0, 3) ?? [
    'Détecter le hook et le rythme',
    'Cartographier les risques éditoriaux',
    'Générer le plan de repost',
  ];
  return (
    <section className="mt-5 rounded-[22px] border border-blue-300/18 bg-[linear-gradient(180deg,rgba(9,15,35,0.78),rgba(5,8,18,0.9))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <h2 className="text-[1.05rem] font-black text-white">Aperçu du résultat</h2>
      <div className="mt-4 grid gap-4 min-[390px]:grid-cols-[112px_minmax(0,1fr)]">
        <ScoreRing score={score} compact />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[1rem] font-black text-white">{editorialV2 ? 'Score éditorial' : 'Potentiel de repost'}</h3>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[0.68rem] font-black text-cyan-200">{editorialV2 ? 'Grille déterministe' : 'Insight IA'}</span>
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
        <p className="text-[0.74rem] font-bold text-slate-500">Courbe de rétention TikTok</p>
        <p className="mt-2 text-[0.8rem] font-semibold leading-5 text-slate-300">
          Aucune série de rétention autorisée n’est disponible. Viralynz n’invente pas de courbe.
        </p>
      </div>
    </section>
  );
}

function RecentAnalysisCard({ item, index }: { item: AnalysisHistoryItem; index: number }) {
  const score = getAnalysisScore(item);
  const retention = getRetentionValue(item);
  const views = getObservedViews(item);
  const editorialV2 = isDeterministicEditorialAnalysis(item);
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
          <span className="inline-flex items-center gap-1"><AnalyzeIcon name="chart" className="h-3.5 w-3.5" />{editorialV2 ? 'Rétention non mesurée' : retention === null ? 'Rétention --' : `${retention}% rétention`}</span>
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
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden">
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

function ResultCard({ title, score, verdict, analysis, advice }: { title: string; score: number | null; verdict: string; analysis: string; advice: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-vn-violet/80">{verdict}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black tabular-nums ${score === null ? 'border-white/[0.1] bg-white/[0.04] text-gray-400' : scoreTone(score)}`}>
          {score === null ? '—' : `${score}/100`}
        </span>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        {score !== null && <div className={`h-full rounded-full bg-gradient-to-r ${scoreBar(score)}`} style={{ width: `${score}%` }} />}
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
            Débloque la timeline complète, les risques éditoriaux horodatés, les hooks réécrits et la structure prête à remonter.
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

  return [];
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
  const cuts = reconstruction?.cutsRecommended?.map((cut) => `${cut.timeRange} : ${cut.reason}${cut.replacement ? ` → ${cut.replacement}` : ''}`) ?? [];
  const relances = reconstruction?.patternInterrupts?.map((item) => `${item.at} : ${item.instruction} (${item.reason})`) ?? [];
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
              ['Diagnostic', `${result.viralityScore}/100`],
              ['Après republication', '—'],
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
                  : (repost.hookVariants?.length ? repost.hookVariants : [repost.hook])
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
                        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">risque editorial</span>
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
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/80">Pourquoi cette structure mérite un test</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-gray-300">
              <p>{reconstruction?.whyThisStructureWorks?.retentionLogic ?? 'Explication non disponible pour cette reconstruction.'}</p>
              <p>{reconstruction?.whyThisStructureWorks?.viewerPsychology ?? 'Le viewer reçoit une preuve avant l’explication, ce qui augmente la tension et la curiosité.'}</p>
              <p className="text-gray-500">{reconstruction?.whyThisStructureWorks?.changeJustification ?? 'Les changements suivent les risques éditoriaux, le hook et le CTA détectés dans l’analyse.'}</p>
            </div>
          </motion.div>
          <motion.div whileHover={cardHover} className="rounded-2xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.055] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-fuchsia/80">Simulation IA</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ['Rétention', prediction?.retentionPotential ?? null],
                ['Watch time', prediction?.watchTimePotential ?? null],
                ['Engagement', prediction?.engagementPotential ?? null],
                ['Commentaires', prediction?.commentPotential ?? null],
              ] satisfies Array<[string, number | null]>).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/[0.07] bg-black/18 p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</p>
                  <p className="mt-1 text-2xl font-black text-white">{value ?? '—'}{value === null ? null : <span className="text-xs text-gray-500">/100</span>}</p>
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
  const toScore = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : null;
  const overallScore = toScore(result.viralityScore);
  const hookScore = toScore(subScores?.hook ?? result.hook?.score);
  const retentionScore = toScore(subScores?.retention ?? result.retention?.score);
  const rhythmScore = toScore(result.editing?.score);
  const clarityScore = toScore(subScores?.clarity);
  const ctaScore = toScore(subScores?.cta);
  const repostScore = toScore(subScores?.repostPotential);
  const verdict = result.coachAnalysis?.verdict || result.analyzerMeta?.verdictShort || result.finalVerdict || 'Diagnostic non disponible pour cette analyse.';
  const repost = result.repostVersion;
  const reconstructionPlan = result.structuredReconstructionIA ?? null;
  const problems = result.coachAnalysis?.detectedProblems ?? [];
  const problemFor = (terms: RegExp) => problems.find((item) => terms.test(`${item.id} ${item.title} ${item.explanation}`));
  const improvementFor = (terms: RegExp) => result.improvements?.find((item) => terms.test(item.tip))?.tip;
  const diagnostic = problems.map((item) => `${item.title} : ${item.explanation}`);

  const detailCards = [
    {
      title: 'Hook',
      score: hookScore,
      verdict: result.hook?.rating ?? 'Score indisponible',
      analysis: result.hook?.analysis || 'Analyse du hook non disponible.',
      advice: problemFor(/hook|accroche/i)?.action ?? improvementFor(/hook|accroche/i) ?? 'Correction non disponible.',
    },
    {
      title: 'Rétention',
      score: retentionScore,
      verdict: result.retention?.rating ?? 'Score indisponible',
      analysis: result.retention?.analysis || 'Analyse de rétention non disponible.',
      advice: problemFor(/retention|rétention|drop|payoff/i)?.action ?? improvementFor(/retention|rétention|drop|payoff/i) ?? 'Correction non disponible.',
    },
    {
      title: 'Clarte du message',
      score: clarityScore,
      verdict: clarityScore === null ? 'Score indisponible' : 'Score issu du diagnostic',
      analysis: problemFor(/clarte|clarté|promesse|message/i)?.explanation ?? 'Analyse de clarté non disponible.',
      advice: problemFor(/clarte|clarté|promesse|message/i)?.action ?? improvementFor(/clarte|clarté|promesse|message/i) ?? 'Correction non disponible.',
    },
    {
      title: 'Rythme',
      score: rhythmScore,
      verdict: result.editing?.rating ?? 'Score indisponible',
      analysis: result.editing?.analysis || 'Analyse du rythme non disponible.',
      advice: problemFor(/rythme|montage|cut|pattern/i)?.action ?? improvementFor(/rythme|montage|cut|pattern/i) ?? 'Correction non disponible.',
    },
    {
      title: 'CTA',
      score: ctaScore,
      verdict: ctaScore === null ? 'Score indisponible' : 'Score issu du diagnostic',
      analysis: problemFor(/cta|appel.*action|comment/i)?.explanation ?? 'Analyse du CTA non disponible.',
      advice: problemFor(/cta|appel.*action|comment/i)?.action ?? improvementFor(/cta|appel.*action|comment/i) ?? 'Correction non disponible.',
    },
    {
      title: 'Potentiel de reconstruction',
      score: repostScore,
      verdict: repostScore === null ? 'Score indisponible' : 'Score issu du diagnostic',
      analysis: result.coachAnalysis?.repostEngine?.bestOpportunity?.why ?? 'Potentiel de reconstruction non disponible.',
      advice: result.coachAnalysis?.repostEngine?.bestOpportunity?.action ?? 'Correction non disponible.',
    },
  ];
  const visibleDiagnosticCount = isFreePreview ? 2 : 5;
  const visibleDetailCards = isFreePreview ? detailCards.slice(0, 2) : detailCards;
  const lockedDetailCards = isFreePreview ? detailCards.slice(2) : [];
  const primaryPriority = result.coachAnalysis?.openingAnalysis?.mainProblem
    ?? result.coachAnalysis?.detectedProblems?.[0]?.title
    ?? 'Aucune priorité fiable disponible.';
  const priorityActions = problems.slice(0, 3).map((problem) => ({
    title: problem.title,
    why: problem.explanation,
    correction: problem.action,
    impact: problem.impact || 'Diagnostic',
  }));
  const repostPreview: Array<[string, string]> = repost ? [
    ['Hook', repost.hook],
    ...repost.structure.slice(0, 3).map((step, index): [string, string] => [`Étape ${index + 1}`, step]),
    ['CTA', repost.cta],
  ].filter((item): item is [string, string] => Boolean(item[1]?.trim())) : [];
  const hookPackHref = repost?.hook
    ? `/dashboard/hooks?objective=repost&trendHook=${encodeURIComponent(repost.hook)}&trendTitle=${encodeURIComponent(verdict)}`
    : '/dashboard/hooks?objective=repost';

  return (
    <section className="animate-fade-in space-y-5">
      <div className="overflow-hidden rounded-3xl border border-cyan-300/14 bg-[radial-gradient(circle_at_14%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(232,121,249,0.15),transparent_34%),linear-gradient(180deg,rgba(11,11,18,0.98),rgba(11,11,18,0.94))] shadow-[0_24px_110px_-70px_rgba(34,211,238,0.85)]">
        <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/50 to-transparent" />
        <div className="grid gap-5 p-4 sm:p-7 lg:grid-cols-[0.76fr_1.24fr] lg:items-stretch">
          <div className="relative flex min-h-[13rem] items-center justify-center rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.065] to-transparent p-4">
            <div className="absolute inset-6 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative w-full text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/75">Résultat</p>
              <p className="mt-2 text-6xl font-black tracking-tight text-white tabular-nums sm:text-7xl">
                {overallScore ?? '—'}{overallScore !== null && <span className="text-2xl text-gray-600">/100</span>}
              </p>
              <p className="mx-auto mt-4 max-w-xs text-xs leading-5 text-gray-500">Aucun gain futur n'est affiché sans mesure après republication.</p>
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
            <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-white">Diagnostic enregistré pour cette vidéo</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">{verdict}</p>
            <div className="mt-4 rounded-2xl border border-vn-fuchsia/18 bg-vn-fuchsia/[0.065] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-vn-fuchsia/80">Priorité n°1</p>
              <p className="mt-1 text-sm font-black text-white">{primaryPriority}</p>
              <p className="mt-1 text-xs leading-5 text-gray-400">
                {priorityActions[0]?.correction ?? 'Aucune correction fiable n’a été retournée pour ce diagnostic.'}
              </p>
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

      <SectionCard title="À corriger en priorité" eyebrow="Décisions observées">
        {priorityActions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] p-4 text-sm leading-6 text-gray-400">
            Aucune priorité fiable n'est disponible. Relance une analyse exploitable pour obtenir des décisions liées à cette vidéo.
          </div>
        )}
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
            {repostPreview.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {repostPreview.map(([label, value]) => (
                  <div key={`${label}-${value}`} className="rounded-xl border border-white/[0.065] bg-black/18 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/75">{label}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-gray-200">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/[0.1] bg-black/18 p-3 text-xs leading-5 text-gray-500">Plan de repost indisponible dans cette analyse.</p>
            )}
          </div>
          {canUseReconstruction && reconstructionPlan ? (
            <ReconstructionExperience
              plan={reconstructionPlan}
              scaleMode={isLifetimePlan(plan)}
            />
          ) : canUseReconstruction ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.025] p-4 text-sm leading-6 text-gray-400">
              La reconstruction structurée n'est pas disponible pour cette analyse. Aucun plan générique n'a été injecté.
            </div>
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
        <CollapsibleInsight title="Carte des risques éditoriaux">
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
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Diagnostic actuel</p>
                  <p className="mt-1 text-xl font-black text-white">{result.coachAnalysis.repostEngine.scoreBefore}/100</p>
                </div>
                <div className="rounded-xl bg-white/[0.04] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Après republication</p>
                  <p className="mt-1 text-xl font-black text-gray-400">—</p>
                  <p className="mt-1 text-[10px] text-gray-600">Non mesure</p>
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
              <p className="text-sm font-bold text-white">Carte des risques éditoriaux</p>
                  <p className="mt-1 text-xs text-gray-500">Hypothèses horodatées issues des signaux disponibles, pas une courbe de rétention mesurée.</p>
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
              <p className="text-sm font-bold text-white">Carte segmentee des risques</p>
              <p className="mt-1 text-xs text-gray-500">Chaque segment indique les signaux vraiment disponibles et la correction a tester.</p>
              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                {result.coachAnalysis.videoSegments.map((segment) => (
                  <div key={`${segment.range}-${segment.role}`} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-vn-violet">{segment.range}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${scoreTone(100 - segment.dropRisk)}`}>risque estime {segment.dropRisk}</span>
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

      <CollapsibleInsight title="Checklist complète — avant remontage">
        {(result.actionPlan ?? []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.025] p-3 text-sm leading-6 text-gray-400">Checklist indisponible dans cette analyse.</p>
        )}
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
          <Link href={hookPackHref} className="rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-4 py-3 text-sm font-bold text-white transition hover:brightness-110">Créer un Hook Pack</Link>
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
  const router = useRouter();
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadTiktokUrl, setUploadTiktokUrl] = useState('');
  const [activeSource, setActiveSource] = useState<AnalyzeSource>('upload');
  const [tiktokVideos, setTikTokVideos] = useState<TikTokPublishedVideo[]>([]);
  const [tiktokVideosLoaded, setTikTokVideosLoaded] = useState(false);
  const [selectedTikTokVideoId, setSelectedTikTokVideoId] = useState<string | null>(null);
  const [objective, setObjective] = useState<ObjectiveId>('retention');
  const [creatorContext, setCreatorContext] = useState<CreatorContextInput>({
    objectiveDetails: '',
    niche: '',
    audience: '',
    audienceKnowledge: '',
    tone: '',
    platform: 'tiktok',
    platformDetails: '',
    language: 'fr',
    format: '',
    formatDetails: '',
    memoryConsent: false,
  });
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
  const [pipelineState, setPipelineState] = useState<AnalysisPipelineState>(() => createPipelineState());
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisPreviewSignals>({});
  const [analysisJob, setAnalysisJob] = useState<PublicAnalysisJobState | null>(null);
  const [uploadClientStage, setUploadClientStage] = useState<UploadClientStage>('initializing');
  const requestedAnalysisIdRef = useRef<string | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const uploadIdempotencyKeyRef = useRef<string | null>(null);
  const browserSupabaseRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null);

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

  useEffect(() => () => {
    pollAbortRef.current?.abort();
  }, []);

  const isReady = mounted && authLoaded;
  const effectiveCount = authUser ? authUser.analyses_count : guestCount;
  const effectiveLimit = authUser ? (PLAN_LIMITS[authUser.plan] ?? GUEST_LIMIT) : GUEST_LIMIT;
  const isLimitReached = isReady && effectiveCount >= effectiveLimit;
  const creatorContextReady = creatorContextIsComplete(objective, creatorContext);
  const canSubmit = !!videoFile && creatorContextReady && !isLoading && !isLimitReached;
  const isFreePreview = !authUser || authUser.plan === 'free';
  const planCanUseReconstruction = authUser ? hasProOrLifetimeAccess(authUser.plan) : false;
  const reconstructionLimit = authUser ? RECONSTRUCTION_LIMITS[authUser.plan] ?? 0 : 0;
  const reconstructionUsed = authUser?.reconstructions_count ?? 0;
  const loadingButtonText = isLoading
    ? activeSource === 'upload'
      ? analysisJob ? jobStatusLabels[analysisJob.status] : 'Préparation de l’envoi'
      : pipelineState.steps.find((step) => step.status === 'running')?.label ?? 'En attente du statut serveur'
    : 'Lancer le diagnostic';

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [history]
  );
  const selectedTikTokVideo = useMemo(
    () => tiktokVideos.find((video) => video.id === selectedTikTokVideoId) ?? null,
    [selectedTikTokVideoId, tiktokVideos]
  );
  const canAnalyzeSelectedTikTok = Boolean(selectedTikTokVideo?.shareUrl && creatorContextReady && !isLoading && !isLimitReached);
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
      setError('La vidéo dépasse 250 Mo. Compresse-la ou exporte une version plus légère.');
      return;
    }
    if (!SUPPORTED_VIDEO_TYPES.has(file.type)) {
      setError('Format non pris en charge. Utilise MP4, MOV, WebM, MKV ou MPEG.');
      return;
    }
    pollAbortRef.current?.abort();
    uploadIdempotencyKeyRef.current = null;
    setAnalysisJob(null);
    setUploadClientStage('initializing');
    setError('');
    setVideoFile(file);
    setAnalysisPreview({
      fileName: file.name,
      fileSizeMb: Number((file.size / 1024 / 1024).toFixed(1)),
    });
    setResults(null);
  };

  const clearSelectedVideo = () => {
    pollAbortRef.current?.abort();
    uploadIdempotencyKeyRef.current = null;
    setAnalysisJob(null);
    setVideoFile(null);
    setAnalysisPreview({});
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
      warning: data.repostVersion || data.coachAnalysis?.repostEngine ? undefined : 'Aucun plan de remontage fiable retourne.',
    });
    updatePipelineStep('hooks', data.coachAnalysis?.hookVariants?.length || data.repostVersion?.hook ? 'done' : 'warning', {
      signalsAvailable: data.coachAnalysis?.hookVariants?.length || data.repostVersion?.hook ? ['Hooks generes'] : [],
      limitations: missingSignals.slice(0, 2),
      warning: data.coachAnalysis?.hookVariants?.length || data.repostVersion?.hook ? undefined : 'Aucune variante de hook fiable retournee.',
      completed: true,
    });

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

  const readApiError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({} as { error?: unknown }));
    return typeof data.error === 'string' && data.error.trim() ? data.error : fallback;
  };

  const pollAnalysisJob = async (jobId: string, signal: AbortSignal): Promise<PublicAnalysisJobState> => {
    let consecutiveFailures = 0;
    let queuedRecoveryAttempted = false;
    while (!signal.aborted) {
      await waitForPollingInterval(signal, 2000);
      const response = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        cache: 'no-store',
        signal,
      });
      if (!response.ok) {
        consecutiveFailures += 1;
        const message = await readApiError(response, 'Le statut de l’analyse est temporairement indisponible.');
        if (response.status === 401 || response.status === 404 || consecutiveFailures >= 3) {
          throw new Error(message);
        }
        continue;
      }

      consecutiveFailures = 0;
      const data = await response.json() as AnalysisJobApiResponse;
      if (!data.job?.id) throw new Error('Réponse de statut invalide.');
      let currentJob = data.job;
      setAnalysisJob(currentJob);
      if (currentJob.status === 'completed' || currentJob.status === 'failed') return currentJob;

      const updatedAtMs = Date.parse(currentJob.updatedAt);
      const queuedLeaseIsStale = currentJob.status === 'queued'
        && Number.isFinite(updatedAtMs)
        && Date.now() - updatedAtMs >= 120_000;
      if (queuedLeaseIsStale && !queuedRecoveryAttempted) {
        queuedRecoveryAttempted = true;
        const recoveryResponse = await fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}/start`, {
          method: 'POST',
          signal,
        });
        if (recoveryResponse.ok) {
          const recovery = await recoveryResponse.json() as AnalysisJobApiResponse;
          if (recovery.job?.id) {
            currentJob = recovery.job;
            setAnalysisJob(currentJob);
            if (currentJob.status === 'completed' || currentJob.status === 'failed') return currentJob;
          }
        }
      }
    }
    throw new DOMException('Polling annulé.', 'AbortError');
  };

  const analyzeFromUpload = async () => {
    if (isLimitReached || isLoading) return;
    if (!videoFile) { setError('Choisis un fichier MP4, MOV, WebM, MKV ou MPEG.'); return; }
    if (!authUser) {
      setShowGuestGate(true);
      return;
    }
    if (!creatorContextIsComplete(objective, creatorContext)) {
      setError('Complète le contexte créateur avant de lancer l’analyse.');
      return;
    }

    const currentFile = videoFile;
    const controller = new AbortController();
    pollAbortRef.current?.abort();
    pollAbortRef.current = controller;
    const idempotencyKey = uploadIdempotencyKeyRef.current ?? `analysis_${crypto.randomUUID()}`;
    uploadIdempotencyKeyRef.current = idempotencyKey;
    setError('');
    setIsLoading(true);
    setResults(null);
    setAnalysisJob(null);
    setUploadClientStage('initializing');
    setAnalysisPreview({
      fileName: currentFile.name,
      fileSizeMb: Number((currentFile.size / 1024 / 1024).toFixed(1)),
    });

    try {
      const contextPayload = buildCreatorContextPayload(objective, creatorContext);
      const initializeResponse = await fetch('/api/analysis-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey,
          fileName: currentFile.name,
          contentType: currentFile.type,
          sizeBytes: currentFile.size,
          creatorContext: contextPayload.creatorContext,
        }),
        signal: controller.signal,
      });
      if (!initializeResponse.ok) {
        if (initializeResponse.status === 409) uploadIdempotencyKeyRef.current = null;
        throw new Error(await readApiError(initializeResponse, 'Impossible de préparer l’envoi privé.'));
      }

      const initialized = await initializeResponse.json() as AnalysisJobApiResponse;
      if (!initialized.job?.id) throw new Error('Le serveur n’a pas retourné de job d’analyse.');
      let currentJob = initialized.job;
      setAnalysisJob(currentJob);

      if (currentJob.status === 'failed') {
        uploadIdempotencyKeyRef.current = null;
        throw new Error(currentJob.error?.message ?? 'Cette analyse a été interrompue.');
      }
      if (currentJob.status === 'completed') {
        if (!currentJob.analysisId) throw new Error('Analyse terminée sans résultat accessible.');
        router.push(`/analyses/${encodeURIComponent(currentJob.analysisId)}`);
        return;
      }

      if (initialized.reused && (currentJob.status === 'uploading' || currentJob.status === 'queued')) {
        const resumingUploadedFile = currentJob.status === 'uploading';
        setUploadClientStage('starting');
        const resumeResponse = await fetch(`/api/analysis-jobs/${encodeURIComponent(currentJob.id)}/start`, {
          method: 'POST',
          signal: controller.signal,
        });
        if (resumeResponse.ok) {
          const resumed = await resumeResponse.json() as AnalysisJobApiResponse;
          if (resumed.job?.id) {
            currentJob = resumed.job;
            setAnalysisJob(currentJob);
          }
        } else {
          const resumeFailure = await resumeResponse.json().catch(() => ({} as AnalysisJobApiResponse));
          const canRetryUpload = resumingUploadedFile
            && resumeResponse.status === 400
            && resumeFailure.retryUpload === true;
          if (!canRetryUpload) {
            throw new Error(
              typeof resumeFailure.error === 'string' && resumeFailure.error.trim()
                ? resumeFailure.error
                : 'Impossible de reprendre le traitement.',
            );
          }
        }
      }

      if (currentJob.status === 'uploading') {
        if (!initialized.upload?.bucket || !initialized.upload.path || !initialized.upload.token) {
          throw new Error('Le lien d’envoi privé est indisponible.');
        }
        setUploadClientStage('uploading');
        const supabase = browserSupabaseRef.current ?? createBrowserSupabaseClient();
        browserSupabaseRef.current = supabase;
        const { error: uploadError } = await supabase.storage
          .from(initialized.upload.bucket)
          .uploadToSignedUrl(initialized.upload.path, initialized.upload.token, currentFile, {
            contentType: currentFile.type,
          });
        if (uploadError) {
          throw new Error('L’envoi privé de la vidéo a échoué. Vérifie ta connexion puis réessaie.');
        }

        setUploadClientStage('starting');
        const startResponse = await fetch(`/api/analysis-jobs/${encodeURIComponent(currentJob.id)}/start`, {
          method: 'POST',
          signal: controller.signal,
        });
        if (!startResponse.ok) {
          throw new Error(await readApiError(startResponse, 'Le traitement n’a pas pu démarrer.'));
        }
        const started = await startResponse.json() as AnalysisJobApiResponse;
        if (!started.job?.id) throw new Error('Le serveur n’a pas confirmé le démarrage.');
        currentJob = started.job;
        setAnalysisJob(currentJob);
      }

      setUploadClientStage('processing');
      const terminalJob = currentJob.status === 'completed' || currentJob.status === 'failed'
        ? currentJob
        : await pollAnalysisJob(currentJob.id, controller.signal);
      if (terminalJob.status === 'failed') {
        uploadIdempotencyKeyRef.current = null;
        throw new Error(terminalJob.error?.message ?? 'L’analyse a été interrompue. Ton quota a été restauré.');
      }
      if (!terminalJob.analysisId) throw new Error('Analyse terminée sans résultat accessible.');
      router.push(`/analyses/${encodeURIComponent(terminalJob.analysisId)}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessaie sans changer de vidéo.');
    } finally {
      if (pollAbortRef.current === controller) pollAbortRef.current = null;
      if (!controller.signal.aborted) setIsLoading(false);
    }
  };

  const analyzeFromTikTok = async () => {
    if (isLimitReached || isLoading) return;
    if (!selectedTikTokVideo?.shareUrl) {
      setError('Cette vidéo TikTok n’a pas de lien exploitable. Importe le fichier vidéo pour lancer une analyse complète.');
      return;
    }
    if (!authUser) {
      setShowGuestGate(true);
      return;
    }
    if (!creatorContextIsComplete(objective, creatorContext)) {
      setError('Complète le contexte créateur avant de lire les données TikTok disponibles.');
      return;
    }

    setAnalysisJob(null);
    setPipelineState(createPipelineState());
    setAnalysisPreview({
      fileName: selectedTikTokVideo.title ?? selectedTikTokVideo.shareUrl,
      durationSec: selectedTikTokVideo.duration ?? undefined,
    });
    updatePipelineStep('prepare', 'running');
    setError('');
    setIsLoading(true);
    setResults(null);

    try {
      updatePipelineStep('prepare', 'done', { signalsAvailable: ['Lien TikTok'] });
      updatePipelineStep('ocr', 'running');

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: selectedTikTokVideo.shareUrl,
          ...buildCreatorContextPayload(objective, creatorContext),
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
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGuestCount(0);
    setResults(null);
    setError('');
  };

  const handleAnalysisReset = () => {
    pollAbortRef.current?.abort();
    uploadIdempotencyKeyRef.current = null;
    setAnalysisJob(null);
    setResults(null);
    setError('');
    setVideoFile(null);
    setUploadTiktokUrl('');
    setPipelineState(createPipelineState());
    setAnalysisPreview({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeVideoAfterError = () => {
    pollAbortRef.current?.abort();
    uploadIdempotencyKeyRef.current = null;
    setAnalysisJob(null);
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
                onClear={clearSelectedVideo}
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

            {isLoading && (
              activeSource === 'upload'
                ? <AsyncAnalysisJobProgress job={analysisJob} stage={uploadClientStage} fileName={videoFile?.name} />
                : <AnalysisPipelineProgress pipeline={pipelineState} preview={analysisPreview} />
            )}
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
                            Score <span className="text-vn-violet">{getAnalysisScore(item) ?? '—'}</span> · {new Date(item.created_at).toLocaleDateString('fr-FR')}
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
      <div className={`relative mx-auto min-h-dvh w-full overflow-hidden bg-[radial-gradient(circle_at_78%_8%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_14%_18%,rgba(139,92,246,0.16),transparent_30%),linear-gradient(180deg,#050711_0%,#070a18_48%,#050711_100%)] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 text-white shadow-[0_0_90px_-60px_rgba(34,211,238,0.95)] ${embedded ? 'max-w-[900px] sm:px-6 sm:pb-10 lg:px-8' : 'max-w-[430px]'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.09),transparent_62%)]" />
        <div className="relative">
          <AnalyzePageHeader authUser={authUser} />

          <section className="relative mt-8 min-h-[170px]">
            <AnalyzeHeroArt />
            <div className="max-w-[300px]">
              <h1 className="text-[3.05rem] font-black leading-[0.96] tracking-[-0.055em] text-white min-[390px]:text-[3.35rem]">Analyser</h1>
              <p className="mt-4 max-w-[320px] text-[1rem] font-medium leading-6 text-slate-300">
                Viralynz repere le hook, le rythme et les risques editoriaux a partir des signaux reellement disponibles.
              </p>
            </div>
          </section>

          <AnalyzeSourceCard
            source={activeSource}
            onSourceChange={setActiveSource}
            file={videoFile}
            disabled={isLoading || isLimitReached}
            onFileSelect={handleFileSelect}
            onFileClear={clearSelectedVideo}
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
            objective={objective}
            creatorContext={creatorContext}
            onObjectiveChange={setObjective}
            onCreatorContextChange={(patch) => setCreatorContext((current) => ({ ...current, ...patch }))}
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
              {activeSource === 'upload' ? (
                <AsyncAnalysisJobProgress job={analysisJob} stage={uploadClientStage} fileName={videoFile?.name} />
              ) : (
                <AnalysisPipelineProgress pipeline={pipelineState} preview={analysisPreview} />
              )}
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
