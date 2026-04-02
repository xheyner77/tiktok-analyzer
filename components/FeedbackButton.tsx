'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Status = 'idle' | 'sending' | 'success' | 'error';

const CATEGORIES = [
  { id: 'bug',         label: '🐛 Bug' },
  { id: 'suggestion',  label: '💡 Suggestion' },
  { id: 'question',    label: '❓ Question' },
  { id: 'other',       label: '💬 Autre' },
] as const;

type Category = typeof CATEGORIES[number]['id'];

export default function FeedbackButton() {
  const [open,     setOpen]     = useState(false);
  const [category, setCategory] = useState<Category>('suggestion');
  const [message,  setMessage]  = useState('');
  const [status,   setStatus]   = useState<Status>('idle');
  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const [visible,  setVisible]  = useState(false);
  /* createPortal needs the DOM — track mount so we never SSR-render the portal */
  const [domReady, setDomReady] = useState(false);

  useEffect(() => { setDomReady(true); }, []);

  /* Fade-in */
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setVisible(true);
        textareaRef.current?.focus();
      }, 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [open]);

  /* Auto-close after success */
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => {
      setOpen(false);
      setTimeout(() => { setStatus('idle'); setMessage(''); setCategory('suggestion'); }, 350);
    }, 2200);
    return () => clearTimeout(t);
  }, [status]);

  /* Close on Escape */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  async function handleSubmit() {
    if (!message.trim() || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const modal = (
    /*
     * Rendered via createPortal into document.body — completely outside the
     * Navbar's stacking context (backdrop-filter creates a containing block
     * that would otherwise confine `fixed` children to the 56px navbar).
     */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.82 : 0})`,
        backdropFilter:  `blur(${visible ? 8 : 0}px)`,
        transition:      'background-color 0.2s ease, backdrop-filter 0.2s ease',
      }}
      onClick={() => setOpen(false)}
    >
      {/* Card — stopPropagation keeps clicks inside from closing the modal */}
      <div
        className="relative w-full max-w-md bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl shadow-2xl"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  `scale(${visible ? 1 : 0.97}) translateY(${visible ? 0 : 8}px)`,
          transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full bg-gradient-to-br from-vn-fuchsia/10 to-vn-indigo/10 blur-2xl pointer-events-none" />

        <div className="relative p-6">
          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 w-7 h-7 rounded-lg bg-[#1a1a1a] flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-[#222] transition-colors"
            aria-label="Fermer"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>

          {status === 'success' ? (
            <div className="py-6 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-fuchsia/15 to-vn-indigo/15 border border-vn-fuchsia/20 flex items-center justify-center text-2xl">
                🙏
              </div>
              <div>
                <p className="text-base font-bold text-white mb-1">Message envoyé !</p>
                <p className="text-sm text-gray-500">On te répond dans les meilleurs délais.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 pr-6">
                <h2 className="text-base font-bold text-white mb-1">Nous contacter</h2>
                <p className="text-xs text-gray-500">Bug, question, suggestion — on te répond rapidement.</p>
              </div>

              {/* Category tabs */}
              <div className="flex gap-1.5 mb-4">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                      ${category === c.id
                        ? 'bg-[#1a1a1a] border border-[#333] text-white'
                        : 'text-gray-600 hover:text-gray-400 hover:bg-white/5'
                      }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décris ton problème, ta question ou ta suggestion…"
                rows={4}
                maxLength={1000}
                className="w-full bg-[#111] border border-[#222] hover:border-[#2a2a2a] focus:border-[#ff0050]/40 focus:ring-2 focus:ring-[#ff0050]/8 text-white text-sm placeholder-gray-600 rounded-xl px-4 py-3 resize-none transition-all duration-150 mb-1"
              />
              <p className="text-right text-[11px] text-gray-700 mb-4 tabular-nums">
                {message.length} / 1000
              </p>

              {status === 'error' && (
                <p className="text-xs text-red-400 mb-3">
                  Une erreur est survenue. Réessaie dans un instant.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending'}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white font-semibold text-sm hover:opacity-90 transition-all duration-200 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-vn-fuchsia/15"
              >
                {status === 'sending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi…
                  </span>
                ) : 'Envoyer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Trigger ───────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/5"
        aria-label="Envoyer un feedback"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
          <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.457 1.457 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
        </svg>
        <span className="hidden sm:inline">Nous contacter</span>
      </button>

      {/* ── Modal via portal (bypasses Navbar stacking context) ───────────── */}
      {open && domReady && createPortal(modal, document.body)}
    </>
  );
}
