import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  buildInputStoragePath,
  isOwnedArtifactStorageLocation,
  isOwnedInputStorageLocation,
  matchesIdempotentUpload,
  parseAnalysisCompletionId,
  pickJobStageValues,
  safeVideoExtension,
  sanitizeOriginalFileName,
} from '@/lib/video-analysis/job-guards';
import {
  isAllowedPrivateDownloadUrl,
  isSafeAnalysisTempDirPath,
} from '@/lib/video-analysis/temp-file-guards';

describe('video analysis upload identity and paths', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const jobId = '22222222-2222-4222-8222-222222222222';

  it('never trusts an extension that conflicts with the accepted MIME type', () => {
    expect(safeVideoExtension('payload.html', 'video/mp4')).toBe('.mp4');
    expect(safeVideoExtension('clip.MOV', 'video/quicktime')).toBe('.mov');
    expect(buildInputStoragePath({ userId, jobId, fileName: '../../clip.exe', contentType: 'video/webm' }))
      .toBe(`${userId}/${jobId}/input.webm`);
  });

  it('removes traversal, controls and bidirectional filename spoofing', () => {
    const sanitized = sanitizeOriginalFileName('../facture\u202Egpj.exe\u0000');
    expect(sanitized).toBe('..-facturegpj.exe');
    expect(sanitized).not.toContain('\u202E');
    expect(sanitized).not.toContain('\u0000');
  });

  it('reuses an idempotency key only for the exact same immutable request', () => {
    const existing = {
      original_file_name: 'clip.mp4',
      content_type: 'video/mp4',
      size_bytes: 42,
      creator_context: { audience: 'Créateurs', nested: { a: 1, b: 2 } },
    };
    expect(matchesIdempotentUpload(existing, {
      fileName: 'clip.mp4',
      contentType: 'video/mp4',
      sizeBytes: 42,
      creatorContext: { nested: { b: 2, a: 1 }, audience: 'Créateurs' },
    })).toBe(true);
    expect(matchesIdempotentUpload(existing, {
      fileName: 'autre.mp4',
      contentType: 'video/mp4',
      sizeBytes: 42,
      creatorContext: existing.creator_context,
    })).toBe(false);
    expect(matchesIdempotentUpload(existing, {
      fileName: 'clip.mp4',
      contentType: 'video/mp4',
      sizeBytes: 43,
      creatorContext: existing.creator_context,
    })).toBe(false);
  });

  it('refuses cross-user, cross-job and cross-bucket storage locations', () => {
    const inputPath = `${userId}/${jobId}/input.mp4`;
    expect(isOwnedInputStorageLocation({ userId, jobId, bucket: 'analysis-inputs', path: inputPath })).toBe(true);
    expect(isOwnedInputStorageLocation({ userId: 'attacker', jobId, bucket: 'analysis-inputs', path: inputPath })).toBe(false);
    expect(isOwnedInputStorageLocation({ userId, jobId, bucket: 'public', path: inputPath })).toBe(false);
    expect(isOwnedInputStorageLocation({ userId, jobId, bucket: 'analysis-inputs', path: `${inputPath}/other` })).toBe(false);
    expect(isOwnedInputStorageLocation({ userId, jobId, bucket: 'analysis-inputs', path: `${userId}/${jobId}/inputevil.mp4` })).toBe(false);

    const evidencePath = `${userId}/${jobId}/frames/frame.jpg`;
    expect(isOwnedArtifactStorageLocation({ userId, jobId, bucket: 'analysis-evidence', path: evidencePath })).toBe(true);
    expect(isOwnedArtifactStorageLocation({ userId, jobId: 'other', bucket: 'analysis-evidence', path: evidencePath })).toBe(false);
    expect(isOwnedArtifactStorageLocation({
      userId,
      jobId,
      bucket: 'analysis-evidence',
      path: `${userId}/${jobId}/frames/../other.jpg`,
    })).toBe(false);
  });

  it('allowlists stage fields so untrusted values cannot overwrite ownership or terminal state', () => {
    expect(pickJobStageValues({
      transcript: { raw: 'texte' },
      probe: { duration: 12 },
      user_id: 'attacker',
      quota_state: 'refunded',
      status: 'completed',
      progress: 100,
      workflow_run_id: 'attacker-run',
    })).toEqual({
      transcript: { raw: 'texte' },
      probe: { duration: 12 },
    });
  });

  it('accepts only a UUID as the atomic completion RPC result', () => {
    const analysisId = '33333333-3333-4333-8333-333333333333';
    expect(parseAnalysisCompletionId(analysisId)).toBe(analysisId);
    expect(() => parseAnalysisCompletionId(null)).toThrow('ANALYSIS_COMPLETION_RESPONSE_INVALID');
    expect(() => parseAnalysisCompletionId({ id: analysisId })).toThrow('ANALYSIS_COMPLETION_RESPONSE_INVALID');
  });
});

describe('temporary files and private downloads', () => {
  it('accepts only direct Viralynz children of the OS temp directory', () => {
    expect(isSafeAnalysisTempDirPath(join(tmpdir(), 'viralynz-job-abcdef'))).toBe(true);
    expect(isSafeAnalysisTempDirPath(tmpdir())).toBe(false);
    expect(isSafeAnalysisTempDirPath(join(tmpdir(), 'other-job'))).toBe(false);
    expect(isSafeAnalysisTempDirPath(`${tmpdir()}/viralynz-job/../outside`)).toBe(false);
    expect(isSafeAnalysisTempDirPath(`${tmpdir()}/viralynz-job/../viralynz-other`)).toBe(false);
  });

  it('blocks SSRF and redirects outside the configured Supabase Storage origin', () => {
    const base = 'https://project.supabase.co';
    expect(isAllowedPrivateDownloadUrl(
      `${base}/storage/v1/object/sign/analysis-inputs/user/job/input.mp4?token=secret`,
      base,
    )).toBe(true);
    expect(isAllowedPrivateDownloadUrl('https://attacker.test/storage/v1/object/sign/file', base)).toBe(false);
    expect(isAllowedPrivateDownloadUrl(`${base}@attacker.test/storage/v1/object/sign/file`, base)).toBe(false);
    expect(isAllowedPrivateDownloadUrl(`${base}/auth/v1/token`, base)).toBe(false);
  });
});

describe('analysis job mutation CSRF defense in depth', () => {
  it.each([
    'app/api/analysis-jobs/route.ts',
    'app/api/analysis-jobs/[id]/start/route.ts',
  ])('%s rejects explicit cross-site mutations inside the route', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('rejectCrossSiteMutation(request)');
  });

  it('keeps a missing upload retryable but makes a mismatched upload terminal', () => {
    const source = readFileSync('app/api/analysis-jobs/[id]/start/route.ts', 'utf8');
    expect(source).toContain("code === 'ANALYSIS_UPLOAD_NOT_FOUND'");
    expect(source).toContain('retryUpload: uploadCanBeRetried');
    expect(source).toContain('{ status: uploadCanBeRetried ? 400 : 503 }');
    expect(source).toContain('{ status: isUploadError ? 422 : 503 }');
    expect(source.indexOf('if (uploadCanBeRetried || uploadCheckUnavailable)'))
      .toBeLessThan(source.indexOf('let quotaRestored = false'));
  });
});
