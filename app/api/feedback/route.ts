import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { category, message } = await request.json();

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }

    const session = await getSession();

    console.log('[feedback]', {
      category: category ?? 'other',
      message:  message.trim(),
      from:     session?.email ?? 'anonymous',
      at:       new Date().toISOString(),
    });

    // ── Ready to plug a real email service here (Resend, Nodemailer…) ──────
    // await sendEmail({ subject: `[Feedback] ${category}`, body: message, from: session?.email });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
