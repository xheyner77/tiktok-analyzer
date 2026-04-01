interface AnalysisCounterProps {
  used: number;
  limit?: number;
}

export default function AnalysisCounter({ used, limit }: AnalysisCounterProps) {
  const isUnlimited = limit === undefined;

  if (isUnlimited) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-vn-fuchsia" style={{ boxShadow: '0 0 6px rgba(232,121,249,0.6)' }} />
        <span className="text-xs font-medium text-gray-500">Quota mensuel — Plan Elite</span>
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const isExhausted = remaining === 0;

  if (limit <= 5) {
    return (
      <div className="flex items-center justify-center gap-2.5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: limit }).map((_, i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < used ? 'rgba(255,255,255,0.08)' : '#e879f9',
                boxShadow: i < used ? 'none' : '0 0 6px rgba(232,121,249,0.55)',
              }}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${isExhausted ? 'text-red-400' : 'text-gray-500'}`}>
          {isExhausted
            ? 'Limite atteinte'
            : `${remaining} analyse${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
        </span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="w-24 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 90 ? '#f87171' : 'linear-gradient(to right, #e879f9, #818cf8)',
          }}
        />
      </div>
      <span className={`text-xs font-medium ${isExhausted ? 'text-red-400' : 'text-gray-500'}`}>
        {isExhausted
          ? 'Limite atteinte'
          : `${remaining} analyse${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
      </span>
    </div>
  );
}
