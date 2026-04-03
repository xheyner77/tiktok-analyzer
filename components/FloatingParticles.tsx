'use client';

import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  colorIdx: number;
  life: number;
  maxLife: number;
}

const COLORS = [
  [232, 121, 249],
  [167, 139, 250],
  [99,  102, 241],
  [216,  90, 240],
];

interface Props {
  className?: string;
  count?: number;
}

export default function FloatingParticles({ className = '', count = 40 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Désactiver sur mobile pour éviter les crashes iOS Safari
    if (typeof window !== 'undefined' && window.innerWidth < 640) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animId: number;
    let w = 0;
    let h = 0;
    let paused = false;

    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w;
      canvas.height = h;
    };

    const spawn = (randomY = false): Particle => {
      const maxLife = 200 + Math.random() * 200;
      return {
        x:        Math.random() * w,
        y:        randomY ? Math.random() * h : h + 8,
        vx:       (Math.random() - 0.5) * 0.3,
        vy:       -(Math.random() * 0.5 + 0.2),
        size:     Math.random() * 1.4 + 0.4,
        opacity:  0,
        colorIdx: Math.floor(Math.random() * COLORS.length),
        life:     randomY ? Math.random() * maxLife : 0,
        maxLife,
      };
    };

    resize();

    // Throttle resize pour éviter les recalculs intensifs au zoom
    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      paused = true;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        paused = false;
      }, 150);
    };
    window.addEventListener('resize', onResize, { passive: true });

    // Pause quand l'onglet est caché
    const onVisibility = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    for (let i = 0; i < count; i++) particles.push(spawn(true));

    const tick = () => {
      animId = requestAnimationFrame(tick);
      if (paused) return;

      ctx.clearRect(0, 0, w, h);

      if (particles.length < count * 1.2 && Math.random() < 0.12) {
        particles.push(spawn(false));
      }

      particles = particles.filter((p) => {
        p.life += 1;
        p.x += p.vx;
        p.y += p.vy;

        const t = p.life / p.maxLife;
        const raw = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
        p.opacity = Math.min(raw * 0.55, 0.55);

        const [r, g, b] = COLORS[p.colorIdx];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity})`;
        ctx.fill();

        return p.life < p.maxLife && p.y > -10;
      });
    };

    tick();

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
}
