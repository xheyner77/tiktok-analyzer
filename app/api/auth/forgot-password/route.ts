import { type NextRequest } from 'next/server';
import { supabaseAuth } from '@/lib/supabase';
import { getPasswordResetRedirectUrl } from '@/lib/site-url';
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

function translateForgotPasswordError(message: string): string {
  const msg = message.toLowerCase();
  if (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('too many requests')
  ) {
    return 'Trop de demandes. Réessaie dans quelques minutes.';
  }
  if (msg.includes('invalid email')) {
    return 'Adresse email invalide.';
  }
  return 'Impossible d\'envoyer l\'email. Réessaie plus tard.';
}

/**
 * Envoie l’email de réinitialisation Supabase. Le lien pointe vers
 * getPasswordResetRedirectUrl() (ex. https://www.viralynz.com/reset-password).
 */
export async function POST(request: NextRequest) {
  const crossSite = rejectCrossSiteMutation(request);
  if (crossSite) return crossSite;

  try {
    const body = await readJsonObject(request, 8 * 1024);
    if (!body) {
      return privateJson({ error: 'Requête invalide.' }, { status: 400 });
    }
    const email = typeof body.email === 'string'
      ? body.email.trim().toLowerCase()
      : '';

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
        scope: 'forgot-password:target',
        identifier: email,
        ...BEST_EFFORT_EMAIL_LIMITS.authEmailPerTarget,
      },
    ]);
    if (!rateLimit.allowed) {
      // Succès volontairement générique : ne révèle ni l'existence du compte ni la règle déclenchée.
      return privateJson({ success: true });
    }

    const redirectTo = getPasswordResetRedirectUrl(request.headers.get('origin'));

    const { error } = await supabaseAuth.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[forgot-password] provider_request_failed', {
        name: error.name,
        status: error.status,
        code: error.code,
      });
      return privateJson({ error: translateForgotPasswordError(error.message) }, { status: 400 });
    }

    // Même si l’email n’existe pas, Supabase renvoie souvent success (anti-énumération).
    return privateJson({ success: true });
  } catch (error) {
    console.error('[forgot-password] request_failed', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return privateJson(
      { error: 'Impossible de traiter la demande pour le moment. Réessaie plus tard.' },
      { status: 500 }
    );
  }
}
