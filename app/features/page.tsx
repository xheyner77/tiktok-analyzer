import type { Metadata } from 'next';
import Link from 'next/link';
import FloatingParticles from '@/components/FloatingParticles';

export const metadata: Metadata = {
  title: 'Fonctionnalités – Viralynz',
  description:
    "Analyse vidéo IA, diagnostic hook, montage et rétention, plan d'action priorisé, hook generator. Tout ce dont tu as besoin pour performer sur TikTok.",
};

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} shrink-0 text-vn-fuchsia`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconScan() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}
function IconEye() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function IconStar() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}
function IconTarget() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}
function IconRocket() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 01-2.58 5.841m0 0a6 6 0 01-5.84-7.38m5.84 7.38h.008" />
    </svg>
  );
}

const coreFeatures = [
  {
    icon: <IconScan />,
    tag: 'Analyse IA',
    title: 'Score de viralité',
    desc: "Un score de 0 à 100 calculé par vision IA sur ta vidéo réelle. Pas une estimation basée sur les stats — une lecture frame par frame de ce qui accroche ou décroche.",
    points: ['Score global 0–100', 'Analyse frame par frame', 'Contexte stats TikTok'],
    accent: 'from-vn-fuchsia/[0.08] to-transparent',
    border: 'border-vn-fuchsia/15',
    iconBg: 'bg-vn-fuchsia/10 border-vn-fuchsia/20 text-vn-fuchsia',
  },
  {
    icon: <IconEye />,
    tag: 'Diagnostic',
    title: 'Analyse du Hook',
    desc: "Les 3 premières secondes décident tout. Viralynz détecte si ton ouverture retient l'attention, crée de la curiosité, et donne envie de continuer.",
    points: ["Détection d'accroche", 'Curiosity gap analysé', 'Première impression scorée'],
    accent: 'from-blue-500/[0.06] to-transparent',
    border: 'border-blue-500/15',
    iconBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  },
  {
    icon: <IconChart />,
    tag: 'Diagnostic',
    title: 'Rétention & Montage',
    desc: "Courbe d'attention estimée, coupes analysées, rythme visuel mesuré. Tu sais exactement à quel moment l'audience décroche — et pourquoi.",
    points: ["Courbe d'attention estimée", 'Analyse du rythme de coupe', 'Drops identifiés et annotés'],
    accent: 'from-purple-500/[0.06] to-transparent',
    border: 'border-purple-500/15',
    iconBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  },
];

const secondaryFeatures = [
  {
    icon: <IconTarget />,
    title: 'Problème principal',
    desc: "Un diagnostic en une phrase. Pas 3 pages de rapport. Tu sais exactement ce qui bloque ta vidéo.",
  },
  {
    icon: <IconBolt />,
    title: "Plan d'action",
    desc: "3 à 5 actions concrètes, priorisées par impact. Pas des conseils génériques — des corrections précises pour ta vidéo.",
  },
  {
    icon: <IconMic />,
    title: 'Transcription audio',
    desc: "L'IA analyse aussi ce que tu dis. Accroche verbale, rythme de parole, clarté du message — tout est pris en compte.",
  },
  {
    icon: <IconHistory />,
    title: 'Historique & progression',
    desc: "Chaque analyse est sauvegardée. Suis ta progression vidéo après vidéo et identifie les patterns qui reviennent.",
  },
  {
    icon: <IconStar />,
    title: 'Hook Generator',
    desc: "Génère des hooks percutants adaptés à ton contenu. Courts, viraux, prêts à tester. Disponible en Pro & Elite.",
  },
  {
    icon: <IconRocket />,
    title: 'Dashboard coach',
    desc: "Vue synthétique de toutes tes performances : score moyen, points forts, points faibles, plan de progression.",
  },
];

const pillars = [
  {
    name: 'Hook',
    color: 'text-vn-fuchsia',
    bg: 'bg-vn-fuchsia/10 border-vn-fuchsia/20',
    desc: "Les 3 premières secondes qui font tout. L'IA mesure si ton ouverture accroche, crée de la curiosité et donne envie de rester.",
    metrics: ["Puissance d'accroche", 'Curiosity gap', 'Première image analysée', 'Texte overlay détecté'],
  },
  {
    name: 'Montage',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    desc: "Rythme des coupes, intensité visuelle, lisibilité — un montage fluide retient. Un montage plat fait décrocher.",
    metrics: ['Fréquence de coupe', 'Intensité visuelle', 'Cohérence du rythme', 'Transitions analysées'],
  },
  {
    name: 'Rétention',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    desc: "La courbe d'attention estimée frame par frame. Tu vois où l'audience décroche — et ce qui cause la chute.",
    metrics: ["Courbe d'attention", 'Drops identifiés', 'Moments forts repérés', 'Durée optimale estimée'],
  },
];

const plans = [
  {
    name: 'Starter',
    color: 'text-gray-400',
    border: 'border-white/[0.07]',
    features: [
      'Analyse vidéo IA complète',
      'Score de viralité',
      'Diagnostic Hook / Montage / Rétention',
      "Plan d'action priorisé",
      '3 analyses à vie',
    ],
    locked: ['Hook generator', 'Historique illimité', 'Transcription audio'],
  },
  {
    name: 'Pro',
    color: 'text-vn-fuchsia',
    border: 'border-vn-fuchsia/25',
    bg: 'bg-vn-fuchsia/[0.04]',
    badge: 'Le plus populaire',
    features: [
      'Tout Starter, plus :',
      '50 analyses / mois',
      'Hook generator (150 hooks/mois)',
      'Historique complet',
      'Transcription audio',
      'Dashboard IA & progression',
    ],
    locked: [],
  },
  {
    name: 'Elite',
    color: 'text-purple-400',
    border: 'border-purple-500/25',
    bg: 'bg-purple-500/[0.04]',
    features: [
      'Tout Pro, plus :',
      '200 analyses / mois',
      '500 hooks / mois',
      'Insights viraux avancés',
      'Volume & profondeur max',
      'Support prioritaire',
    ],
    locked: [],
  },
];

export default function FeaturesPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Background glows */}
      <div className="absolute top-0 inset-x-0 h-[500px] pointer-events-none" aria-hidden>
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-b from-vn-fuchsia/[0.08] to-transparent blur-3xl" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-vn-indigo/[0.05] blur-3xl" />
        <FloatingParticles count={35} />
      </div>

      {/* HERO */}
      <section className="relative pt-16 sm:pt-20 pb-10 sm:pb-14 border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 mb-7">
            <div className="w-1.5 h-1.5 rounded-full bg-vn-fuchsia shadow-[0_0_6px_rgba(232,121,249,0.9)]" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Fonctionnalités
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.6rem] font-black text-white tracking-tight leading-[1.05] mb-6">
            Tout ce dont tu as besoin<br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">
              pour performer.
            </span>
          </h1>
          <p className="text-gray-400 text-[15px] sm:text-[16px] max-w-2xl mx-auto leading-relaxed mb-10">
            Analyse vidéo IA, diagnostic précis, plan d&apos;action. Un seul outil — zéro mystère algorithmique.
          </p>

          {/* Stats strip */}
          <div className="w-full grid grid-cols-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            {[
              { value: '3',    label: 'Piliers analysés',  color: 'text-vn-fuchsia' },
              { value: '14',   label: 'Frames extraites',  color: 'text-blue-400' },
              { value: '30s',  label: 'Résultats en',      color: 'text-purple-400' },
              { value: '100%', label: 'IA embarquée',      color: 'text-emerald-400' },
            ].map(({ value, label: lbl, color }, i, arr) => (
              <div key={lbl}
                className={`px-2 sm:px-8 py-4 sm:py-5 text-center ${i < arr.length - 1 ? 'border-r border-white/[0.07]' : ''}`}>
                <p className={`text-xl sm:text-3xl font-black leading-none ${color} mb-1`}>{value}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-600 font-medium leading-tight">{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE FEATURES */}
      <section className="relative py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Trois piliers.</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Un seul diagnostic.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
            {coreFeatures.map((feat) => (
              <div key={feat.title}
                className={`relative p-6 sm:p-7 rounded-2xl border ${feat.border} bg-gradient-to-b ${feat.accent} overflow-hidden hover:-translate-y-0.5 transition-all duration-300`}>
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${feat.iconBg}`}>
                    {feat.icon}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${feat.iconBg.split(' ')[2]} opacity-70`}>
                    {feat.tag}
                  </span>
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2.5 tracking-tight">{feat.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed mb-5">{feat.desc}</p>
                <ul className="space-y-2">
                  {feat.points.map((p) => (
                    <li key={p} className="flex items-center gap-2.5 text-[12.5px] text-gray-400">
                      <CheckIcon className="w-3.5 h-3.5" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PILIERS DÉTAILLÉS */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Ce que l&apos;IA analyse,</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">concrètement.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 sm:gap-6">
            {pillars.map((pillar) => (
              <div key={pillar.name} className={`p-6 sm:p-7 rounded-2xl border ${pillar.bg}`}>
                <div className={`inline-block text-[11px] font-black uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border ${pillar.bg} ${pillar.color} mb-5`}>
                  {pillar.name}
                </div>
                <p className="text-[13.5px] text-gray-400 leading-relaxed mb-6">{pillar.desc}</p>
                <ul className="space-y-2.5">
                  {pillar.metrics.map((m) => (
                    <li key={m} className="flex items-center gap-2.5 text-[13px] text-gray-500">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pillar.color.replace('text-', 'bg-')}`} />
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECONDARY FEATURES */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Chaque outil</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">à ta disposition.</span>
            </h2>
            <p className="mt-3 text-gray-500 text-[14.5px] max-w-lg mx-auto">
              De l&apos;analyse à la correction — un workflow complet, sans jongler entre 5 outils.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {secondaryFeatures.map((feat) => (
              <div key={feat.title}
                className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300 group">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-gray-400 group-hover:text-vn-fuchsia group-hover:border-vn-fuchsia/25 group-hover:bg-vn-fuchsia/[0.05] transition-all mb-4">
                  {feat.icon}
                </div>
                <h3 className="text-[15px] font-bold text-white mb-2 tracking-tight">{feat.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">Ce qui est inclus</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">dans chaque plan.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
            {plans.map((plan) => (
              <div key={plan.name}
                className={`relative p-6 sm:p-7 rounded-2xl border ${plan.border} ${plan.bg ?? 'bg-white/[0.02]'} flex flex-col`}>
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia to-vn-indigo text-white shadow-lg whitespace-nowrap z-10">
                    {plan.badge}
                  </span>
                )}
                <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${plan.color} mb-5 ${plan.badge ? 'mt-2' : ''}`}>
                  {plan.name}
                </p>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={f} className={`flex items-start gap-2.5 text-[13px] ${i === 0 && plan.features[0].includes('plus') ? 'text-gray-600 italic' : 'text-gray-300'}`}>
                      {!(i === 0 && plan.features[0].includes('plus')) && <CheckIcon className="w-3.5 h-3.5 mt-0.5" />}
                      {i === 0 && plan.features[0].includes('plus') && <span className="w-3.5 shrink-0" />}
                      {f}
                    </li>
                  ))}
                  {plan.locked?.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-700 line-through">
                      <span className="w-3.5 shrink-0 text-gray-800 mt-0.5">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-center mt-8">
            <Link href="/pricing"
              className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-vn-fuchsia hover:text-white transition-colors">
              Voir les prix détaillés
              <ArrowRight />
            </Link>
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">De la vidéo au plan d&apos;action</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">en 30 secondes.</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                n: '01',
                title: 'Tu importes ta vidéo',
                desc: "Upload ton fichier MP4 directement. Ajoute optionnellement le lien TikTok pour enrichir l'analyse avec les stats publiques.",
                color: 'text-vn-fuchsia',
                border: 'border-vn-fuchsia/15',
              },
              {
                n: '02',
                title: "L'IA analyse frame par frame",
                desc: '14 frames extraites, transcription audio, scores calculés sur hook, montage et rétention. Tout en temps réel.',
                color: 'text-blue-400',
                border: 'border-blue-500/15',
              },
              {
                n: '03',
                title: 'Tu reçois un diagnostic complet',
                desc: "Score 0–100, problème principal identifié, plan d'action en 3 à 5 points. Tu sais exactement quoi corriger.",
                color: 'text-purple-400',
                border: 'border-purple-500/15',
              },
            ].map((step) => (
              <div key={step.n}
                className={`flex items-start gap-5 p-5 sm:p-6 rounded-2xl border ${step.border} bg-white/[0.02]`}>
                <div className={`w-10 h-10 rounded-full border ${step.border} flex items-center justify-center shrink-0`}>
                  <span className={`text-[11px] font-black ${step.color}`}>{step.n}</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white mb-1.5 tracking-tight">{step.title}</h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              <span className="text-white">TikTok aujourd&apos;hui.</span><br />
              <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Le reste demain.</span>
            </h2>
            <p className="mt-3 text-gray-500 text-[14.5px] max-w-lg mx-auto">
              Viralynz commence avec TikTok — le format le plus exigeant sur l&apos;attention.
              La logique s&apos;étend naturellement aux autres formats courts.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { platform: 'TikTok',           status: 'live', desc: "Analyse complète disponible — notre référence format court.",                color: 'text-emerald-400', dot: 'bg-emerald-400' },
              { platform: 'Instagram Reels',  status: 'next', desc: "Même logique d'analyse adaptée au feed et aux critères Meta.",               color: 'text-gray-500',   dot: 'bg-gray-600' },
              { platform: 'YouTube Shorts',   status: 'next', desc: "Shorts, même exigence sur l'accroche et la rétention.",                      color: 'text-gray-500',   dot: 'bg-gray-600' },
              { platform: 'Autres formats',   status: 'later',desc: "Vidéos verticales, social ads, paid content — un cadre unique.",             color: 'text-gray-500',   dot: 'bg-gray-600' },
            ].map(({ platform, status, desc, color, dot }) => (
              <div key={platform} className="p-5 sm:p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${dot} ${status === 'live' ? 'shadow-[0_0_6px_rgba(52,211,153,0.8)]' : ''}`} />
                    <p className="text-[15px] font-bold text-white tracking-tight">{platform}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/[0.07] ${status === 'live' ? 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' : 'text-gray-600 bg-white/[0.03]'}`}>
                    {status === 'live' ? 'Live' : 'Bientôt'}
                  </span>
                </div>
                <p className={`text-[13px] ${color} leading-relaxed`}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">
            <span className="text-white">Comprends ce qui bloque.</span><br />
            <span className="bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent">Corrige avant de reposter.</span>
          </h2>
          <p className="text-gray-500 text-[14.5px] mb-10 max-w-sm mx-auto">
            3 analyses gratuites — sans carte bancaire, sans engagement.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-vn-fuchsia/50 to-vn-indigo/40 opacity-70 blur-lg transition-all group-hover:opacity-100" aria-hidden />
              <Link href="/analyzer"
                className="relative inline-flex items-center gap-2.5 min-h-[50px] rounded-full px-9 text-[14.5px] font-semibold text-white bg-gradient-to-r from-vn-fuchsia to-vn-indigo hover:brightness-110 hover:scale-[1.02] transition-all shadow-xl">
                Lancer mon analyse
                <ArrowRight />
              </Link>
            </div>
            <Link href="/pricing" className="text-[13.5px] text-gray-500 hover:text-gray-300 transition-colors">
              Voir les plans →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
