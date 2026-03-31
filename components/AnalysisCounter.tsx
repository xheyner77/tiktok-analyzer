interface AnalysisCounterProps {
  used: number;
  limit?: number;
}

export default function AnalysisCounter({ used, limit }: AnalysisCounterProps) {
  const isUnlimited = limit === undefined;

  if (isUnlimited) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff0050]" style={{ boxShadow: '0 0 6px #ff005060' }} />
        <span className="text-xs font-medium text-gray-500">Quota mensuel — Plan Elite</span>
      </div>
    );
  }

  const remaining = Math.max(0, limit - used);
  const isExhausted = remaining === 0;

  /* For small limits (≤ 5) keep the dot UI; above that use a progress bar */
  if (limit <= 5) {
    return (
      <div className="flex items-center justify-center gap-2.5">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: limit }).map((_, i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i < used ? '#2a2a2a' : '#ff0050',
                boxShadow: i < used ? 'none' : '0 0 6px #ff005060',
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

  /* Pour les plafonds élevés (ex. Pro / Elite), barre + texte */
  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="flex items-center justify-center gap-3">
      <div className="w-24 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 90 ? '#ef4444' : 'linear-gradient(to right, #ff0050, #7928ca)',
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
