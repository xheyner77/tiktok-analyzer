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
import type { AppPlan } from '@/lib/plans';

const STORAGE_KEY = 'tiktok_analysis_count';
const GUEST_LIMIT = 3;
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
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
  { id: 'frames', label: 'Extraction des frames cles', microcopy: 'Lecture des images utiles pour comprendre le visuel.', durationMs: 1400 },
  { id: 'ocr', label: 'Lecture du texte ecran', microcopy: 'OCR vision sur les textes visibles et la premiere frame.', durationMs: 1200 },
  { id: 'transcript', label: 'Transcription audio', microcopy: 'Whisper lit la voix quand une piste audio exploitable existe.', durationMs: 1600 },
  { id: 'format', label: 'Detection du format video', microcopy: 'Facecam, tuto, sans parole, demo ou format hybride.', durationMs: 900 },
  { id: 'opening', label: 'Analyse des 3 premieres secondes', microcopy: 'Stop-scroll, promesse, friction et premiere preuve.', durationMs: 1200 },
  { id: 'timeline', label: 'Analyse de la timeline complete', microcopy: 'Segments 0-1s, 1-3s, 3-5s, 5-10s, 10-20s et fin.', durationMs: 1200 },
  { id: 'weak-moments', label: 'Detection des moments faibles', microcopy: 'Drop probable, surcharge, payoff tardif et contradictions.', durationMs: 900 },
  { id: 'repost', label: 'Generation du plan de remontage', microcopy: 'Structure, cuts, angle, CTA et texte ecran.', durationMs: 1100 },
  { id: 'hooks', label: 'Generation des hooks', microcopy: 'Variantes testables selon les signaux vraiment disponibles.', durationMs: 900 },
] as const;

type PipelineStepId = typeof pipelineStepTemplates[number]['id'];

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
    <section className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.025] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_60px_-40px_rgba(0,0,0,0.9)]">
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
      className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${
        isDragging
          ? 'border-vn-fuchsia/45 bg-vn-fuchsia/[0.08]'
          : file
          ? 'border-vn-violet/25 bg-vn-violet/[0.045]'
          : 'border-dashed border-white/[0.14] bg-[#080810]/80 hover:border-vn-violet/35 hover:bg-white/[0.04]'
      }`}
    >
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime,video/*" className="hidden" disabled={disabled} onChange={onChange} />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/40 to-transparent" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-vn-violet/25 bg-vn-violet/15 text-vn-violet">
            <VideoIcon className="h-6 w-6" />
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
                <p className="mt-1 text-xs text-gray-500">MP4, MOV ou TikTok export — max 200 Mo</p>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {file && (
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-gray-300 transition hover:border-white/[0.18] hover:bg-white/[0.07] disabled:opacity-50"
            >
              Retirer
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black transition hover:bg-gray-200 disabled:opacity-50"
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

function AnalysisPipelineProgress({ pipeline }: { pipeline: AnalysisPipelineState }) {
  const activeStep = pipeline.steps.find((step) => step.status === 'running') ?? pipeline.steps.find((step) => step.id === pipeline.currentStep) ?? pipeline.steps[0];
  const statusLabel: Record<AnalysisPipelineStepStatus, string> = {
    pending: 'En attente',
    running: 'En cours',
    done: 'Termine',
    warning: 'Partiel',
    failed: 'Echec',
  };
  return (
    <section className="rounded-3xl border border-vn-violet/20 bg-[#080810]/95 p-5 sm:p-7 shadow-[0_20px_90px_-50px_rgba(99,102,241,0.75)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-vn-fuchsia/70">Analyse en cours</p>
          <h2 className="mt-2 text-xl font-black text-white">Lecture video de bout en bout</h2>
          <p className="mt-1 text-sm text-gray-500">{activeStep?.label}</p>
          <p className="mt-2 text-xs text-vn-violet/80">{activeStep?.microcopy}</p>
        </div>
        <p className="text-3xl font-black tabular-nums text-white">{pipeline.progress}%</p>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo transition-all duration-500"
          style={{ width: `${pipeline.progress}%` }}
        />
      </div>
      <div className="mt-6 grid gap-2">
        {pipeline.steps.map((step) => {
          const done = step.status === 'done';
          const active = step.status === 'running';
          const warning = step.status === 'warning';
          const failed = step.status === 'failed';
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
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">{statusLabel[step.status]}</span>
                </div>
                {(step.warning || step.error) && <p className="mt-1 text-xs text-amber-300/80">{step.warning ?? step.error}</p>}
              </div>
            </div>
          );
        })}
      </div>
      {(pipeline.signalsAvailable.length > 0 || pipeline.limitations.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {pipeline.signalsAvailable.map((signal) => (
            <span key={signal} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300">{signal}</span>
          ))}
          {pipeline.limitations.map((item) => (
            <span key={item} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">{item}</span>
          ))}
        </div>
      )}
    </section>
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
  const scaleOnly = plan === 'scale';
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
                ).slice(0, scaleOnly ? 4 : 3).map((hook) => (
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
              {scaleOnly && <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2 text-xs font-bold text-cyan-100">Lifetime : variantes CTA + multi-structures pour comparer plusieurs comptes.</p>}
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

  return (
    <section className="animate-fade-in space-y-5">
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0b0b12] shadow-[0_24px_120px_-70px_rgba(167,139,250,0.75)]">
        <div className="h-px bg-gradient-to-r from-transparent via-vn-fuchsia/50 to-transparent" />
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="relative flex min-h-[15rem] items-center justify-center rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.06] to-transparent">
            <div className="absolute inset-6 rounded-full bg-vn-fuchsia/10 blur-3xl" />
            <div className="relative text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Score vidéo</p>
              <p className="mt-2 text-6xl font-black tracking-tight text-white tabular-nums sm:text-7xl">{result.viralityScore}<span className="text-2xl text-gray-600">/100</span></p>
              <p className="mx-auto mt-4 max-w-xs text-sm font-semibold text-vn-violet">{verdict}</p>
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
            <h2 className="mt-5 text-2xl font-black tracking-tight text-white">Diagnostic rapide</h2>
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
              <div className="mt-3 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                {[
                  ['Donnees observees', result.analyzerMeta.signalDisclosure.observedData],
                  ['Hypotheses IA', result.analyzerMeta.signalDisclosure.aiHypotheses],
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
            <div className="mt-4 space-y-2.5">
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
          </div>
        </div>
      </div>

      {isFreePreview && <PremiumTeaserBand />}

      <SectionCard title="Analyse détaillée" eyebrow="Diagnostic par levier">
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
      </SectionCard>

      {isFreePreview && result.coachAnalysis?.timeline && (
        <SectionCard title="Mini timeline" eyebrow="Drop detecte">
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
        </SectionCard>
      )}

      {result.coachAnalysis && !isFreePreview && (
        <SectionCard title="Lecture coach TikTok" eyebrow={result.coachAnalysis.patternLabel}>
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
        </SectionCard>
      )}

      <SectionCard title="Reconstruction IA" eyebrow="Moteur de structure">
        {canUseReconstruction ? (
          <ReconstructionExperience
            plan={reconstructionPlan}
            scaleMode={plan === 'scale'}
          />
        ) : (
          <ReconstructionPaywallPremium plan={plan} access={result.reconstructionAccess} />
        )}
      </SectionCard>

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

      <SectionCard title="Plan d'action" eyebrow="Checklist avant remontage">
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
      </SectionCard>

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
    </section>
  );
}

interface AnalyzerV2ClientProps {
  embedded?: boolean;
}

export default function AnalyzerV2Client({ embedded = false }: AnalyzerV2ClientProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadTiktokUrl, setUploadTiktokUrl] = useState('');
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
  const planCanUseReconstruction = authUser?.plan === 'pro' || authUser?.plan === 'scale';
  const reconstructionLimit = authUser ? RECONSTRUCTION_LIMITS[authUser.plan] ?? 0 : 0;
  const reconstructionUsed = authUser?.reconstructions_count ?? 0;

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [history]
  );

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
      setError('La vidéo dépasse 200 Mo. Compresse-la ou exporte une version plus légère.');
      return;
    }
    setError('');
    setVideoFile(file);
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
            updatePipelineStep('transcript', transcript ? 'done' : 'warning', {
              signalsAvailable: transcript ? ['Transcript audio'] : [],
              warning: transcript ? undefined : 'Audio traite, mais aucun transcript fiable.',
              limitations: transcript ? [] : ['Transcript indisponible'],
            });
          } else {
            updatePipelineStep('transcript', 'warning', {
              warning: 'Transcription indisponible, analyse poursuivie avec vision/OCR.',
              limitations: ['Whisper indisponible'],
            });
          }
        } catch (tErr) {
          console.warn('[analyze] transcription failed (non-blocking):', tErr);
          updatePipelineStep('transcript', 'warning', {
            warning: 'Transcription indisponible, analyse poursuivie avec vision/OCR.',
            limitations: ['Whisper indisponible'],
          });
        }
      } else {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

      <div className={embedded ? 'relative mx-auto w-full max-w-[1120px] pb-10 pt-2' : 'relative mx-auto max-w-6xl px-4 py-8 pb-20 sm:px-6 sm:py-10'}>
        <header className={embedded ? 'mt-0' : 'mt-4'}>
          <div>
            <h1 className={embedded ? 'max-w-3xl text-[30px] font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-[38px]' : 'max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl'}>
              Analyser une vidéo <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">TikTok</span>
            </h1>
            <p className={embedded ? 'mt-3 max-w-2xl text-[14px] leading-relaxed text-slate-400 sm:text-[15px]' : 'mt-4 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg'}>
              Importe ta vidéo et reçois un diagnostic précis avec les signaux à corriger avant remontage.
            </p>
          </div>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="space-y-5">
            <SectionCard title="Importer la vidéo" eyebrow="Étape 1">
              <UploadCard
                file={videoFile}
                disabled={isLoading || isLimitReached}
                onSelect={handleFileSelect}
                onClear={() => setVideoFile(null)}
              />
              <div className="mt-4">
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                  Lien TikTok optionnel
                </label>
                <input
                  type="url"
                  value={uploadTiktokUrl}
                  onChange={(e) => setUploadTiktokUrl(e.target.value)}
                  placeholder="https://vm.tiktok.com/... ou tiktok.com/.../video/..."
                  disabled={isLoading || isLimitReached}
                  className="w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-gray-600 hover:border-white/[0.15] focus:border-vn-violet/50 focus:ring-2 focus:ring-vn-violet/10 disabled:opacity-50"
                />
              </div>
            </SectionCard>

            <div className="rounded-2xl border border-white/[0.08] bg-[#080810]/90 p-4">
              <button
                type="button"
                onClick={() => void analyzeFromUpload()}
                disabled={!canSubmit}
                className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-vn-fuchsia via-vn-violet to-vn-indigo px-5 py-4 text-sm font-black text-white shadow-[0_16px_50px_-24px_rgba(232,121,249,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? extractStatus || 'Analyse en cours...' : "Lancer le diagnostic"}
              </button>
              <p className="mt-3 text-center text-xs text-gray-600">
                {canSubmit ? 'Prêt : Viralynz détecte le format automatiquement.' : 'Sélectionne une vidéo pour lancer le diagnostic.'}
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/35 bg-red-950/35 px-4 py-3 animate-fade-in">
                <p className="text-center text-sm text-red-300">{error}</p>
              </div>
            )}

            {isLoading && <AnalysisPipelineProgress pipeline={pipelineState} />}
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

          <aside className={`space-y-4 lg:sticky ${embedded ? 'lg:top-5' : 'lg:top-6'}`}>
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

  if (embedded) {
    return (
      <section data-dashboard-analyze-section="true" className="relative min-w-0 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        {content}
      </section>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      {content}
    </main>
  );
}
