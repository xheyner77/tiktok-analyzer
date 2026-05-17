'use client';

import { useState } from 'react';

const faqs = [
  {
    q: 'Puis-je annuler à tout moment ?',
    a: "Oui, sans engagement. Tu peux annuler ton abonnement depuis ton tableau de bord en quelques secondes. L'accès reste actif jusqu'à la fin de la période payée.",
  },
  {
    q: 'Le plan gratuit suffit-il pour tester ?',
    a: "Oui — les 3 analyses gratuites permettent de tester sans connecter TikTok : score vidéo, hook, drop principal, mini timeline et recommandations essentielles. Les blocs avancés restent floutés.",
  },
  {
    q: 'À quoi servent exactement les analyses ?',
    a: "Chaque analyse décompose ta vidéo en 3 dimensions clés : Hook (accroche), Montage (rythme et cuts), Rétention (courbe d'attention). Tu reçois un score, des points forts, des points faibles et des recommandations concrètes pour corriger la structure avant remontage.",
  },
  {
    q: 'À quoi sert le générateur de hooks ?',
    a: "C'est inclus dans les plans Creator, Pro et Scale. Il transforme un angle ou un hook faible en variantes testables basées sur ta niche, ton format et ta mémoire créateur.",
  },
  {
    q: "Est-ce seulement pour TikTok ?",
    a: "Aujourd'hui, Viralynz est prioritaire sur TikTok. La structure du moteur prépare aussi Reels et Shorts, sans diluer le workflow TikTok actuel.",
  },
  {
    q: "Que se passe-t-il si j'atteins ma limite mensuelle ?",
    a: "Les nouvelles analyses attendent le prochain renouvellement. Ton historique, ta mémoire et tes structures restent intacts. Tu peux changer de plan quand tu as besoin de plus de volume.",
  },
  {
    q: 'Dois-je être monteur ou expert vidéo ?',
    a: "Non. Viralynz est conçu pour les créateurs, pas les techniciens. Les analyses sont formulées en langage clair, avec des actions concrètes à appliquer même sans formation technique.",
  },
  {
    q: 'Puis-je passer de Pro à Scale ?',
    a: "Oui, la mise à niveau de Pro vers Scale est disponible depuis ton tableau de bord. La différence de prix est proratisée selon ta période de facturation.",
  },
];

export default function PricingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {faqs.map((faq, i) => (
        <div
          key={i}
          className={`rounded-xl border transition-colors duration-200 overflow-hidden ${
            open === i
              ? 'border-white/[0.12] bg-white/[0.03]'
              : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.09]'
          }`}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className={`text-[13px] font-semibold leading-snug transition-colors ${open === i ? 'text-white' : 'text-gray-300'}`}>
              {faq.q}
            </span>
            <span className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
              open === i
                ? 'bg-vn-fuchsia/20 border-vn-fuchsia/40 text-vn-fuchsia rotate-45'
                : 'border-white/[0.10] text-gray-500'
            }`}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
              </svg>
            </span>
          </button>

          {open === i && (
            <div className="px-5 pb-4">
              <p className="text-[12px] text-gray-500 leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
