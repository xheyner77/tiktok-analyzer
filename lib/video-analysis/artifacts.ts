import 'server-only';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { supabase } from '@/lib/supabase';
import { isOwnedArtifactStorageLocation } from './job-guards';
import type { AnalysisJobRow } from './types';

export interface AnalysisArtifactRow {
  id: string;
  job_id: string;
  user_id: string;
  kind: 'frame' | 'ocr' | 'audio' | 'report';
  storage_bucket: string | null;
  storage_path: string | null;
  start_time: number;
  end_time: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ARTIFACT_COLUMNS = [
  'id',
  'job_id',
  'user_id',
  'kind',
  'storage_bucket',
  'storage_path',
  'start_time',
  'end_time',
  'metadata',
  'created_at',
].join(', ');

const ARTIFACT_KINDS = new Set<AnalysisArtifactRow['kind']>(['frame', 'ocr', 'audio', 'report']);

function asArtifactRow(value: unknown): AnalysisArtifactRow {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ANALYSIS_ARTIFACT_INVALID');
  }
  const row = value as Record<string, unknown>;
  const startTime = Number(row.start_time);
  const endTime = Number(row.end_time);
  if (
    typeof row.id !== 'string'
    || typeof row.job_id !== 'string'
    || typeof row.user_id !== 'string'
    || typeof row.kind !== 'string'
    || !ARTIFACT_KINDS.has(row.kind as AnalysisArtifactRow['kind'])
    || (row.storage_bucket !== null && typeof row.storage_bucket !== 'string')
    || (row.storage_path !== null && typeof row.storage_path !== 'string')
    || !Number.isFinite(startTime)
    || !Number.isFinite(endTime)
    || endTime < startTime
    || !row.metadata
    || typeof row.metadata !== 'object'
    || Array.isArray(row.metadata)
    || typeof row.created_at !== 'string'
  ) {
    throw new Error('ANALYSIS_ARTIFACT_INVALID');
  }
  return {
    id: row.id,
    job_id: row.job_id,
    user_id: row.user_id,
    kind: row.kind as AnalysisArtifactRow['kind'],
    storage_bucket: row.storage_bucket as string | null,
    storage_path: row.storage_path as string | null,
    start_time: startTime,
    end_time: endTime,
    metadata: row.metadata as Record<string, unknown>,
    created_at: row.created_at,
  };
}

export async function persistFrameArtifacts(input: {
  job: AnalysisJobRow;
  frames: Array<{
    filePath?: string;
    dataBase64?: string;
    timestampSeconds: number;
    width: number;
    height: number;
    reason: string;
  }>;
}): Promise<AnalysisArtifactRow[]> {
  const bucket = 'analysis-evidence';
  const persisted: AnalysisArtifactRow[] = [];
  const uploadedPaths: string[] = [];

  try {
    for (const frame of input.frames) {
      if (
        !Number.isFinite(frame.timestampSeconds)
        || frame.timestampSeconds < 0
        || !Number.isInteger(frame.width)
        || frame.width <= 0
        || !Number.isInteger(frame.height)
        || frame.height <= 0
      ) {
        throw new Error('ANALYSIS_FRAME_METADATA_INVALID');
      }
      const id = randomUUID();
      const path = `${input.job.user_id}/${input.job.id}/frames/${id}.jpg`;
      const contents = frame.dataBase64
        ? Buffer.from(frame.dataBase64, 'base64')
        : frame.filePath
          ? await readFile(frame.filePath)
          : null;
      if (!contents?.byteLength) throw new Error('ANALYSIS_FRAME_EMPTY');
      const uploaded = await supabase.storage.from(bucket).upload(path, contents, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });
      if (uploaded.error) throw new Error('ANALYSIS_FRAME_UPLOAD_FAILED');
      uploadedPaths.push(path);

      const row = {
        id,
        job_id: input.job.id,
        user_id: input.job.user_id,
        kind: 'frame' as const,
        storage_bucket: bucket,
        storage_path: path,
        start_time: frame.timestampSeconds,
        end_time: frame.timestampSeconds,
        metadata: {
          width: frame.width,
          height: frame.height,
          samplingReason: frame.reason,
          ...(frame.filePath ? { sourceName: basename(frame.filePath) } : {}),
        },
      };
      const inserted = await supabase
        .from('analysis_artifacts')
        .insert(row)
        .select(ARTIFACT_COLUMNS)
        .single();
      if (inserted.error || !inserted.data) throw new Error('ANALYSIS_FRAME_RECORD_FAILED');
      persisted.push(asArtifactRow(inserted.data));
    }
    return persisted;
  } catch (error) {
    if (uploadedPaths.length) await supabase.storage.from(bucket).remove(uploadedPaths);
    if (persisted.length) {
      await supabase.from('analysis_artifacts').delete().in('id', persisted.map((row) => row.id));
    }
    throw error;
  }
}

export async function persistTemporaryAudioArtifact(input: {
  job: AnalysisJobRow;
  filePath: string;
  durationSeconds: number;
  contentType?: 'audio/mpeg' | 'audio/wav';
}): Promise<AnalysisArtifactRow> {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
    throw new Error('ANALYSIS_AUDIO_DURATION_INVALID');
  }
  const id = randomUUID();
  const bucket = 'analysis-evidence';
  const contentType = input.contentType ?? 'audio/wav';
  const extension = contentType === 'audio/mpeg' ? 'mp3' : 'wav';
  const path = `${input.job.user_id}/${input.job.id}/audio/${id}.${extension}`;
  const contents = await readFile(input.filePath);
  const uploaded = await supabase.storage.from(bucket).upload(path, contents, {
    contentType,
    cacheControl: '300',
    upsert: false,
  });
  if (uploaded.error) throw new Error('ANALYSIS_AUDIO_UPLOAD_FAILED');

  const inserted = await supabase
    .from('analysis_artifacts')
    .insert({
      id,
      job_id: input.job.id,
      user_id: input.job.user_id,
      kind: 'audio',
      storage_bucket: bucket,
      storage_path: path,
      start_time: 0,
      end_time: input.durationSeconds,
      metadata: { temporary: true, sizeBytes: contents.byteLength },
    })
    .select(ARTIFACT_COLUMNS)
    .single();
  if (inserted.error || !inserted.data) {
    await supabase.storage.from(bucket).remove([path]);
    throw new Error('ANALYSIS_AUDIO_RECORD_FAILED');
  }
  return asArtifactRow(inserted.data);
}

export async function listJobArtifacts(
  jobId: string,
  kind?: AnalysisArtifactRow['kind'],
): Promise<AnalysisArtifactRow[]> {
  let query = supabase
    .from('analysis_artifacts')
    .select(ARTIFACT_COLUMNS)
    .eq('job_id', jobId)
    .order('start_time', { ascending: true });
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query;
  if (error) throw new Error('ANALYSIS_ARTIFACT_READ_FAILED');
  return (data ?? []).map(asArtifactRow);
}

export async function createArtifactSignedUrls(
  artifacts: AnalysisArtifactRow[],
  expiresIn = 600,
): Promise<Map<string, string>> {
  const ttl = Math.max(60, Math.min(900, Math.round(expiresIn)));
  const result = new Map<string, string>();
  const groups = new Map<string, AnalysisArtifactRow[]>();
  for (const artifact of artifacts) {
    if (!artifact.storage_bucket || !artifact.storage_path) continue;
    if (!isOwnedArtifactStorageLocation({
      userId: artifact.user_id,
      jobId: artifact.job_id,
      bucket: artifact.storage_bucket,
      path: artifact.storage_path,
    })) {
      throw new Error('ANALYSIS_ARTIFACT_LOCATION_INVALID');
    }
    const rows = groups.get(artifact.storage_bucket) ?? [];
    rows.push(artifact);
    groups.set(artifact.storage_bucket, rows);
  }

  for (const [bucket, rows] of groups) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(rows.map((row) => row.storage_path as string), ttl);
    if (error || !data) throw new Error('ANALYSIS_ARTIFACT_URL_FAILED');
    data.forEach((signed, index) => {
      if (signed.signedUrl) result.set(rows[index].id, signed.signedUrl);
    });
  }
  return result;
}

export async function updateArtifactMetadata(
  artifactId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('analysis_artifacts')
    .update({ metadata })
    .eq('id', artifactId);
  if (error) throw new Error('ANALYSIS_ARTIFACT_UPDATE_FAILED');
}

export async function updateArtifactMetadataBatch(
  artifacts: Array<Pick<AnalysisArtifactRow, 'id' | 'metadata'>>,
): Promise<void> {
  const chunkSize = 50;
  for (let index = 0; index < artifacts.length; index += chunkSize) {
    const chunk = artifacts.slice(index, index + chunkSize);
    await Promise.all(chunk.map(async (artifact) => {
      const { error } = await supabase
        .from('analysis_artifacts')
        .update({ metadata: artifact.metadata })
        .eq('id', artifact.id);
      if (error) throw new Error('ANALYSIS_ARTIFACT_UPDATE_FAILED');
    }));
  }
}

export async function removeArtifact(artifact: AnalysisArtifactRow): Promise<void> {
  if (artifact.storage_bucket && artifact.storage_path) {
    if (!isOwnedArtifactStorageLocation({
      userId: artifact.user_id,
      jobId: artifact.job_id,
      bucket: artifact.storage_bucket,
      path: artifact.storage_path,
    })) {
      throw new Error('ANALYSIS_ARTIFACT_LOCATION_INVALID');
    }
    const removed = await supabase.storage.from(artifact.storage_bucket).remove([artifact.storage_path]);
    if (removed.error) throw new Error('ANALYSIS_ARTIFACT_STORAGE_DELETE_FAILED');
  }
  const deleted = await supabase
    .from('analysis_artifacts')
    .delete()
    .eq('id', artifact.id)
    .eq('job_id', artifact.job_id)
    .eq('user_id', artifact.user_id);
  if (deleted.error) throw new Error('ANALYSIS_ARTIFACT_RECORD_DELETE_FAILED');
}

export async function removeAllJobArtifacts(jobId: string): Promise<void> {
  const artifacts = await listJobArtifacts(jobId);
  const groups = new Map<string, string[]>();
  for (const artifact of artifacts) {
    if (!artifact.storage_bucket || !artifact.storage_path) continue;
    if (!isOwnedArtifactStorageLocation({
      userId: artifact.user_id,
      jobId: artifact.job_id,
      bucket: artifact.storage_bucket,
      path: artifact.storage_path,
    })) {
      throw new Error('ANALYSIS_ARTIFACT_LOCATION_INVALID');
    }
    const paths = groups.get(artifact.storage_bucket) ?? [];
    paths.push(artifact.storage_path);
    groups.set(artifact.storage_bucket, paths);
  }
  for (const [bucket, paths] of groups) {
    const removed = await supabase.storage.from(bucket).remove(paths);
    if (removed.error) throw new Error('ANALYSIS_ARTIFACT_STORAGE_DELETE_FAILED');
  }
  const deleted = await supabase.from('analysis_artifacts').delete().eq('job_id', jobId);
  if (deleted.error) throw new Error('ANALYSIS_ARTIFACT_RECORD_DELETE_FAILED');
}
