'use client';

export function TrendLoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-[18px] border border-white/[0.07] bg-white/[0.04]" />
      ))}
    </div>
  );
}
