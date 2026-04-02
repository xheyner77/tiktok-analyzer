export default function Header() {
  return (
    <div className="text-center space-y-4">
      {/* Title only — no logo, no brand label */}
      <div>
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
        <p className="mt-2 text-gray-400 text-[0.93rem] max-w-sm mx-auto leading-relaxed">
          Décode hook, montage et rétention sur tes vidéos courtes — TikTok en priorité, avec une vision multi-plateformes.
        </p>
      </div>

      {/* Feature pills — 4 couleurs cohérentes */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {[
          { label: 'Hook',      color: 'border-vn-fuchsia/25 text-vn-fuchsia/85' },
          { label: 'Montage',   color: 'border-vn-violet/25 text-vn-violet/85' },
          { label: 'Rétention', color: 'border-vn-indigo/25 text-vn-indigo/85' },
          { label: 'Conseils',  color: 'border-purple-400/25 text-purple-300/85' },
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
