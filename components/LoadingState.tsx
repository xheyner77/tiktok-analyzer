interface LoadingStateProps {
  statusLine?: string;
}

export default function LoadingState({ statusLine }: LoadingStateProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Score skeleton */}
      <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.02] p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-28 h-3 bg-white/[0.07] rounded-full animate-pulse" />

          <div className="relative flex items-center justify-center w-[176px] h-[176px]">
            <div className="absolute inset-0 rounded-full border-[10px] border-white/[0.06]" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-9 bg-white/[0.07] rounded-lg animate-pulse" />
              <div className="w-10 h-3 bg-white/[0.05] rounded animate-pulse" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full mt-1">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-center">
                <div className="w-12 h-2.5 bg-white/[0.07] rounded animate-pulse mx-auto mb-2" />
                <div className="w-8 h-5 bg-white/[0.07] rounded animate-pulse mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Synthèse skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
            <div className="w-16 h-2.5 bg-white/[0.07] rounded animate-pulse mb-2" />
            <div className="w-10 h-6 bg-white/[0.07] rounded animate-pulse mb-2" />
            <div className="w-full h-2 bg-white/[0.05] rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Analysis card skeletons */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/[0.07] animate-pulse" />
              <div className="w-28 h-3.5 bg-white/[0.07] rounded animate-pulse" />
            </div>
            <div className="w-16 h-5 bg-white/[0.07] rounded-full animate-pulse" />
          </div>
          <div className="h-1.5 w-full bg-white/[0.06] rounded-full mb-4 animate-pulse" />
          <div className="space-y-2">
            <div className="w-full h-2.5 bg-white/[0.05] rounded animate-pulse" />
            <div className="w-5/6 h-2.5 bg-white/[0.05] rounded animate-pulse" />
            <div className="w-4/6 h-2.5 bg-white/[0.05] rounded animate-pulse" />
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex items-center gap-2.5 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin text-vn-fuchsia" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-400">{statusLine ?? 'Analyse de la vidéo en cours...'}</span>
        </div>
        <div className="flex items-center gap-2">
          {['Hook', 'Montage', 'Rétention'].map((label) => (
            <span key={label} className="text-[11px] text-gray-600 bg-white/[0.03] border border-white/[0.07] px-2.5 py-1 rounded-full">{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
