export default function Header() {
  return (
    <div className="space-y-5">
      {/* Label */}
      <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-gray-600">
        Viralynz · Analyse vidéo IA
      </p>

      {/* Title */}
      <div>
        <h1 className="text-[1.9rem] sm:text-[2.3rem] font-display font-bold tracking-tight leading-tight">
          <span className="text-white">Comprends ce qui </span>
          <span style={{
            background: 'linear-gradient(105deg, #f5c5ff 0%, #c084fc 45%, #818cf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            bloque ta vidéo
          </span>
        </h1>
        <p className="mt-2 text-[13px] text-gray-500 max-w-xs leading-relaxed">
          Hook, montage, rétention — identifie quoi corriger avant de reposter.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'Hook',        color: 'border-vn-fuchsia/20 text-vn-fuchsia/75' },
          { label: 'Montage',     color: 'border-vn-violet/20 text-vn-violet/75'  },
          { label: 'Rétention',   color: 'border-vn-indigo/20 text-vn-indigo/75'  },
          { label: 'Conseils IA', color: 'border-purple-400/20 text-purple-400/70' },
        ].map(({ label, color }) => (
          <span key={label}
            className={`text-[10px] font-medium bg-white/[0.03] border px-3 py-0.5 rounded-full ${color}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
