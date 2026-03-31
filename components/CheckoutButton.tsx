'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
