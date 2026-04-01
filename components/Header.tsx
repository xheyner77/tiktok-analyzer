export default function Header() {
  return (
    <div className="text-center space-y-4">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-vn-fuchsia via-vn-violet to-vn-indigo shadow-lg shadow-vn-fuchsia/25 mb-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7"
        >
          <path d="M4 18V6l8-2v14M4 18c0 1.5 1.5 3 3 3s3-1.5 3-3M12 4l8 2v10" />
          <circle cx="7" cy="18" r="2" fill="white" />
        </svg>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-vn-violet mb-1">Viralynz</p>
        <h1 className="text-3xl font-display font-bold tracking-tight">
          <span className="text-white">Analyse</span>{' '}
          <span className="gradient-text">vidéo</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
          Décode hook, montage et rétention sur tes vidéos courtes — TikTok en priorité, avec une vision multi-plateformes.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {['Hook', 'Montage', 'Rétention', 'Conseils'].map((label) => (
          <span
            key={label}
            className="text-xs text-gray-500 bg-[#111] border border-[#1f1f1f] px-3 py-1 rounded-full"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
