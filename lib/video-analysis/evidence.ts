import 'server-only';
import {
  AudioSignalsSchema,
  CreatorContextSchema,
  FrameEvidenceSchema,
  ObservedMetricsSchema,
  RetentionEvidenceSchema,
  TranscriptionSchema,
  VideoMetadataSchema,
  VisualSignalsSchema,
  type AudioSignals,
  type CreatorContext,
  type FrameEvidence,
  type ObservedMetrics,
  type RetentionEvidence,
  type Transcription,
  type VideoMetadata,
  type VisualSignals,
} from '@/lib/analysis-engine/index';
import type { Measurement, TimeInterval } from '@/lib/video-pipeline/types';
import type { AnalysisArtifactRow } from './artifacts';
import { TECHNICAL_EVIDENCE_IDS, transcriptFromJob } from './grounding';
import type { VisualFrameObservation } from './intermediate-schemas';
import type { AnalysisJobRow } from './types';

interface TechnicalSignalsLike {
  sceneCuts?: Measurement<Array<{ timestamp: number; score: number }>>;
  cutDensityPerMinute?: Measurement<number>;
  blackIntervals?: Measurement<TimeInterval[]>;
  freezeIntervals?: Measurement<TimeInterval[]>;
  brightness?: Measurement<{
    meanLuma: number;
    standardDeviation: number;
  }>;
  audio?: {
    silenceIntervals?: Measurement<TimeInterval[]>;
    initialSilenceDurationSec?: Measurement<number>;
    firstSpeechTimeSec?: Measurement<number>;
    meanVolumeDb?: Measurement<number>;
    peakVolumeDb?: Measurement<number>;
    loudnessSamples?: Measurement<Array<{ timestampSec: number; momentaryLufs: number }>>;
  };
}

function unavailable(reason: string, reasonCode: 'not_measurable' | 'missing_track' | 'insufficient_samples' | 'tool_error' = 'not_measurable') {
  return { status: 'unavailable' as const, reasonCode, reason };
}

function measuredNumber<Unit extends string>(input: {
  id: string;
  value: number;
  unit: Unit;
  method: string;
  evidenceRefs?: string[];
}) {
  return {
    status: 'measured' as const,
    id: input.id,
    value: input.value,
    unit: input.unit,
    method: input.method,
    evidenceRefs: input.evidenceRefs ?? [],
  };
}

function sumIntervals(intervals: TimeInterval[], durationSec: number): number {
  const normalized = intervals
    .map((interval) => ({
      start: Math.max(0, Math.min(durationSec, interval.startTimeSec)),
      end: Math.max(0, Math.min(durationSec, interval.endTimeSec)),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const interval of normalized) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.reduce((sum, interval) => sum + interval.end - interval.start, 0);
}

function distributedEvidenceRefs(values: string[], maximum = 180): string[] {
  if (values.length <= maximum) return [...new Set(values)];
  return [...new Set(Array.from({ length: maximum }, (_, index) => (
    values[Math.min(values.length - 1, Math.floor((index * values.length) / maximum))]
  )))];
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values: number[]): number | null {
  const average = mean(values);
  if (average === null) return null;
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length);
}

function lexicalTokens(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('fr-FR')
    .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? [];
}

function sentenceWordCounts(value: string): number[] {
  return value
    .split(/[.!?…]+|\n+/u)
    .map((sentence) => lexicalTokens(sentence).length)
    .filter((count) => count > 0);
}

function repeatedTrigramCount(tokens: string[]): number {
  const occurrences = new Map<string, number>();
  for (let index = 0; index <= tokens.length - 3; index += 1) {
    const trigram = tokens.slice(index, index + 3).join(' ');
    occurrences.set(trigram, (occurrences.get(trigram) ?? 0) + 1);
  }
  return [...occurrences.values()].filter((count) => count >= 2).length;
}

const HESITATION_TOKENS = new Set(['euh', 'heu', 'hum', 'hmm', 'uh', 'um', 'erm']);

function timestampInsideIntervals(timestampSec: number, intervals: TimeInterval[]): boolean {
  return intervals.some((interval) => (
    timestampSec >= interval.startTimeSec - 0.05
    && timestampSec <= interval.endTimeSec + 0.05
  ));
}

function valueOf<T>(measurement: Measurement<T> | undefined): T | null {
  return measurement?.availability === 'measured' ? measurement.value : null;
}

function mapCreatorContext(job: AnalysisJobRow): CreatorContext {
  return CreatorContextSchema.parse({
    version: 'creator-context-v1',
    ...job.creator_context,
  });
}

function mapVideoMetadata(job: AnalysisJobRow): VideoMetadata {
  if (!job.probe || typeof job.probe !== 'object') throw new Error('VIDEO_PROBE_MISSING');
  const probe = job.probe as Record<string, unknown>;
  const durationSec = Number(probe.durationSec);
  const width = Number(probe.displayWidth ?? probe.width);
  const height = Number(probe.displayHeight ?? probe.height);
  const framesPerSecond = Number(probe.fps);
  const container = typeof probe.container === 'string' ? probe.container : '';
  const videoCodec = typeof probe.videoCodec === 'string' ? probe.videoCodec : '';
  const hasAudio = probe.hasAudio === true;
  const audioCodec = typeof probe.audioCodec === 'string' ? probe.audioCodec : '';
  return VideoMetadataSchema.parse({
    version: 'video-metadata-v1',
    fileName: job.original_file_name,
    mimeType: job.content_type,
    fileSizeBytes: job.size_bytes,
    durationSec,
    width,
    height,
    framesPerSecond,
    container,
    videoCodec,
    ...(Number.isFinite(Number(probe.bitrate)) ? { bitrateBitsPerSec: Math.round(Number(probe.bitrate)) } : {}),
    audioTrack: hasAudio
      ? audioCodec
        ? { status: 'present', codec: audioCodec }
        : { status: 'unavailable', reason: 'La piste audio existe mais son codec n’a pas été identifié.' }
      : { status: 'absent', verifiedBy: 'ffmpeg' },
    probedAt: job.started_at ?? job.updated_at,
  });
}

function visualObservation(frame: AnalysisArtifactRow): VisualFrameObservation | null {
  const value = frame.metadata.visualObservation;
  if (!value || typeof value !== 'object') return null;
  return value as VisualFrameObservation;
}

function mapFrames(frames: AnalysisArtifactRow[]): FrameEvidence[] {
  return frames.map((frame) => {
    const observation = visualObservation(frame);
    const text = observation?.onScreenText.status === 'observed'
      ? observation.onScreenText.text.trim()
      : '';
    const ocr = text
      ? {
          status: 'observed' as const,
          text,
          confidence: observation?.confidence ?? 'low',
          method: 'Vision multimodale sur frame horodatée',
        }
      : {
          status: 'unavailable' as const,
          reason: observation
            ? 'Aucun texte suffisamment lisible n’a été observé sur cette frame.'
            : 'Observation visuelle indisponible.',
        };
    return FrameEvidenceSchema.parse({
      id: frame.id,
      timestampSec: Number(frame.start_time),
      artifactRef: `artifact:${frame.id}`,
      width: Number(frame.metadata.width),
      height: Number(frame.metadata.height),
      samplingReason: frame.metadata.samplingReason,
      ocr,
    });
  });
}

function mapTranscription(job: AnalysisJobRow): Transcription {
  return TranscriptionSchema.parse(job.transcript ?? {
    status: 'unavailable',
    reasonCode: job.source_metadata.hasAudio === true ? 'provider_error' : 'no_audio_track',
    reason: job.source_metadata.hasAudio === true
      ? 'La transcription n’a pas pu être produite.'
      : 'Aucune piste audio n’est présente.',
  });
}

function mapAudioSignals(job: AnalysisJobRow): AudioSignals {
  const duration = Number(job.source_metadata.durationSeconds);
  const technical = (job.technical_signals ?? {}) as TechnicalSignalsLike;
  const audio = technical.audio ?? {};
  const silenceIntervals = valueOf(audio.silenceIntervals);
  const meanVolume = valueOf(audio.meanVolumeDb);
  const peakVolume = valueOf(audio.peakVolumeDb);
  const initialSilenceDurationSec = valueOf(audio.initialSilenceDurationSec);
  const transcript = transcriptFromJob(job);
  const firstSpeechTimeSec = transcript.status === 'available'
    ? transcript.segments[0]?.startSec ?? null
    : valueOf(audio.firstSpeechTimeSec);
  const firstSpeechEvidence = transcript.status === 'available'
    ? transcript.segments[0]?.id
    : undefined;
  const loudnessSamples = valueOf(audio.loudnessSamples);
  const speechIntervals: TimeInterval[] = transcript.segments.map((segment) => ({
    startTimeSec: segment.startSec,
    endTimeSec: segment.endSec,
    durationSec: Math.max(0, segment.endSec - segment.startSec),
  }));
  const pauses = transcript.words.slice(1).flatMap((word, index) => {
    const previous = transcript.words[index];
    const gap = word.startSec - previous.endSec;
    return gap >= 0.4
      ? [{ id: `pause-${index + 1}`, startSec: previous.endSec, endSec: word.startSec }]
      : [];
  });
  const finiteLoudnessSamples = (loudnessSamples ?? []).filter((sample) => (
    Number.isFinite(sample.timestampSec) && Number.isFinite(sample.momentaryLufs)
  ));
  const speechLoudnessValues = finiteLoudnessSamples
    .filter((sample) => timestampInsideIntervals(sample.timestampSec, speechIntervals))
    .map((sample) => sample.momentaryLufs);
  const nonSpeechLoudnessValues = finiteLoudnessSamples
    .filter((sample) => !timestampInsideIntervals(sample.timestampSec, speechIntervals))
    .map((sample) => sample.momentaryLufs);
  const speechLoudnessVariation = speechLoudnessValues.length >= 3
    ? standardDeviation(speechLoudnessValues)
    : null;
  const nonSpeechLoudness = nonSpeechLoudnessValues.length >= 3
    ? mean(nonSpeechLoudnessValues)
    : null;
  const transcriptEvidenceRefs = distributedEvidenceRefs(
    transcript.segments.map((segment) => segment.id),
  );
  const timedWordTokens = transcript.words.flatMap((word) => lexicalTokens(word.text));
  const normalizedTextTokens = lexicalTokens(transcript.text);
  const transcriptTokens = normalizedTextTokens.length ? normalizedTextTokens : timedWordTokens;
  const speechDurationSec = sumIntervals(speechIntervals, duration);
  const sentenceLengths = sentenceWordCounts(transcript.text);
  const averageSentenceLength = mean(sentenceLengths);
  const linguisticEvidenceRefs = distributedEvidenceRefs(
    transcript.words.length
      ? transcript.words.map((word) => word.id)
      : transcript.segments.map((segment) => segment.id),
  );
  const canMeasureLinguistics = transcript.status === 'available' && transcriptTokens.length > 0;

  return AudioSignalsSchema.parse({
    version: 'audio-signals-v1',
    integratedLoudness: unavailable('Le pipeline mesure le loudness momentané, pas le LUFS intégré.'),
    truePeak: unavailable('volumedetect ne fournit pas une mesure true peak dBTP calibrée.'),
    meanVolumeDb: meanVolume === null
      ? unavailable('Volume moyen non mesurable.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.meanVolume,
          value: meanVolume,
          unit: 'dBFS',
          method: 'FFmpeg volumedetect mean_volume',
        }),
    peakVolumeDb: peakVolume === null
      ? unavailable('Pic de volume non mesurable.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.peakVolume,
          value: peakVolume,
          unit: 'dBFS',
          method: 'FFmpeg volumedetect max_volume',
        }),
    silenceRatio: silenceIntervals === null
      ? unavailable('Zones silencieuses non mesurables.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.silence,
          value: Math.max(0, Math.min(1, sumIntervals(silenceIntervals, duration) / duration)),
          unit: 'ratio',
          method: 'Somme des intervalles FFmpeg silencedetect / durée FFmpeg',
        }),
    speechRatio: transcript.status === 'available' && transcript.segments.length
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.speechRatio,
          value: Math.max(0, Math.min(1, sumIntervals(speechIntervals, duration) / duration)),
          unit: 'ratio',
          method: 'Somme des segments de transcription horodatés / durée FFmpeg',
          evidenceRefs: transcript.segments.map((segment) => segment.id),
        })
      : unavailable('Aucun segment de parole horodaté exploitable.', 'insufficient_samples'),
    speakingRateWpm: canMeasureLinguistics && speechDurationSec > 0
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.speakingRate,
          value: Number(((transcriptTokens.length / speechDurationSec) * 60).toFixed(2)),
          unit: 'words_per_minute',
          method: 'Nombre de mots transcrits / durée cumulée des segments parlés horodatés',
          evidenceRefs: linguisticEvidenceRefs,
        })
      : unavailable('Le débit verbal exige des mots et des segments parlés horodatés.', 'insufficient_samples'),
    averageSentenceLengthWords: canMeasureLinguistics && averageSentenceLength !== null
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.averageSentenceLength,
          value: Number(averageSentenceLength.toFixed(2)),
          unit: 'words',
          method: 'Moyenne des mots entre ponctuations de fin de phrase dans la transcription normalisée',
          evidenceRefs: linguisticEvidenceRefs,
        })
      : unavailable('La transcription ne contient aucune phrase mesurable.', 'insufficient_samples'),
    wordDensityPerSecond: canMeasureLinguistics && Number.isFinite(duration) && duration > 0
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.wordDensity,
          value: Number((transcriptTokens.length / duration).toFixed(3)),
          unit: 'words_per_second',
          method: 'Nombre de mots transcrits / durée totale FFmpeg de la vidéo',
          evidenceRefs: linguisticEvidenceRefs,
        })
      : unavailable('La densité de mots exige une transcription et une durée vidéo valides.', 'insufficient_samples'),
    repeatedPhraseCount: canMeasureLinguistics
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.repeatedPhrases,
          value: repeatedTrigramCount(transcriptTokens),
          unit: 'count',
          method: 'Nombre de trigrammes normalisés distincts apparaissant au moins deux fois dans la transcription',
          evidenceRefs: linguisticEvidenceRefs,
        })
      : unavailable('La transcription ne contient pas assez de mots pour mesurer les répétitions.', 'insufficient_samples'),
    hesitationCount: canMeasureLinguistics
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.hesitations,
          value: transcriptTokens.filter((token) => HESITATION_TOKENS.has(token)).length,
          unit: 'count',
          method: 'Comptage exact d’une liste conservatrice d’hésitations vocalisées dans la transcription',
          evidenceRefs: linguisticEvidenceRefs,
        })
      : unavailable('Aucune transcription exploitable pour compter les hésitations.', 'insufficient_samples'),
    pauseIntervals: transcript.words.length > 1
      ? {
          status: 'measured',
          id: TECHNICAL_EVIDENCE_IDS.pauses,
          value: pauses,
          unit: 'seconds',
          method: 'Écarts de 400 ms ou plus entre mots horodatés',
          evidenceRefs: transcript.words.map((word) => word.id),
        }
      : unavailable('Timestamps mot à mot insuffisants pour mesurer les pauses.', 'insufficient_samples'),
    voiceMusicBalance: unavailable('Aucune séparation de sources voix/musique fiable n’est exécutée.'),
    initialSilenceDurationSec: initialSilenceDurationSec === null
      ? unavailable('La durée du silence initial n’a pas pu être mesurée.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.initialSilence,
          value: initialSilenceDurationSec,
          unit: 'seconds',
          method: 'FFmpeg silencedetect depuis le début de la piste',
        }),
    firstSpeechTimeSec: firstSpeechTimeSec === null
      ? unavailable('Le début de la parole ne peut pas être confirmé.', job.source_metadata.hasAudio ? 'insufficient_samples' : 'missing_track')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.firstSpeech,
          value: firstSpeechTimeSec,
          unit: 'seconds',
          method: firstSpeechEvidence
            ? 'Début du premier segment de transcription horodaté'
            : 'Détecteur de parole configuré',
          evidenceRefs: firstSpeechEvidence ? [firstSpeechEvidence] : [],
        }),
    loudnessTimeline: loudnessSamples?.length
      ? {
          status: 'measured',
          id: TECHNICAL_EVIDENCE_IDS.loudness,
          value: loudnessSamples,
          unit: 'LUFS_momentary',
          method: 'FFmpeg ebur128, loudness momentanée horodatée',
          evidenceRefs: [],
      }
      : unavailable('La variation de loudness horodatée n’est pas disponible.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track'),
    speechWindowLoudnessVariation: speechLoudnessVariation === null
      ? unavailable('Moins de trois mesures de loudness ne permettent pas de mesurer la variation pendant les plages parlées.', 'insufficient_samples')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.speechLoudnessVariation,
          value: Number(speechLoudnessVariation.toFixed(3)),
          unit: 'LUFS_stddev',
          method: 'Écart-type de la loudness momentanée du mix dans les segments transcrits; la musique peut contribuer',
          evidenceRefs: [TECHNICAL_EVIDENCE_IDS.loudness, ...transcriptEvidenceRefs],
        }),
    nonSpeechLoudness: nonSpeechLoudness === null
      ? unavailable('Moins de trois mesures hors parole transcrite ne permettent pas d’estimer le niveau du mix restant.', 'insufficient_samples')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.nonSpeechLoudness,
          value: Number(nonSpeechLoudness.toFixed(3)),
          unit: 'LUFS_momentary_mean',
          method: 'Moyenne de loudness du mix hors segments transcrits; peut inclure musique, ambiance ou parole non transcrite',
          evidenceRefs: [TECHNICAL_EVIDENCE_IDS.loudness, ...transcriptEvidenceRefs],
        }),
    saturationRisk: peakVolume === null
      ? unavailable('Le pic numérique n’est pas disponible.', job.source_metadata.hasAudio ? 'tool_error' : 'missing_track')
      : {
          status: 'measured',
          id: TECHNICAL_EVIDENCE_IDS.saturationRisk,
          value: peakVolume >= -0.5 ? 'possible' : 'not_observed',
          unit: 'classification',
          method: 'Risque de clipping numérique si le pic FFmpeg est supérieur ou égal à -0,5 dBFS; ne prouve pas une saturation audible',
          evidenceRefs: [TECHNICAL_EVIDENCE_IDS.peakVolume],
        },
    backgroundNoise: nonSpeechLoudness === null
      ? unavailable('Le niveau hors parole transcrite est insuffisant; aucun profil de bruit calibré n’est inventé.', 'insufficient_samples')
      : {
          status: 'measured',
          id: TECHNICAL_EVIDENCE_IDS.backgroundNoise,
          value: nonSpeechLoudness >= -35 ? 'possible' : 'not_observed',
          unit: 'classification',
          method: 'Risque fondé sur le niveau du mix hors parole; possible peut désigner musique ou ambiance, pas un bruit confirmé',
          evidenceRefs: [TECHNICAL_EVIDENCE_IDS.nonSpeechLoudness, ...transcriptEvidenceRefs],
        },
    vocalEnergyVariation: speechLoudnessVariation === null
      ? unavailable('La variation d’énergie pendant les plages parlées est insuffisamment échantillonnée.', 'insufficient_samples')
      : {
          status: 'measured',
          id: TECHNICAL_EVIDENCE_IDS.vocalEnergyVariation,
          value: speechLoudnessVariation >= 3 ? 'observed' : speechLoudnessVariation >= 1.2 ? 'possible' : 'not_observed',
          unit: 'classification',
          method: 'Variation de loudness du mix alignée aux segments transcrits; ne sépare pas la voix de la musique',
          evidenceRefs: [TECHNICAL_EVIDENCE_IDS.speechLoudnessVariation, ...transcriptEvidenceRefs],
        },
  });
}

function intervalRatio(intervals: TimeInterval[] | null, duration: number): number | null {
  return intervals === null ? null : Math.max(0, Math.min(1, sumIntervals(intervals, duration) / duration));
}

function mapVisualSignals(job: AnalysisJobRow, frames: AnalysisArtifactRow[]): VisualSignals {
  const duration = Number(job.source_metadata.durationSeconds);
  const technical = (job.technical_signals ?? {}) as TechnicalSignalsLike;
  const scenes = valueOf(technical.sceneCuts);
  const cutsPerMinute = valueOf(technical.cutDensityPerMinute);
  const blackRatio = intervalRatio(valueOf(technical.blackIntervals), duration);
  const freezeRatio = intervalRatio(valueOf(technical.freezeIntervals), duration);
  const brightness = valueOf(technical.brightness);
  const framesWithText = frames.filter((frame) => {
    const observation = visualObservation(frame);
    return observation?.onScreenText.status === 'observed' && Boolean(observation.onScreenText.text.trim());
  });

  return VisualSignalsSchema.parse({
    version: 'visual-signals-v1',
    averageLuma: brightness
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.averageLuma,
          value: brightness.meanLuma,
          unit: 'YAVG',
          method: 'FFmpeg signalstats YAVG à 2 Hz',
        })
      : unavailable('Luminosité moyenne indisponible.', 'tool_error'),
    brightnessVariation: brightness
      ? measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.brightnessVariation,
          value: brightness.standardDeviation,
          unit: 'YAVG_stddev',
          method: 'Écart-type des échantillons FFmpeg signalstats YAVG à 2 Hz',
        })
      : unavailable('Variation de luminosité indisponible.', 'tool_error'),
    blackFrameRatio: blackRatio === null
      ? unavailable('Intervalles noirs indisponibles.', 'tool_error')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.blackFrames,
          value: blackRatio,
          unit: 'ratio',
          method: 'Durée FFmpeg blackdetect / durée FFmpeg',
        }),
    freezeRatio: freezeRatio === null
      ? unavailable('Intervalles figés indisponibles.', 'tool_error')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.freezes,
          value: freezeRatio,
          unit: 'ratio',
          method: 'Durée FFmpeg freezedetect / durée FFmpeg',
        }),
    sceneCutCount: scenes === null
      ? unavailable('Changements de scène indisponibles.', 'tool_error')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.sceneCutCount,
          value: scenes.length,
          unit: 'count',
          method: 'FFmpeg scene score > 0,28',
        }),
    cutsPerMinute: cutsPerMinute === null
      ? unavailable('Densité de cuts indisponible.', 'tool_error')
      : measuredNumber({
          id: TECHNICAL_EVIDENCE_IDS.cutsPerMinute,
          value: cutsPerMinute,
          unit: 'count_per_minute',
          method: 'Changements de scène FFmpeg / durée FFmpeg',
        }),
    motionIntensity: unavailable('Aucun optical flow calibré n’est exécuté.'),
    textCoverageRatio: frames.length
      ? measuredNumber({
          id: 'signal-visual-text-sampled',
          value: framesWithText.length / frames.length,
          unit: 'ratio',
          method: 'Frames échantillonnées où la vision observe du texte lisible / frames analysées',
          evidenceRefs: framesWithText.map((frame) => frame.id),
        })
      : unavailable('Aucune frame analysée.', 'insufficient_samples'),
    facePresenceRatio: unavailable('Aucun détecteur de visage calibré n’est exécuté.'),
  });
}

export interface DeterministicEvidenceBundle {
  creatorContext: CreatorContext;
  video: VideoMetadata;
  frames: FrameEvidence[];
  transcription: Transcription;
  audioSignals: AudioSignals;
  visualSignals: VisualSignals;
  observedMetrics: ObservedMetrics;
  retention: RetentionEvidence;
}

export function buildDeterministicEvidence(
  job: AnalysisJobRow,
  frames: AnalysisArtifactRow[],
): DeterministicEvidenceBundle {
  return {
    creatorContext: mapCreatorContext(job),
    video: mapVideoMetadata(job),
    frames: mapFrames(frames),
    transcription: mapTranscription(job),
    audioSignals: mapAudioSignals(job),
    visualSignals: mapVisualSignals(job, frames),
    observedMetrics: ObservedMetricsSchema.parse({
      status: 'unavailable',
      reason: 'Aucune métrique TikTok vérifiée n’est attachée à cet upload.',
    }),
    retention: RetentionEvidenceSchema.parse({
      status: 'unavailable',
      reason: 'Aucune courbe de rétention TikTok réelle n’est disponible pour cet upload.',
    }),
  };
}
