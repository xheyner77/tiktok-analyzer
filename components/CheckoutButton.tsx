'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { waitForBillingPlan } from '@/lib/wait-for-billing-sync';

interface CheckoutButtonProps {
  plan: 'pro' | 'elite';
  className: string;
  children: React.ReactNode;
}

export default function CheckoutButton({ plan, className, children }: CheckoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckout = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });

      if (res.status === 401) {
        router.push('/login?redirect=/pricing');
        return;
      }

      const data = await res.json();

      if (data.url) {
        // Persist the chosen plan so /dashboard can apply it after Stripe redirect
        localStorage.setItem('pendingPlan', plan);
        window.location.href = data.url;
        return;
      }

      if (data.code === 'PRO_TO_ELITE_USE_UPGRADE') {
        const r2 = await fetch('/api/upgrade-subscription', { method: 'POST' });
        const d2 = await r2.json().catch(() => ({}));
        if (r2.ok) {
          const synced = await waitForBillingPlan('elite');
          if (!synced) console.warn('[CheckoutButton] Webhook Elite lent — redirection.');
          window.location.href = '/dashboard?t=' + Date.now();
          return;
        }
        setErrorMsg(d2.error ?? 'Mise à niveau Elite impossible pour le moment.');
        return;
      }

      // Handle specific error codes
      if (data.code === 'ALREADY_ON_PLAN') {
        setErrorMsg(`Tu es déjà sur ce plan.`);
      } else if (data.code === 'PLAN_DOWNGRADE_BLOCKED') {
        setErrorMsg(`Tu es déjà sur le plan Elite. Pour gérer ton abonnement, contacte le support.`);
      } else {
        setErrorMsg(data.error ?? 'Une erreur est survenue.');
      }
    } catch (err) {
      console.error('[CheckoutButton] Error:', err);
      setErrorMsg('Erreur réseau. Réessaie dans un instant.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleCheckout}
        disabled={isLoading}
        className={`${className} disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Chargement...
          </span>
        ) : (
          children
        )}
      </button>

      {errorMsg && (
        <p className="mt-2 text-xs text-amber-400 text-center leading-snug">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
