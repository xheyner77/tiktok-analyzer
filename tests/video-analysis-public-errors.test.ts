import { describe, expect, it } from 'vitest';
import {
  parsePublicAnalysisFailure,
  serializePublicAnalysisFailure,
} from '@/lib/video-analysis/public-errors';

describe('erreurs publiques du workflow vidéo', () => {
  it('ne sérialise jamais le message brut d’un fournisseur', () => {
    const serialized = serializePublicAnalysisFailure(
      new Error('OPENAI_TIMEOUT:sk-live-secret transcript utilisateur réponse fournisseur'),
    );
    expect(serialized).toBe(
      'ANALYSIS_PIPELINE_FAILED:L’analyse n’a pas pu être terminée. Ton quota a été restauré.',
    );
    expect(serialized).not.toMatch(/sk-live|transcript|fournisseur/iu);
  });

  it('conserve un code limite connu avec un message canonique', () => {
    const serialized = serializePublicAnalysisFailure(
      new Error('VIDEO_DURATION_EXCEEDED:durée privée 9876 secondes'),
    );
    expect(serialized).toContain('VIDEO_DURATION_EXCEEDED:');
    expect(serialized).not.toContain('9876');
  });

  it('refuse aussi un payload sérialisé forgé', () => {
    expect(parsePublicAnalysisFailure('FATALERROR:clé et détails internes')).toEqual({
      code: 'ANALYSIS_PIPELINE_FAILED',
      message: 'L’analyse n’a pas pu être terminée. Ton quota a été restauré.',
    });
  });
});
