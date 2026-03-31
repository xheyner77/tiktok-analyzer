interface LoadingStateProps {
  /** Shown in the footer line (e.g. frame extraction step before API call). */
  statusLine?: string;
}

export default function LoadingState({ statusLine }: LoadingStateProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Score skeleton */}
      <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 card-glow">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-3 bg-[#1a1a1a] rounded-full animate-pulse" />

          <div className="relative flex items-center justify-center w-[168px] h-[168px]">
            <div className="absolute inset-0 rounded-full border-[10px] border-[#1a1a1a]" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-8 bg-[#1a1a1a] rounded-lg animate-pulse" />
              <div className="w-8 h-3 bg-[#1a1a1a] rounded animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-[#0e0e0e] rounded-xl p-3 text-center border border-[#1a1a1a]">
                <div className="w-12 h-2.5 bg-[#1a1a1a] rounded animate-pulse mx-auto mb-2" />
                <div className="w-8 h-5 bg-[#1a1a1a] rounded animate-pulse mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analysis card skeletons */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 card-glow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] animate-pulse" />
              <div className="w-28 h-3.5 bg-[#1a1a1a] rounded animate-pulse" />
            </div>
            <div className="w-16 h-5 bg-[#1a1a1a] rounded-full animate-pulse" />
          </div>
          <div className="h-1.5 w-full bg-[#1a1a1a] rounded-full mb-4" />
          <div className="space-y-2">
            <div className="w-full h-2.5 bg-[#1a1a1a] rounded animate-pulse" />
            <div className="w-5/6 h-2.5 bg-[#1a1a1a] rounded animate-pulse" />
            <div className="w-4/6 h-2.5 bg-[#1a1a1a] rounded animate-pulse" />
          </div>
        </div>
      ))}

      {/* Loading text */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <svg className="w-4 h-4 animate-spin text-[#ff0050]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{statusLine ?? 'Analyse de la vidéo en cours...'}</span>
        </div>
        <p className="text-xs text-gray-600">Hook · Montage · Rétention</p>
      </div>
    </div>
  );
}
