'use client';

import { useLanguage } from '@/lib/i18n/useLanguage';
import type { Language } from '@/lib/i18n/translations';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  function selectLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.035] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl ${compact ? '' : 'shrink-0'}`}
      aria-label="Language"
    >
      {(['fr', 'en'] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => selectLanguage(item)}
          aria-pressed={language === item}
          className={`grid h-8 min-w-10 place-items-center rounded-full px-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition ${
            language === item
              ? 'bg-[linear-gradient(135deg,rgba(34,211,238,0.24),rgba(124,58,237,0.38))] text-white shadow-[0_12px_30px_-22px_rgba(34,211,238,0.95),inset_0_1px_0_rgba(255,255,255,0.18)]'
              : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
          }`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
