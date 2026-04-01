import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  className?: string;
  size?: 'default' | 'large';
  showText?: boolean;
};

/**
 * Icône V stylisée : double éclair / chevron montant — symbolise la viralité et la performance.
 * Dégradé fuchsia → violet → indigo, glow ambiant sur hover.
 */
export function BrandIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} aria-hidden>
      {/* Halo ambiant derrière l'icône */}
      <span
        className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-vn-fuchsia/50 via-vn-violet/35 to-vn-indigo/40 blur-[10px] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative w-full h-full drop-shadow-[0_0_6px_rgba(232,121,249,0.55)]"
      >
        <defs>
          <linearGradient id="vn-logo-grad" x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#f0abfc" />
            <stop offset="45%"  stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="vn-logo-grad2" x1="4" y1="32" x2="32" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#e879f9" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        {/* Fond arrondi semi-transparent */}
        <rect width="36" height="36" rx="10" fill="url(#vn-logo-grad)" opacity="0.15" />
        {/*
          Lettre V stylisée avec un éclair intégré :
          - branche gauche : descend en diagonale puis remonte vers le centre (en V)
          - petit éclair au creux du V : triangle pointu vers le haut
          - épaisseur variable pour effet premium
        */}
        {/* Grande forme V — épaisse, gradient fill */}
        <path
          d="M7 8 L14.5 26 L18 20 L21.5 26 L29 8"
          stroke="url(#vn-logo-grad)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Accent central : petit éclair / flèche montante au creux du V */}
        <path
          d="M15.5 18 L18 13 L20.5 18"
          stroke="url(#vn-logo-grad2)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.9"
        />
        {/* Point lumineux en bas du V */}
        <circle cx="18" cy="26.5" r="1.5" fill="url(#vn-logo-grad2)" opacity="0.85" />
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
