import { type NextRequest } from 'next/server';
import { supabaseAuth } from '@/lib/supabase';
import { getAuthEmailCallbackUrl } from '@/lib/site-url';
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

/**
 * Converts raw Supabase Auth error messages into user-friendly French strings.
 */
function translateResendError(message: string): string {
  const msg = message.toLowerCase();

  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('email rate limit exceeded') ||
    msg.includes('too many requests')
  ) {
    return 'Trop d\'emails envoyés récemment. Veuillez patienter quelques minutes avant de renvoyer.';
  }

  if (msg.includes('network') || msg.includes('fetch failed')) {
    return 'Erreur de connexion. Vérifiez votre connexion et réessayez.';
  }

  return 'Impossible d\'envoyer l\'email de confirmation. Veuillez réessayer dans quelques instants.';
}

function shouldHideAccountState(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('user not found')
    || normalized.includes('no user')
    || normalized.includes('already confirmed')
    || normalized.includes('email already confirmed');
}

export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  try {
    const body = await readJsonObject(request, 8 * 1024);
    if (!body) {
      return privateJson({ error: 'Requête invalide.' }, { status: 400 });
    }
    const rawEmail = body.email;

    if (!rawEmail || typeof rawEmail !== 'string') {
      return privateJson({ error: 'Email requis.' }, { status: 400 });
    }
    const email = rawEmail.trim().toLowerCase();
    if (!email) {
      return privateJson({ error: 'Email requis.' }, { status: 400 });
    }

    const clientIdentifier = getBestEffortRequestIdentifier(request);
    const rateLimit = consumeBestEffortEmailRateLimits([
      {
        scope: 'auth-email:client',
        identifier: clientIdentifier,
        ...BEST_EFFORT_EMAIL_LIMITS.authEmailPerClient,
      },
      {
        scope: 'resend-confirmation:target',
        identifier: email,
        ...BEST_EFFORT_EMAIL_LIMITS.authEmailPerTarget,
      },
    ]);
    if (!rateLimit.allowed) {
      // Succès volontairement générique : ne révèle ni l'existence du compte ni la règle déclenchée.
      return privateJson({ success: true });
    }

    const emailRedirectTo = getAuthEmailCallbackUrl(request.headers.get('origin'));

    const { error } = await supabaseAuth.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      if (shouldHideAccountState(error.message)) {
        return privateJson({ success: true });
      }
      console.error('[resend-confirmation] provider_request_failed', {
        name: error.name,
        status: error.status,
        code: error.code,
      });
      return privateJson({ error: translateResendError(error.message) }, { status: 400 });
    }

    return privateJson({ success: true });
  } catch (error) {
    console.error('[resend-confirmation] request_failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return privateJson(
      { error: 'Impossible de traiter la demande pour le moment. Réessaie plus tard.' },
      { status: 500 }
    );
  }
}
