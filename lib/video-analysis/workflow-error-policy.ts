import 'server-only';

import { APIConnectionError, APIError, RateLimitError } from 'openai';
import { FatalError, RetryableError } from 'workflow';
import { ZodError } from 'zod';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'ANALYSIS_PIPELINE_FAILED';
}

export function isTemporaryAnalysisError(error: unknown): boolean {
  if (RetryableError.is(error)) return true;
  if (error instanceof RateLimitError || error instanceof APIConnectionError) return true;
  const status = error instanceof APIError
    ? error.status
    : Number((error as { status?: unknown } | null)?.status);
  return [408, 409, 429, 500, 502, 503, 504].includes(status);
}

/** Only explicit provider/network transients may consume the single workflow retry. */
export function classifyAnalysisStepError(error: unknown): Error {
  if (RetryableError.is(error) || error instanceof FatalError) return error;
  if (isTemporaryAnalysisError(error)) {
    return new RetryableError(errorMessage(error), { retryAfter: '1s' });
  }
  if (error instanceof ZodError) return new FatalError('ANALYSIS_RESPONSE_FORMAT_INVALID');
  return new FatalError(errorMessage(error));
}
