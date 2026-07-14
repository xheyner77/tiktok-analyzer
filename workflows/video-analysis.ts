import {
  cleanupCompletedInputStep,
  failVideoAnalysisStep,
  getWorkflowDispositionStep,
  preprocessVideoStep,
  specialistAnalysisStep,
  synthesizeValidateAndPersistStep,
  timelineAnalysisStep,
  transcribeVideoStep,
  visualAnalysisStep,
} from '@/lib/video-analysis/workflow-steps';
import { serializePublicAnalysisFailure } from '@/lib/video-analysis/public-errors';

export interface VideoAnalysisWorkflowResult {
  status: 'completed' | 'failed';
  analysisId: string | null;
}

export async function runVideoAnalysisWorkflow(jobId: string): Promise<VideoAnalysisWorkflowResult> {
  'use workflow';

  const disposition = await getWorkflowDispositionStep(jobId);
  if (disposition.status === 'completed') {
    await cleanupCompletedInputStep(jobId);
    return { status: 'completed', analysisId: disposition.analysisId };
  }
  if (disposition.status === 'failed') {
    await failVideoAnalysisStep(jobId, 'ANALYSIS_RESUME_CLEANUP:Nettoyage après échec.');
    return { status: 'failed', analysisId: null };
  }

  try {
    await preprocessVideoStep(jobId);
    await transcribeVideoStep(jobId);
    await visualAnalysisStep(jobId);
    await specialistAnalysisStep(jobId);
    await timelineAnalysisStep(jobId);
    const completed = await synthesizeValidateAndPersistStep(jobId);
    await cleanupCompletedInputStep(jobId);
    return { status: 'completed', analysisId: completed.analysisId };
  } catch (error) {
    const publicFailure = serializePublicAnalysisFailure(error);
    await failVideoAnalysisStep(jobId, publicFailure);
    throw new Error(publicFailure);
  }
}
