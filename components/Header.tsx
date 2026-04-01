export default function Header() {
  return (
    <div className="text-center space-y-5">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-vn-fuchsia/50 via-vn-violet/35 to-vn-indigo/40 blur-xl opacity-80" aria-hidden />
          <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-fuchsia via-vn-violet to-vn-indigo shadow-lg shadow-vn-fuchsia/30">
            <svg viewBox="0 0 36 36" fill="none" className="w-8 h-8">
              <path d="M7 8 L14.5 26 L18 20 L21.5 26 L29 8" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15.5 18 L18 13 L20.5 18" stroke="rgba(255,255,255,0.75)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-vn-fuchsia mb-1.5">Viralynz</p>
          <h1 className="text-[2rem] sm:text-[2.4rem] font-display font-bold tracking-tight leading-tight">
            <span className="text-white">Analyse </span>
            <span
              style={{
                background: 'linear-gradient(105deg, #f5c5ff 0%, #c084fc 45%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              vidéo
            </span>
          </h1>
          <p className="mt-2.5 text-gray-400 text-[0.93rem] max-w-sm mx-auto leading-relaxed">
            Décode hook, montage et rétention sur tes vidéos courtes — TikTok en priorité, avec une vision multi-plateformes.
          </p>
        </div>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { label: 'Hook',      color: 'border-vn-fuchsia/20 text-vn-fuchsia/80' },
          { label: 'Montage',   color: 'border-vn-violet/20 text-vn-violet/80' },
          { label: 'Rétention', color: 'border-vn-indigo/20 text-vn-indigo/80' },
          { label: 'Conseils',  color: 'border-white/10 text-gray-400' },
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
