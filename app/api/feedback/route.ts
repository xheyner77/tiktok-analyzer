import { type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { getSession } from '@/lib/session';
import {
  privateJson,
  readJsonObject,
  rejectCrossSiteMutation,
} from '@/lib/api-route-security';
import {
  BEST_EFFORT_EMAIL_LIMITS,
  consumeBestEffortEmailRateLimits,
  getBestEffortRequestIdentifier,
} from '@/lib/email-abuse-protection';

const CATEGORY_LABELS = {
  bug: 'Bug',
  suggestion: 'Suggestion',
  question: 'Question',
  other: 'Autre',
} as const;

type FeedbackCategory = keyof typeof CATEGORY_LABELS;

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === 'string' && value in CATEGORY_LABELS;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  try {
    const body = await readJsonObject(request, 32 * 1024);
    if (!body) {
      return privateJson({ error: 'Corps de requête invalide.' }, { status: 400 });
    }

    if (!isFeedbackCategory(body.category)) {
      return privateJson({ error: 'Catégorie invalide.' }, { status: 400 });
    }

    if (typeof body.message !== 'string' || !body.message.trim()) {
      return privateJson({ error: 'Message vide.' }, { status: 400 });
    }

    const trimmed = body.message.trim();
    if (trimmed.length > 1000) {
      return privateJson({ error: 'Message trop long (maximum 1 000 caractères).' }, { status: 400 });
    }

    const session = await getSession();
    const actorIdentifier = session?.userId
      ? `user:${session.userId}`
      : getBestEffortRequestIdentifier(request);
    const rateLimit = consumeBestEffortEmailRateLimits([{
      scope: 'feedback:actor',
      identifier: actorIdentifier,
      ...BEST_EFFORT_EMAIL_LIMITS.feedbackPerActor,
    }]);
    if (!rateLimit.allowed) {
      return privateJson(
        { error: 'Trop de messages envoyés. Réessaie dans quelques minutes.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
    const supportEmail = process.env.SUPPORT_EMAIL?.trim();
    if (!resendKey || !resendFrom || !supportEmail) {
      console.error('[feedback] Service email indisponible: configuration incomplète.');
      return privateJson(
        { error: 'Le support est temporairement indisponible.' },
        { status: 503 },
      );
    }

    const senderLabel = session ? escapeHtml(session.email) : 'Visiteur anonyme';
    const categoryLabel = CATEGORY_LABELS[body.category];
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({
      from: resendFrom,
      to: supportEmail,
      ...(session?.email ? { replyTo: session.email } : {}),
      subject: `[Viralynz] ${categoryLabel}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
          <div style="background:#050816;color:#fff;padding:28px;border-radius:16px;margin-bottom:16px">
            <h1 style="font-size:20px;margin:0 0 8px">Nouveau retour Viralynz</h1>
            <p style="color:#cbd5e1;font-size:14px;margin:0">Catégorie : <strong>${categoryLabel}</strong></p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e5e7eb;padding:24px;border-radius:12px;margin-bottom:16px">
            <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin:0">${escapeHtml(trimmed)}</p>
          </div>
          <p style="font-size:13px;color:#64748b">
            Envoyé par : <strong>${senderLabel}</strong><br/>
            Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[feedback] Envoi refusé par le fournisseur email.', {
        name: error.name,
        statusCode: error.statusCode,
      });
      return privateJson(
        { error: 'Le message n’a pas pu être envoyé.' },
        { status: 502 },
      );
    }

    return privateJson({ ok: true });
  } catch (error) {
    console.error('[feedback] Erreur inattendue.', {
      kind: error instanceof Error ? error.name : 'unknown',
    });
    return privateJson({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
