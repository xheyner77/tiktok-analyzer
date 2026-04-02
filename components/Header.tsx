export default function Header() {
  return (
    <div className="space-y-5 text-center sm:text-left">
      {/* Title */}
      <div>
        <h1 className="text-[1.9rem] sm:text-[2.3rem] font-black tracking-tight leading-tight">
          <span className="text-white">Comprends ce qui </span>
          <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">
            bloque ta vidéo
          </span>
        </h1>
        <p className="mt-2 text-[13px] text-gray-500 max-w-xs sm:max-w-xs mx-auto sm:mx-0 leading-relaxed">
          Hook, montage, rétention — identifie quoi corriger avant de reposter.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-1.5 justify-center sm:justify-start">
        {[
          { label: 'Hook',        color: 'border-vn-fuchsia/20 text-vn-fuchsia/75' },
          { label: 'Montage',     color: 'border-vn-violet/20 text-vn-violet/75'  },
          { label: 'Rétention',   color: 'border-vn-indigo/20 text-vn-indigo/75'  },
          { label: 'Conseils IA', color: 'border-purple-400/20 text-purple-400/70' },
        ].map(({ label, color }) => (
          <span key={label}
            className={`text-[10px] font-medium bg-vn-surface border px-3 py-0.5 rounded-full ${color}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
