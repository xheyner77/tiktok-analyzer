'use client';

import { useState } from 'react';

export default function CopyHookButton({
  value,
  label = 'Copier',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[11px] font-bold text-slate-300 transition hover:border-violet-300/25 hover:bg-violet-400/10 hover:text-white"
    >
      {copied ? 'Copié' : label}
    </button>
  );
}
