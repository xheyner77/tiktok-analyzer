'use client';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-grid h-8 min-w-10 place-items-center rounded-full border border-white/[0.10] bg-white/[0.035] px-2.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-300 ${compact ? '' : 'shrink-0'}`}
      aria-label="Langue française"
    >
      FR
    </span>
  );
}
