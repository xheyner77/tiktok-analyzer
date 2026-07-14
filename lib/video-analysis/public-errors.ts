const PUBLIC_ANALYSIS_FAILURES = {
  VIDEO_STREAM_MISSING: 'Le fichier ne contient aucun flux vidéo lisible.',
  VIDEO_DURATION_UNAVAILABLE: 'La durée complète de la vidéo ne peut pas être déterminée.',
  VIDEO_DURATION_EXCEEDED: 'La vidéo dépasse la durée technique autorisée; aucune analyse partielle n’a été conservée.',
  VIDEO_FILE_TOO_LARGE: 'Le fichier dépasse la taille technique autorisée; aucune analyse partielle n’a été conservée.',
  VIDEO_RESOLUTION_EXCEEDED: 'La résolution dépasse la limite technique acceptée.',
  VIDEO_FRAME_RATE_EXCEEDED: 'La cadence vidéo dépasse la limite technique acceptée.',
  VIDEO_PIXEL_RATE_EXCEEDED: 'Le débit de pixels à décoder dépasse la limite technique acceptée.',
  ANALYSIS_PRIVATE_DOWNLOAD_TOO_LARGE: 'Le fichier dépasse la limite technique annoncée.',
  ANALYSIS_UPLOAD_SIZE_MISMATCH: 'Le fichier envoyé est incomplet.',
  VIDEO_METADATA_INCOMPLETE: 'Les métadonnées indispensables de la vidéo sont illisibles.',
  VIDEO_FRAME_COVERAGE_INCOMPLETE: 'La vidéo ne peut pas être représentée intégralement sans zone aveugle.',
  ANALYSIS_QUOTA_NOT_RESERVED: 'Le quota n’a pas été réservé pour ce traitement.',
  ANALYSIS_JOB_ALREADY_FAILED: 'Ce traitement est déjà terminé en erreur.',
  ANALYSIS_JOB_ALREADY_COMPLETED: 'Cette analyse est déjà enregistrée.',
  ANALYSIS_PIPELINE_FAILED: 'L’analyse n’a pas pu être terminée. Ton quota a été restauré.',
} as const;

export type PublicAnalysisFailureCode = keyof typeof PUBLIC_ANALYSIS_FAILURES;

function codeFromUnknown(error: unknown): string {
  if (!(error instanceof Error)) return '';
  return error.message.split(':', 1)[0]?.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') ?? '';
}

export function publicAnalysisFailure(error: unknown): {
  code: PublicAnalysisFailureCode;
  message: string;
} {
  const candidate = codeFromUnknown(error) as PublicAnalysisFailureCode;
  const code = Object.hasOwn(PUBLIC_ANALYSIS_FAILURES, candidate)
    ? candidate
    : 'ANALYSIS_PIPELINE_FAILED';
  return { code, message: PUBLIC_ANALYSIS_FAILURES[code] };
}

export function serializePublicAnalysisFailure(error: unknown): string {
  const failure = publicAnalysisFailure(error);
  return `${failure.code}:${failure.message}`;
}

export function parsePublicAnalysisFailure(serialized: string): {
  code: PublicAnalysisFailureCode;
  message: string;
} {
  return publicAnalysisFailure(new Error(serialized));
}

export const PUBLIC_ANALYSIS_FAILURE_CODES = Object.freeze(Object.keys(
  PUBLIC_ANALYSIS_FAILURES,
) as PublicAnalysisFailureCode[]);
