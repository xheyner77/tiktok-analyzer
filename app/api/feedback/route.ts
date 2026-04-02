import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { Resend } from 'resend';

const CONTACT_EMAIL = 'xheyner77@gmail.com';

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

    const session  = await getSession();
    const from     = session?.email ?? 'Visiteur anonyme';
    const fromEncoded = from.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const catLabel = CATEGORY_LABELS[category] ?? '💬 Autre';

    /* ── Resend email ─────────────────────────────────────────────────────── */
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from:    'Viralynz Contact <onboarding@resend.dev>',
        to:      CONTACT_EMAIL,
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
                ${message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}
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
        message:  message.trim(),
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
