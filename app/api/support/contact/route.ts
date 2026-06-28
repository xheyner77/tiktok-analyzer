import { NextResponse, type NextRequest } from 'next/server';
import { Resend } from 'resend';
import { getDashboardData } from '@/lib/dashboard-data';
import { getUserById } from '@/lib/auth';
import { getSession } from '@/lib/session';

const requestTypes = {
  account: 'Compte & accès',
  billing: 'Billing',
  analysis_bug: 'Bug analyse',
  ai_result: 'Résultat IA à vérifier',
  tiktok: 'TikTok Sync',
  quotas: 'Quotas',
  product_feedback: 'Idée produit',
  other: 'Autre',
} as const;

const priorities = {
  standard: 'Standard',
  important: 'Important',
  blocking: 'Bloquant',
} as const;

type RequestType = keyof typeof requestTypes;
type Priority = keyof typeof priorities;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isRequestType(value: string): value is RequestType {
  return value in requestTypes;
}

function isPriority(value: string): value is Priority {
  return value in priorities;
}

function buildMailto(to: string, subject: string, message: string, context: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(`[Viralynz Support] ${subject}`)}&body=${encodeURIComponent(`${message}\n\n---\nContexte Viralynz\n${context}`)}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
    }

    const body = await request.json();
    const typeRaw = cleanText(body.type, 40);
    const priorityRaw = cleanText(body.priority, 40);
    const subject = cleanText(body.subject, 140);
    const message = cleanText(body.message, 4000);
    const browserContext = cleanText(body.browserContext, 800);
    const currentRoute = cleanText(body.currentRoute, 160);
    const feedbackSignal = cleanText(body.feedbackSignal, 120);
    const issueReference = cleanText(body.issueReference, 500);

    if (!isRequestType(typeRaw)) {
      return NextResponse.json({ error: 'Type de demande invalide.' }, { status: 400 });
    }
    if (!isPriority(priorityRaw)) {
      return NextResponse.json({ error: 'Priorité invalide.' }, { status: 400 });
    }
    if (subject.length < 3) {
      return NextResponse.json({ error: 'Ajoute un sujet clair.' }, { status: 400 });
    }
    if (message.length < 12) {
      return NextResponse.json({ error: 'Décris le problème avec un peu plus de contexte.' }, { status: 400 });
    }

    const [profile, dashboard] = await Promise.all([
      getUserById(session.userId),
      getDashboardData(),
    ]);

    const supportEmail = process.env.SUPPORT_EMAIL?.trim();
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
    const fallbackEmail = supportEmail || 'support@viralynz.com';
    const planLabel = dashboard.user.planLabel || (profile?.plan ? profile.plan.toUpperCase() : 'Non disponible');
    const subscriptionStatus = profile?.subscription_status || 'none';
    const tiktokStatus = dashboard.tiktokConnection.connected ? 'connecté' : 'non connecté';
    const routeLabel = currentRoute || '/dashboard/support';
    const accountContext = [
      `Email: ${dashboard.user.email || session.email}`,
      `User ID: ${session.userId}`,
      `Plan: ${planLabel}`,
      `Analyses: ${dashboard.user.quotaUsed} / ${dashboard.user.quotaLimit ?? '∞'}`,
      `TikTok: ${tiktokStatus}`,
      `Mode TikTok: ${dashboard.tiktokConnection.modeLabel || 'Non disponible'}`,
      `Billing: ${subscriptionStatus}`,
      `Route: ${routeLabel}`,
      `Signal: ${feedbackSignal || requestTypes[typeRaw]}`,
      issueReference ? `Reference: ${issueReference}` : '',
    ].filter(Boolean).join('\n');

    if (!resendFrom) {
      return NextResponse.json(
        {
          error: 'Configuration email expéditeur manquante. Ouvre l’email prérempli pour envoyer la demande.',
          code: 'RESEND_FROM_EMAIL_NOT_CONFIGURED',
          mailto: buildMailto(fallbackEmail, subject, message, accountContext),
        },
        { status: 503 }
      );
    }

    if (!supportEmail || !resendKey) {
      return NextResponse.json(
        {
          error: !supportEmail
            ? 'Email support non configuré. Ouvre l’email prérempli pour envoyer la demande.'
            : 'Configuration email support manquante. Ouvre l’email prérempli pour envoyer la demande.',
          code: !supportEmail ? 'SUPPORT_EMAIL_NOT_CONFIGURED' : 'EMAIL_NOT_CONFIGURED',
          mailto: buildMailto(fallbackEmail, subject, message, accountContext),
        },
        { status: 503 }
      );
    }

    const resend = new Resend(resendKey);

    await resend.emails.send({
      from: resendFrom,
      to: supportEmail,
      replyTo: session.email,
      subject: `[Viralynz Support] ${priorities[priorityRaw]} - ${requestTypes[typeRaw]} - ${subject}`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;color:#111827">
          <div style="background:#050816;color:#fff;border-radius:18px;padding:28px;margin-bottom:18px">
            <p style="margin:0 0 8px;color:#67e8f9;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:800">Viralynz Support</p>
            <h1 style="margin:0;font-size:22px;line-height:1.25">${escapeHtml(subject)}</h1>
            <p style="margin:12px 0 0;color:#cbd5e1;font-size:14px">Type: <strong>${requestTypes[typeRaw]}</strong> · Priorité: <strong>${priorities[priorityRaw]}</strong></p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:22px;margin-bottom:18px">
            <h2 style="margin:0 0 12px;font-size:15px;color:#111827">Message</h2>
            <p style="white-space:pre-wrap;margin:0;font-size:15px;line-height:1.65;color:#1f2937">${escapeHtml(message)}</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px">
            <h2 style="margin:0 0 12px;font-size:15px;color:#111827">Contexte attaché</h2>
            <p style="white-space:pre-wrap;margin:0;color:#4b5563;font-size:14px;line-height:1.7">${escapeHtml(accountContext)}</p>
            <p style="margin:16px 0 0;color:#6b7280;font-size:12px;line-height:1.6">
              Navigateur: ${escapeHtml(browserContext || 'Non fourni')}<br/>
              Date: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[support/contact] error:', message);
    return NextResponse.json({ error: 'Impossible d’envoyer la demande pour le moment.' }, { status: 500 });
  }
}
