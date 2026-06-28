import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { Resend } from 'resend';

const CATEGORY_LABELS: Record<string, string> = {
  bug:        '🐛 Bug',
  suggestion: '💡 Suggestion',
  question:   '❓ Question',
  other:      '💬 Autre',
};

export async function POST(request: NextRequest) {
  try {
    const { category, message } = await request.json();

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }

    const trimmed = message.trim();
    if (trimmed.length > 1000) {
      return NextResponse.json({ error: 'Message trop long (max 1000 caractères)' }, { status: 400 });
    }

    const session  = await getSession();
    const from     = session?.email ?? 'Visiteur anonyme';
    const fromEncoded = from.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const catLabel = CATEGORY_LABELS[category] ?? '💬 Autre';

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
    const supportEmail = process.env.SUPPORT_EMAIL?.trim();

    const missingEmailConfig = [
      !resendKey ? 'RESEND_API_KEY' : '',
      !resendFrom ? 'RESEND_FROM_EMAIL' : '',
      !supportEmail ? 'SUPPORT_EMAIL' : '',
    ].filter(Boolean);

    if (process.env.NODE_ENV === 'production' && missingEmailConfig.length > 0) {
      console.error('[contact] Email config missing in production:', missingEmailConfig.join(', '));
      return NextResponse.json({ error: 'Configuration email support manquante.' }, { status: 503 });
    }

    /* ── Resend email ─────────────────────────────────────────────────────── */
    if (resendKey) {
      if (!resendFrom) {
        console.error('[contact] RESEND_FROM_EMAIL missing.');
        return NextResponse.json({ error: 'Configuration email expéditeur manquante.' }, { status: 503 });
      }

      if (!supportEmail) {
        console.error('[contact] SUPPORT_EMAIL missing.');
        return NextResponse.json({ error: 'Email support non configuré.' }, { status: 503 });
      }

      const resend = new Resend(resendKey);

      await resend.emails.send({
        from:    resendFrom,
        to:      supportEmail,
        subject: `[Viralynz Contact] ${catLabel} — ${from}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <div style="background:#0d0d0d;padding:32px;border-radius:16px;margin-bottom:16px">
              <h1 style="color:#e879f9;font-size:20px;margin:0 0 8px">
                Nouveau message via Viralynz
              </h1>
              <p style="color:#aaa;font-size:14px;margin:0">
                Catégorie : <strong style="color:#fff">${catLabel}</strong>
              </p>
            </div>
            <div style="background:#f9f9f9;padding:24px;border-radius:12px;margin-bottom:16px">
              <p style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin:0">
                ${trimmed.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
              </p>
            </div>
            <p style="font-size:13px;color:#888">
              Envoyé par : <strong>${fromEncoded}</strong><br/>
              Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
            </p>
          </div>
        `,
      });
    } else {
      /* Fallback : log en console si pas de clé Resend */
      console.log('[contact]', {
        category: catLabel,
        message:  trimmed,
        from,
        at:       new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[contact] error', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
