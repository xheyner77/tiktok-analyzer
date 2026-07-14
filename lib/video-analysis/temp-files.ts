import 'server-only';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  isAllowedPrivateDownloadUrl,
  isSafeAnalysisTempDirPath,
} from './temp-file-guards';

export { isAllowedPrivateDownloadUrl, isSafeAnalysisTempDirPath } from './temp-file-guards';

export async function createAnalysisTempDir(jobId: string): Promise<string> {
  const safeId = jobId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
  return mkdtemp(join(tmpdir(), `viralynz-${safeId}-`));
}

export async function removeAnalysisTempDir(path: string): Promise<void> {
  if (!isSafeAnalysisTempDirPath(path)) {
    throw new Error('ANALYSIS_TEMP_PATH_REJECTED');
  }
  await rm(resolve(path), { recursive: true, force: true });
}

export async function downloadPrivateFile(input: {
  signedUrl: string;
  destination: string;
  maxBytes: number;
  timeoutMs?: number;
}): Promise<number> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl || !isAllowedPrivateDownloadUrl(input.signedUrl, supabaseUrl)) {
    throw new Error('ANALYSIS_PRIVATE_DOWNLOAD_URL_REJECTED');
  }

  const response = await fetch(input.signedUrl, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(input.timeoutMs ?? 120_000),
  });
  if (!response.ok || !response.body) throw new Error('ANALYSIS_PRIVATE_DOWNLOAD_FAILED');

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > input.maxBytes) {
    await response.body.cancel();
    throw new Error('ANALYSIS_PRIVATE_DOWNLOAD_TOO_LARGE');
  }

  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.byteLength;
      if (received > input.maxBytes) {
        callback(new Error('ANALYSIS_PRIVATE_DOWNLOAD_TOO_LARGE'));
        return;
      }
      callback(null, chunk);
    },
  });

  const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
  await pipeline(body, limiter, createWriteStream(input.destination, { flags: 'wx' }));
  return received;
}
