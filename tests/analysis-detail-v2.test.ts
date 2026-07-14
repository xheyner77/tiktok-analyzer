import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANALYSIS_SECTION_CRITERIA } from '@/lib/analysis-engine/schemas';

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('détail d’analyse V2 protégé et honnête', () => {
  const detailData = source('lib/analysis-detail-data.ts');
  const detailPage = source('app/analyses/[id]/page.tsx');

  it('charge engine_result uniquement pour le propriétaire de l’analyse', () => {
    const query = detailData.slice(
      detailData.indexOf(".from('analyses')"),
      detailData.indexOf('const parsedEngine'),
    );

    expect(query).toContain(".select('id, user_id, video_url, result, engine_result, created_at')");
    expect(query).toContain(".eq('id', id)");
    expect(query).toContain(".eq('user_id', session.userId)");
    expect(query).toContain('if (row.user_id !== session.userId)');
    expect(detailData).toContain('FinalAnalysisResultSchema.safeParse(row.engine_result)');
  });

  it('retrouve le job par analysis_id et signe les frames pour quinze minutes seulement', () => {
    const evidenceQuery = detailData.slice(
      detailData.indexOf(".from('analysis_jobs')"),
      detailData.indexOf("console.warn('[analysis-detail]"),
    );

    expect(evidenceQuery).toContain(".select('id, user_id')");
    expect(evidenceQuery).toContain(".eq('analysis_id', row.id)");
    expect(evidenceQuery).toContain(".eq('user_id', session.userId)");
    expect(evidenceQuery).toContain('jobUserId === session.userId');
    expect(evidenceQuery).toContain("listJobArtifacts(jobId, 'frame')");
    expect(evidenceQuery).toContain('createArtifactSignedUrls(artifacts, 15 * 60)');
  });

  it('affiche une carte éditoriale sans prétendre mesurer une courbe de rétention', () => {
    expect(detailPage).toContain('Carte des risques éditoriaux');
    expect(detailPage).toContain('Ce n’est pas une courbe de rétention mesurée.');
    expect(detailPage).toContain('Viralynz n’invente pas de moment de drop.');
    expect(detailData).toContain("retention: 'Resserrer les risques éditoriaux'");
    expect(detailData).toContain('pas une prédiction de vues ni une courbe de rétention TikTok');
    expect(detailData).toContain("canShowRealBenchmark: false");
    expect(detailData).toContain("includeInRealAggregates: false");
  });

  it('mappe et restitue les 8 rubriques et les 78 critères V2 sans objet brut', () => {
    const criteria = Object.values(ANALYSIS_SECTION_CRITERIA).flat();

    expect(Object.keys(ANALYSIS_SECTION_CRITERIA)).toHaveLength(8);
    expect(criteria).toHaveLength(78);
    for (const criterionId of criteria) {
      expect(detailData).toContain(`'${criterionId}'`);
    }

    expect(detailData).toContain('buildEngineAnalysisSections(engine)');
    expect(detailData).toContain('buildUnavailableAnalysisSections(');
    expect(detailData).toContain('readableEvidence(reference, evidenceLabels)');
    expect(detailPage).toContain('8 rubriques, 78 critères, aucune case inventée');
    expect(detailPage).toContain('section.criteria.map((criterion)');
    expect(detailPage).toContain('<CriterionCard key={criterion.criterionId} criterion={criterion} />');
    expect(detailPage).not.toContain('[object Object]');
  });

  it('ne transforme pas une analyse V2 partielle en analyse complète', () => {
    expect(detailData).toContain("const isComplete = engine.video.audioTrack.status === 'present'");
    expect(detailData).toContain("&& engine.evidence.transcription.status === 'available'");
    expect(detailData).toContain('&& unavailableSignalCount === 0');
    expect(detailData).toContain("level: isComplete ? 'real' : 'partial'");
    expect(detailData).toContain('Aucun signal manquant n’est remplacé par une donnée inventée.');
    expect(detailPage).toContain('{analysis.transparency.label}');
    expect(detailPage).not.toContain("analysis.transparency.level === 'real' ? 'Analyse complète'");
  });
});
