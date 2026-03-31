export default function Header() {
  return (
    <div className="text-center space-y-4">
      {/* Logo mark */}
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ff0050] to-[#7928ca] shadow-lg shadow-[#ff0050]/20 mb-2">
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
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-white">TikTok</span>{' '}
          <span className="gradient-text">Analyzer</span>
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-sm mx-auto leading-relaxed">
          Analysez la viralité de n&apos;importe quelle vidéo TikTok en quelques secondes grâce à l&apos;IA.
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
