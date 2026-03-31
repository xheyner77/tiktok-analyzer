'use client';

import { useEffect, useState } from 'react';

interface AuthTransitionProps {
  show: boolean;
  onComplete: () => void;
}

const STEPS = [
  'Connexion...',
  'Chargement du profil...',
  'Finalisation...',
] as const;

const STEP_MS   = 667;   // ~667ms per step → 3 steps = ~2000ms
const TOTAL_MS  = 2100;  // total before onComplete fires

export default function AuthTransition({ show, onComplete }: AuthTransitionProps) {
  const [mounted, setMounted]     = useState(false); // drives fade-in + scale
  const [stepIdx, setStepIdx]     = useState(0);
  const [stepText, setStepText]   = useState(STEPS[0]);
  const [textVisible, setTextVisible] = useState(true);
  const [progress, setProgress]   = useState(0);

  useEffect(() => {
    if (!show) return;

    // Reset every time the overlay opens
    setStepIdx(0);
    setStepText(STEPS[0]);
    setTextVisible(true);
    setProgress(0);

    // Tiny delay so the initial render paints at opacity-0, then transitions in
    const fadeIn = setTimeout(() => {
      setMounted(true);
      // Kick off progress bar animation
      setTimeout(() => setProgress(100), 80);
    }, 30);

    // Text phase transitions
    const timers: ReturnType<typeof setTimeout>[] = [];

    [1, 2].forEach((idx) => {
      // Fade out current text
      timers.push(setTimeout(() => setTextVisible(false), STEP_MS * idx - 180));
      // Swap text + fade back in
      timers.push(setTimeout(() => {
        setStepIdx(idx);
        setStepText(STEPS[idx]);
        setTextVisible(true);
      }, STEP_MS * idx));
    });

    // Fire onComplete
    const done = setTimeout(() => onComplete(), TOTAL_MS);

    return () => {
      clearTimeout(fadeIn);
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Reset mount state when hidden so next open starts fresh
  useEffect(() => {
    if (!show) setMounted(false);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080808] flex items-center justify-center"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.35s ease',
      }}
    >
      {/* ── Ambient glows ───────────────────────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large outer glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-gradient-to-br from-[#ff0050]/8 to-[#7928ca]/8 blur-3xl" />
        {/* Pulsing inner glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-gradient-to-br from-[#ff0050]/10 to-[#7928ca]/10 blur-2xl animate-pulse" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center gap-8 px-6 select-none"
        style={{
          transform: mounted ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff0050] to-[#7928ca] flex items-center justify-center shadow-lg shadow-[#ff0050]/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="text-base font-bold text-white">
            TikTok<span className="gradient-text">Analyzer</span>
          </span>
        </div>

        {/* Premium spinner */}
        <div className="relative flex items-center justify-center">
          {/* Outer glow ring */}
          <div
            className="absolute w-20 h-20 rounded-full opacity-20 animate-ping"
            style={{ background: 'radial-gradient(circle, #ff0050, #7928ca)' }}
          />
          {/* Spinning arc */}
          <div className="w-16 h-16 animate-spin" style={{ animationDuration: '1.1s' }}>
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16">
              {/* Track */}
              <circle cx="32" cy="32" r="26" stroke="#1a1a1a" strokeWidth="4" />
              {/* Gradient arc */}
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="url(#auth-spinner-grad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="82 164"
                strokeDashoffset="0"
              />
              <defs>
                <linearGradient id="auth-spinner-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ff0050" />
                  <stop offset="100%" stopColor="#7928ca" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {/* Center dot */}
          <div className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-[#ff0050] to-[#7928ca] shadow-md shadow-[#ff0050]/40" />
        </div>

        {/* Text block */}
        <div className="flex flex-col items-center gap-2 text-center" style={{ minHeight: '3rem' }}>
          <p className="text-base font-semibold text-white leading-snug">
            Préparation de ton espace d&apos;analyse...
          </p>
          {/* Step text with fade transition */}
          <p
            key={stepIdx}
            className="text-sm text-gray-500 transition-opacity duration-200"
            style={{ opacity: textVisible ? 1 : 0 }}
          >
            {stepText}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col items-center gap-2 w-64">
          <div className="w-full h-[3px] bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ff0050] to-[#7928ca]"
              style={{
                width: `${progress}%`,
                transition: `width ${TOTAL_MS - 150}ms cubic-bezier(0.4, 0, 0.15, 1)`,
                boxShadow: '0 0 10px #ff005055',
              }}
            />
          </div>
          <span className="text-[11px] text-gray-600 tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}
