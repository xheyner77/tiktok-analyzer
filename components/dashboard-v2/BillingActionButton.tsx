'use client';

import { useState } from 'react';
import type { BillingInterval, PaidStripePlan } from '@/lib/stripe-billing';

type BillingActionButtonProps = {
  action: 'checkout' | 'portal';
  plan?: PaidStripePlan;
  interval?: BillingInterval;
  disabled?: boolean;
  fullWidth?: boolean;
  className: string;
  children: React.ReactNode;
};

export default function BillingActionButton({
  action,
  plan,
  interval = 'month',
  disabled = false,
  fullWidth = true,
  className,
  children,
}: BillingActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = action === 'portal' ? '/api/billing/portal' : '/api/checkout';
      const body = action === 'checkout' ? JSON.stringify({ plan, interval }) : undefined;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: action === 'checkout' ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'Action billing indisponible pour le moment.');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action billing indisponible pour le moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={fullWidth ? 'w-full' : 'inline-flex flex-col'}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-55`}
      >
        {loading ? 'Ouverture...' : children}
      </button>
      {error ? <p className="mt-2 text-center text-[12px] leading-relaxed text-rose-200">{error}</p> : null}
    </div>
  );
}
