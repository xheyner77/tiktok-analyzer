'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import BrandLogo from '@/components/BrandLogo';

/*
 * /auth/callback — landing page after Supabase email confirmation.
 *
 * Supabase redirects here after the user clicks the confirmation link in
 * their email. The URL may contain:
 *   - Query params: ?token_hash=...&type=signup  (PKCE flow, newer Supabase)
 *   - Hash params:  #access_token=...&type=signup (implicit flow, older)
 *
 * For this app we don't auto-login here; we simply show a clear success
 * message so the user knows their email is confirmed and can log in.
 */

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check for error param from Supabase (e.g. expired link)
    const error = searchParams.get('error') ?? searchParams.get('error_description');
    if (error) {
      setErrorMsg(error);
      setStatus('error');
      return;
    }

    // Any other landing here (token_hash present or hash fragment) = success
    setStatus('success');
  }, [searchParams]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3">
        <svg className="w-5 h-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-gray-500">Vérification en cours...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="relative w-full max-w-sm animate-fade-up text-center">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo size="large" className="mb-6" />
        </div>

        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-7 card-glow">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-2xl mx-auto mb-5">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Lien expiré ou invalide</h2>
          <p className="text-sm text-gray-500 mb-2">
            Ce lien de confirmation n&apos;est plus valide. Il a peut-être expiré (valable 24h) ou déjà été utilisé.
          </p>
          {errorMsg && (
            <p className="text-xs text-gray-600 mb-5 font-mono">{errorMsg}</p>
          )}
          <Link
            href="/signup"
            className="block w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 transition-all shadow-lg shadow-vn-fuchsia/15 mb-3 text-center"
          >
            Renvoyer l&apos;email de confirmation
          </Link>
          <Link
            href="/login"
            className="block w-full py-2.5 rounded-xl font-semibold text-sm bg-[#1a1a1a] border border-[#222] text-gray-300 hover:bg-[#1f1f1f] hover:text-white transition-all text-center"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // Success
  return (
    <div className="relative w-full max-w-sm animate-fade-up text-center">
      <div className="flex flex-col items-center mb-8">
        <BrandLogo size="large" className="mb-6" />
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-7 card-glow">
        {/* Animated checkmark */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
            <circle cx="12" cy="12" r="10" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4" />
            <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Email confirmé !</h2>
        <p className="text-sm text-gray-400 mb-6">
          Ton adresse email a bien été vérifiée. Tu peux maintenant te connecter et accéder à ton espace.
        </p>

        <Link
          href="/login"
          className="block w-full py-3.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 transition-all shadow-lg shadow-vn-fuchsia/15 text-center"
        >
          Se connecter →
        </Link>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-vn-indigo/5 to-vn-fuchsia/5 blur-3xl" />
      </div>
      <Suspense fallback={
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500">Chargement...</span>
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </main>
  );
}
