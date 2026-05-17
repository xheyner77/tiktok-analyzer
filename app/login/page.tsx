'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthTransition from '@/components/AuthTransition';
import BrandLogo from '@/components/BrandLogo';
import StarsFullPage from '@/components/StarsFullPage';

// Separated into its own component because useSearchParams() requires
// a Suspense boundary in Next.js 14 App Router. Without it the page
// can fail to render (blank / black screen) during SSR.
function LoginForm() {
  const searchParams = useSearchParams();
  // Validate redirect to prevent open redirect — only allow internal relative paths
  const rawRedirect = searchParams?.get('redirect') ?? '/dashboard';
  const redirectTo = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';
  const passwordResetSuccess = searchParams?.get('reset') === 'success';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleResendConfirmation() {
    if (!email || resendStatus === 'sending' || resendStatus === 'sent') return;
    setResendStatus('sending');
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendStatus(res.ok ? 'sent' : 'error');
    } catch {
      setResendStatus('error');
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setError('');
    setErrorCode(null);
    setResendStatus('idle');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setErrorCode(data.code ?? null);
        setIsLoading(false);
        return;
      }

      // Show premium transition — onComplete fires the actual navigation
      setShowTransition(true);
      // isLoading stays true to keep buttons disabled during the transition
    } catch (err) {
      console.error('[LoginForm] fetch error:', err);
      setError('Impossible de contacter le serveur.');
      setIsLoading(false);
    }
  };

  return (
    <>
      <AuthTransition
        show={showTransition}
        onComplete={() => {
          window.location.href = redirectTo;
        }}
      />

    <div className="relative z-10 w-full max-w-[26rem] animate-fade-up">
      {/* Logo */}
      <div className="mb-7 flex flex-col items-center text-center">
        <BrandLogo size="large" className="mb-5" />
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-vn-fuchsia/80">
          <span className="h-1.5 w-1.5 rounded-full bg-vn-fuchsia shadow-[0_0_14px_rgba(232,121,249,0.9)]" aria-hidden />
          Espace cr&eacute;ateur
        </div>
        <h1 className="text-3xl font-black tracking-tight text-white">Connexion</h1>
        <p className="text-gray-500 text-sm mt-1">Retrouve tes analyses, ta mémoire créateur et tes structures.</p>
      </div>

      {/* Card */}
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.025))] p-5 shadow-[0_28px_100px_-70px_rgba(232,121,249,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur sm:p-6">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/70 to-transparent" aria-hidden />
        {passwordResetSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5">
            <p className="text-xs text-emerald-300">
              Mot de passe mis à jour. Tu peux te connecter avec ton nouveau mot de passe.
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              autoComplete="email"
              disabled={isLoading}
              className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/30 px-4 text-[13px] font-semibold text-white outline-none transition-all placeholder:text-gray-700 hover:border-white/[0.14] focus:border-vn-fuchsia/45 focus:bg-black/40 focus:ring-2 focus:ring-vn-fuchsia/10 disabled:opacity-50"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400">Mot de passe</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                className="h-12 w-full rounded-xl border border-white/[0.09] bg-black/30 px-4 pr-11 text-[13px] font-semibold text-white outline-none transition-all placeholder:text-gray-700 hover:border-white/[0.14] focus:border-vn-fuchsia/45 focus:bg-black/40 focus:ring-2 focus:ring-vn-fuchsia/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-600 transition-colors hover:bg-white/[0.04] hover:text-gray-300"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                    <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41Z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-[11px] font-semibold text-gray-500 transition-colors hover:text-vn-fuchsia"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={`border rounded-xl px-3.5 py-3 ${
              errorCode === 'EMAIL_NOT_CONFIRMED'
                ? 'bg-amber-500/8 border-amber-500/25'
                : 'bg-red-500/8 border-red-500/20'
            }`}>
              <div className="flex items-start gap-2">
                {errorCode === 'EMAIL_NOT_CONFIRMED' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5">
                    <path d="M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2ZM1.5 12.251c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V5.809L8.38 9.397a.75.75 0 0 1-.76 0L1.5 5.809v6.442Zm13-8.181v-.32a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25v.32L8 7.88Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-red-400 shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                )}
                <p className={`text-xs leading-relaxed ${
                  errorCode === 'EMAIL_NOT_CONFIRMED' ? 'text-amber-300' : 'text-red-400'
                }`}>{error}</p>
              </div>

              {/* Resend button — only shown for unconfirmed email */}
              {errorCode === 'EMAIL_NOT_CONFIRMED' && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendStatus === 'sending' || resendStatus === 'sent' || !email}
                  className="mt-2.5 w-full py-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendStatus === 'sending' ? 'Envoi...'
                    : resendStatus === 'sent' ? '✓ Email renvoyé !'
                    : resendStatus === 'error' ? 'Erreur — réessaie'
                    : 'Renvoyer l\'email de confirmation'}
                </button>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_22px_70px_-38px_rgba(232,121,249,0.95)] transition-all hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connexion...
              </span>
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>

      {/* Footer link */}
      <p className="mt-5 text-center text-sm text-gray-600">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="font-semibold text-gray-300 transition-colors hover:text-white">
          Créer un compte
        </Link>
      </p>
    </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10 [padding-bottom:max(2rem,env(safe-area-inset-bottom,0px)+1rem)] sm:py-12">
      <StarsFullPage />
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-vn-fuchsia/8 via-vn-indigo/5 to-cyan-400/5 blur-3xl" />
      </div>

      {/* Suspense required by Next.js 14 when a child uses useSearchParams() */}
      <Suspense fallback={<div className="w-full max-w-sm h-96 animate-pulse bg-[#111] rounded-2xl" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
