interface AnalysisCounterProps {
  used: number;
  limit?: number; // undefined = unlimited (Elite plan)
}

export default function AnalysisCounter({ used, limit }: AnalysisCounterProps) {
  const isUnlimited = limit === undefined;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);
  const isExhausted = !isUnlimited && remaining === 0;

  if (isUnlimited) {
    return (
      <div className="flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#ff0050]" style={{ boxShadow: '0 0 6px #ff005060' }} />
        <span className="text-xs font-medium text-gray-500">Analyses illimitées — Plan Elite</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5">
      {/* Dots */}
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

      {/* Label */}
      <span className={`text-xs font-medium ${isExhausted ? 'text-red-400' : 'text-gray-500'}`}>
        {isExhausted
          ? 'Limite atteinte — passage Premium requis'
          : `${remaining} analyse${remaining > 1 ? 's' : ''} gratuite${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}`}
      </span>
    </div>
  );
}
