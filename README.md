# TikTok Analyzer

Analysez la viralité de n'importe quelle vidéo TikTok — Score, Hook, Montage, Rétention et Conseils personnalisés.

## Stack technique

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **API Route** avec analyse simulée par IA

## Prérequis

1. Installez **Node.js** (version 18 ou supérieure) : https://nodejs.org/
2. Vérifiez l'installation : `node --version` et `npm --version`

## Démarrage

```bash
# 1. Aller dans le dossier du projet
cd tiktok-analyzer

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement
npm run dev
```

Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre navigateur.

## Structure du projet

```
tiktok-analyzer/
├── app/
│   ├── api/analyze/route.ts   # API mock d'analyse
│   ├── globals.css            # Styles globaux
│   ├── layout.tsx             # Layout racine
│   └── page.tsx               # Page principale
├── components/
│   ├── Header.tsx             # En-tête avec logo
│   ├── UrlInput.tsx           # Champ + bouton d'analyse
│   ├── ScoreRing.tsx          # Cercle SVG animé du score
│   ├── AnalysisCard.tsx       # Carte d'analyse (Hook / Montage / Rétention)
│   ├── ImprovementTips.tsx    # Liste des conseils d'amélioration
│   ├── ResultsPanel.tsx       # Panneau de résultats complet
│   └── LoadingState.tsx       # Skeleton de chargement
├── lib/
│   ├── types.ts               # Interfaces TypeScript partagées
│   └── utils.ts               # Fonctions utilitaires (couleurs, classes)
├── tailwind.config.ts
├── next.config.mjs
└── package.json
```

## Fonctionnalités

- Champ d'input avec validation d'URL TikTok
- Bouton "Analyser" avec état de chargement
- **Score de viralité** — cercle SVG animé (0–100)
- **Analyse du Hook** — forces, faiblesses, score
- **Analyse du Montage** — rythme, coupes, dynamisme
- **Analyse de la Rétention** — micro-hooks, structure narrative
- **5 conseils d'amélioration** priorisés (haute / moyenne / basse)
- Skeleton loading animé pendant l'analyse
- Design dark mode avec accents gradient TikTok

## Build de production

```bash
npm run build
npm start
```
