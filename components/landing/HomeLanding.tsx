'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import PremiumFeaturesSection from '@/components/landing/FeaturesSection';
import PremiumHowItWorksSection from '@/components/landing/HowItWorksSection';

const shell = 'mx-auto w-full max-w-6xl px-3.5 sm:px-6 lg:px-8';
const titleGradient = 'bg-gradient-to-r from-vn-fuchsia via-pink-400 to-vn-indigo bg-clip-text text-transparent';
const premiumEase = [0.22, 1, 0.36, 1] as const;
const sectionReveal = {
  hidden: { opacity: 0, y: 26, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
};
const cardHover = {
  y: -4,
  scale: 1.006,
  transition: { duration: 0.35, ease: premiumEase },
};

const timeline = [
  ['0-3s', 'hook trop explicatif', 'le viewer comprend, mais ne reste pas'],
  ['4-8s', 'payoff trop tard', 'la preuve arrive après le drop'],
  ['12-18s', 'rythme plat', 'aucune rupture avant le point fort'],
  ['Fin', 'CTA vague', 'la question arrive après le départ'],
];

const productSignals = [
  ['À garder', ['Sujet clair', 'Preuve crédible', 'Angle commentaire']],
  ['À changer', ['Payoff en première frame', 'Intro à couper', 'CTA plus court']],
];

const planSteps = ['Payoff en premier', 'Preuve avant 0:03', 'Correction en une phrase', 'CTA commentaire court'];

const diagnosticInsights = [
  'Le viewer comprend le sujet, mais la récompense arrive trop tard.',
  'Le meilleur passage est visible, mais il doit passer avant 0:03.',
  'Le hook explique le contexte avant de créer la curiosité.',
];

const repostPlan = [
  ['0:00-0:02', 'Le problème n’est pas ton idée, c’est ton intro.'],
  ['0:02-0:05', 'Montre directement le résultat ou la preuve.'],
  ['0:05-0:09', 'Explique l’erreur en une phrase.'],
  ['0:09-0:15', 'Donne la correction et termine par une question.'],
];

const repostOutputs = [
  ['Hook', 'Le problème n’est pas ton idée. C’est ton intro.'],
  ['Texte écran', 'Ton meilleur passage arrive trop tard.'],
  ['CTA final', 'Commente HOOK si tu veux la version courte.'],
];

const aiSignals = ['Hook détecté', 'Drop probable', 'Cut prioritaire', 'CTA faible', 'Texte écran lu'];

const repostTimeline = [
  ['0:00', 'Hook faible détecté', 'réécrire'],
  ['0:03', 'Drop probable', 'cut'],
  ['0:05', 'Moment à avancer', 'avancer'],
  ['0:09', 'CTA à reformuler', 'CTA'],
];

const repostFixes = [
  'Ouvre directement sur le payoff, pas sur le contexte.',
  'Avance la preuve avant 0:03.',
  'Coupe l’intro explicative qui retarde la récompense.',
  'Ajoute une rupture visuelle au moment où la rétention chute.',
  'Termine avec une question commentaire liée au bénéfice.',
];

const problemItems = [
  'Ton hook explique avant de créer la tension.',
  'Ton meilleur moment arrive trop tard.',
  'La promesse n’est pas claire en 2 secondes.',
  'Le rythme tombe juste avant le payoff.',
  'Ton CTA arrive quand les gens sont déjà partis.',
];

const outputs = [
  ['Verdict clair', 'Ce qui fait scroller.'],
  ['Hook corrigé', 'Une ouverture plus directe.'],
  ['Cuts à faire', 'Les secondes qui freinent.'],
  ['Plan de remontage', 'Le nouvel ordre à tester.'],
];

const proof = [
  ['Diagnostic concret', 'Hook, rythme, drop, CTA.'],
  ['Plan de remontage', 'Couper, avancer, restructurer.'],
  ['Sans friction', '3 analyses gratuites.'],
];

const knownTikTokCreators = [
  ['Créatrice lifestyle', 'https://i.pravatar.cc/96?img=47'],
  ['Créateur business', 'https://i.pravatar.cc/96?img=12'],
  ['Créatrice beauté', 'https://i.pravatar.cc/96?img=56'],
  ['Monteur short-form', 'https://i.pravatar.cc/96?img=33'],
  ['Créatrice food', 'https://i.pravatar.cc/96?img=22'],
];

type RoadmapStatus = 'available' | 'soon' | 'future';
type RoadmapIconName = 'play' | 'reels' | 'shorts' | 'spark';

const roadmapSteps: Array<{
  label: string;
  title: string;
  description: string;
  features: string[];
  status: RoadmapStatus;
  icon: RoadmapIconName;
}> = [
  {
    label: 'Disponible maintenant',
    title: 'Analyse TikTok',
    description: 'Upload ta vidéo, comprends pourquoi elle décroche et obtiens une version plus forte à reposter.',
    features: ['Analyse du hook', 'Score de viralité', 'Diagnostic rythme / rétention', 'Version à reposter'],
    status: 'available',
    icon: 'play',
  },
  {
    label: 'Bientôt',
    title: 'Instagram Reels',
    description: 'Analyse tes Reels avec les mêmes critères : accroche, rythme, clarté, potentiel de rétention et CTA.',
    features: ['Analyse Reels', 'Hooks adaptés Instagram', 'Recommandations format court', 'Comparaison TikTok / Reels'],
    status: 'soon',
    icon: 'reels',
  },
  {
    label: 'Bientôt',
    title: 'YouTube Shorts',
    description: 'Comprends pourquoi tes Shorts ne retiennent pas l’attention et transforme tes idées en formats plus puissants.',
    features: ['Analyse Shorts', 'Rétention des premières secondes', 'Optimisation titre / structure', 'Repost strategy'],
    status: 'soon',
    icon: 'shorts',
  },
  {
    label: 'Plus tard',
    title: 'Assistant de croissance multi-canal',
    description: 'Un espace pour suivre tes contenus, comparer tes performances et savoir quoi reposter, quoi améliorer et quoi abandonner.',
    features: ['Historique multi-plateformes', 'Recommandations personnalisées', 'Bibliothèque de contenus gagnants', 'Plan d’action IA'],
    status: 'future',
    icon: 'spark',
  },
];

const roadmapStatusStyles: Record<
  RoadmapStatus,
  {
    card: string;
    badge: string;
    icon: string;
    dot: string;
    state: string;
    stateLabel: string;
  }
> = {
  available: {
    card: 'border-cyan-300/30 bg-[linear-gradient(145deg,rgba(34,211,238,0.12),rgba(99,102,241,0.06),rgba(8,9,13,0.92))] shadow-[0_26px_95px_-70px_rgba(34,211,238,0.9)]',
    badge: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    icon: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200 shadow-[0_0_30px_-14px_rgba(34,211,238,0.9)]',
    dot: 'bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]',
    state: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
    stateLabel: 'Actif',
  },
  soon: {
    card: 'border-vn-fuchsia/25 bg-[linear-gradient(145deg,rgba(232,121,249,0.1),rgba(59,130,246,0.055),rgba(8,9,13,0.92))] shadow-[0_26px_95px_-72px_rgba(168,85,247,0.86)]',
    badge: 'border-vn-fuchsia/25 bg-vn-fuchsia/10 text-fuchsia-100',
    icon: 'border-vn-fuchsia/30 bg-vn-fuchsia/10 text-fuchsia-200 shadow-[0_0_30px_-14px_rgba(232,121,249,0.86)]',
    dot: 'bg-vn-fuchsia shadow-[0_0_18px_rgba(232,121,249,0.75)]',
    state: 'border-vn-fuchsia/20 bg-vn-fuchsia/[0.08] text-fuchsia-100/85',
    stateLabel: 'Coming soon',
  },
  future: {
    card: 'border-indigo-300/20 bg-[linear-gradient(145deg,rgba(99,102,241,0.11),rgba(34,211,238,0.035),rgba(8,9,13,0.92))] shadow-[0_26px_95px_-72px_rgba(99,102,241,0.8)]',
    badge: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-100',
    icon: 'border-indigo-300/25 bg-indigo-300/10 text-indigo-100 shadow-[0_0_30px_-14px_rgba(99,102,241,0.8)]',
    dot: 'bg-indigo-300 shadow-[0_0_18px_rgba(129,140,248,0.7)]',
    state: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-100/85',
    stateLabel: 'Future',
  },
};

const testimonials = [
  ['Lina', 'Viralynz a repéré que mon payoff arrivait après 6 secondes. J’ai avancé la preuve en première frame.', 'watch time amélioré'],
  ['Nolan', 'Je pensais manquer d’idées. En fait, mes hooks donnaient le contexte avant la tension.', '3 structures sauvées'],
  ['Maya Studio', 'On décide en réunion quelles vidéos clients méritent un cut, une nouvelle structure ou un nouveau hook.', 'workflow agence'],
];

const legacyReviewColumns = [
  [
    ['Richard D.', 'Monteur short-form pour coachs', 'Je pensais que le montage était trop lent. Viralynz a montré autre chose : le meilleur plan arrivait à 0:07, après le drop. J’ai coupé l’intro, mis le payoff en première frame et gardé le même sujet.', 'rétention 3s améliorée', '11'],
    ['Parveen K.', 'Créateur business TikTok', 'Sur une vidéo qui plafonnait, Viralynz m’a dit que je donnais l’explication avant la tension. J’ai reposté avec un hook plus frontal et un CTA en 5 mots. Les commentaires sont arrivés beaucoup plus vite.', 'CTA raccourci', '47'],
    ['Sarah M.', 'Coach fitness', 'Je croyais que mon sujet était trop niche. En fait, la première frame montrait mon visage sans résultat visible. Viralynz a proposé d’ouvrir sur l’avant/après, puis d’expliquer. Même vidéo, meilleur watch time.', 'payoff avancé', '32'],
    ['Yanis B.', 'UGC creator e-commerce', 'Avant de relancer une créa produit, je passe la vidéo dans Viralynz. Sur une démo skincare, il a repéré que le bénéfice visuel arrivait après le texte. J’ai inversé l’ordre : résultat, preuve, prix, CTA.', 'créa repostée', '15'],
    ['Nora Studio', 'Agence TikTok B2C', 'Les retours clients étaient souvent subjectifs. Maintenant on montre la timeline : hook faible à 0:00, drop probable à 0:03, cut prioritaire à 0:05. Ça rend les décisions de repost beaucoup plus simples.', 'brief client clair', '44'],
    ['Hugo L.', 'Formateur Notion & IA', 'Mes vidéos faisaient trop tutoriel YouTube. Viralynz a détecté que j’expliquais le contexte avant le problème. J’ai ouvert avec “tu perds 20 minutes ici” et gardé la preuve pour 0:03.', 'hook réécrit', '18'],
    ['Mila P.', 'Créatrice beauté', 'Mon CTA disait juste “dis-moi ce que tu en penses”. Viralynz l’a marqué comme trop vague. J’ai reposté avec “commente ROUTINE si tu veux la version courte” et les réponses étaient enfin exploitables.', 'CTA spécifique', '56'],
    ['Tom A.', 'Monteur ads TikTok', 'Pour mes clients, l’outil est utile parce qu’il parle comme un monteur : cut cette seconde, avance cette preuve, ajoute une rupture visuelle ici. Je peux transformer un avis flou en montage concret.', 'cuts validés', '25'],
    ['Sofia D.', 'Coach business', 'Je voulais changer toute la vidéo. Viralynz m’a montré que l’idée tenait, mais que l’ordre cassait la rétention : contexte, exemple, payoff. J’ai simplement remis payoff, preuve, correction, CTA.', 'ordre corrigé', '38'],
    ['Inès K.', 'Créatrice mode', 'Sur mes hauls, je perdais les viewers avant la première tenue. Viralynz a repéré que la promesse arrivait trop tard. J’ai mis le look final en intro et coupé les 4 secondes de préparation.', 'intro coupée', '27'],
  ],
  [
    ['Denis B.', 'Créateur TikTok éducation', 'J’avais un bon sujet, mais je commençais par “aujourd’hui je vais t’expliquer”. Viralynz a noté que le scroll n’était jamais stoppé. J’ai repris la vidéo avec une affirmation plus agressive en 0:00.', 'scroll stoppé', '12'],
    ['Algrow', 'Studio Shorts & TikTok', 'On analyse les vidéos qui ont entre 2k et 20k vues pour voir lesquelles méritent un repost. Viralynz repère les patterns : payoff trop tard, rythme plat, CTA mou. Ça évite de recycler au hasard.', 'tri des reposts', '39'],
    ['AI Guy', 'Créateur IA', 'Mes vidéos avaient trop de jargon dès le hook. Viralynz a détecté que le viewer comprenait le thème, mais pas le bénéfice. J’ai remplacé l’intro par une promesse visuelle et coupé 3 secondes.', 'jargon coupé', '51'],
    ['Lina Studio', 'Agence social ads TikTok', 'Pour un client e-commerce, Viralynz a vu que la preuve produit était enterrée après l’explication. On a mis la démonstration au début, ajouté un texte écran et gardé la correction en une phrase.', 'démo avancée', '23'],
    ['Julien B.', 'Créateur marketing B2B', 'La timeline m’a montré le moment exact où ma vidéo devenait “cours magistral”. J’ai ajouté un pattern interrupt à 0:04 et raccourci la phrase suivante. Le repost était beaucoup moins plat.', 'pattern interrupt', '60'],
    ['Amélie R.', 'Freelance contenu TikTok', 'Je l’utilise avant d’envoyer une V2 à mes clients. Quand Viralynz marque “CTA faible”, je sais quoi faire : question plus précise, mot-clé à commenter, fin plus courte.', 'V2 plus nette', '14'],
    ['Mehdi T.', 'Créateur e-commerce', 'Sur une vidéo produit, je pensais que le prix bloquait. Viralynz a détecté que le bénéfice n’était visible qu’après 5 secondes. J’ai ouvert avec le résultat en main, puis expliqué le produit.', 'preuve à 0:01', '41'],
    ['Clara M.', 'Créatrice food', 'Mes recettes commençaient par les ingrédients. Viralynz m’a dit de montrer la texture finale avant la préparation. J’ai reposté avec le plan fromage fondu en première frame.', 'frame remplacée', '22'],
    ['Kevin D.', 'Clipper podcast TikTok', 'Les meilleurs moments étaient là, mais pas au bon endroit. Viralynz a repéré que la punchline arrivait après une phrase de setup trop longue. J’ai coupé le setup et gardé la réaction.', 'setup cut', '33'],
    ['Yasmine O.', 'Créatrice voyage', 'Je perdais les viewers sur mes transitions. Viralynz a conseillé d’ouvrir sur le plan le plus surprenant, puis de revenir au contexte. Le repost a généré plus de sauvegardes que l’original.', 'save rate en hausse', '49'],
  ],
];


const reviewColumns = [
  [
    ['Richard D.', 'Monteur short-form pour coachs', 'J’avais un client persuadé que sa vidéo était trop lente. Viralynz a pointé un truc précis : le meilleur plan arrivait à 0:07, après la chute. On a ouvert dessus et gardé le même script.', 'payoff avancé', '11'],
    ['Parveen K.', 'Créateur business TikTok', 'Sur une vidéo bloquée à 2 800 vues, l’outil m’a montré que je donnais le contexte avant la tension. J’ai refait l’intro en une phrase et les commentaires utiles sont arrivés beaucoup plus vite.', 'CTA raccourci', '47'],
    ['Sarah M.', 'Coach fitness', 'Je pensais que mon sujet était trop niche. En fait, la première seconde ne montrait aucun résultat visible. J’ai remplacé l’intro par l’avant/après, puis seulement après j’ai expliqué.', 'frame changée', '32'],
    ['Yanis B.', 'UGC creator e-commerce', 'Je l’utilise surtout avant de recycler une créa produit. Sur une démo skincare, Viralynz a vu que la preuve arrivait après le texte. On a inversé : résultat, preuve, prix, CTA.', 'démo avancée', '15'],
    ['Nora Studio', 'Agence TikTok B2C', 'Avant, nos retours clients étaient trop subjectifs. Maintenant on montre la timeline : hook faible, drop probable, seconde à couper. Les validations de montage sont beaucoup plus simples.', 'brief clair', '44'],
    ['Hugo L.', 'Formateur Notion & IA', 'Mes vidéos ressemblaient trop à des tutos YouTube. Viralynz a repéré que j’expliquais avant de créer le problème. J’ai ouvert avec “tu perds 20 minutes ici” et gardé la preuve pour 0:03.', 'hook réécrit', '18'],
    ['Mila P.', 'Créatrice beauté', 'Mon CTA était toujours “dis-moi ce que tu en penses”. L’analyse m’a forcée à poser une vraie question. Depuis, je termine avec un mot-clé à commenter et les réponses sont beaucoup plus exploitables.', 'CTA précis', '56'],
    ['Tom A.', 'Monteur ads TikTok', 'Pour les pubs courtes, ça m’aide à trancher vite. Si Viralynz marque “preuve trop tard”, je sais quoi déplacer au lieu de refaire toute la créa. Ça économise des heures.', 'cut validé', '25'],
  ],
  [
    ['Sofia D.', 'Coach business', 'Je voulais changer tout le sujet. En fait, l’idée tenait, mais l’ordre cassait la rétention : contexte, exemple, payoff. J’ai simplement remis payoff, preuve, correction, CTA.', 'ordre corrigé', '38'],
    ['Inès K.', 'Créatrice mode', 'Sur mes hauls, je perdais les gens avant la première tenue. Viralynz a repéré que la promesse arrivait trop tard. J’ai mis le look final en intro et coupé la préparation.', 'intro coupée', '27'],
    ['Denis B.', 'Créateur éducation', 'Je démarrais souvent par “aujourd’hui je vais t’expliquer”. L’outil m’a montré que ça ne stoppait personne. J’ai remplacé par une affirmation plus directe dès 0:00.', 'scroll stoppé', '12'],
    ['Algrow', 'Studio Shorts', 'On passe les vidéos entre 2k et 20k vues dans Viralynz pour décider lesquelles méritent une reconstruction. Ça évite de recycler au feeling et ça donne des consignes claires au monteur.', 'tri structure', '39'],
    ['Julien B.', 'Marketing B2B', 'La timeline m’a montré le moment où ma vidéo devenait trop cours magistral. J’ai ajouté un cut à 0:04 et raccourci la phrase suivante. La version retravaillée était beaucoup plus directe.', 'rythme relancé', '60'],
    ['Amélie R.', 'Freelance contenu', 'Je l’utilise avant d’envoyer une V2. Quand l’analyse signale CTA faible, je sais exactement quoi modifier : question plus précise, mot-clé à commenter, fin plus courte.', 'V2 plus nette', '14'],
    ['Mehdi T.', 'Créateur e-commerce', 'Sur une vidéo produit, je pensais que le prix bloquait. Viralynz a détecté que le bénéfice n’était visible qu’après 5 secondes. J’ai ouvert avec le résultat en main.', 'preuve à 0:01', '41'],
  ],
];

const plans = [
  {
    name: 'Free',
    price: '0€',
    body: 'Pour voir pourquoi une vidéo décroche.',
    bullets: ['3 analyses', 'Verdict clair', 'Hook corrigé'],
  },
  {
    name: 'Starter',
    price: '10€/mois',
    body: 'Pour transformer tes flops en structures à retester.',
    bullets: ['50 analyses/mois', '150 hooks/mois', 'Plan de remontage'],
    featured: true,
  },
  {
    name: 'Pro',
    price: '29€/mois',
    body: 'Pour suivre tes hooks, angles et structures comme un système.',
    bullets: ['200 analyses/mois', '500 hooks/mois', 'Patterns de rétention'],
  },
];

const faqs = [
  ['Viralynz garantit un résultat ?', 'Non. Viralynz ne promet pas un résultat. Il t’aide à comprendre pourquoi une vidéo ne retient pas et quoi changer dans sa structure.'],
  ['Je peux analyser une vidéo qui a déjà été publiée ?', 'Oui. C’est le cas d’usage principal : tu prends un TikTok qui n’a pas percé, Viralynz repère le hook, le drop, les cuts et la structure à retester.'],
  ['Qu’est-ce que je reçois après l’analyse ?', 'Un verdict clair, les moments où la vidéo décroche, un hook corrigé, les cuts prioritaires, un CTA plus net et un plan de remontage.'],
  ['Est-ce que je dois connecter mon compte TikTok ?', 'Non pour commencer. Tu peux tester avec une vidéo uploadée. Connecter TikTok sert ensuite à mieux suivre tes comptes et tes structures retravaillées.'],
  ['Combien de temps prend une analyse ?', 'Quelques minutes en général. L’objectif est de te donner une décision de montage exploitable, pas un rapport long à interpréter.'],
  ['Est-ce adapté aux créateurs débutants ?', 'Oui. Viralynz est pensé pour les créateurs, monteurs, freelances et marques qui veulent comprendre le hook, le rythme et la rétention.'],
  ['Est-ce que Viralynz remplace un monteur ?', 'Non. Il aide à décider quoi modifier : couper l’intro, avancer le payoff, clarifier le hook ou resserrer le CTA.'],
  ['Puis-je tester gratuitement ?', 'Oui. Tu as 3 analyses gratuites, sans carte bancaire.'],
];

function MotionSection({
  children,
  className,
  id,
  ariaLabel,
}: {
  children: React.ReactNode;
  className: string;
  id?: string;
  ariaLabel?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      aria-label={ariaLabel}
      className={className}
      initial={prefersReducedMotion ? false : 'hidden'}
      whileInView={prefersReducedMotion ? undefined : 'visible'}
      viewport={{ once: true, amount: 0.18, margin: '0px 0px -80px 0px' }}
      variants={sectionReveal}
      transition={{ duration: 0.72, ease: premiumEase }}
    >
      {children}
    </motion.section>
  );
}

function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <path d="M3 8h9M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RatingStar({ fill = 'full' }: { fill?: 'full' | 'partial' }) {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden>
      <svg viewBox="0 0 20 20" className="h-full w-full text-blue-400/35" fill="currentColor">
        <path d="m10 1.7 2.35 5.02 5.32.82-3.86 3.92.91 5.55L10 14.36 5.28 17l.91-5.55-3.86-3.92 5.32-.82L10 1.7Z" />
      </svg>
      <span className={`absolute inset-y-0 left-0 overflow-hidden ${fill === 'partial' ? 'w-[76%]' : 'w-full'}`}>
        <svg viewBox="0 0 20 20" className="h-full w-3.5 text-blue-400 sm:w-4" fill="currentColor">
          <path d="m10 1.7 2.35 5.02 5.32.82-3.86 3.92.91 5.55L10 14.36 5.28 17l.91-5.55-3.86-3.92 5.32-.82L10 1.7Z" />
        </svg>
      </span>
    </span>
  );
}

function HeroRatingBadge() {
  return (
    <div className="mb-3 inline-flex max-w-[21rem] items-center justify-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.045] px-3.5 py-1.5 text-[13px] font-bold text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_45px_-32px_rgba(34,211,238,0.55)] sm:mb-5 sm:max-w-none sm:px-4">
      <span className="flex items-center gap-1 text-blue-400" aria-label="Note de 4.8 sur 5">
        <RatingStar />
        <RatingStar />
        <RatingStar />
        <RatingStar />
        <RatingStar fill="partial" />
      </span>
      <span className="font-black text-white">4.8</span>
      <span className="h-4 w-px bg-white/15" aria-hidden />
      <span className="whitespace-nowrap text-gray-400"><span className="font-black text-white">500+</span> avis</span>
    </div>
  );
}

function CreatorProofBadge() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-center gap-2.5 sm:mb-6 sm:gap-3">
      <div className="flex -space-x-2" aria-label="Rep&egrave;res de TikTokeurs connus">
        {knownTikTokCreators.map(([name, avatarUrl]) => (
          <img
            key={name}
            src={avatarUrl}
            alt=""
            title={name}
            className="h-7 w-7 rounded-full border-2 border-[#050508] object-cover shadow-[0_0_16px_-10px_rgba(34,211,238,0.95)] ring-1 ring-white/15 sm:h-8 sm:w-8"
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-gray-300 sm:text-sm">
        Approuv&eacute; par <span className="font-black text-blue-400">10K+ cr&eacute;ateurs</span>
      </p>
    </div>
  );
}

function RoadmapStepIcon({ icon, className }: { icon: RoadmapIconName; className?: string }) {
  if (icon === 'play') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M8.5 6.75v10.5L17 12 8.5 6.75Z" fill="currentColor" />
        <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (icon === 'reels') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="5" width="16" height="14" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 5 11 10M13 5l3 5M5 10h14M10 13.3v3.4l3.2-1.7-3.2-1.7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (icon === 'shorts') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="7" y="3.5" width="10" height="17" rx="3.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M11 9.2v5.6l4-2.8-4-2.8Z" fill="currentColor" />
        <path d="M10.5 17h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5 13.55 8l4.7.35-3.6 3.05 1.1 4.6L12 13.55 8.25 16l1.1-4.6-3.6-3.05L10.45 8 12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M19 15.5v3.25M17.35 17.12h3.3M5 14.5v2.5M3.75 15.75h2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function RoadmapSection() {
  return (
    <MotionSection className={`${shell} relative py-6 sm:py-14`}>
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] px-3.5 py-7 shadow-[0_34px_120px_-82px_rgba(99,102,241,0.9)] sm:rounded-[1.8rem] sm:px-6 sm:py-10 lg:px-8">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent" />
          <div className="absolute left-1/2 top-0 h-52 w-[34rem] -translate-x-1/2 rounded-full bg-vn-fuchsia/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-52 w-72 rounded-full bg-cyan-300/[0.08] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">Roadmap</p>
          <h2 className="mt-3 text-[1.85rem] font-black leading-[1.02] tracking-tight text-white sm:text-5xl">
            Une roadmap pensée pour les créateurs multi-plateformes
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base sm:leading-7">
            Viralynz commence avec TikTok, puis s’étendra aux formats courts qui comptent vraiment : Reels, Shorts et analyse de contenu multi-canal.
          </p>
        </div>

        <div className="relative mt-7 sm:mt-10">
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-10 hidden h-px bg-gradient-to-r from-cyan-300/0 via-cyan-300/30 to-vn-fuchsia/0 xl:block" aria-hidden />
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
            {roadmapSteps.map((step, index) => {
              const styles = roadmapStatusStyles[step.status];
              return (
                <motion.article
                  key={step.title}
                  whileHover={cardHover}
                  className={`relative flex min-h-[25rem] flex-col overflow-hidden rounded-2xl border p-4 transition duration-500 sm:p-5 ${styles.card}`}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.icon}`}>
                      <RoadmapStepIcon icon={step.icon} className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${styles.badge}`}>
                      {step.label}
                    </span>
                  </div>

                  <div className="relative z-10 mt-5">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${styles.dot}`} aria-hidden />
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">Étape {index + 1}</span>
                    </div>
                    <h3 className="mt-2 text-xl font-black leading-tight tracking-tight text-white">{step.title}</h3>
                    <p className="mt-3 text-[13px] leading-5 text-gray-400">{step.description}</p>
                  </div>

                  <ul className="relative z-10 mt-5 space-y-2.5">
                    {step.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-[13px] font-semibold leading-5 text-gray-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300/75 shadow-[0_0_14px_rgba(34,211,238,0.45)]" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="relative z-10 mt-auto pt-6">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.13em] ${styles.state}`}>
                      {styles.stateLabel}
                    </span>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#090a10]/80 p-4 text-center shadow-[0_24px_80px_-64px_rgba(34,211,238,0.75)] sm:mt-7 sm:p-6">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/55 to-transparent" aria-hidden />
          <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">Commence avec TikTok. Prépare la suite.</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            Analyse tes vidéos dès maintenant et construis une méthode qui pourra bientôt s’appliquer à tous tes formats courts.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link
              href="/signup"
              className="group inline-flex min-h-[48px] w-full max-w-[20rem] items-center justify-center gap-2 rounded-xl border border-vn-fuchsia/35 bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_18px_70px_-42px_rgba(232,121,249,0.88)] transition duration-500 ease-out hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.99] sm:w-auto sm:px-6"
            >
              Analyser ma première vidéo
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#features"
              className="inline-flex min-h-[48px] w-full max-w-[20rem] items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-gray-200 transition duration-300 hover:border-cyan-300/25 hover:bg-cyan-300/[0.08] hover:text-white sm:w-auto sm:px-6"
            >
              Voir les fonctionnalités
            </Link>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

export default function HomeLanding() {
  return (
    <main className="relative overflow-x-hidden bg-vn-bg text-white">
      <PremiumPageStyle />

      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.016)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.016)_1px,transparent_1px)] bg-[size:58px_58px] opacity-20" />
        <div className="absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(ellipse_72%_44%_at_50%_0%,rgba(168,85,247,0.16),transparent_66%),radial-gradient(circle_at_82%_20%,rgba(34,211,238,0.1),transparent_31%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,8,0.02),rgba(5,5,8,0.84)_58%,#050508)]" />
      </div>

      <MotionSection className={`${shell} relative overflow-hidden pb-5 pt-14 sm:pb-16 sm:pt-20 lg:pt-24`}>
        <div className="mx-auto max-w-5xl text-center">
          <div>
            <HeroRatingBadge />

            <h1 className="mx-auto max-w-[20rem] text-[clamp(2.25rem,10vw,3rem)] font-black leading-[0.94] tracking-tight text-white sm:max-w-4xl sm:text-6xl sm:leading-[0.96] lg:text-[4.7rem]">
              Comprends pourquoi tes vid&eacute;os <span className={titleGradient}>flopent</span>
            </h1>

            <p className="hidden">
              Upload une vidéo qui n’a pas percé. Viralynz repère le hook faible, le drop, le rythme qui casse et le CTA à resserrer dans ton plan de remontage.
            </p>

            <p className="hidden">
              Upload une vidéo qui n'a pas percé. Viralynz repère le hook faible, le drop, le rythme qui casse et le CTA à resserrer dans ton plan de remontage.
            </p>

            <p className="mx-auto mt-3 max-w-[21rem] text-[0.95rem] leading-5 text-gray-300 sm:mt-5 sm:max-w-2xl sm:text-lg sm:leading-7">
              Viralynz rep&egrave;re les moments qui font d&eacute;crocher les viewers et te montre quoi corriger avant de republier.
            </p>

            <div className="mt-4 flex flex-col items-center justify-center gap-2.5 sm:mt-6 sm:flex-row sm:gap-3">
              <Link
                href="/signup"
                className="group inline-flex min-h-[46px] w-full max-w-[19rem] items-center justify-center gap-2 rounded-xl border border-vn-fuchsia/35 bg-gradient-to-r from-vn-fuchsia to-vn-indigo px-5 text-sm font-black text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_22px_70px_-32px_rgba(232,121,249,0.95)] transition duration-500 ease-out hover:-translate-y-0.5 hover:scale-[1.012] hover:brightness-110 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_30px_95px_-42px_rgba(232,121,249,1)] active:scale-[0.99] sm:min-h-[54px] sm:w-auto sm:max-w-[24rem] sm:px-8"
              >
                Analyser ma vid&eacute;o
              </Link>
            </div>

            <p className="mt-2 text-[11px] font-bold text-gray-500">
              3 analyses gratuites · sans carte bancaire
            </p>

            <div className="mt-5 sm:mt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Plateformes support&eacute;es</p>
              <div className="mt-2 flex flex-wrap items-start justify-center gap-x-2.5 gap-y-2 sm:mt-3 sm:gap-x-4">
                <div className="flex min-h-[2.65rem] flex-col items-center justify-start">
                  <div className="flex items-center gap-1.5 text-lg font-black tracking-tight text-white sm:text-2xl">
                    <span className="relative flex h-6 w-6 items-center justify-center text-base sm:h-7 sm:w-7 sm:text-lg" aria-hidden>
                      <span className="absolute translate-x-[-1px] translate-y-[1px] text-cyan-300">♪</span>
                      <span className="absolute translate-x-[1px] translate-y-[-1px] text-rose-400">♪</span>
                      <span className="relative text-white">♪</span>
                    </span>
                    <span>TikTok</span>
                  </div>
                </div>

                <div className="flex min-h-[2.65rem] flex-col items-center justify-start text-white/35" title="Bient&ocirc;t disponible">
                  <div className="flex items-center gap-1.5 text-base font-black tracking-tight grayscale sm:text-2xl">
                    <span className="relative flex h-5 w-7 items-center justify-center rounded-md bg-white/15 sm:h-6 sm:w-8" aria-hidden>
                      <svg viewBox="0 0 24 16" className="h-5 w-7 sm:h-6 sm:w-8" fill="none">
                        <rect width="24" height="16" rx="4" fill="currentColor" />
                        <path d="M10 4.5v7l6-3.5-6-3.5Z" fill="#050508" />
                      </svg>
                    </span>
                    <span>YouTube</span>
                  </div>
                  <span className="mt-1 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/35">prochainement</span>
                </div>

                <div className="flex min-h-[2.65rem] flex-col items-center justify-start text-white/35" title="Bient&ocirc;t disponible">
                  <div className="flex items-center gap-1.5 text-base font-black tracking-tight grayscale sm:text-2xl">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/15 sm:h-6 sm:w-6" aria-hidden>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none">
                        <rect x="5" y="5" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="2" />
                        <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="2" />
                        <circle cx="16.6" cy="7.4" r="1.2" fill="currentColor" />
                      </svg>
                    </span>
                    <span>Instagram</span>
                  </div>
                  <span className="mt-1 rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/35">prochainement</span>
                </div>
              </div>

              <div className="mt-4 sm:mt-5">
                <CreatorProofBadge />
              </div>
            </div>
          </div>

          <ProductHeroStage />
        </div>
      </MotionSection>

      <PremiumFeaturesSection />

      <PremiumHowItWorksSection />

      <RoadmapSection />

      <MotionSection className={`${shell} relative py-4 sm:py-12`}>
        <div className="mx-auto max-w-4xl rounded-[1.25rem] border border-white/[0.09] bg-[#090a10]/90 p-3.5 shadow-[0_28px_90px_-60px_rgba(34,211,238,0.45)] sm:rounded-[1.75rem] sm:p-7">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[1.45rem] font-black leading-tight tracking-tight text-white sm:text-4xl">
              Sans diagnostic, tu postes <TitleAccent>presque au hasard</TitleAccent>
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-gray-400 sm:text-base sm:leading-6">
              Une bonne idée peut flopper juste parce que le hook arrive trop tard, que le rythme tombe ou que le payoff est mal placé. Viralynz te montre quoi corriger avant de republier.
            </p>
          </div>

          <div className="mt-4 grid gap-2.5 sm:mt-7 sm:gap-3 lg:grid-cols-2">
            <motion.div whileHover={cardHover} className="relative overflow-hidden rounded-2xl border border-rose-400/25 bg-[linear-gradient(145deg,rgba(244,63,94,0.09),rgba(8,9,13,0.92))] p-3.5 shadow-[0_24px_90px_-68px_rgba(244,63,94,0.75)] transition-shadow duration-500 hover:shadow-[0_28px_105px_-72px_rgba(244,63,94,0.95)] sm:p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/45 to-transparent" aria-hidden />
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-400/35 bg-rose-500/12 text-sm leading-none text-rose-200 shadow-[0_0_28px_-12px_rgba(244,63,94,0.9)]" aria-hidden>
                  ×
                </span>
                <h3 className="text-base font-black leading-tight text-rose-200">Sans Viralynz</h3>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {[
                  'Tu publies en espérant que l’algorithme comprenne.',
                  'Tu ne sais pas si le flop vient du hook, du rythme ou du CTA.',
                  'Tu risques de jeter une bonne idée au lieu de corriger sa structure.',
                  'Tu changes le décor ou le texte, mais tu gardes le vrai problème.',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 py-0.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-rose-400/25 text-[11px] leading-none text-rose-300" aria-hidden>
                      ×
                    </span>
                    <p className="flex-1 text-[13px] font-medium leading-[1.35] text-gray-300 sm:text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div whileHover={cardHover} className="rounded-2xl border border-blue-400/30 bg-blue-500/[0.045] p-3.5 shadow-[0_22px_70px_-54px_rgba(59,130,246,0.85)] transition-shadow duration-500 hover:shadow-[0_28px_100px_-70px_rgba(59,130,246,0.95)] sm:p-5">
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/35 bg-cyan-400/10 text-sm leading-none text-cyan-200" aria-hidden>
                  ✓
                </span>
                <h3 className="text-base font-black leading-tight text-blue-200">Avec Viralynz</h3>
              </div>

              <div className="space-y-2 sm:space-y-2.5">
                {[
                  'Tu sais où l’attention décroche et pourquoi.',
                  'Tu identifies les secondes à couper, avancer ou renforcer.',
                  'Tu transformes un flop en hypothèse de repost claire.',
                  'Tu republies avec un plan, pas avec une intuition vague.',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 py-0.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/10 text-[11px] leading-none text-emerald-300" aria-hidden>
                      ✓
                    </span>
                    <p className="flex-1 text-[13px] font-medium leading-[1.35] text-gray-200 sm:text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-400/30 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),rgba(34,211,238,0.05))] px-4 py-3 text-center shadow-[0_18px_65px_-55px_rgba(59,130,246,0.9)] sm:mt-5">
            <p className="text-sm font-black leading-6 text-white">
              Le but n’est pas de poster plus. C’est de poster avec une raison claire de performer.
            </p>
          </div>
        </div>
      </MotionSection>

      <ReviewsSection />

      <FAQSection />

      <MotionSection className={`${shell} relative pb-8 pt-6 sm:pb-16 sm:pt-12`}>
        <CreatorProofBadge />
        <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[linear-gradient(135deg,rgba(232,121,249,0.18),rgba(34,211,238,0.08),rgba(99,102,241,0.14))] px-4 py-7 text-center sm:rounded-[1.7rem] sm:px-10 sm:py-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" aria-hidden />
          <h2 className="mx-auto max-w-3xl text-2xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Ta prochaine structure gagnante peut venir de <TitleAccent>ton dernier flop</TitleAccent>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-300 sm:text-base sm:leading-7">
            Une vidéo qui n’a pas pris n’est pas forcément mauvaise. Parfois, le payoff arrive trop tard, le hook explique trop, ou le CTA tombe après le drop.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              href="/signup"
              className="group inline-flex min-h-[50px] w-full max-w-[24rem] items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-vn-bg transition duration-500 ease-out hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-[0_24px_80px_-48px_rgba(255,255,255,0.75)] active:scale-[0.99] sm:w-auto sm:px-8"
            >
              Tester une analyse gratuite
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </MotionSection>

      <MobileAppComingSoonSection />
    </main>
  );
}

const fakeQrModules = 29;
const fakeQrQuietZone = 4;
const fakeQrViewBox = fakeQrModules + fakeQrQuietZone * 2;

function isQrFinderModule(row: number, col: number, startRow: number, startCol: number): boolean {
  const localRow = row - startRow;
  const localCol = col - startCol;
  if (localRow < 0 || localRow > 6 || localCol < 0 || localCol > 6) return false;

  const isOuterRing = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6;
  const isCenter = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4;
  return isOuterRing || isCenter;
}

function isQrReservedFinderZone(row: number, col: number, startRow: number, startCol: number): boolean {
  return row >= startRow - 1 && row <= startRow + 7 && col >= startCol - 1 && col <= startCol + 7;
}

function isQrAlignmentModule(row: number, col: number): boolean {
  const localRow = row - 20;
  const localCol = col - 20;
  if (localRow < 0 || localRow > 4 || localCol < 0 || localCol > 4) return false;
  const isOuterRing = localRow === 0 || localRow === 4 || localCol === 0 || localCol === 4;
  const isCenter = localRow === 2 && localCol === 2;
  return isOuterRing || isCenter;
}

function isFakeQrDarkCell(row: number, col: number): boolean {
  if (
    isQrFinderModule(row, col, 0, 0) ||
    isQrFinderModule(row, col, 0, fakeQrModules - 7) ||
    isQrFinderModule(row, col, fakeQrModules - 7, 0)
  ) {
    return true;
  }

  if (
    isQrReservedFinderZone(row, col, 0, 0) ||
    isQrReservedFinderZone(row, col, 0, fakeQrModules - 7) ||
    isQrReservedFinderZone(row, col, fakeQrModules - 7, 0)
  ) {
    return false;
  }

  if ((row === 6 || col === 6) && row > 7 && col > 7 && row < fakeQrModules - 7 && col < fakeQrModules - 7) {
    return (row + col) % 2 === 0;
  }

  if (isQrAlignmentModule(row, col)) return true;

  const hash = (row * 17 + col * 31 + row * col * 3 + Math.floor(row / 2) * 11) % 23;
  return hash < 10 || (row % 5 === 0 && col % 3 === 1) || (col % 7 === 2 && row % 4 !== 0);
}

function FakeQrCode() {
  const reduceMotion = useReducedMotion();
  const darkCells = Array.from({ length: fakeQrModules * fakeQrModules }, (_, index) => {
    const row = Math.floor(index / fakeQrModules);
    const col = index % fakeQrModules;
    return isFakeQrDarkCell(row, col) ? [row + fakeQrQuietZone, col + fakeQrQuietZone] : null;
  }).filter((cell): cell is number[] => Boolean(cell));

  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [0, -7, 0], rotate: [-0.25, 0.3, -0.25] }}
      transition={reduceMotion ? undefined : { duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
      className="relative mx-auto flex h-[10.75rem] w-[10.75rem] items-center justify-center rounded-[1.45rem] bg-white p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.96)_inset,0_22px_64px_-34px_rgba(255,255,255,0.72)] sm:h-[12rem] sm:w-[12rem]"
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1rem] bg-white">
        <svg
          className="h-full w-full scale-105 opacity-45 blur-[6px]"
          viewBox={`0 0 ${fakeQrViewBox} ${fakeQrViewBox}`}
          shapeRendering="crispEdges"
          aria-hidden
        >
          <rect width={fakeQrViewBox} height={fakeQrViewBox} fill="white" />
          {darkCells.map(([y, x]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111111" />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 bg-white/42 backdrop-blur-[2px]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="rounded-full border border-black/10 bg-white/78 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#111827] shadow-[0_14px_42px_-28px_rgba(15,23,42,0.8)]">
            Accès stores
          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-[1rem] ring-1 ring-black/10" aria-hidden />
      </div>
    </motion.div>
  );
}

function GooglePlayBadge() {
  return (
    <div className="inline-flex h-11 min-w-[10.4rem] select-none items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.08] px-4 text-white/48 shadow-[0_12px_36px_-24px_rgba(255,255,255,0.35)] backdrop-blur-xl grayscale">
      <svg className="h-5 w-5 shrink-0 opacity-50" viewBox="0 0 28 31" aria-hidden>
        <defs>
          <linearGradient id="play-cyan" x1="1.6" y1="2.1" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
          <linearGradient id="play-green" x1="3" y1="28.9" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="play-yellow" x1="16" y1="16" x2="27" y2="10" gradientUnits="userSpaceOnUse">
            <stop stopColor="#facc15" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="play-pink" x1="16" y1="16" x2="27" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fb7185" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path d="M2.7 2.2C2.28 2.56 2 3.2 2 4.04v22.92c0 .84.28 1.48.7 1.84l13.7-13.3L2.7 2.2Z" fill="url(#play-cyan)" />
        <path d="m16.4 15.5 4.05-3.93L5.35 2.9C4.2 2.24 3.25 1.98 2.7 2.2l13.7 13.3Z" fill="url(#play-green)" />
        <path d="m16.4 15.5 4.05 3.93 4.95-2.84c1.48-.86 1.48-2.32 0-3.18l-4.95-2.84-4.05 3.93Z" fill="url(#play-yellow)" />
        <path d="M2.7 28.8c.55.22 1.5-.04 2.65-.7l15.1-8.67-4.05-3.93L2.7 28.8Z" fill="url(#play-pink)" />
      </svg>
      <span className="text-sm font-black leading-none">Google Play</span>
    </div>
  );
}

function AppStoreBadge() {
  return (
    <div className="inline-flex h-11 min-w-[10.4rem] select-none items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.065] px-4 text-white/48 shadow-[0_12px_36px_-24px_rgba(255,255,255,0.35)] backdrop-blur-xl">
      <svg className="h-5 w-5 shrink-0 opacity-55" viewBox="0 0 28 32" fill="currentColor" aria-hidden>
        <path d="M18.48 1.9c.08 1.34-.39 2.62-1.36 3.72-.93 1.05-2.4 1.86-3.74 1.75-.15-1.28.5-2.68 1.38-3.7.98-1.12 2.65-1.98 3.72-1.77Z" />
        <path d="M23.9 22.68c-.6 1.36-.9 1.96-1.68 3.18-1.08 1.68-2.6 3.78-4.5 3.8-1.69.02-2.13-1.1-4.42-1.08-2.3.02-2.78 1.1-4.46 1.08-1.9-.02-3.35-1.9-4.43-3.58C1.4 21.42 1.1 15.98 2.96 13.06c1.32-2.08 3.4-3.3 5.36-3.32 2-.02 3.24 1.1 4.9 1.1 1.6 0 2.58-1.1 4.9-1.1 1.74.02 3.6.96 4.92 2.6-4.3 2.36-3.6 8.5.86 10.34Z" />
      </svg>
      <span className="text-sm font-black leading-none">App Store</span>
    </div>
  );
}

function MobileAppComingSoonSection() {
  return (
    <MotionSection className={`${shell} relative pb-7 pt-2 sm:pb-10 sm:pt-0`}>
      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/[0.09] bg-[#05070d] shadow-[0_34px_150px_-90px_rgba(34,211,238,0.9)] sm:rounded-[2rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_50%,rgba(34,211,238,0.22),transparent_32%),radial-gradient(circle_at_19%_46%,rgba(232,121,249,0.22),transparent_30%),radial-gradient(circle_at_80%_8%,rgba(99,102,241,0.22),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018)_34%,rgba(3,3,8,0.78))]" aria-hidden />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:34px_34px] opacity-20" aria-hidden />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" aria-hidden />

        <div className="relative grid gap-6 px-4 py-7 sm:px-8 sm:py-9 lg:grid-cols-[17.5rem_1fr] lg:items-center lg:gap-10 lg:px-10">
          <div className="relative mx-auto w-full max-w-[17rem] lg:max-w-none">
            <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle,rgba(34,211,238,0.46),transparent_62%)] blur-xl" aria-hidden />
            <div className="absolute -inset-3 rounded-[2rem] bg-vn-fuchsia/20 blur-2xl" aria-hidden />
            <div className="relative rounded-[1.7rem] border border-white/[0.1] bg-white/[0.055] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_28px_90px_-54px_rgba(34,211,238,0.95)] backdrop-blur-xl">
              <FakeQrCode />
            </div>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-[2rem] font-black uppercase leading-[0.95] tracking-tight text-white sm:text-[3.35rem] lg:text-[4rem]">
              L&rsquo;application arrive sur les <span className={titleGradient}>stores</span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-semibold leading-6 text-gray-400 sm:text-base lg:mx-0">
              Viralynz fonctionne d&eacute;j&agrave; sur mobile. L&rsquo;app native arrive bient&ocirc;t sur Google Play et l&rsquo;App Store pour retrouver ton coach de repost plus vite.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <GooglePlayBadge />
              <AppStoreBadge />
            </div>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden>
      <path d="M3.5 8.5 6.4 11.4 12.5 4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionHeader({ label, title, body }: { label?: string; title: React.ReactNode; body?: string }) {
  return (
    <div className="mb-4 max-w-2xl sm:mb-7">
      {label ? <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">{label}</p> : null}
      <h2 className="text-[1.55rem] font-black leading-tight tracking-tight text-white sm:text-4xl">{title}</h2>
      {body ? <p className="mt-2 text-sm leading-6 text-gray-400 sm:mt-3 sm:text-base sm:leading-7">{body}</p> : null}
    </div>
  );
}

function ResultProofPhone() {
  return (
    <section id="comment-ca-marche" className={`${shell} relative py-6 scroll-mt-24 sm:py-12`}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div className="text-center lg:text-left">
          <h2 className="mx-auto max-w-xl text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:mx-0">
            Tes vid&eacute;os ont plus de potentiel <TitleAccent>que tu le crois</TitleAccent>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-400 sm:text-base lg:mx-0">
            Viralynz aide &agrave; comprendre ce qui bloque vraiment les performances.
          </p>
        </div>

        <div className="relative isolate mx-auto w-full max-w-[18.75rem] sm:max-w-[22rem]">
          <div className="absolute -inset-7 rounded-[3rem] bg-[radial-gradient(circle_at_50%_28%,rgba(168,85,247,0.2),transparent_55%),radial-gradient(circle_at_72%_68%,rgba(34,211,238,0.12),transparent_46%)] blur-2xl" aria-hidden />
          <div className="relative overflow-hidden [mask-image:radial-gradient(ellipse_64%_76%_at_50%_50%,black_58%,rgba(0,0,0,0.82)_73%,transparent_100%)] [-webkit-mask-image:radial-gradient(ellipse_64%_76%_at_50%_50%,black_58%,rgba(0,0,0,0.82)_73%,transparent_100%)]">
            <img
              src="/ChatGPT Image 15 mai 2026, 13_58_30.png"
              alt="Aperçu TikTok Analytics avec vues, engagement et récompenses estimées"
              className="block w-[108%] max-w-none -translate-x-[3.8%] mix-blend-lighten drop-shadow-[0_28px_70px_rgba(168,85,247,0.24)]"
              style={{ filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.86)) drop-shadow(0 0 16px rgba(168,85,247,0.22)) drop-shadow(0 24px 64px rgba(168,85,247,0.18))' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFeaturesSection() {
  const currentVideo = [
    ['0:00', 'Tu expliques le contexte avant de donner une raison de rester.'],
    ['0:04', 'Le payoff arrive trop tard, la tension retombe.'],
    ['0:07', 'La séquence répète l’idée au lieu de l’avancer.'],
    ['0:11', 'Le CTA demande une action sans créer d’urgence.'],
  ];

  const correctedVersion = [
    'Ouvrir avec le résultat, pas avec le contexte.',
    'Couper les 3 premières secondes.',
    'Avancer la preuve avant l’explication.',
    'Transformer le CTA en question qui crée de la curiosité.',
  ];

  const decisions = [
    ['01', 'À couper', 'Les secondes qui ralentissent le rythme ou répètent la même idée.'],
    ['02', 'À avancer', 'Le payoff, la preuve ou le bénéfice qui arrive trop tard.'],
    ['03', 'À réécrire', 'Les hooks, transitions et CTA qui manquent de tension.'],
    ['04', 'À garder', 'Les moments qui créent de la clarté, de la preuve ou de la curiosité.'],
    ['05', 'À republier', 'La version corrigée avec une structure plus testable.'],
  ];

  return (
    <MotionSection id="features" className={`${shell} relative py-6 sm:py-16 scroll-mt-24`}>
      <div className="mx-auto max-w-[82rem]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100 shadow-[0_18px_52px_-42px_rgba(34,211,238,0.95)]">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" aria-hidden />
            FONCTIONNALITÉS
          </div>
          <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Viralynz ne te donne pas un rapport. <TitleAccent>Il te donne la V2</TitleAccent>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base sm:leading-7">
            Upload ta vidéo. Viralynz repère les secondes qui font décrocher, réécrit les passages faibles et te sort une version à republier avec un plan clair.
          </p>
        </div>

        <div className="relative mt-6 overflow-hidden rounded-[1.55rem] border border-white/[0.11] bg-[#07080d] p-3 shadow-[0_44px_160px_-92px_rgba(168,85,247,0.98)] sm:mt-9 sm:p-5 lg:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(232,121,249,0.2),transparent_34%),radial-gradient(circle_at_86%_10%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_36%)]" aria-hidden />
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" aria-hidden />

          <div className="relative grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            <div className="rounded-[1.25rem] border border-rose-300/20 bg-[linear-gradient(155deg,rgba(244,63,94,0.115),rgba(255,255,255,0.022))] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-100/65">Avant</p>
                  <h3 className="mt-1 text-2xl font-black leading-tight text-white">Vidéo actuelle</h3>
                </div>
                <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1.5 text-[10px] font-black text-rose-100">
                  Rétention probable : en baisse
                </span>
              </div>

              <div className="mt-5 grid gap-2.5">
                {currentVideo.map(([time, line]) => (
                  <div key={time} className="grid grid-cols-[3.2rem_1fr] gap-3 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
                    <span className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-2 py-2 text-center text-[10px] font-black text-rose-100">{time}</span>
                    <p className="text-sm font-semibold leading-5 text-gray-200">{line}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 shadow-[0_0_42px_-18px_rgba(34,211,238,0.95)]">
                <span className="absolute inset-[-8px] rounded-full border border-cyan-300/5" aria-hidden />
                Diagnostic → Reconstruction
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-cyan-300/22 bg-[linear-gradient(155deg,rgba(34,211,238,0.11),rgba(255,255,255,0.024))] p-4 shadow-[0_28px_95px_-70px_rgba(34,211,238,0.98)] sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/70">Après</p>
                  <h3 className="mt-1 text-2xl font-black leading-tight text-white">V2 recommandée</h3>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-black text-emerald-100">
                  Version prête à tester
                </span>
              </div>

              <div className="mt-5 grid gap-2.5">
                {correctedVersion.map((line, index) => (
                  <div key={line} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-2xl border border-white/[0.08] bg-black/25 p-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-[11px] font-black text-cyan-100">0{index + 1}</span>
                    <p className="text-sm font-semibold leading-5 text-gray-100">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative mt-3 rounded-[1.15rem] border border-vn-fuchsia/18 bg-vn-fuchsia/[0.055] px-4 py-3 text-center">
            <p className="text-sm font-black leading-6 text-white">
              Chaque analyse devient une décision de montage. Coupe. Avance. Réécris. Republie.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2.5 sm:mt-5 sm:grid-cols-2 lg:grid-cols-5">
          {decisions.map(([number, title, body]) => (
            <motion.div
              key={title}
              whileHover={cardHover}
              className="relative min-h-[8.5rem] overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.052),rgba(255,255,255,0.018))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] transition duration-500 hover:border-cyan-300/24 hover:bg-white/[0.06]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-white/10 bg-white/[0.055] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-cyan-100/75">{number}</span>
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.85)]" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-black leading-tight text-white">{title}</h3>
              <p className="mt-2 text-xs font-medium leading-5 text-gray-400">{body}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 text-center sm:mt-7">
          <Link href="/signup" className="inline-flex min-h-[50px] w-full max-w-[24rem] items-center justify-center rounded-full bg-white px-6 text-sm font-black text-vn-bg transition duration-500 ease-out hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-[0_24px_80px_-48px_rgba(255,255,255,0.75)] active:scale-[0.99] sm:w-auto sm:px-8">
            Analyser ma vidéo
          </Link>
          <p className="mt-2 text-xs font-semibold leading-5 text-gray-500">
            Reçois les corrections à appliquer avant ton prochain repost.
          </p>
        </div>
      </div>
    </MotionSection>
  );
}

function ReconstructionFeatureSection() {
  const steps = [
    ['0:00-0:02', 'HOOK VISUEL', 'Montrer le résultat final immédiatement', 'Avancer'],
    ['0:02-0:05', 'PREUVE RAPIDE', 'Afficher transformation, preuve ou contraste', 'Déplacer'],
    ['0:05-0:08', 'ERREUR COMMUNE', 'Supprimer l’introduction actuelle', 'Couper'],
    ['0:08-0:12', 'CORRECTION', 'Ajouter texte écran et relance visuelle', 'Relancer'],
    ['0:12-0:15', 'CTA', 'Déplacer la question avant le drop principal', 'Optimiser'],
  ];

  return (
    <MotionSection className={`${shell} relative py-5 sm:py-14`}>
      <div className="mx-auto max-w-5xl overflow-hidden rounded-[1.35rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_90%_12%,rgba(232,121,249,0.16),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] p-4 shadow-[0_34px_130px_-84px_rgba(34,211,238,0.95)] sm:rounded-[1.75rem] sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
              Pro + Lifetime
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base sm:leading-7">
              Ta video perd l'attention. Viralynz detecte exactement ou. L'IA reconstruit une meilleure structure, puis tu remontes une version optimisee avec tes propres images.
            </p>
            <div className="mt-5 grid gap-2">
              {[
                '1. Ta video perd l attention.',
                '2. Viralynz detecte exactement ou.',
                '3. L IA reconstruit une meilleure structure.',
                '4. Tu remontes une version optimisee.',
              ].map((item) => (
                <div key={item} className="rounded-xl border border-cyan-300/14 bg-cyan-300/[0.045] px-3 py-2 text-xs font-black text-cyan-50">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {['Nouvel ordre des séquences', 'Moments à supprimer', 'Moments à avancer', 'Pattern interrupts'].map((item) => (
                <div key={item} className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs font-black text-gray-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/[0.09] bg-black/24 p-3 sm:p-4">
            <div className="absolute bottom-8 left-[1.7rem] top-8 w-px bg-gradient-to-b from-cyan-300/10 via-cyan-300/45 to-fuchsia-300/10" />
            <div className="space-y-2.5">
              {steps.map(([time, label, action, badge], index) => (
                <motion.div
                  key={time}
                  initial={{ opacity: 0, y: 14, filter: 'blur(5px)' }}
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.48, delay: index * 0.08, ease: premiumEase }}
                  whileHover={{ x: 4, scale: 1.01 }}
                  className="relative grid gap-2 rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.024))] p-3 transition hover:border-cyan-300/24 sm:grid-cols-[5.8rem_1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full border border-cyan-300/35 bg-cyan-300/12 text-[10px] font-black text-cyan-100 shadow-[0_0_26px_-12px_rgba(34,211,238,0.95)]">{index + 1}</span>
                    <span className="text-[11px] font-black text-cyan-100">{time}</span>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">{action}</p>
                  </div>
                  <span className="w-fit rounded-full border border-vn-fuchsia/22 bg-vn-fuchsia/10 px-2.5 py-1 text-[9px] font-black uppercase text-fuchsia-100">{badge}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

function ReviewsSection() {
  return (
    <MotionSection className={`${shell} relative py-5 sm:py-14`}>
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <HeroRatingBadge />
        </div>

        <div className="text-center">
          <h2 className="text-[1.45rem] font-black leading-tight tracking-tight text-white sm:text-4xl">
            Des créateurs qui corrigent vraiment <TitleAccent>leur structure</TitleAccent>
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-[13px] leading-5 text-gray-400 sm:text-base sm:leading-6">
            Pas des avis vagues. Des hooks réécrits, des drops repérés, des cuts appliqués et des structures remontées plus intelligemment.
          </p>
        </div>

        <div className="relative mx-auto mt-5 h-[27rem] max-w-[31rem] overflow-hidden sm:mt-7 sm:h-[42rem]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-vn-bg via-vn-bg/80 to-transparent" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-vn-bg via-vn-bg/80 to-transparent" aria-hidden />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviewColumns.map((column, columnIndex) => (
              <div key={columnIndex} className={columnIndex === 1 ? 'pt-3 sm:pt-14' : ''}>
                <div
                  className="space-y-3"
                  style={{
                    animation: `${columnIndex === 0 ? 'vn-review-up' : 'vn-review-down'} 34s linear infinite`,
                  }}
                >
                  {[...column, ...column].map(([name, role, quote, result, avatar], index) => (
                    <article
                      key={`${name}-${index}`}
                      className="rounded-2xl border border-white/[0.09] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.035))] p-3 text-left shadow-[0_18px_60px_-48px_rgba(34,211,238,0.48)] backdrop-blur sm:p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img
                            src={`https://i.pravatar.cc/48?img=${avatar}`}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover ring-1 ring-cyan-300/10 sm:h-9 sm:w-9"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black leading-tight text-white">{name}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-gray-500">{role}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-cyan-100/90">
                          {result}
                        </span>
                      </div>
                      <p className="text-[12px] font-semibold leading-[1.55] text-gray-300 sm:text-[13px]">{quote}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

function GrowthEngineSection() {
  const steps = [
    {
      number: '1',
      title: 'Du flop au diagnostic exploitable',
      body: 'Upload une vidéo qui n’a pas pris. Viralynz repère le hook faible, le drop et le moment où le viewer n’a plus de raison de rester.',
      note: 'Hook · rythme · drop · CTA',
      bullets: ['Hook trop lent', 'Drop visible', 'CTA trop vague'],
    },
    {
      number: '2',
      title: 'Un hook qui arrête le scroll',
      body: 'Viralynz remplace l’intro qui explique par une ouverture qui crée de la tension avant de donner le contexte.',
      note: 'Avant scolaire · Après plus direct',
      bullets: ['Payoff en premier', 'Promesse plus nette', 'Intro plus courte'],
    },
    {
      number: '3',
      title: 'Des cuts précis, pas des conseils vagues',
      body: 'Tu sais quoi couper, quoi avancer et où ajouter une rupture pour éviter que la rétention tombe au mauvais moment.',
      note: 'Timeline claire · décisions de montage',
      bullets: ['Supprimer l’intro', 'Avancer le meilleur moment', 'Couper les plans morts'],
    },
    {
      number: '4',
      title: 'Remonte avec une vraie hypothèse',
      body: 'Tu repars avec une structure à tester : nouvel ordre, hook corrigé, cuts prioritaires et CTA plus simple à commenter.',
      note: 'Structure à tester · sans repartir de zéro',
      bullets: ['Hook corrigé', 'Cuts prioritaires', 'CTA commentaire'],
    },
  ];

  return (
    <section id="reconstruction" className={`${shell} relative py-7 sm:py-14 scroll-mt-24`}>
      <div className="mx-auto max-w-5xl rounded-[1.35rem] border border-white/[0.1] bg-[#08090e] p-4 shadow-[0_30px_120px_-82px_rgba(59,130,246,0.75)] sm:rounded-[1.75rem] sm:p-7">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Le moteur de reconstruction TikTok <TitleAccent>de Viralynz</TitleAccent>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">
            Un système simple : comprendre pourquoi ça décroche, corriger l’ordre, puis retester une structure plus propre.
          </p>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <article
              key={step.number}
              className={`rounded-2xl border bg-white/[0.035] p-4 ${
                index === 3 ? 'border-blue-400/35 shadow-[0_24px_80px_-58px_rgba(59,130,246,0.9)]' : 'border-white/[0.08]'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-300/45 bg-blue-500/15 text-xs font-black text-blue-200 shadow-[0_0_34px_-12px_rgba(59,130,246,0.95)] before:absolute before:inset-[-5px] before:rounded-full before:border before:border-blue-300/10 before:content-['']">
                  {step.number}
                </span>
                <div className="mt-4">
                  <h3 className="text-base font-black leading-tight text-white">{step.title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-gray-300">{step.body}</p>
                  <div className="mx-auto mt-4 flex max-w-[12rem] flex-col items-center gap-2">
                    {step.bullets.map((bullet) => (
                      <span key={bullet} className="inline-flex w-fit items-center justify-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.045] px-2.5 py-1.5 text-center text-[11px] font-black text-gray-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.9)]" aria-hidden />
                        {bullet}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs font-bold leading-5 text-gray-500">{step.note}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


function FAQSection() {
  return (
    <MotionSection id="faq" className={`${shell} relative py-4 sm:py-12 scroll-mt-24`}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center sm:mb-7">
          <h2 className="text-[1.45rem] font-black leading-tight tracking-tight text-white sm:text-4xl">
            Questions <TitleAccent>fréquentes</TitleAccent>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-gray-400 sm:text-base sm:leading-6">
            Ce qu’il faut savoir avant ta première reconstruction.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map(([question, answer], index) => (
            <details
              key={question}
              className={`group rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-2.5 transition hover:border-white/[0.14] hover:bg-white/[0.055] sm:rounded-2xl sm:px-5 sm:py-4 ${index > 4 ? 'hidden sm:block' : ''}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left text-[13px] font-black leading-5 text-white marker:hidden sm:gap-4 sm:text-base">
                {question}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 text-base font-bold text-cyan-200 transition group-open:rotate-45 sm:h-7 sm:w-7 sm:text-lg" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 pr-7 text-[13px] leading-5 text-gray-400 sm:mt-3 sm:pr-8 sm:text-sm sm:leading-6">
                {answer}
              </p>
            </details>
          ))}
        </div>
        <details className="group mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 sm:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-black text-cyan-100 marker:hidden">
            Voir les autres questions
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 text-base transition group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <div className="mt-2 space-y-2">
            {faqs.slice(5).map(([question, answer]) => (
              <details key={question} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2">
                <summary className="cursor-pointer list-none text-[13px] font-black leading-5 text-white marker:hidden">{question}</summary>
                <p className="mt-2 text-[13px] leading-5 text-gray-400">{answer}</p>
              </details>
            ))}
          </div>
        </details>
      </div>
    </MotionSection>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: 'Diagnostic de rétention',
      body: 'Identifie le hook faible, le drop et les moments où le viewer n’a plus de raison de rester.',
      metric: 'Hook + drop',
    },
    {
      title: 'Plan de remontage clair',
      body: 'Tu sais quoi couper, quoi avancer et comment remettre le payoff au bon moment.',
      metric: 'Cuts prioritaires',
    },
    {
      title: 'Hooks et CTA à tester',
      body: 'Repars avec une ouverture plus directe et une fin qui demande une réponse claire.',
      metric: 'Structure prête',
    },
  ];

  return (
    <section id="features" className={`${shell} relative py-6 sm:py-12 scroll-mt-24`}>
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-fuchsia-200/75">
            Système de reconstruction
          </p>
          <h2 className="text-2xl font-black leading-tight tracking-tight text-white sm:text-4xl">
            Tout ce qu’il faut pour transformer un flop en <TitleAccent>structure à tester</TitleAccent>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400 sm:text-base">
            Viralynz ne te donne pas juste un score : il te donne les décisions de montage qui rendent ta prochaine version retravaillée plus solide.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 md:grid-cols-3">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(8,9,13,0.96))] p-4 shadow-[0_24px_85px_-70px_rgba(168,85,247,0.9)] sm:p-5"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/45 to-transparent" aria-hidden />
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-vn-fuchsia/30 bg-vn-fuchsia/12 text-sm font-black text-fuchsia-100 shadow-[0_0_30px_-14px_rgba(232,121,249,0.9)]">
                  0{index + 1}
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-emerald-200">
                  {feature.metric}
                </span>
              </div>
              <h3 className="text-base font-black leading-tight text-white">{feature.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-gray-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PremiumPageStyle() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          @keyframes vn-scan {
            0% { transform: translateY(-18%); opacity: .05; }
            35% { opacity: .34; }
            100% { transform: translateY(118%); opacity: .02; }
          }
          @keyframes vn-pulse-line {
            0%, 100% { opacity: .45; transform: scaleX(.72); }
            50% { opacity: 1; transform: scaleX(1); }
          }
          @keyframes vn-float-badge {
            0%, 100% { transform: translate3d(0,0,0) rotate(-7deg); }
            50% { transform: translate3d(0,-8px,0) rotate(-5deg); }
          }
          @keyframes vn-float-soft {
            0%, 100% { transform: translate3d(0,0,0); }
            50% { transform: translate3d(0,-10px,0); }
          }
          @keyframes vn-glow-sweep {
            0% { transform: translateX(-120%) rotate(18deg); opacity: 0; }
            18% { opacity: .55; }
            46%, 100% { transform: translateX(140%) rotate(18deg); opacity: 0; }
          }
          @keyframes vn-hero-float {
            0%, 100% { transform: translate3d(0,0,0); }
            50% { transform: translate3d(0,-10px,0); }
          }
          @keyframes vn-hero-glow {
            0%, 100% { opacity: .42; transform: scale(.98); }
            50% { opacity: .68; transform: scale(1.02); }
          }
          @keyframes vn-review-up {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          @keyframes vn-review-down {
            0% { transform: translateY(-50%); }
            100% { transform: translateY(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-hero-float], [data-hero-glow] { animation: none !important; }
            section * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
          }
          @media (max-width: 640px) {
            footer > div { padding-top: .95rem !important; padding-bottom: .95rem !important; }
            footer .grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: .75rem !important; }
            footer .grid > div:first-child { grid-column: 1 / -1 !important; gap: .55rem !important; }
            footer .grid > div:first-child p:nth-of-type(1) { font-size: 1.08rem !important; line-height: 1.05 !important; max-width: 12rem !important; }
            footer .grid > div:first-child p:nth-of-type(2) { max-width: 18rem !important; font-size: .76rem !important; line-height: 1.35 !important; }
            footer .grid > div:nth-child(3) { display: none !important; }
            footer ul.space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: .34rem !important; }
            footer p.mb-5 { margin-bottom: .48rem !important; }
            footer a[href="/signup"] { min-height: 2.35rem !important; padding: .5rem .95rem !important; }
            footer .mt-12 { margin-top: .8rem !important; }
            footer .pt-7 { padding-top: .65rem !important; }
          }
        `,
      }}
    />
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-6 w-full max-w-[25.5rem] lg:mt-0 lg:max-w-[35rem]">
      <div className="absolute -inset-6 rounded-[2.3rem] bg-[radial-gradient(circle_at_48%_0%,rgba(255,47,95,0.26),transparent_48%),radial-gradient(circle_at_82%_42%,rgba(34,211,238,0.18),transparent_40%),radial-gradient(circle_at_18%_74%,rgba(232,121,249,0.18),transparent_38%)] blur-2xl" aria-hidden />

      <div
        className="absolute -left-1 top-5 z-20 flex items-center gap-2 rounded-[1.05rem] bg-[#ff315f] px-3.5 py-2 text-white shadow-[0_18px_60px_-20px_rgba(255,49,95,0.95)] sm:-left-6 sm:top-7 sm:px-4 sm:py-2.5"
        style={{ animation: 'vn-float-badge 4.6s ease-in-out infinite' }}
        aria-label="Preuve sociale TikTok"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#ff315f]">
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </span>
        <span className="text-lg font-black leading-none sm:text-2xl">434</span>
        <span className="h-4 w-4 rotate-45 rounded-[4px] bg-white" />
        <span className="text-lg font-black leading-none sm:text-2xl">23k</span>
        <span className="h-4 w-4 rounded-full bg-white" />
        <span className="text-lg font-black leading-none sm:text-2xl">99+</span>
        <span className="absolute -bottom-2 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 bg-[#ff315f]" aria-hidden />
      </div>

      <div
        className="absolute -right-1 top-[7.1rem] z-20 rounded-2xl border border-cyan-200/25 bg-cyan-200/12 px-3 py-2 text-xs font-black text-cyan-50 shadow-[0_18px_55px_-30px_rgba(34,211,238,0.95)] backdrop-blur-md sm:-right-4 sm:top-36"
        style={{ animation: 'vn-float-soft 5.4s ease-in-out infinite' }}
      >
        +18 pts retention
      </div>

      <div className="relative overflow-hidden rounded-[1.65rem] border border-white/[0.13] bg-[#07070d] p-2 shadow-[0_34px_150px_-76px_rgba(255,49,95,0.95)] sm:p-2.5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-white/10 blur-xl" style={{ animation: 'vn-glow-sweep 6.5s ease-in-out infinite' }} aria-hidden />
        <div className="relative min-h-[410px] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#050509] sm:min-h-[540px]">
          <img
            src="/hero-viralynz.png"
            alt="Diagnostic Viralynz montrant hook faible, drop et plan de remontage"
            className="absolute inset-0 h-full w-full object-cover opacity-95"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,8,0.02),rgba(5,5,8,0.16)_42%,rgba(5,5,8,0.92)),radial-gradient(circle_at_50%_10%,transparent,rgba(5,5,8,0.24)_58%)]" aria-hidden />
          <div className="absolute inset-x-3 top-3 flex items-center justify-between">
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-black">Audit structure</span>
            <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-black text-emerald-100 backdrop-blur-md">Plan de remontage</span>
          </div>
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/[0.12] bg-black/58 p-3 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Scan rétention</p>
                <p className="mt-1 text-sm font-black text-white">Le payoff arrive après le drop.</p>
              </div>
              <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.14] px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/70">Score</p>
                <p className="text-2xl font-black leading-none text-amber-100">58</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {['Hook', 'Rythme', 'Clarté', 'CTA'].map((label, index) => (
                <div key={label}>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full ${index === 0 ? 'w-[45%] bg-rose-300' : index === 1 ? 'w-[58%] bg-amber-300' : index === 2 ? 'w-[74%] bg-cyan-300' : 'w-[50%] bg-vn-fuchsia'}`}
                    />
                  </div>
                  <p className="mt-1 text-[9px] font-bold text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2.5 overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[linear-gradient(165deg,#1b1223,#07070c_46%,#101827)] p-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-black">TikTok 31s</span>
            <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-[9px] font-black text-rose-200">Flop</span>
          </div>
          <div className="relative mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/28 p-3 sm:mt-12">
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cyan-300/10 to-transparent" style={{ animation: 'vn-scan 3.8s ease-in-out infinite' }} aria-hidden />
            <div className="space-y-2">
              <div className="h-1.5 w-4/5 origin-left rounded-full bg-white/80" style={{ animation: 'vn-pulse-line 2.8s ease-in-out infinite' }} />
              <div className="h-1.5 w-2/3 rounded-full bg-white/35" />
              <div className="h-1.5 w-1/2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-[86px_1fr] gap-2.5">
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[0.14] px-3 py-2.5 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/70">Score</p>
            <p className="text-3xl font-black leading-none text-amber-100">58<span className="text-sm text-amber-100/60">/100</span></p>
          </div>
          <div className="rounded-2xl border border-vn-fuchsia/25 bg-vn-fuchsia/[0.08] px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-fuchsia-200">Verdict</p>
            <p className="mt-1 text-sm font-black leading-5 text-white">Tu expliques avant le payoff.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PremiumHeroVisual() {
  return (
    <div className="relative mx-auto mt-7 w-full max-w-[35rem] lg:mt-0">
      <div className="absolute -inset-4 rounded-[2.2rem] bg-[radial-gradient(circle_at_22%_14%,rgba(255,49,95,0.24),transparent_34%),radial-gradient(circle_at_78%_22%,rgba(34,211,238,0.2),transparent_32%),radial-gradient(circle_at_50%_85%,rgba(232,121,249,0.2),transparent_38%)] blur-2xl" aria-hidden />
      <div className="absolute -inset-px rounded-[1.75rem] bg-gradient-to-br from-white/24 via-white/5 to-transparent opacity-80" aria-hidden />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.13] bg-[#07070d]/92 p-1.5 shadow-[0_38px_140px_-78px_rgba(232,121,249,0.98)] backdrop-blur-xl sm:rounded-[2.15rem] sm:p-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 bg-white/10 blur-xl" style={{ animation: 'vn-glow-sweep 7s ease-in-out infinite' }} aria-hidden />

        <div className="relative aspect-[16/10.2] min-h-[238px] overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#050509] sm:min-h-[345px] lg:min-h-[430px]">
          <img
            src="/hero-viralynz.png"
            alt="Apercu premium Viralynz avec diagnostic TikTok, score et structure a remonter"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,4,8,0.02),rgba(4,4,8,0.1)_44%,rgba(4,4,8,0.45)),radial-gradient(circle_at_52%_28%,transparent,rgba(4,4,8,0.18)_66%)]" aria-hidden />

          <div
            className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-white/14 bg-black/42 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_50px_-34px_rgba(0,0,0,0.9)] backdrop-blur-md sm:left-5 sm:top-5"
            style={{ animation: 'vn-float-soft 5.8s ease-in-out infinite' }}
          >
            <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
            Diagnostic live
          </div>

          <div
            className="absolute -right-1 bottom-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/12 px-3 py-2 text-right shadow-[0_18px_55px_-30px_rgba(16,185,129,0.9)] backdrop-blur-md sm:right-5 sm:bottom-5 sm:px-4"
            style={{ animation: 'vn-float-soft 6.4s ease-in-out infinite' }}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-100/70">Structure prête</p>
            <p className="mt-0.5 text-xl font-black leading-none text-emerald-100">87/100</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5 px-1 pt-1.5 sm:gap-2 sm:px-1.5 sm:pt-2">
          {[
            ['Hook', 'à réécrire'],
            ['Drop', '0:05'],
            ['CTA', 'trop vague'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] px-2.5 py-2 sm:px-3 sm:py-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">{label}</p>
              <p className="mt-1 text-sm font-black text-white sm:text-base">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MinimalHeroMockup() {
  return (
    <div className="relative mx-auto mt-6 w-full max-w-[31rem] lg:mt-0">
      <div className="absolute -inset-4 rounded-[2rem] bg-[radial-gradient(circle_at_65%_18%,rgba(34,211,238,0.12),transparent_34%),radial-gradient(circle_at_28%_72%,rgba(168,85,247,0.13),transparent_38%)] blur-2xl" aria-hidden />

      <div className="relative overflow-hidden rounded-[1.55rem] border border-white/[0.1] bg-[#080910]/92 p-2.5 shadow-[0_32px_120px_-88px_rgba(168,85,247,0.75)] backdrop-blur-xl sm:rounded-[1.9rem] sm:p-3">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden />

        <div className="grid gap-2.5 sm:grid-cols-[0.82fr_1.18fr]">
          <div className="relative min-h-[300px] overflow-hidden rounded-[1.25rem] border border-white/[0.08] bg-[#0c0d14] p-3 sm:min-h-[360px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(168,85,247,0.16),transparent_42%)]" aria-hidden />
            <div className="relative flex items-center justify-between">
              <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-gray-300">Vidéo source</span>
              <span className="text-[10px] font-bold text-gray-500">31s</span>
            </div>
            <div className="relative mt-5 flex h-[205px] flex-col justify-end overflow-hidden rounded-[1.1rem] border border-white/[0.08] bg-[linear-gradient(180deg,#151622,#080910)] p-3 sm:h-[255px]">
              <div className="absolute left-1/2 top-7 h-20 w-20 -translate-x-1/2 rounded-full border border-white/[0.1] bg-white/[0.04]" aria-hidden />
              <div className="relative">
                <p className="max-w-[11rem] text-xl font-black leading-tight text-white">Tu expliques avant le payoff</p>
                <div className="mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="h-full w-[58%] rounded-full bg-gradient-to-r from-vn-fuchsia to-cyan-300" />
                </div>
              </div>
            </div>
            <div className="relative mt-3 grid grid-cols-3 gap-1.5">
              {['Hook', 'Rythme', 'CTA'].map((item) => (
                <div key={item} className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-2 py-1.5">
                  <p className="text-[10px] font-bold text-gray-400">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.035] p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">Diagnostic</p>
                <p className="mt-2 text-lg font-black leading-tight text-white">Sujet clair, payoff trop tard.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.09] bg-[#0d0f18] px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-gray-500">Score</p>
                <p className="mt-0.5 text-2xl font-black leading-none text-white">58<span className="text-xs text-gray-500">/100</span></p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.07] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Nouveau hook</p>
              <p className="mt-2 text-lg font-black leading-tight text-white">"Le problème n’est pas ton idée, c’est ton intro."</p>
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#0b0c13] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Plan de remontage</p>
              <div className="mt-3 grid gap-2">
                {['Couper les 3 premières secondes', 'Avancer la preuve avant 0:03', 'Finir avec un CTA court'].map((step, index) => (
                  <div key={step} className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] text-[10px] font-black text-cyan-100">{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroImageVisual() {
  const visualRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: visualRef,
    offset: ['start end', 'end start'],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [18, -18]);
  const parallaxRotate = useTransform(scrollYProgress, [0, 1], [-1.4, 1.2]);

  return (
    <motion.div
      ref={visualRef}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 26, scale: 0.985 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      style={{
        y: prefersReducedMotion ? 0 : parallaxY,
        rotate: prefersReducedMotion ? 0 : parallaxRotate,
      }}
      className="relative mx-auto mt-7 w-[85vw] max-w-[22rem] sm:mt-9 sm:w-full sm:max-w-[42rem] lg:mt-0 lg:-mr-20 lg:max-w-[60rem]"
    >
      <motion.div
        data-hero-glow
        className="absolute -inset-x-8 -inset-y-5 rounded-[999px] bg-[radial-gradient(circle_at_50%_46%,rgba(168,85,247,0.3),transparent_46%),radial-gradient(circle_at_76%_34%,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_24%_78%,rgba(236,72,153,0.11),transparent_30%)] blur-3xl sm:bg-[radial-gradient(circle_at_50%_46%,rgba(168,85,247,0.34),transparent_46%),radial-gradient(circle_at_76%_34%,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_24%_78%,rgba(236,72,153,0.14),transparent_30%)]"
        animate={prefersReducedMotion ? undefined : { opacity: [0.36, 0.66, 0.36], scale: [0.98, 1.035, 0.98] }}
        transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        className="absolute left-[8%] top-[10%] h-1.5 w-1.5 rounded-full bg-cyan-200/80 shadow-[0_0_22px_rgba(34,211,238,0.9)]"
        animate={prefersReducedMotion ? undefined : { opacity: [0.32, 0.86, 0.32], scale: [1, 1.35, 1] }}
        transition={{ duration: 5.4, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <motion.div
        className="absolute bottom-[22%] right-[10%] h-2 w-2 rounded-full bg-vn-fuchsia/70 shadow-[0_0_26px_rgba(232,121,249,0.9)]"
        animate={prefersReducedMotion ? undefined : { opacity: [0.4, 0.9, 0.4], scale: [1, 1.28, 1] }}
        transition={{ duration: 6.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
        aria-hidden
      />
      <motion.div
        className="absolute right-[34%] top-[4%] h-1 w-1 rounded-full bg-white/70 shadow-[0_0_18px_rgba(255,255,255,0.75)]"
        animate={prefersReducedMotion ? undefined : { opacity: [0.15, 0.65, 0.15], y: [0, -6, 0] }}
        transition={{ duration: 7.4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
        aria-hidden
      />
      <motion.div
        className="absolute left-[-2%] top-[19%] z-20 scale-75 rounded-2xl border border-white/[0.12] bg-black/42 px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_20px_60px_-38px_rgba(0,0,0,0.9)] backdrop-blur-md sm:left-[6%] sm:top-[24%] sm:scale-100"
        animate={prefersReducedMotion ? undefined : { y: [0, -8, 0], opacity: [0.78, 1, 0.78] }}
        transition={{ duration: 6.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      >
        Analyse live
      </motion.div>
      <motion.div
        className="absolute right-[-8%] top-[14%] z-20 scale-75 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_22px_70px_-42px_rgba(34,211,238,0.95)] backdrop-blur-md sm:right-[4%] sm:top-[17%] sm:scale-100"
        animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], opacity: [0.74, 1, 0.74] }}
        transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
      >
        Structure prête
      </motion.div>
      <motion.div
        className="absolute bottom-[10%] left-[-3%] z-20 scale-75 rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.09] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-50 shadow-[0_22px_70px_-42px_rgba(232,121,249,0.95)] backdrop-blur-md sm:bottom-[12%] sm:left-[12%] sm:scale-100"
        animate={prefersReducedMotion ? undefined : { y: [0, 9, 0], opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 7.8, repeat: Infinity, ease: 'easeInOut', delay: 1.1 }}
      >
        Hook réparé
      </motion.div>

      <motion.div
        data-hero-float
        className="relative overflow-visible rounded-[2rem] transition duration-700 [transform-style:preserve-3d] lg:hover:scale-[1.015]"
        animate={prefersReducedMotion ? undefined : { y: [0, -11, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.014, rotateX: 1.2, rotateY: -2.2, rotateZ: 0.4 }}
      >
        <div className="absolute inset-x-[18%] bottom-[5%] h-12 rounded-full bg-black/75 blur-2xl sm:h-16 sm:blur-3xl" aria-hidden />
        <div className="relative h-[22rem] overflow-visible rounded-[2rem] bg-transparent sm:h-auto">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_52%_44%,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_60%_58%,rgba(34,211,238,0.13),transparent_42%)] blur-2xl" aria-hidden />
          <motion.img
            src="/hero-viralynz.png"
            alt="Hero Viralynz avec video TikTok diagnostiquee et structure a remonter"
            className="absolute left-1/2 top-1/2 block h-auto w-[205%] max-w-none -translate-x-[48%] -translate-y-[50%] select-none object-contain drop-shadow-[0_34px_62px_rgba(0,0,0,0.58)] [mask-image:radial-gradient(ellipse_at_center,black_56%,rgba(0,0,0,0.92)_76%,transparent_100%)] sm:relative sm:left-auto sm:top-auto sm:mx-auto sm:w-[118%] sm:-translate-x-[9%] sm:translate-y-0 sm:drop-shadow-[0_42px_80px_rgba(0,0,0,0.58)] lg:w-[124%] lg:-translate-x-[10%]"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.012, 1] }}
            transition={{ duration: 8.5, repeat: Infinity, ease: 'easeInOut' }}
            draggable={false}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function DashboardStatCard({ label, value, lift }: { label: string; value: string; lift: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] p-3 shadow-[0_18px_55px_-48px_rgba(168,85,247,0.9)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-gray-400">{label}</p>
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.95)]" />
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-xl font-black leading-none text-white sm:text-3xl">{value}</p>
        <p className="text-[10px] font-black text-lime-300">{lift}</p>
      </div>
      <div className="mt-3 h-8 overflow-hidden">
        <svg viewBox="0 0 180 44" className="h-full w-full" fill="none" aria-hidden>
          <path d="M0 32 C18 30 22 37 38 31 C52 25 60 32 74 25 C88 18 96 24 110 17 C126 8 132 16 144 9 C158 0 166 10 180 4" stroke="url(#statLine)" strokeWidth="2.5" />
          <path d="M0 44 L0 32 C18 30 22 37 38 31 C52 25 60 32 74 25 C88 18 96 24 110 17 C126 8 132 16 144 9 C158 0 166 10 180 4 L180 44 Z" fill="url(#statFill)" />
          <defs>
            <linearGradient id="statLine" x1="0" x2="180" y1="20" y2="20">
              <stop stopColor="#22d3ee" />
              <stop offset="1" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="statFill" x1="90" x2="90" y1="4" y2="44">
              <stop stopColor="#8b5cf6" stopOpacity="0.38" />
              <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function HeroDashboardMockup() {
  const navItems = ['Dashboard', 'Analyses', 'Structure Insights', 'Hooks', 'Trends'];
  const insights = [
    ['Hook', '58/100', 'Le sujet est clair, mais la tension arrive trop tard.'],
    ['Rétention', '72/100', 'Drop détecté à 0:05, juste avant la preuve.'],
    ['Payoff', '88/100', 'Le meilleur moment doit passer en première frame.'],
  ];
  const recs = ['Réécrire le hook', 'Avancer le payoff', 'CTA plus tôt'];

  return (
    <div className="absolute left-1/2 top-1/2 h-[619px] w-[1100px] -translate-x-1/2 -translate-y-1/2 scale-[0.32] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#04050b] text-left shadow-[0_40px_140px_-72px_rgba(124,58,237,0.9)] sm:scale-[0.58] md:scale-[0.72] lg:scale-[0.9] xl:scale-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_12%,rgba(124,58,237,0.24),transparent_30%),radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_30%)]" aria-hidden />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:42px_42px] opacity-30" aria-hidden />

      <div className="relative grid h-full grid-cols-[8.5rem_1fr]">
        <aside className="block border-r border-white/[0.07] bg-black/28 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-vn-fuchsia/35 bg-vn-fuchsia/15 text-lg font-black text-fuchsia-200">V</div>
            <div>
              <p className="text-sm font-black text-white">Viralynz</p>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-vn-fuchsia">Pro</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {navItems.map((item, index) => (
              <div
                key={item}
                className={`rounded-lg px-2.5 py-2 text-[11px] font-bold ${
                  index === 0 ? 'bg-vn-fuchsia/20 text-white ring-1 ring-vn-fuchsia/25' : 'text-gray-500'
                }`}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
            <p className="text-[10px] font-black text-white">Pro Plan</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-vn-fuchsia to-blue-500" />
            </div>
          </div>
        </aside>

        <div className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-black leading-none text-white sm:text-2xl">Dashboard Viralynz</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-400">Diagnostic hook · drop · structure</p>
            </div>
            <span className="rounded-lg border border-vn-fuchsia/30 bg-vn-fuchsia/15 px-2.5 py-1.5 text-[10px] font-black text-fuchsia-100">
              Nouveau diagnostic
            </span>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            <DashboardStatCard label="Hook" value="0:02" lift="trop sage" />
            <DashboardStatCard label="Drop" value="0:05" lift="-38%" />
            <DashboardStatCard label="Watch time" value="8.7s" lift="+14.6%" />
            <DashboardStatCard label="Score structure" value="87" lift="+11.3%" />
          </div>

          <div className="mt-3 grid grid-cols-[1.5fr_0.85fr] gap-3">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-white">Timeline rétention</p>
                <span className="rounded-md border border-white/[0.08] px-2 py-1 text-[10px] font-bold text-gray-400">Cette vidéo</span>
              </div>
              <div className="relative mt-3 h-52 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                <div className="absolute inset-x-0 bottom-6 top-4 grid grid-rows-4">
                  {[0, 1, 2, 3].map((line) => (
                    <span key={line} className="border-t border-white/[0.05]" />
                  ))}
                </div>
                <svg viewBox="0 0 640 220" className="absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M0 45 C55 82 76 98 126 91 C178 84 198 126 254 116 C312 104 316 147 368 151 C430 155 437 111 493 124 C556 138 571 167 640 158" stroke="url(#retentionHeroLine)" strokeWidth="4" />
                  <path d="M0 220 L0 45 C55 82 76 98 126 91 C178 84 198 126 254 116 C312 104 316 147 368 151 C430 155 437 111 493 124 C556 138 571 167 640 158 L640 220 Z" fill="url(#retentionHeroFill)" />
                  <circle cx="80" cy="86" r="7" fill="#a855f7" />
                  <circle cx="300" cy="135" r="7" fill="#fb7185" />
                  <circle cx="430" cy="111" r="7" fill="#60a5fa" />
                  <defs>
                    <linearGradient id="retentionHeroLine" x1="0" x2="640" y1="90" y2="90">
                      <stop stopColor="#a855f7" />
                      <stop offset="0.5" stopColor="#ec4899" />
                      <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                    <linearGradient id="retentionHeroFill" x1="320" x2="320" y1="45" y2="220">
                      <stop stopColor="#8b5cf6" stopOpacity="0.42" />
                      <stop offset="1" stopColor="#0ea5e9" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute left-[8%] top-5 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">Hook trop explicatif</div>
                <div className="absolute left-[46%] top-[52%] rounded-lg bg-rose-500/18 px-2 py-1 text-[10px] font-bold text-rose-100 ring-1 ring-rose-300/20">Drop 0:05</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2">
                <div className="relative h-40 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_24%,rgba(168,85,247,0.52),transparent_34%),linear-gradient(160deg,#111827,#09090f)] sm:h-52">
                  <div className="absolute inset-x-8 top-10 h-28 rounded-full bg-vn-fuchsia/25 blur-2xl" />
                  <div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/[0.09] bg-black/45 p-3 backdrop-blur">
                    <p className="text-sm font-black text-white">Tu expliques avant le payoff</p>
                    <p className="mt-1 text-[11px] text-gray-400">15.2s · drop 0:05</p>
                  </div>
                  <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white">▶</div>
                </div>
              </div>

              <div className="rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.075] p-3">
                <p className="text-sm font-black text-white">Structure Insights</p>
                <p className="mt-2 text-sm leading-5 text-gray-300">Cette vidéo devient <span className="font-black text-fuchsia-300">plus solide à retester</span> après correction.</p>
                <div className="mt-3 space-y-2">
                  {insights.map(([name, score, body]) => (
                    <div key={name} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/[0.07] bg-black/24 p-2">
                      <div>
                        <p className="text-[11px] font-black text-white">{name}</p>
                        <p className="mt-0.5 text-[10px] leading-4 text-gray-500">{body}</p>
                      </div>
                      <span className="text-[11px] font-black text-lime-300">{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {recs.map((rec, index) => (
              <div key={rec} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                <p className="text-[11px] font-black text-white">{rec}</p>
                <div className={`mt-3 h-1.5 rounded-full ${index === 0 ? 'bg-vn-fuchsia' : index === 1 ? 'bg-blue-500' : 'bg-cyan-400'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FullHeroDashboardMockup() {
  const navItems = ['Dashboard', 'Analyses', 'Structure Insights', 'Hooks', 'Hook Patterns', 'Content Memory', 'Collections', 'Competitors', 'Alerts', 'Exports', 'Settings'];
  const insightRows = [
    ['Hook', '58/100', 'Le hook annonce le sujet, mais pas la tension.', 'bg-orange-400'],
    ['Rétention', '72/100', 'Le rythme baisse entre 0:04 et 0:07.', 'bg-orange-400'],
    ['Payoff', '88/100', 'La preuve forte arrive trop tard dans la timeline.', 'bg-vn-fuchsia'],
    ['CTA', '61/100', 'La question arrive après le départ des viewers faibles.', 'bg-cyan-400'],
  ];
  const topVideos = [
    ['92', 'Tu donnes le contexte avant la tension', 'Structure prioritaire'],
    ['85', 'L’intro qui casse le watch time', 'Hook à réécrire'],
    ['78', 'Avance le payoff avant 0:03', 'Timeline claire'],
    ['75', 'Arrête d’ouvrir tes vidéos comme ça', 'CTA à resserrer'],
  ];
  const recommendations = [
    ['Réécrire le hook', 'Commence par la tension, pas par le contexte.', 'Générer hooks', 'from-vn-fuchsia to-violet-600'],
    ['Avancer le payoff', 'Place la preuve avant 0:03 pour retenir.', 'Voir timeline', 'from-blue-600 to-indigo-600'],
    ['Ajouter une rupture', 'Relance le rythme entre 0:04 et 0:07.', 'Voir cuts', 'from-pink-600 to-vn-fuchsia'],
    ['CTA plus net', 'Ajoute la question avant que le viewer quitte.', 'Voir exemples', 'from-cyan-700 to-teal-600'],
  ];

  return (
    <div className="absolute left-1/2 top-1/2 h-[864px] w-[1536px] -translate-x-1/2 -translate-y-1/2 scale-[0.205] overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#030610] text-left shadow-[0_40px_140px_-72px_rgba(124,58,237,0.9)] sm:scale-[0.34] md:scale-[0.45] lg:scale-[0.6] xl:scale-[0.716] 2xl:scale-[0.716]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_12%,rgba(124,58,237,0.24),transparent_30%),radial-gradient(circle_at_28%_0%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.045),transparent_30%)]" aria-hidden />
      <div className="relative grid h-full grid-cols-[224px_1fr]">
        <aside className="relative border-r border-white/[0.07] bg-black/34 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-vn-fuchsia to-violet-700 text-xl font-black text-white">V</div>
            <p className="text-2xl font-black leading-none text-white">Viralynz</p>
            <span className="ml-auto rounded-md bg-vn-fuchsia/25 px-2 py-1 text-[11px] font-black text-fuchsia-100">Pro</span>
          </div>
          <div className="mt-7 space-y-2">
            {navItems.map((item, index) => (
              <div key={item} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-bold ${index === 0 ? 'bg-vn-fuchsia/24 text-white ring-1 ring-vn-fuchsia/35' : 'text-gray-400'}`}>
                <span className="h-4 w-4 rounded border border-current opacity-80" />
                {item}
                {item === 'Alerts' ? <span className="ml-auto rounded bg-vn-fuchsia/25 px-1.5 py-0.5 text-[10px] text-fuchsia-100">New</span> : null}
              </div>
            ))}
          </div>
          <div className="absolute bottom-20 left-5 right-5 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
            <p className="text-sm font-black text-white">Pro Plan</p>
            <p className="mt-2 text-xs text-gray-400">150 / 150 analyses used</p>
            <div className="mt-2 h-1.5 rounded-full bg-white/10">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-vn-fuchsia to-blue-500" />
            </div>
            <div className="mt-4 rounded-lg border border-vn-fuchsia/30 bg-vn-fuchsia/15 py-2 text-center text-sm font-black text-fuchsia-200">Upgrade plan</div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 bg-white/[0.025] p-5">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-cyan-200 to-vn-fuchsia" />
            <div>
              <p className="text-sm font-black text-white">Alexandre</p>
              <p className="text-xs text-gray-500">alex@viralynz.com</p>
            </div>
          </div>
        </aside>

        <div className="p-5">
          <div className="flex h-16 items-start justify-between">
            <div>
              <p className="text-2xl font-black leading-none text-white">Analyse prête, Alexandre</p>
              <p className="mt-2 text-sm font-semibold text-gray-400">Hook, drop, cuts et version à retester</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-lg border border-white/[0.09] bg-white/[0.035] px-4 py-2 text-sm font-semibold text-gray-300">Vidéo · 15.2s</span>
              <span className="rounded-lg bg-gradient-to-r from-vn-fuchsia to-violet-600 px-5 py-2 text-sm font-black text-white">+ Nouvelle analyse</span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_360px] gap-4">
            <div>
              <div className="grid grid-cols-5 gap-3">
                <DashboardStatCard label="Watch time" value="8.7s" lift="+14.6%" />
                <DashboardStatCard label="Drop" value="0:05" lift="-38%" />
                <DashboardStatCard label="CTA" value="tardif" lift="à couper" />
                <DashboardStatCard label="Score structure" value="87/100" lift="+11.3%" />
                <div className="rounded-xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.11] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-fuchsia-200">Priorité structure</p>
                  <p className="mt-3 text-2xl font-black text-white">Haute</p>
                  <div className="mt-3 grid grid-cols-4 gap-1">
                    <span className="h-1.5 rounded bg-fuchsia-300" />
                    <span className="h-1.5 rounded bg-fuchsia-400" />
                    <span className="h-1.5 rounded bg-violet-900" />
                    <span className="h-1.5 rounded bg-violet-950" />
                  </div>
                  <p className="mt-3 text-xs leading-4 text-gray-300">7 vidéos à restructurer</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_224px] gap-4">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-black text-white">Timeline rétention</p>
                    <span className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-bold text-gray-400">Cette vidéo</span>
                  </div>
                  <div className="relative mt-4 h-[260px] overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
                    <div className="absolute inset-x-0 bottom-8 top-5 grid grid-rows-4">
                      {[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-white/[0.05]" />)}
                    </div>
                    <svg viewBox="0 0 760 280" className="absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="none" aria-hidden>
                      <path d="M0 54 C66 104 90 120 150 110 C212 100 236 152 302 140 C370 126 376 184 438 186 C512 188 520 132 586 150 C660 168 678 214 760 196" stroke="url(#fullRetentionLine)" strokeWidth="4" />
                      <path d="M0 280 L0 54 C66 104 90 120 150 110 C212 100 236 152 302 140 C370 126 376 184 438 186 C512 188 520 132 586 150 C660 168 678 214 760 196 L760 280 Z" fill="url(#fullRetentionFill)" />
                      <circle cx="95" cy="104" r="7" fill="#a855f7" />
                      <circle cx="356" cy="170" r="7" fill="#fb7185" />
                      <circle cx="510" cy="132" r="7" fill="#60a5fa" />
                      <defs>
                        <linearGradient id="fullRetentionLine" x1="0" x2="760" y1="120" y2="120"><stop stopColor="#a855f7" /><stop offset="0.55" stopColor="#ec4899" /><stop offset="1" stopColor="#22d3ee" /></linearGradient>
                        <linearGradient id="fullRetentionFill" x1="380" x2="380" y1="54" y2="280"><stop stopColor="#8b5cf6" stopOpacity="0.42" /><stop offset="1" stopColor="#0ea5e9" stopOpacity="0" /></linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute left-[8%] top-6 rounded-lg bg-black/55 px-3 py-2 text-xs font-bold text-white backdrop-blur">Hook compris<br /><span className="text-gray-400">tension faible</span></div>
                    <div className="absolute left-[46%] top-[49%] rounded-lg bg-rose-500/18 px-3 py-2 text-xs font-bold text-rose-100 ring-1 ring-rose-300/20">Drop 0:05<br />-38%</div>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-2 rounded-xl border border-white/[0.06] bg-black/20 p-2">
                    {['Hook 0:02', 'Drop 0:05', 'Payoff 0:11', 'CTA 0:15', 'Score 87'].map((tag, index) => (
                      <span key={tag} className={`rounded-lg px-2 py-2 text-center text-xs font-black ${index === 1 ? 'bg-orange-500/12 text-orange-300' : 'bg-violet-500/12 text-violet-200'}`}>{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2">
                  <div className="relative h-[260px] overflow-hidden rounded-xl bg-[radial-gradient(circle_at_50%_24%,rgba(168,85,247,0.52),transparent_34%),linear-gradient(160deg,#111827,#09090f)]">
                    <div className="absolute inset-x-8 top-10 h-32 rounded-full bg-vn-fuchsia/25 blur-2xl" />
                    <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white">▶</div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-16">
                      <p className="text-base font-black text-white">Tu expliques avant le payoff</p>
                      <p className="mt-1 text-xs text-gray-400">15.2s · drop à 0:05</p>
                    </div>
                  </div>
                  <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.04] py-2 text-center text-sm font-bold text-gray-300">Voir la source</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[190px_1fr_280px] gap-4">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                  <p className="text-base font-black text-white">Signal structure</p>
                  <div className="mx-auto mt-8 flex h-28 w-28 items-center justify-center rounded-full border-[10px] border-vn-fuchsia border-r-violet-950 text-4xl font-black text-white">89%</div>
                  <p className="mt-4 text-sm text-gray-400">À retester</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <p className="text-base font-black text-white">Courbe d’attention</p>
                  <svg viewBox="0 0 520 170" className="mt-4 h-[160px] w-full" fill="none" aria-hidden>
                    <path d="M0 102 C40 58 80 72 120 88 C170 112 205 36 260 62 C306 84 324 132 356 74 C402 22 448 48 520 20" stroke="url(#emotionHeroLineFull)" strokeWidth="3" />
                    <path d="M0 170 L0 102 C40 58 80 72 120 88 C170 112 205 36 260 62 C306 84 324 132 356 74 C402 22 448 48 520 20 L520 170 Z" fill="url(#emotionHeroFillFull)" />
                    <defs>
                      <linearGradient id="emotionHeroLineFull" x1="0" x2="520" y1="70" y2="70"><stop stopColor="#f97316" /><stop offset="0.45" stopColor="#ec4899" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
                      <linearGradient id="emotionHeroFillFull" x1="260" x2="260" y1="20" y2="170"><stop stopColor="#ec4899" stopOpacity="0.32" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <p className="text-base font-black text-white">Patterns de contenu</p>
                  <div className="mt-5 grid grid-cols-[100px_1fr] gap-5">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-[18px] border-vn-fuchsia border-l-cyan-300 border-t-orange-300 text-center text-sm font-black text-white">12.4M<br /><span className="text-[10px] text-gray-400">vues</span></div>
                    <div className="space-y-2 text-xs font-bold text-gray-300">
                      {['Hooks directs 42%', 'Proof first 27%', 'Storytime 15%', 'BTS 9%', 'Autres 7%'].map((item) => <p key={item}>{item}</p>)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <p className="text-base font-black text-white">Actions de remontage</p>
                <div className="mt-3 grid grid-cols-4 gap-3">
                  {recommendations.map(([title, body, action, gradient]) => (
                    <div key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                      <p className="text-sm font-black text-white">{title}</p>
                      <p className="mt-2 min-h-[42px] text-xs leading-5 text-gray-400">{body}</p>
                      <div className={`mt-3 rounded-md bg-gradient-to-r ${gradient} py-2 text-center text-xs font-black text-white`}>{action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.075] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-base font-black text-white">Structure Insights</p>
                  <span className="rounded-md bg-vn-fuchsia/25 px-2 py-1 text-[10px] font-black text-fuchsia-100">New</span>
                </div>
                <p className="mt-5 text-lg leading-7 text-gray-300">Cette vidéo devient <span className="font-black text-fuchsia-300">plus claire à retester</span> une fois le hook et le CTA corrigés.</p>
                <div className="mt-4 space-y-3">
                  {insightRows.map(([name, score, body, dot]) => (
                    <div key={name} className="grid grid-cols-[auto_1fr_auto] gap-3 rounded-xl border border-white/[0.07] bg-black/24 p-3">
                      <span className={`mt-1 h-7 w-7 rounded-full ${dot}`} />
                      <div>
                        <p className="text-sm font-black text-white">{name}</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{body}</p>
                      </div>
                      <span className="text-sm font-black text-lime-300">{score}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg bg-gradient-to-r from-vn-fuchsia to-violet-700 py-3 text-center text-sm font-black text-white">Voir le plan de remontage</div>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-base font-black text-white">Structures à étudier</p>
                  <span className="text-xs font-black text-fuchsia-300">Tout voir</span>
                </div>
                <div className="space-y-3">
                  {topVideos.map(([score, title, views]) => (
                    <div key={title} className="grid grid-cols-[40px_1fr_auto] gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-300 to-vn-fuchsia" />
                      <div>
                        <p className="text-sm font-bold leading-4 text-white">{title}</p>
                        <p className="mt-1 text-xs text-gray-500">{views}</p>
                      </div>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-lime-400/40 text-xs font-black text-lime-300">{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductHeroStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      ref={stageRef}
      className="relative mx-auto mt-5 w-[94vw] max-w-[1100px] sm:mt-10 sm:w-[90vw]"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="absolute -inset-x-4 -inset-y-4 rounded-[2.2rem] bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,0.24),transparent_46%),radial-gradient(circle_at_72%_58%,rgba(34,211,238,0.14),transparent_36%)] blur-2xl sm:-inset-x-8 sm:-inset-y-8 sm:rounded-[3rem] sm:blur-3xl"
        animate={prefersReducedMotion ? undefined : { opacity: [0.34, 0.58, 0.34] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <motion.div
        className="relative overflow-hidden rounded-[1.55rem] border border-white/[0.1] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-1.5 shadow-[0_50px_150px_-92px_rgba(34,211,238,0.8)] backdrop-blur-xl sm:rounded-[2.2rem] sm:p-2"
        whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.008 }}
        animate={
          prefersReducedMotion
            ? undefined
            : {
                boxShadow: [
                  '0 50px 150px -92px rgba(34,211,238,0.8)',
                  '0 50px 170px -82px rgba(168,85,247,0.95)',
                  '0 50px 150px -92px rgba(34,211,238,0.8)',
                ],
                borderColor: ['rgba(255,255,255,0.1)', 'rgba(34,211,238,0.26)', 'rgba(255,255,255,0.1)'],
              }
        }
        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" aria-hidden />
        <div className="relative aspect-[3/2] overflow-hidden rounded-[1.3rem] bg-[#050508] sm:rounded-[1.8rem]">
          <img
            src="/hero-dashboard-complete.png"
            alt="Dashboard Viralynz complet avec rétention, drops détectés et plan de remontage"
            className="h-full w-full object-contain object-center"
            loading="eager"
            decoding="async"
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProductCommandCenter() {
  return (
    <MotionSection id="exemple-analyse" className={`${shell} relative py-5 sm:py-14`} ariaLabel="Exemple d'analyse Viralynz">
      <div className="relative overflow-hidden rounded-[1.35rem] border border-white/[0.13] bg-[#07070d] shadow-[0_42px_170px_-86px_rgba(232,121,249,0.95)] sm:rounded-[2.1rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_13%_0%,rgba(232,121,249,0.22),transparent_34%),radial-gradient(circle_at_86%_8%,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.055),transparent_31%)]" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" aria-hidden />

        <div className="relative p-3.5 sm:p-6 lg:p-7">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/80">Ce que tu reçois après analyse</p>
            <h2 className="mt-2 text-[1.45rem] font-black leading-tight text-white sm:text-4xl">
              Viralynz ne te dit pas seulement que ça flop
              <TitleAccent> Il te montre comment le remonter mieux</TitleAccent>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[13px] font-semibold leading-5 text-gray-400 sm:mt-3 sm:text-base sm:leading-6">
              Tu ne repars pas avec une note. Tu repars avec quoi couper, quoi avancer et quoi tester.
            </p>
          </div>

          <div className="mt-4 grid gap-2.5 sm:mt-6 sm:gap-3 lg:grid-cols-[0.92fr_1.05fr_1.12fr] lg:items-stretch">
            <motion.article whileHover={cardHover} className="relative overflow-hidden rounded-[1.15rem] border border-amber-300/20 bg-amber-300/[0.06] p-3.5 transition-shadow duration-500 hover:shadow-[0_28px_95px_-72px_rgba(251,191,36,0.8)] sm:rounded-[1.25rem] sm:p-5">
              <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-300/10 blur-2xl" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/70">Vidéo actuelle</p>
              <div className="mt-3 flex items-end justify-between gap-4 sm:mt-4">
                <div>
                  <p className="text-sm font-bold text-gray-400">Score actuel</p>
                  <p className="mt-1 text-4xl font-black leading-none text-amber-100 sm:text-5xl">42<span className="text-lg text-amber-100/45 sm:text-xl">/100</span></p>
                </div>
                <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-rose-100">Intro faible</span>
              </div>
              <div className="mt-3 grid gap-2 sm:mt-5">
                {[
                  ['Problème', 'Intro trop explicative'],
                  ['Drop probable', 'Avant 0:04'],
                  ['CTA', 'Trop vague'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/[0.08] bg-black/20 p-2.5 sm:rounded-2xl sm:p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">{label}</p>
                    <p className="mt-1 text-sm font-black leading-5 text-white">{value}</p>
                  </div>
                ))}
              </div>
            </motion.article>

            <motion.article whileHover={cardHover} className="relative overflow-hidden rounded-[1.15rem] border border-white/[0.1] bg-white/[0.045] p-3.5 transition-shadow duration-500 hover:shadow-[0_28px_95px_-72px_rgba(168,85,247,0.86)] sm:rounded-[1.25rem] sm:p-5">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/80">Diagnostic Viralynz</p>
              <div className="mt-3 rounded-2xl border border-vn-fuchsia/25 bg-vn-fuchsia/[0.09] p-3 sm:mt-4 sm:p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200">Verdict</p>
                <p className="mt-2 text-lg font-black leading-tight text-white sm:text-xl">Le problème n’est pas ton idée. C’est ton intro.</p>
              </div>
              <div className="mt-2.5 grid gap-2 sm:mt-3 sm:gap-2.5">
                {diagnosticInsights.map((item, index) => (
                    <div key={item} className="grid grid-cols-[1.75rem_1fr] gap-2.5 rounded-xl border border-white/[0.08] bg-black/22 p-2.5 sm:grid-cols-[2rem_1fr] sm:gap-3 sm:rounded-2xl sm:p-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-xs font-black text-cyan-100">{index + 1}</span>
                    <p className="text-sm font-semibold leading-5 text-gray-200">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {aiSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.07] px-2.5 py-1 text-[10px] font-black text-cyan-100/85">
                    {signal}
                  </span>
                ))}
              </div>
            </motion.article>

            <motion.article whileHover={cardHover} className="relative overflow-hidden rounded-[1.15rem] border border-cyan-300/20 bg-cyan-300/[0.055] p-3.5 shadow-[0_28px_95px_-72px_rgba(34,211,238,0.95)] transition-shadow duration-500 hover:shadow-[0_34px_115px_-76px_rgba(34,211,238,1)] sm:rounded-[1.25rem] sm:p-5">
              <div className="absolute -right-12 top-6 h-32 w-32 rounded-full bg-cyan-300/12 blur-2xl" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/80">Simulation de structure</p>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-black/24 p-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">Score estimé après</p>
                  <p className="mt-1 text-4xl font-black leading-none text-cyan-100 sm:text-5xl">74<span className="text-lg text-cyan-100/45 sm:text-xl">/100</span></p>
                </div>
                <div className="flex min-w-24 items-center justify-center rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-[11px] font-black text-lime-100">
                  +32 points
                </div>
              </div>
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-cyan-300/15 bg-black/22 p-3">
                <div className="absolute left-7 top-7 bottom-5 w-px bg-gradient-to-b from-cyan-300/45 via-vn-fuchsia/35 to-transparent" aria-hidden />
                <div className="space-y-2.5">
                  {repostTimeline.map(([time, label, badge]) => (
                    <div key={time} className="relative grid grid-cols-[2.7rem_1fr_auto] items-center gap-2">
                      <span className="relative z-10 rounded-full border border-cyan-300/25 bg-[#07141a] px-2 py-1 text-center text-[10px] font-black text-cyan-100">{time}</span>
                      <p className="min-w-0 text-xs font-bold leading-4 text-gray-200">{label}</p>
                      <span className="rounded-full border border-white/[0.08] bg-white/[0.045] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-gray-400">{badge}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2.5 grid gap-2 sm:mt-3">
                {repostOutputs.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/70">{label}</p>
                    <p className="mt-1 text-sm font-black leading-5 text-white">{value}</p>
                  </div>
                ))}
              </div>
            </motion.article>
          </div>

          <div className="relative mt-3 overflow-hidden rounded-[1.15rem] border border-white/[0.1] bg-black/24 p-3.5 shadow-[0_24px_90px_-74px_rgba(139,92,246,0.95)] sm:mt-4 sm:rounded-[1.25rem] sm:p-5">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-vn-fuchsia/45 to-transparent" aria-hidden />
            <div className="grid gap-3 lg:grid-cols-[0.74fr_1.18fr_auto] lg:items-center">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/75">Structure prête à remonter</p>
                <p className="mt-1 text-lg font-black leading-tight text-white">Viralynz change l’ordre, pas le sujet.</p>
                <p className="mt-2 rounded-2xl border border-vn-fuchsia/15 bg-vn-fuchsia/[0.07] p-3 text-xs font-bold leading-5 text-fuchsia-100/85">
                  Payoff → preuve → correction → CTA. La même idée, mais montée pour retenir.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {repostPlan.map(([time, action]) => (
                  <div key={time} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5 sm:rounded-2xl sm:p-3">
                    <p className="text-[11px] font-black text-cyan-200">{time}</p>
                    <p className="mt-1 text-xs font-bold leading-[1.45] text-gray-300">{action}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row lg:flex-col">
                <Link
                  href="/signup"
                  className="group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-vn-bg transition duration-500 ease-out hover:-translate-y-0.5 hover:bg-cyan-50 hover:shadow-[0_22px_72px_-46px_rgba(255,255,255,0.78)] active:scale-[0.99] sm:min-h-[48px]"
                >
                  Analyser mon TikTok
                  <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
                <p className="text-center text-[11px] font-bold text-gray-500">3 analyses gratuites · sans carte bancaire</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {repostFixes.map((fix) => (
                <div key={fix} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[11px] font-bold leading-4 text-gray-400">
                  {fix}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

function RepostTransformationSection() {
  const beforeTimeline = [
    ['0:00', 'Intro explicative', '“Salut les gars, aujourd’hui je vais vous montrer…”', 'hook faible'],
    ['0:03', 'Drop détecté', 'Le viewer n’a toujours pas vu le bénéfice.', '-42%'],
    ['0:07', 'Preuve trop tard', 'Le meilleur passage arrive après la chute.', 'payoff tardif'],
    ['0:14', 'CTA vague', '“Dis-moi ce que tu en penses.”', 'faible action'],
  ];

  const afterTimeline = [
    ['0:00', 'Payoff en première frame', '“Le problème n’est pas ton produit.”', 'hook direct'],
    ['0:02', 'Preuve avancée', 'Le résultat apparaît avant le premier drop.', '+18 pts'],
    ['0:05', 'Pattern interrupt', 'Cut visuel au moment où le rythme baissait.', 'relance'],
    ['0:12', 'CTA précis', '“Commente PRODUIT si tu veux la version courte.”', 'action claire'],
  ];

  const corrections = [
    ['Hook', 'Le sujet devient une tension claire.'],
    ['Ordre', 'Payoff → preuve → erreur → correction.'],
    ['Rythme', 'Cut ajouté juste avant le passage plat.'],
    ['CTA', 'Question courte, liée au bénéfice.'],
  ];

  return (
    <MotionSection className={`${shell} relative py-6 sm:py-16`}>
      <div className="relative overflow-hidden rounded-[1.45rem] border border-white/[0.11] bg-[#06070d] shadow-[0_44px_180px_-96px_rgba(168,85,247,0.98)] sm:rounded-[2.15rem]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(244,63,94,0.17),transparent_34%),radial-gradient(circle_at_82%_6%,rgba(34,211,238,0.15),transparent_32%),radial-gradient(circle_at_50%_100%,rgba(168,85,247,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.055),transparent_34%)]" aria-hidden />
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" aria-hidden />

        <div className="relative p-3.5 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/80">Avant / aprÃ¨s repost</p>
            <h2 className="mt-2 text-[1.55rem] font-black leading-tight tracking-tight text-white sm:text-4xl">
              La mÃªme idÃ©e <TitleAccent>Une structure qui retient</TitleAccent>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-[13px] font-semibold leading-5 text-gray-400 sm:mt-3 sm:text-base sm:leading-6">
              Viralynz ne maquille pas la vidÃ©o. Il change lâ€™ordre des moments qui comptent : hook, preuve, rythme, payoff et CTA.
            </p>
          </div>

          <div className="mt-5 grid gap-3 lg:mt-8 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            <motion.article whileHover={cardHover} className="relative overflow-hidden rounded-[1.25rem] border border-rose-400/24 bg-[linear-gradient(150deg,rgba(244,63,94,0.105),rgba(8,9,14,0.94))] p-3.5 shadow-[0_28px_110px_-82px_rgba(244,63,94,0.9)] sm:p-5">
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/50 to-transparent" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-200/70">Avant repost</p>
                  <h3 className="mt-1 text-xl font-black leading-tight text-white sm:text-2xl">La vidÃ©o explique avant de donner envie</h3>
                </div>
                <div className="rounded-2xl border border-rose-300/24 bg-rose-400/10 px-3 py-2 text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-100/65">Score</p>
                  <p className="text-3xl font-black leading-none text-rose-100">42</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/24 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">Simulation rÃ©tention</span>
                  <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[10px] font-black text-rose-100">drop Ã  0:03</span>
                </div>
                <svg viewBox="0 0 420 150" className="h-32 w-full" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M0 34 C45 44 69 66 103 86 C142 109 174 118 218 116 C258 114 290 126 332 130 C374 134 397 138 420 141" stroke="url(#beforeRepostLine)" strokeWidth="4" />
                  <path d="M0 150 L0 34 C45 44 69 66 103 86 C142 109 174 118 218 116 C258 114 290 126 332 130 C374 134 397 138 420 141 L420 150 Z" fill="url(#beforeRepostFill)" />
                  <circle cx="82" cy="74" r="6" fill="#fb7185" />
                  <circle cx="206" cy="116" r="5" fill="#f59e0b" />
                  <defs>
                    <linearGradient id="beforeRepostLine" x1="0" x2="420" y1="80" y2="80"><stop stopColor="#fb7185" /><stop offset="1" stopColor="#f59e0b" /></linearGradient>
                    <linearGradient id="beforeRepostFill" x1="210" x2="210" y1="34" y2="150"><stop stopColor="#fb7185" stopOpacity="0.28" /><stop offset="1" stopColor="#fb7185" stopOpacity="0" /></linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="mt-3 space-y-2.5">
                {beforeTimeline.map(([time, title, body, badge]) => (
                  <div key={time} className="grid grid-cols-[3.1rem_1fr] gap-2.5 rounded-2xl border border-white/[0.075] bg-black/20 p-2.5">
                    <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-center text-[10px] font-black text-rose-100">{time}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-black leading-5 text-white">{title}</p>
                        <span className="rounded-full bg-rose-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-rose-100/80">{badge}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-5 text-gray-400">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.article>

            <div className="flex items-center justify-center py-1 lg:px-1">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.055] shadow-[0_0_60px_-24px_rgba(34,211,238,0.95)] backdrop-blur sm:h-14 sm:w-14">
                <div className="absolute -inset-3 rounded-full bg-cyan-300/10 blur-xl" aria-hidden />
                <ArrowIcon className="relative h-5 w-5 text-cyan-100 lg:rotate-0" />
              </div>
            </div>

            <motion.article whileHover={cardHover} className="relative overflow-hidden rounded-[1.25rem] border border-cyan-300/24 bg-[linear-gradient(150deg,rgba(34,211,238,0.09),rgba(8,9,14,0.94))] p-3.5 shadow-[0_30px_120px_-82px_rgba(34,211,238,0.95)] sm:p-5">
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent" aria-hidden />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/75">AprÃ¨s correction Viralynz</p>
                  <h3 className="mt-1 text-xl font-black leading-tight text-white sm:text-2xl">La vidÃ©o ouvre sur la tension, puis prouve</h3>
                </div>
                <div className="rounded-2xl border border-cyan-300/24 bg-cyan-300/10 px-3 py-2 text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-100/65">Score</p>
                  <p className="text-3xl font-black leading-none text-cyan-100">78</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/[0.08] bg-black/24 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">Simulation rÃ©tention</span>
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-100">meilleure tenue</span>
                </div>
                <svg viewBox="0 0 420 150" className="h-32 w-full" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M0 42 C44 30 74 33 105 45 C142 59 170 52 206 64 C246 78 282 74 315 82 C354 92 384 86 420 96" stroke="url(#afterRepostLine)" strokeWidth="4" />
                  <path d="M0 150 L0 42 C44 30 74 33 105 45 C142 59 170 52 206 64 C246 78 282 74 315 82 C354 92 384 86 420 96 L420 150 Z" fill="url(#afterRepostFill)" />
                  <circle cx="58" cy="34" r="6" fill="#22d3ee" />
                  <circle cx="206" cy="64" r="5" fill="#a855f7" />
                  <circle cx="354" cy="92" r="5" fill="#34d399" />
                  <defs>
                    <linearGradient id="afterRepostLine" x1="0" x2="420" y1="70" y2="70"><stop stopColor="#22d3ee" /><stop offset="0.55" stopColor="#a855f7" /><stop offset="1" stopColor="#34d399" /></linearGradient>
                    <linearGradient id="afterRepostFill" x1="210" x2="210" y1="34" y2="150"><stop stopColor="#22d3ee" stopOpacity="0.28" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="mt-3 space-y-2.5">
                {afterTimeline.map(([time, title, body, badge]) => (
                  <div key={time} className="grid grid-cols-[3.1rem_1fr] gap-2.5 rounded-2xl border border-white/[0.075] bg-black/20 p-2.5">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-center text-[10px] font-black text-cyan-100">{time}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-black leading-5 text-white">{title}</p>
                        <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-emerald-100/80">{badge}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-5 text-gray-400">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.article>
          </div>

          <div className="mt-3 grid gap-2.5 sm:mt-4 sm:grid-cols-2 lg:grid-cols-4">
            {corrections.map(([label, body]) => (
              <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3 shadow-[0_20px_70px_-58px_rgba(168,85,247,0.8)]">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200/75">{label}</p>
                <p className="mt-1 text-sm font-bold leading-5 text-gray-200">{body}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-vn-fuchsia/20 bg-vn-fuchsia/[0.065] p-3 text-center sm:mt-4 sm:p-4">
            <p className="text-sm font-black leading-6 text-white">
              Viralynz ne promet pas un miracle. Il donne une hypothÃ¨se de repost claire : avancer le payoff, couper le contexte, relancer le rythme, resserrer le CTA.
            </p>
          </div>
        </div>
      </div>
    </MotionSection>
  );
}

function TitleAccent({ children }: { children: React.ReactNode }) {
  return <span className={titleGradient}>{children}</span>;
}

function SocialProofBand() {
  return (
    <MotionSection className={`${shell} relative py-5 sm:py-10`}>
      <div className="relative overflow-hidden rounded-[1.4rem] border border-white/[0.12] bg-[#07070d] p-3.5 shadow-[0_28px_120px_-82px_rgba(34,211,238,0.9)] sm:p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,49,95,0.18),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(34,211,238,0.12),transparent_30%)]" aria-hidden />
        <div className="relative grid gap-4 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/80">Social proof</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ['Audit', 'hook'],
                ['Plan', 'repost'],
                ['Test', 'gratuit'],
              ].map(([value, label]) => (
                <div key={value} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-2.5">
                  <p className="text-lg font-black leading-none text-white">{value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            <h2 className="mt-2 text-[1.35rem] font-black leading-tight text-white sm:text-3xl">Ils ont réparé leurs vidéos <TitleAccent>avec Viralynz</TitleAccent></h2>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {testimonials.map(([name, quote, result]) => (
              <article key={name} className="rounded-2xl border border-white/[0.08] bg-[#0b0b12] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-white">@{name.toLowerCase().replace(' ', '')}</p>
                  <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-100">{result}</span>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-gray-400">“{quote}”</p>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {proof.map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
              <p className="text-sm font-black text-white">{title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </MotionSection>
  );
}
