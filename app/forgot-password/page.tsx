'use client';

import { useState } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import StarsFullPage from '@/components/StarsFullPage';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Indique ton adresse email.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.');
        setIsLoading(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Impossible de contacter le serveur.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8 [padding-bottom:max(2rem,env(safe-area-inset-bottom,0px)+1rem)]">
      <StarsFullPage />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-vn-indigo/5 to-vn-fuchsia/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-up">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo size="large" className="mb-6" />
          <h1 className="text-2xl font-bold text-white">Mot de passe oublié</h1>
          <p className="text-gray-500 text-sm mt-1 text-center">
            On t&apos;envoie un lien pour choisir un nouveau mot de passe.
          </p>
        </div>

        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 card-glow">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-fuchsia/15 to-vn-indigo/15 border border-vn-fuchsia/20 flex items-center justify-center text-2xl mx-auto">
                ✉️
              </div>
              <p className="text-sm text-gray-400">
                Si un compte existe pour <span className="text-gray-300 font-medium">{email}</span>, tu recevras un email avec un lien vers{' '}
                <span className="text-gray-300">viralynz.com</span>. Pense à vérifier les spams.
              </p>
              <Link
                href="/login"
                className="block w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white hover:opacity-90 transition-all text-center"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Adresse email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  autoComplete="email"
                  disabled={isLoading}
                  className="w-full bg-[#0e0e0e] border border-[#222] hover:border-[#2a2a2a] focus:border-vn-fuchsia/40 focus:ring-2 focus:ring-vn-fuchsia/8 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm outline-none transition-all disabled:opacity-50"
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-xl px-3.5 py-2.5">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl py-3.5 font-semibold text-white text-sm bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:opacity-90 transition-all shadow-lg shadow-vn-fuchsia/15 disabled:opacity-50"
              >
                {isLoading ? 'Envoi…' : 'Envoyer le lien'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-600 mt-5">
          <Link href="/login" className="text-gray-300 hover:text-white font-medium">
            ← Retour à la connexion
          </Link>
        </p>
      </div>
    </main>
  );
}
