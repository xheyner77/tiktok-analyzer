export default function Header() {
  return (
    <div className="text-center space-y-5">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-vn-fuchsia/20 bg-vn-fuchsia/[0.06] px-4 py-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-vn-fuchsia animate-pulse" />
        <span className="text-[11px] font-semibold text-vn-fuchsia/90 tracking-wide">Analyse vidéo IA</span>
      </div>

      {/* Title */}
      <div>
        <h1 className="text-[2rem] sm:text-[2.5rem] font-display font-bold tracking-tight leading-tight">
          <span className="text-white">Comprends ce qui </span>
          <span
            style={{
              background: 'linear-gradient(105deg, #f5c5ff 0%, #c084fc 45%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            bloque ta vidéo
          </span>
        </h1>
        <p className="mt-2.5 text-gray-400 text-[0.92rem] max-w-xs mx-auto leading-relaxed">
          Hook, montage, rétention — identifie exactement quoi corriger avant de reposter.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { label: 'Hook',       color: 'border-vn-fuchsia/25 text-vn-fuchsia/85' },
          { label: 'Montage',    color: 'border-vn-violet/25 text-vn-violet/85'  },
          { label: 'Rétention',  color: 'border-vn-indigo/25 text-vn-indigo/85'  },
          { label: 'Conseils IA', color: 'border-purple-400/25 text-purple-300/85' },
        ].map(({ label, color }) => (
          <span
            key={label}
            className={`text-[11px] font-medium bg-white/[0.04] border px-3.5 py-1 rounded-full ${color}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
