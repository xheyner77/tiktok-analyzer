'use client';

import { useState } from 'react';

export default function CreatorMemoryActions({ latestEventId }: { latestEventId?: string }) {
  const [pending, setPending] = useState<'reset' | 'ignore' | null>(null);
  const [message, setMessage] = useState('');

  async function resetMemory() {
    if (!window.confirm('Reinitialiser la memoire createur ? Les prochaines analyses repartiront de zero.')) return;
    setPending('reset');
    setMessage('');
    try {
      const response = await fetch('/api/creator-memory/reset', { method: 'POST' });
      if (!response.ok) throw new Error('reset_failed');
      window.location.reload();
    } catch {
      setMessage('Impossible de reinitialiser la memoire pour le moment.');
      setPending(null);
    }
  }

  async function ignoreLatest() {
    if (!latestEventId) return;
    if (!window.confirm('Ignorer le dernier apprentissage affiche ?')) return;
    setPending('ignore');
    setMessage('');
    try {
      const response = await fetch(`/api/creator-memory/events/${latestEventId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('ignore_failed');
      window.location.reload();
    } catch {
      setMessage('Impossible d ignorer cet apprentissage pour le moment.');
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {latestEventId ? (
        <button
          type="button"
          onClick={ignoreLatest}
          disabled={pending !== null}
          className="min-h-[42px] rounded-[12px] border border-white/[0.09] bg-white/[0.045] px-4 text-[12px] font-black text-slate-200 transition hover:border-cyan-200/20 hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'ignore' ? 'Ignorer...' : 'Ignorer cet apprentissage'}
        </button>
      ) : null}
      <button
        type="button"
        onClick={resetMemory}
        disabled={pending !== null}
        className="min-h-[42px] rounded-[12px] border border-rose-300/18 bg-rose-500/[0.055] px-4 text-[12px] font-black text-rose-100 transition hover:border-rose-200/30 hover:bg-rose-500/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending === 'reset' ? 'Reinitialisation...' : 'Reinitialiser la memoire'}
      </button>
      {message ? <p className="w-full text-[12px] font-semibold text-rose-200">{message}</p> : null}
    </div>
  );
}
