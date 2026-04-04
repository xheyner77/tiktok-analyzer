'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BrandLogo from '@/components/BrandLogo';
import StarsFullPage from '@/components/StarsFullPage';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [initError, setInitError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createBrowserSupabaseClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive || !session) return;
      setCanReset(true);
      setReady(true);
    });

    (async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (alive) {
              setInitError('Ce lien a expiré ou a déjà été utilisé. Demande un nouvel email.');
              setReady(true);
            }
            return;
          }
        }

        // PKCE + anciens liens avec hash (#access_token=…) : laisser le temps au client de parser l’URL
        for (let i = 0; i < 8; i++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (alive) {
              setCanReset(true);
              setReady(true);
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (alive) {
          setInitError('Lien invalide ou expiré. Utilise « Mot de passe oublié » depuis la connexion.');
          setReady(true);
        }
      } catch {
        if (alive) {
          setInitError('Impossible de valider le lien.');
          setReady(true);
        }
      }
    })();

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) {
        setError(upErr.message.includes('session') ? 'Session expirée. Redemande un lien.' : 'Impossible de mettre à jour le mot de passe.');
        setLoading(false);
        return;
      }
      await supabase.auth.signOut();
      window.location.href = '/login?reset=success';
    } catch {
      setError('Erreur réseau.');
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center gap-3 py-12">
        <svg className="w-5 h-5 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-gray-500">Vérification du lien…</span>
      </div>
    );
  }

  if (initError || !canReset) {
    return (
      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-7 card-glow text-center">
        <p className="text-sm text-red-400 mb-6">{initError || 'Lien invalide.'}</p>
        <Link
          href="/forgot-password"
          className="block w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 transition-all"
        >
          Demander un nouveau lien
        </Link>
        <Link href="/login" className="block mt-3 text-sm text-gray-500 hover:text-gray-300">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 card-glow">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
              className="w-full bg-[#0e0e0e] border border-[#222] rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none focus:border-vn-fuchsia/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs"
            >
              {showPassword ? 'Masquer' : 'Voir'}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-400">Confirmer le mot de passe</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={loading}
            className="w-full bg-[#0e0e0e] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-vn-fuchsia/40 disabled:opacity-50"
          />
        </div>
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-3.5 font-semibold text-white text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Mise à jour…' : 'Enregistrer le mot de passe'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 [padding-bottom:max(2rem,env(safe-area-inset-bottom,0px)+1rem)]">
      <StarsFullPage />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-vn-indigo/5 to-vn-fuchsia/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo size="large" className="mb-6" />
          <h1 className="text-2xl font-bold text-white">Nouveau mot de passe</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">Choisis un mot de passe sécurisé pour ton compte.</p>
        </div>

        <Suspense
          fallback={
            <div className="flex justify-center py-12">
              <svg className="w-6 h-6 animate-spin text-gray-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
