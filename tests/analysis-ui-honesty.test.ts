import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('analysis UI honesty', () => {
  const analyzer = source('components/analyzer/AnalyzerV2Client.tsx');
  const detailPage = source('app/analyses/[id]/page.tsx');
  const detailData = source('lib/analysis-detail-data.ts');

  it('envoie le contexte createur strict attendu par les jobs asynchrones', () => {
    expect(analyzer).toContain('buildCreatorContextPayload(objective, creatorContext)');
    expect(analyzer).toContain('objectiveLabel: getObjectiveLabel(objective)');
    expect(analyzer).toContain('audienceKnowledge: context.audienceKnowledge');
    expect(analyzer).toContain('format: context.format');
    expect(analyzer).toContain('memoryConsent: context.memoryConsent');
    expect(analyzer).toContain("context.platform !== 'other' || context.platformDetails.trim().length >= 2");
    expect(analyzer).toContain("context.format !== 'other' || context.formatDetails.trim().length >= 2");
    expect(analyzer).toContain('creatorContext,');
  });

  it('utilise le flux fichier durable avec upload Supabase signe et polling serveur', () => {
    expect(analyzer).toContain("fetch('/api/analysis-jobs'");
    expect(analyzer).toContain('.uploadToSignedUrl(initialized.upload.path, initialized.upload.token, currentFile');
    expect(analyzer).toContain("fetch(`/api/analysis-jobs/${encodeURIComponent(currentJob.id)}/start`");
    expect(analyzer).toContain("fetch(`/api/analysis-jobs/${encodeURIComponent(jobId)}`");
    expect(analyzer).toContain('waitForPollingInterval(signal, 2000)');
    expect(analyzer).toContain("router.push(`/analyses/${encodeURIComponent(terminalJob.analysisId)}`)");
    expect(analyzer).toContain('pollAbortRef.current?.abort()');
    expect(analyzer).toContain('let queuedRecoveryAttempted = false');
    expect(analyzer).toContain('Date.now() - updatedAtMs >= 120_000');
    expect(analyzer).toContain('if (queuedLeaseIsStale && !queuedRecoveryAttempted)');
    expect(analyzer).toContain('resumeFailure.retryUpload === true');
  });

  it('borne les fichiers a 250 Mio et ne simule pas leur traitement dans le navigateur', () => {
    expect(analyzer).toContain('const MAX_UPLOAD_BYTES = 250 * 1024 * 1024');
    expect(analyzer).not.toContain('max 500 Mo');
    expect(analyzer).not.toContain('Max 500 Mo');
    expect(analyzer).not.toContain('extractVideoFramesFromFile');
    expect(analyzer).not.toContain('extractAudioFromVideo');
    expect(analyzer).not.toContain('durationMs:');
    expect(analyzer.match(/setTimeout/g)).toHaveLength(1);
    expect(analyzer).toContain('Cette progression vient du job serveur.');
  });

  it('envoie un code langue ISO et mappe les statuts reels du serveur', () => {
    const languageSelect = analyzer.match(/<select value=\{context\.language\}[\s\S]*?<\/select>/)?.[0] ?? '';
    expect(analyzer).toContain("type ContentLanguage = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar'");
    expect(languageSelect).not.toContain('value="other"');
    expect(languageSelect).toContain('value="ar"');
    expect(analyzer).toContain('const jobStatusLabels: Record<AnalysisJobStatus, string>');
    expect(analyzer).toContain("segment_analysis: 'Analyse des segments'");
    expect(analyzer).toContain('Number.isFinite(job.progress)');
  });

  it('preserve le flux TikTok separe et annonce sa limite metadata', () => {
    expect(analyzer).toContain("fetch('/api/analyze'");
    expect(analyzer).toContain('Cette source exploite seulement les métadonnées TikTok disponibles.');
    expect(analyzer).toContain('Importe le fichier pour une analyse complète.');
  });

  it('ne simule ni progression temporelle ni gain apres correction', () => {
    expect(analyzer).not.toContain('potentialAfterCorrection');
    expect(analyzer).not.toContain('estimatedGain');
    expect(analyzer).not.toContain('smoothedPipelineProgress');
    expect(analyzer).not.toContain('analysisReassuranceMessages');
    expect(analyzer).toContain("Aucun gain futur n'est affiché sans mesure après republication.");
  });

  it('ne remplace jamais un sous-score absent par le score global', () => {
    expect(detailPage).not.toContain('analysis.diagnostics[0]?.score ?? analysis.score');
    expect(detailPage).not.toContain('analysis.diagnostics[3]?.score ?? analysis.score');
    expect(detailPage).not.toContain('analysis.diagnostics[4]?.score ?? analysis.score');
    expect(detailData).not.toContain('subScores?.tension ?? subScores?.rewatchPotential');
  });

  it('distingue source, format et niche sans inference de secours', () => {
    expect(detailPage).toContain('value={analysis.formatLabel}');
    expect(detailData).toContain("return 'Source non renseignée'");
    expect(detailData).not.toContain('result?.detectedVideoMeta?.authorUsername) ??');
    expect(detailPage).toContain('Carte des risques éditoriaux');
  });
});
