import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: 'default' | 'large';
  showText?: boolean;
};

/**
 * Icône Viralynz — V solide premium.
 * Formes pleines (pas de traits) pour lisibilité à toutes les tailles.
 * Fond arrondi foncé + bras gauche (déclin) / droit (montée virale) légèrement asymétrique.
 */
export function BrandIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} aria-hidden>
      {/* Halo ambiant */}
      <span
        className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-vn-fuchsia/45 via-vn-violet/30 to-vn-indigo/35 blur-[12px] opacity-55 transition-opacity duration-300 group-hover:opacity-90"
        aria-hidden
      />
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full"
      >
        <defs>
          <linearGradient id="vn-bg-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#1e0933" />
            <stop offset="100%" stopColor="#080612" />
          </linearGradient>
          <linearGradient id="vn-fill" x1="5" y1="6" x2="35" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#f0abfc" />
            <stop offset="40%"  stopColor="#e879f9" />
            <stop offset="75%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="vn-fill-r" x1="35" y1="6" x2="5" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#f0abfc" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <radialGradient id="vn-spark" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="1" />
            <stop offset="55%"  stopColor="#f0abfc" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
          </radialGradient>
          <filter id="vn-gf" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Fond arrondi dark */}
        <rect width="40" height="40" rx="10" fill="url(#vn-bg-g)" />
        {/* Teinture intérieure subtile */}
        <rect width="40" height="40" rx="10" fill="url(#vn-fill)" opacity="0.09" />
        {/* Bordure fine */}
        <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9.5"
          stroke="url(#vn-fill)" strokeOpacity="0.28" strokeWidth="1.5" />

        {/* ═══ Bras gauche du V (déclin → creux) ═════════════════ */}
        {/* Forme solide : trapèze large en haut, pointu en bas */}
        <path d="M7.5 10 L13.5 10 L21 27 L19 27 Z" fill="url(#vn-fill)" />

        {/* ═══ Bras droit du V (remontée virale) — légèrement plus haut ═ */}
        {/* Légèrement asymétrique : part de y=7 (plus haut) suggère croissance */}
        <path d="M32.5 7 L26.5 7 L21 27 L23 27 Z" fill="url(#vn-fill-r)" opacity="0.92" />

        {/* Éclat lumineux au creux du V */}
        <circle cx="21" cy="27.5" r="2.6" fill="url(#vn-spark)" filter="url(#vn-gf)" />

        {/* Petit point lumineux en haut du bras droit (sommet viral) */}
        <circle cx="32.5" cy="7" r="1.8" fill="#f0abfc" opacity="0.7" />
      </svg>
    </div>
  );
}

export default function BrandLogo({
  href = '/',
  className = '',
  size = 'default',
  showText = true,
}: BrandLogoProps) {
  const iconSize = size === 'large' ? 'w-10 h-10' : 'w-[2.1rem] h-[2.1rem]';
  const textSize = size === 'large' ? 'text-[1.2rem]' : 'text-[1.05rem]';

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 group shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60 ${className}`}
    >
      <BrandIcon className={`${iconSize} transition-transform duration-300 group-hover:scale-[1.06]`} />
      {showText && (
        <span
          className={`font-bold tracking-[-0.035em] ${textSize} leading-none`}
          style={{
            background: 'linear-gradient(105deg, #ffffff 30%, #d8b4fe 65%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Viralynz
        </span>
      )}
    </Link>
  );
}
