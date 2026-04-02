import type { ReactNode } from 'react';
import LandingResultsDemo from './LandingResultsDemo';

type Variant = 'hero' | 'showcase';

/* ── Export principal ────────────────────────────────────── */
export default function LandingProductMockup({
  variant = 'hero',
  className = '',
  footerSlot,
}: {
  variant?: Variant;
  className?: string;
  footerSlot?: ReactNode;
}) {
  const isHero = variant === 'hero';

  const frame = (
    <div className="relative">
      {/* Outer glow */}
      <div
        className="absolute -inset-[3px] sm:-inset-5 rounded-[1.3rem] bg-gradient-to-br from-vn-fuchsia/38 via-vn-violet/16 to-vn-indigo/35 blur-2xl sm:blur-[40px] opacity-90"
        aria-hidden
      />
      {/* Fixed-height clip window — uses the real ResultsPanel */}
      <div className="relative overflow-hidden rounded-[1.1rem] sm:rounded-[1.3rem] h-[400px] sm:h-[480px] md:h-[540px] lg:h-[580px] xl:h-[620px]">
        <LandingResultsDemo />
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`}>
      {isHero ? (
        <>
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-[18%] w-[min(100%,1200px)] h-[min(30vw,240px)] rounded-[100%] bg-gradient-to-b from-vn-fuchsia/30 via-vn-violet/15 to-transparent blur-3xl opacity-80"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-[30%] w-[min(100%,1100px)] h-[min(50vw,460px)] max-h-[500px] rounded-[100%] bg-gradient-to-t from-vn-indigo/35 via-vn-violet/18 to-transparent blur-3xl opacity-90"
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-[min(100%,1340px)] [perspective:2200px]">
            <div className="transform-gpu will-change-transform origin-[50%_0%] sm:[transform:rotateX(5deg)] transition-transform duration-500">
              {frame}
            </div>
          </div>
        </>
      ) : (
        <div className="relative mx-auto w-full max-w-[min(100%,1180px)] sm:[perspective:2400px]">
          <div className="transform-gpu sm:[transform:rotateX(2deg)] origin-[50%_0%]">
            {frame}
          </div>
        </div>
      )}
      {footerSlot ? <div className="relative mt-8 sm:mt-10">{footerSlot}</div> : null}
    </div>
  );
}
