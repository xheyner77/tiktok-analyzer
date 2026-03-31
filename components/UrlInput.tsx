'use client';

import { KeyboardEvent, useState } from 'react';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  isLocked?: boolean;
}

export default function UrlInput({
  value,
  onChange,
  onAnalyze,
  isLoading,
  isLocked = false,
}: UrlInputProps) {
  const [pasteState, setPasteState] = useState<'idle' | 'ok' | 'error'>('idle');

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading && !isLocked) onAnalyze();
  };

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        onChange(text.trim());
        setPasteState('ok');
        setTimeout(() => setPasteState('idle'), 1400);
      }
    } catch {
      setPasteState('error');
      setTimeout(() => setPasteState('idle'), 1800);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative group">
        {/* Left icon — lock if locked, TikTok otherwise */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLocked ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-[#7928ca]/60">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.88a8.21 8.21 0 004.79 1.52V7A4.85 4.85 0 0119.59 6.69z" />
            </svg>
          )}
        </div>

        <input
          type="url"
          value={value}
          onChange={(e) => !isLocked && onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLocked ? 'Accès Premium requis pour continuer…' : 'Colle un lien TikTok ici...'}
          disabled={isLoading || isLocked}
          className={`w-full bg-[#111] border rounded-xl pl-12 pr-4 py-4 text-sm transition-all duration-200 outline-none disabled:cursor-not-allowed
            ${isLocked
              ? 'border-[#2a1a3a] text-gray-600 placeholder-gray-700 opacity-60 select-none'
              : 'border-[#222] hover:border-[#333] focus:border-[#ff0050]/50 focus:ring-2 focus:ring-[#ff0050]/10 text-white placeholder-gray-600 disabled:opacity-50'
            }`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {!isLoading && !isLocked && (
            <button
              type="button"
              onClick={handlePaste}
              className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                pasteState === 'ok'
                  ? 'text-green-400 border-green-500/30 bg-green-500/10'
                  : pasteState === 'error'
                  ? 'text-red-400 border-red-500/30 bg-red-500/10'
                  : 'text-gray-500 border-[#2a2a2a] hover:text-gray-300 hover:border-[#3a3a3a]'
              }`}
              aria-label="Coller depuis le presse-papiers"
            >
              {pasteState === 'ok' ? 'Collé' : pasteState === 'error' ? 'Erreur' : 'Coller'}
            </button>
          )}

          {value && !isLoading && !isLocked && (
            <button
              onClick={() => onChange('')}
              className="text-gray-600 hover:text-gray-400 transition-colors p-1"
              aria-label="Effacer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!isLocked && (
        <p className="text-[11px] text-gray-600 px-1">
          Format attendu: `https://www.tiktok.com/@username/video/...`
        </p>
      )}

      <button
        onClick={onAnalyze}
        disabled={isLoading || isLocked || !value.trim()}
        className={`w-full relative overflow-hidden rounded-xl py-4 font-semibold text-white text-sm transition-all duration-200 active:scale-[0.99] shadow-lg
          ${isLocked
            ? 'bg-[#1a1a2a] border border-[#2a1a3a] opacity-50 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-[#ff0050] to-[#7928ca] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[#ff0050]/10'
          }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyse en cours...
          </span>
        ) : isLocked ? (
          <span className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            Accès Premium requis
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd" />
            </svg>
            Analyser la vidéo
          </span>
        )}
      </button>
    </div>
  );
}
