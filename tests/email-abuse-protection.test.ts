import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  resendConfirmation: vi.fn(),
  resendEmail: vi.fn(),
  getSession: vi.fn(),
  getUserById: vi.fn(),
  getDashboardData: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAuth: {
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      resend: mocks.resendConfirmation,
    },
  },
}));

vi.mock('@/lib/site-url', () => ({
  getPasswordResetRedirectUrl: () => 'https://www.viralynz.com/reset-password',
  getAuthEmailCallbackUrl: () => 'https://www.viralynz.com/auth/callback',
}));

vi.mock('@/lib/session', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/lib/auth', () => ({
  getUserById: mocks.getUserById,
}));

vi.mock('@/lib/dashboard-data', () => ({
  getDashboardData: mocks.getDashboardData,
}));

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mocks.resendEmail };
  },
}));

import { POST as forgotPasswordPost } from '@/app/api/auth/forgot-password/route';
import { POST as resendConfirmationPost } from '@/app/api/auth/resend-confirmation/route';
import { POST as feedbackPost } from '@/app/api/feedback/route';
import { POST as supportPost } from '@/app/api/support/contact/route';
import {
  consumeBestEffortEmailRateLimits,
  resetBestEffortEmailRateLimitsForTests,
} from '@/lib/email-abuse-protection';

function jsonRequest(path: string, body: Record<string, unknown>, ip: string): NextRequest {
  return new NextRequest(`https://www.viralynz.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.viralynz.com',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetBestEffortEmailRateLimitsForTests();
  vi.clearAllMocks();
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('RESEND_FROM_EMAIL', 'Viralynz <support@viralynz.com>');
  vi.stubEnv('SUPPORT_EMAIL', 'support@viralynz.com');

  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.resendConfirmation.mockResolvedValue({ error: null });
  mocks.resendEmail.mockResolvedValue({ data: { id: 'email_test' }, error: null });
  mocks.getSession.mockResolvedValue({ userId: 'user_test', email: 'createur@example.com' });
  mocks.getUserById.mockResolvedValue({ plan: 'pro', subscription_status: 'active' });
  mocks.getDashboardData.mockResolvedValue({
    user: {
      email: 'createur@example.com',
      planLabel: 'Pro',
      quotaUsed: 2,
      quotaLimit: 30,
    },
    tiktokConnection: {
      connected: false,
      modeLabel: 'Non connecté',
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('protection email best-effort', () => {
  it('bloque localement après la limite puis rouvre la fenêtre', () => {
    const rule = {
      scope: 'test:fixed-window',
      identifier: 'personne@example.com',
      limit: 2,
      windowMs: 60_000,
    };

    expect(consumeBestEffortEmailRateLimits([rule], 1_000).allowed).toBe(true);
    expect(consumeBestEffortEmailRateLimits([rule], 2_000).allowed).toBe(true);
    expect(consumeBestEffortEmailRateLimits([rule], 3_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 58,
    });
    expect(consumeBestEffortEmailRateLimits([rule], 61_001).allowed).toBe(true);
  });

  it('limite forgot-password sans changer le succès anti-énumération', async () => {
    let lastResponse: Response | undefined;
    for (let index = 0; index < 4; index += 1) {
      lastResponse = await forgotPasswordPost(jsonRequest(
        '/api/auth/forgot-password',
        { email: 'compte@example.com' },
        '203.0.113.10',
      ));
    }

    expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(3);
    expect(lastResponse?.status).toBe(200);
    await expect(lastResponse?.json()).resolves.toEqual({ success: true });
  });

  it('limite resend-confirmation sans révéler l’état du compte', async () => {
    let lastResponse: Response | undefined;
    for (let index = 0; index < 4; index += 1) {
      lastResponse = await resendConfirmationPost(jsonRequest(
        '/api/auth/resend-confirmation',
        { email: 'compte@example.com' },
        '203.0.113.11',
      ));
    }

    expect(mocks.resendConfirmation).toHaveBeenCalledTimes(3);
    expect(lastResponse?.status).toBe(200);
    await expect(lastResponse?.json()).resolves.toEqual({ success: true });
  });

  it('conserve le succès générique quand Supabase signale un compte absent', async () => {
    mocks.resendConfirmation.mockResolvedValueOnce({
      error: { message: 'User not found', name: 'AuthApiError', status: 400, code: 'user_not_found' },
    });

    const response = await resendConfirmationPost(jsonRequest(
      '/api/auth/resend-confirmation',
      { email: 'absent@example.com' },
      '203.0.113.12',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('renvoie 429 avant un cinquième feedback automatique', async () => {
    mocks.getSession.mockResolvedValue(null);
    let lastResponse: Response | undefined;
    for (let index = 0; index < 5; index += 1) {
      lastResponse = await feedbackPost(jsonRequest(
        '/api/feedback',
        { category: 'suggestion', message: 'Une amélioration concrète du produit.' },
        '203.0.113.13',
      ));
    }

    expect(mocks.resendEmail).toHaveBeenCalledTimes(4);
    expect(lastResponse?.status).toBe(429);
    expect(Number(lastResponse?.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('renvoie 429 avant une quatrième demande support et conserve le mailto', async () => {
    const body = {
      type: 'analysis_bug',
      priority: 'important',
      subject: 'Analyse bloquée',
      message: 'Mon analyse reste bloquée après le chargement.',
      currentRoute: '/dashboard/support',
    };
    let lastResponse: Response | undefined;
    for (let index = 0; index < 4; index += 1) {
      lastResponse = await supportPost(jsonRequest('/api/support/contact', body, '203.0.113.14'));
    }

    expect(mocks.resendEmail).toHaveBeenCalledTimes(3);
    expect(lastResponse?.status).toBe(429);
    const payload = await lastResponse?.json() as { code?: string; mailto?: string };
    expect(payload.code).toBe('RATE_LIMITED');
    expect(payload.mailto).toMatch(/^mailto:/);
  });

  it('conserve le fallback mailto quand Resend est indisponible', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    const response = await supportPost(jsonRequest('/api/support/contact', {
      type: 'other',
      priority: 'standard',
      subject: 'Question compte',
      message: 'Je souhaite comprendre un réglage de mon compte.',
    }, '203.0.113.15'));

    expect(response.status).toBe(503);
    const payload = await response.json() as { code?: string; mailto?: string };
    expect(payload.code).toBe('SUPPORT_UNAVAILABLE');
    expect(payload.mailto).toMatch(/^mailto:/);
    expect(mocks.resendEmail).not.toHaveBeenCalled();
  });
});
