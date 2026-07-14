import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { FinalAnalysisResult } from '@/lib/analysis-engine/index';
import { toHonestLegacyAnalysisResult } from '@/lib/video-analysis/legacy-adapter';

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

function interfaceBody(file: string, interfaceName: string): string {
  const match = file.match(new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`, 'u'));
  if (!match) throw new Error(`Interface introuvable: ${interfaceName}`);
  return match[1];
}

function minimalEngineResult(): FinalAnalysisResult {
  const availableSection = (summary: string) => ({
    status: 'available' as const,
    summary,
    strengths: ['Point observé.'],
    problems: ['Correction justifiée.'],
    recommendations: ['Action vérifiable.'],
    evidence: ['frame_start'],
    limitations: ['Aucune métrique TikTok n’est disponible.'],
  });
  const computed = (value: number) => ({
    status: 'computed' as const,
    value,
    confidence: 'high' as const,
    evidenceCoverage: 1,
    criteria: [],
    positives: [],
    negatives: [],
    limitations: [],
  });

  return {
    schemaVersion: 'video-analysis-v2',
    creatorContext: {
      objective: 'views',
      niche: 'Montage vidéo',
    },
    video: {
      fileName: 'source.mp4',
      fileSizeBytes: 2_097_152,
      durationSec: 12,
      audioTrack: { status: 'absent', verifiedBy: 'ffmpeg' },
    },
    evidence: {
      frames: [{ id: 'frame_start' }],
      transcription: {
        status: 'unavailable',
        reason: 'Aucune piste audio mesurable.',
      },
    },
    strategicSummary: {
      status: 'available',
      diagnosis: 'La preuve visuelle arrive après le contexte.',
      firstDecision: 'Avance la preuve.',
      whyNow: 'La frame horodatée justifie cette décision.',
    },
    hook: availableSection('Le hook annonce le sujet sans montrer la preuve.'),
    editing: availableSection('Le rythme éditorial peut être resserré.'),
    storytelling: availableSection('La structure place la preuve après le contexte.'),
    correctionPlan: { status: 'unavailable' },
    improvedVersion: { status: 'unavailable' },
    priorities: { status: 'unavailable' },
    timeline: [],
    scores: {
      overall: computed(77),
      hook: computed(71),
      rhythm: computed(63),
      structure: computed(68),
    },
  } as unknown as FinalAnalysisResult;
}

describe('orchestrateur durable de l’analyse vidéo', () => {
  const workflow = source('workflows/video-analysis.ts');
  const steps = source('lib/video-analysis/workflow-steps.ts');
  const visual = source('lib/video-analysis/visual-analysis.ts');
  const jobs = source('lib/video-analysis/jobs.ts');

  it('enchaîne les étapes réelles dans l’ordre et nettoie après la persistance', () => {
    const runnablePath = workflow.slice(workflow.indexOf('  try {'), workflow.indexOf('  } catch (error)'));
    const orderedCalls = [
      'preprocessVideoStep(jobId)',
      'transcribeVideoStep(jobId)',
      'visualAnalysisStep(jobId)',
      'specialistAnalysisStep(jobId)',
      'timelineAnalysisStep(jobId)',
      'synthesizeValidateAndPersistStep(jobId)',
      'cleanupCompletedInputStep(jobId)',
    ];
    const positions = orderedCalls.map((call) => runnablePath.indexOf(call));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(workflow.indexOf('getWorkflowDispositionStep(jobId)')).toBeLessThan(workflow.indexOf('  try {'));
    expect(workflow.slice(workflow.indexOf('  } catch (error)'))).toContain(
      'const publicFailure = serializePublicAnalysisFailure(error)',
    );
    expect(workflow.slice(workflow.indexOf('  } catch (error)'))).toContain(
      'failVideoAnalysisStep(jobId, publicFailure)',
    );
    expect(workflow.slice(workflow.indexOf('  } catch (error)'))).toContain('throw new Error(publicFailure)');
    expect(workflow.slice(workflow.indexOf('  } catch (error)'))).not.toContain('throw error');
  });

  it('ne transporte aucun transcript, frame, diagnostic ou résultat lourd dans les sorties de steps', () => {
    const forbiddenPayloadField = /\b(?:transcript|frames|diagnostics|timeline|engineResult|evidence)\??\s*:/u;
    const resultBodies = [
      interfaceBody(steps, 'PreprocessStepResult'),
      interfaceBody(steps, 'TranscriptionStepResult'),
      interfaceBody(visual, 'VisualAnalysisStepResult'),
      interfaceBody(steps, 'SynthesisPersistenceStepResult'),
    ];

    for (const body of resultBodies) expect(body).not.toMatch(forbiddenPayloadField);
    expect(steps).toContain("Omit<SpecialistStepResult, 'diagnostics'>");
    expect(steps).toContain('const { diagnostics: _diagnostics, ...metrics }');
    expect(steps).toContain("Omit<TimelineAnalysisStepResult, 'timeline'>");
    expect(steps).toContain('const { timeline: _timeline, ...metrics }');
    expect(interfaceBody(workflow, 'VideoAnalysisWorkflowResult')).not.toMatch(forbiddenPayloadField);
  });

  it('nettoie strictement les fichiers temporaires, les entrées privées et les artefacts d’échec', () => {
    expect(steps.match(/finally \{\s*await removeAnalysisTempDir\(tempDir\);\s*\}/gu)).toHaveLength(2);

    const failureCleanup = steps.slice(
      steps.indexOf('export async function failVideoAnalysisStep'),
      steps.indexOf('export async function cleanupCompletedInputStep'),
    );
    expect(failureCleanup).toContain('cleanupTerminalJobStorage(failedJob)');

    const completionCleanup = steps.slice(steps.indexOf('export async function cleanupCompletedInputStep'));
    expect(completionCleanup).toContain("if (job.status !== 'completed') return");
    expect(completionCleanup).toContain('cleanupTerminalJobStorage(job)');
    expect(jobs).toContain('Promise.allSettled');
    expect(jobs).toContain('removeInputObject(job, { strict: true })');
    expect(jobs).toContain("listJobArtifacts(job.id, 'audio')");
    expect(jobs).toContain('removeAllJobArtifacts(job.id)');
    expect(jobs).toContain(".update({ cleanup_pending: false })");
  });

  it('persiste une URL interne stable et force analysisId du moteur à être le jobId', () => {
    const synthesisPath = steps.slice(steps.indexOf('export async function synthesizeValidateAndPersistStep'));
    const persistenceCall = synthesisPath.match(/completeAnalysisJob\(\{[\s\S]*?\n\s*\}\);/u)?.[0] ?? '';

    expect(synthesisPath).toContain('analysisId: jobId');
    expect(persistenceCall).toContain('videoUrl: `viralynz-analysis://${jobId}`');
    expect(persistenceCall).not.toMatch(/signed|token|expires|https?:\/\//iu);
    expect(persistenceCall).toContain('engineResult');
  });

  it('utilise la mémoire uniquement avec consentement puis apprend après la persistance canonique', () => {
    const synthesisPath = steps.slice(steps.indexOf('export async function synthesizeValidateAndPersistStep'));
    const loadPosition = synthesisPath.indexOf('prepareCreatorMemory({');
    const synthesisPosition = synthesisPath.indexOf('runCritiqueAndSynthesis({');
    const completionPosition = synthesisPath.indexOf('completeAnalysisJob({');
    const learningPosition = synthesisPath.indexOf('learnCreatorMemoryV2({');

    expect(loadPosition).toBeGreaterThanOrEqual(0);
    expect(loadPosition).toBeLessThan(synthesisPosition);
    expect(synthesisPath).toContain('consent: evidence.creatorContext.memoryConsent === true');
    expect(synthesisPath).toContain('creatorMemoryContext: creatorMemory.context || undefined');
    expect(completionPosition).toBeLessThan(learningPosition);
    expect(synthesisPath.slice(learningPosition)).toContain("learningStatus = 'learn_failed'");
    expect(synthesisPath.slice(learningPosition)).toContain('recordCompletedJobMemoryOutcome({');
  });
});

describe('adaptateur legacy honnête', () => {
  it('projette uniquement les scores déterministes et qualifie la rétention comme non mesurée', () => {
    const engine = minimalEngineResult();
    const first = toHonestLegacyAnalysisResult(engine) as {
      viralityScore: number;
      structureScore: number;
      scoreSemantics: string;
      unavailableObservedStats: string[];
      retention: { score: number; analysis: string };
    };
    const second = toHonestLegacyAnalysisResult(engine);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      viralityScore: 77,
      structureScore: 68,
      scoreSemantics: 'deterministic_editorial_rubric',
    });
    expect(first.retention.score).toBe(68);
    expect(first.unavailableObservedStats).toContain('retention');
    expect(first.retention.analysis).toMatch(/score interne de structure éditoriale/iu);
    expect(first.retention.analysis).toMatch(/aucune rétention TikTok n’est mesurée/iu);
  });

  it('conserve un score indisponible comme donnée absente au lieu d’inventer un nombre', () => {
    const engine = minimalEngineResult();
    const unavailable = {
      status: 'unavailable' as const,
      reason: 'Couverture insuffisante.',
      confidence: 'low' as const,
      evidenceCoverage: 0,
      criteria: [],
      observations: ['Signal indisponible.'],
      penalties: [],
      positives: [],
    };
    engine.scores.overall = unavailable;
    engine.scores.hook = unavailable;
    engine.scores.rhythm = unavailable;
    engine.scores.structure = unavailable;
    const legacy = toHonestLegacyAnalysisResult(engine) as {
      viralityScore: number | null;
      hook: { score: number | null; rating: string };
      analyzerMeta: { analysisModeLabel: string };
    };
    expect(legacy.viralityScore).toBeNull();
    expect(legacy.hook).toMatchObject({ score: null, rating: 'Indisponible' });
    expect(legacy.analyzerMeta.analysisModeLabel).toContain('sans piste audio');
  });

  it('signale une rubrique disponible mais partielle au lieu de sur-vendre une analyse complète', () => {
    const engine = minimalEngineResult();
    (engine.hook as unknown as { criteria: Array<Record<string, unknown>> }).criteria = [{
      criterionId: 'hook_first_frame',
      status: 'unavailable',
      note: 'Signal non mesurable.',
      evidence: [],
      timeRange: null,
      confidence: 'low',
    }];

    const legacy = toHonestLegacyAnalysisResult(engine) as {
      analyzerMeta: {
        analysisCompleteness: string;
        analysisModeLabel: string;
        validationWarnings: string[];
      };
    };

    expect(legacy.analyzerMeta.analysisCompleteness).toBe('partial');
    expect(legacy.analyzerMeta.analysisModeLabel).toContain('certains signaux sont indisponibles');
    expect(legacy.analyzerMeta.validationWarnings).toContain(
      'Rubrique hook partielle : 1/1 critères indisponibles.',
    );
  });
});
