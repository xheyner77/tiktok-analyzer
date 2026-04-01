import Link from 'next/link';

type BrandLogoProps = {
  href?: string;
  className?: string;
  /** Larger text for auth screens */
  size?: 'default' | 'large';
  /** Show wordmark */
  showText?: boolean;
};

export function BrandIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl bg-gradient-to-br from-vn-fuchsia via-vn-violet to-vn-indigo flex items-center justify-center shadow-lg shadow-vn-fuchsia/25 ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="w-[55%] h-[55%]" aria-hidden>
        <path
          d="M4 18V6l8-2v14M4 18c0 1.5 1.5 3 3 3s3-1.5 3-3M12 4l8 2v10"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="18" r="2" fill="white" />
        <path
          d="M18 14l2 2-2 2"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
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
  const textCls =
    size === 'large'
      ? 'text-lg font-bold tracking-tight'
      : 'text-[15px] font-bold tracking-[-0.02em]';

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 group shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vn-violet/60 ${className}`}
    >
      <BrandIcon
        className={`${size === 'large' ? 'w-9 h-9 rounded-xl' : 'w-8 h-8 rounded-[10px]'} transition-transform group-hover:scale-[1.02]`}
      />
      {showText && (
        <span className={`text-white ${textCls}`}>
          Viral<span className="gradient-text">ynz</span>
        </span>
      )}
    </Link>
  );
}
