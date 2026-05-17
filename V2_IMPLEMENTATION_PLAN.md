# Viralynz V2 - Plan d'Implementation Technique

Ce plan transforme `V2_PRODUCT_SPEC.md` en feuille de route technique prudente. Objectif : repositionner Viralynz autour du diagnostic TikTok + version a reposter, sans casser les fondations existantes : auth, Supabase, Stripe, OpenAI, quotas, upload, TikTok OAuth.

## 1. Etat Actuel des Pages Principales

### `app/page.tsx`

Etat actuel :

- Page tres fine.
- Importe uniquement `HomeLanding` depuis `components/landing/HomeLanding.tsx`.
- Ne contient aucune logique produit, auth, paiement ou data.

Implication V2 :

- Fichier a faible risque.
- Peut rester identique si `HomeLanding` est refondu.
- A modifier seulement si on decide de brancher un nouveau composant racine, par exemple `HomeLandingV2`.

### `components/landing/HomeLanding.tsx`

Etat actuel :

- Tres gros composant client.
- Contient la majorite de la landing actuelle : hero, sections, testimonials, pricing, roadmap, CTA final.
- Utilise `framer-motion`, `CheckoutButton`, `FloatingParticles`, `HeroMockupPremium`, `faqItems`, constantes de quotas et prix.
- Beaucoup de micro-composants locaux : `Arrow`, `Check`, `FaqChevron`, `FadeUp`, `TestiCard`.
- Positionnement actuel encore axe "dominer TikTok", "arreter de poster au hasard", analyse IA, hooks et performance.
- Le fichier melange copywriting, data marketing, UI, pricing marketing et animations.

Implication V2 :

- C'est la premiere zone a refondre.
- Risque fonctionnel faible si on evite de toucher a `CheckoutButton` et aux constantes Stripe.
- Risque de regression visuelle eleve car le fichier est long et tres stylise.
- Recommandation : extraire la landing V2 en sous-composants plutot que continuer a grossir ce fichier.

### `app/analyzer/page.tsx`

Etat actuel :

- Composant client central du produit.
- Gere l'auth utilisateur via `/api/auth/me`.
- Gere le compteur invite via `localStorage`.
- Gere l'upload video (`videoFile`) et le lien TikTok optionnel (`uploadTiktokUrl`).
- Verifie la validite du lien TikTok via `normalizeTikTokUrl` et `isTikTokVideoUrl`.
- Extrait frames + audio avec `extractVideoFramesFromFile` et `extractAudioFromVideo`.
- Appelle `/api/transcribe` pour Whisper si l'utilisateur est authentifie.
- Appelle `/api/analyze` avec `frames`, `durationSec`, `fileName`, `tiktokUrl`, `transcript`.
- Gere les erreurs serveur 400, 401, 403, 429.
- Gere les quotas via `PLAN_LIMITS`, `AnalysisCounter`, `PremiumGate`, `GuestGate`.
- Affiche `ResultsPanel`.
- Affiche aussi un historique rapide, de la comparaison avant/apres, du pin et de la comparaison multi-versions.

Implication V2 :

- C'est une zone sensible.
- La refonte visuelle doit d'abord encapsuler le flux existant sans modifier les payloads envoyes a `/api/analyze`.
- Les choix V2 "objectif" et "niche" peuvent etre ajoutes en etat local dans une premiere passe, mais ne doivent pas etre envoyes au backend tant que l'API n'est pas preparee.
- Ne pas modifier `analyzeFromUpload`, `processAnalyzeResponse`, l'extraction video/audio ou la logique quota dans la premiere phase.

### `components/ResultsPanel.tsx`

Etat actuel :

- Composant client.
- Prend `data: AnalysisResult`, `plan`, `onReset`.
- Utilise la structure actuelle de `lib/types.ts` :
  - `viralityScore`
  - `structureScore`
  - `hook`
  - `editing`
  - `retention`
  - `improvements`
  - `strategy`
  - `viralTips`
  - stats publiques et champs comparatifs.
- Derive beaucoup de textes cote front :
  - `buildSummary`
  - `deriveMainProblem`
  - `deriveProjection`
  - `findReco`
- Gere les gates Creator / Pro / Scale visuellement.
- Affiche score, probleme principal, plan d'action, piliers Hook/Montage/Retention, stats publiques, strategie, insights Scale et CTA.

Implication V2 :

- Le rendu peut evoluer vers "verdict + points a garder/changer + version a reposter".
- Les donnees backend ne contiennent pas encore explicitement `clarity`, `cta`, `repostVersion`, `alternativeScript`, `editingPlan`.
- Il faut garder une couche d'adaptation front qui derive des blocs V2 a partir des champs existants.
- Ne pas changer `AnalysisResult` dans la premiere phase de design.

### `app/dashboard/page.tsx`

Etat actuel :

- Server Component.
- Force le rendu dynamique avec `dynamic = 'force-dynamic'`.
- Lit la session via `getSession`.
- Redirige vers `/login?redirect=/dashboard` si non connecte.
- Lit le profil via `getUserById`.
- Calcule plan effectif, limites d'analyses, limites de hooks, usage, et etat Stripe.
- Charge l'historique via `getAnalyses`.
- Transmet TikTok OAuth state a `DashboardClient`.

Implication V2 :

- A ne presque pas toucher dans un premier temps.
- La data actuelle suffit pour un dashboard V2 de progression.
- Toute refonte dashboard doit d'abord rester dans `DashboardClient`.

### `app/dashboard/DashboardClient.tsx`

Etat actuel :

- Tres gros composant client.
- Gere :
  - flash OAuth TikTok ;
  - sync post-checkout via `/api/upgrade-plan` ;
  - upgrade Scale via `/api/upgrade-subscription` ;
  - annulation via `/api/cancel-plan` ;
  - logout apres annulation legacy ;
  - modal d'annulation via `createPortal` ;
  - tri historique recent/meilleur ;
  - calculs de scores moyens, meilleurs scores, tendance, points faibles ;
  - daily tips ;
  - locked sections Pro/Scale ;
  - `TikTokConnectCard`.
- Contient beaucoup de helpers locaux : `AnalysisHistoryItem`, `AnalysisHistoryPaginated`, `LockedSection`, `RingProgress`, `ScorePill`, etc.

Implication V2 :

- Zone sensible car elle touche indirectement Stripe, plan, TikTok OAuth et auth logout.
- Refonte V2 a faire apres landing/analyzer/results.
- Ne pas toucher aux handlers `handleScaleUpgrade`, `handleCancelPlan`, ni au flow `stripeSessionId` dans la premiere passe.
- Idealement extraire des composants d'affichage purs autour des donnees existantes.

### `app/pricing/page.tsx`

Etat actuel :

- Page serveur sans etat client direct.
- Utilise `CheckoutButton`, `PricingFAQ`, `FloatingParticles`, constantes de plan et prix.
- Contient les cartes Creator/Pro/Scale, tableau de comparaison, section "pour qui", FAQ et CTA final.
- Logique de paiement encapsulee dans `CheckoutButton`.

Implication V2 :

- Refonte marketing possible sans changer la logique Stripe.
- Conserver `CheckoutButton plan="pro"` et `CheckoutButton plan="scale"`.
- Ne pas modifier les constantes de pricing ou les routes checkout.

### `components/Navbar.tsx`

Etat actuel :

- Server Component.
- Lit `getSession`, `getUserById`, `getEffectivePlan`.
- Affiche liens : Fonctionnalites, Tarifs, Nouveautes, Dashboard si connecte, Analyser, Hooks, Feedback, user menu ou login/CTA.
- Utilise `BrandLogo`, `NavbarUserMenu`, `NavbarMobileMenu`, `FeedbackButton`.

Implication V2 :

- Ne pas refondre en premier.
- Ajuster plus tard le wording et la priorite des liens : CTA principal vers `/analyzer`, "Voir un exemple" eventuellement sur landing.
- Garder le fetch serveur tel quel.

### `tailwind.config.ts`

Etat actuel :

- Theme dark Viralynz deja en place.
- Couleurs `vn`: `bg`, `void`, `surface`, `elevated`, `line`, `fuchsia`, `violet`, `indigo`, `glow`.
- Fonts : `sans`, `display`, `hero-inter`.
- Animations : `fade-up`, `fade-in`, `spin-slow`, `vn-float`, `vn-pulse-soft`.

Implication V2 :

- Suffisant pour une V2 dark SaaS premium.
- Ne pas modifier au debut.
- Ajouter des tokens uniquement si une vraie repetition apparait apres extraction des composants.

### `app/globals.css`

Etat actuel :

- Contient les styles globaux, utilitaires custom et nombreux effets landing :
  - `gradient-text`
  - `card-glow`
  - `vn-glass`
  - `landing-mesh`
  - `landing-hero-aurora`
  - `landing-grid-fine`
  - `landing-noise`
  - `stars-backdrop`
  - animations hero/mockup/stars.
- Beaucoup de styles sont specifiques a la landing actuelle.

Implication V2 :

- Ne pas supprimer en premiere passe.
- Reutiliser avec moderation.
- Ajouter peu de classes globales nouvelles ; preferer Tailwind local dans les composants V2.

## 2. Fichiers Exacts a Modifier pour la V2

### Phase landing

- `components/landing/HomeLanding.tsx`
- Eventuellement `app/page.tsx` si un nouveau composant `HomeLandingV2` est cree.
- Nouveaux composants sous `components/landing/v2/`.

### Phase analyzer

- `app/analyzer/page.tsx`
- Nouveaux composants sous `components/analyzer/v2/`.
- `components/LoadingState.tsx` seulement si on veut un loader V2 reutilisable.
- `components/GuestGate.tsx`, `components/PremiumGate.tsx`, `components/AnalysisCounter.tsx` uniquement pour microcopy/style plus tard.

### Phase results

- `components/ResultsPanel.tsx`
- Nouveaux composants sous `components/results/v2/`.
- Eventuellement un helper pur `lib/analysis-result-v2.ts` pour mapper `AnalysisResult` vers un modele d'affichage V2.
- `lib/types.ts` seulement dans une phase API plus tard, pas dans la premiere refonte UI.

### Phase dashboard

- `app/dashboard/DashboardClient.tsx`
- Nouveaux composants sous `components/dashboard/v2/`.
- `app/dashboard/page.tsx` seulement si les props necessaires changent, ce qui est a eviter au debut.
- `components/TikTokConnectCard.tsx` seulement pour style/microcopy.

### Phase pricing

- `app/pricing/page.tsx`
- Eventuellement `components/PricingFAQ.tsx` pour alignement copy.
- `components/CheckoutButton.tsx` ne doit pas etre modifie pour une refonte marketing.

### Phase navigation/design system

- `components/Navbar.tsx`
- `components/NavbarMobileMenu.tsx`
- `components/NavbarUserMenu.tsx`
- `app/globals.css` pour styles transverses seulement.
- `tailwind.config.ts` seulement si nouveaux tokens indispensables.

## 3. Fichiers a Ne Pas Toucher dans un Premier Temps

Fichiers serveur et integrations a garder intacts pendant la refonte UI :

- `app/api/analyze/route.ts`
- `app/api/transcribe/route.ts`
- `app/api/analyze/history/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/checkout/route.ts`
- `app/api/webhook/route.ts`
- `app/api/cancel-plan/route.ts`
- `app/api/upgrade-plan/route.ts`
- `app/api/upgrade-subscription/route.ts`
- `app/api/tiktok/connect/route.ts`
- `app/api/tiktok/callback/route.ts`
- `app/api/tiktok/disconnect/route.ts`
- `lib/auth.ts`
- `lib/session.ts`
- `lib/supabase.ts`
- `lib/stripe-subscription-sync.ts`
- `lib/stripe-billing.ts`
- `lib/openai.ts`
- `lib/openai-models.ts`
- `lib/extract-video-frames.ts`
- `lib/tiktok-oauth.ts`
- `lib/plan-limits.ts`
- `supabase/schema.sql`
- `supabase/migrations/*`

Raison :

Ces fichiers portent les flux critiques : auth, quota, paiement, analyse IA, transcription, TikTok OAuth et schema DB. La V2 doit d'abord changer la desirabilite et la clarte, pas les contrats serveur.

## 4. Nouveaux Composants a Creer

### Landing

- `components/landing/v2/V2Hero.tsx`
- `components/landing/v2/LandingProblemSection.tsx`
- `components/landing/v2/LandingAnalysisPreview.tsx`
- `components/landing/v2/BeforeAfterHookExample.tsx`
- `components/landing/v2/LandingForWhoSection.tsx`
- `components/landing/v2/LandingPricingTeaser.tsx`
- `components/landing/v2/ConversionCTASection.tsx`

### Analyzer

- `components/analyzer/v2/AnalyzerUploadStep.tsx`
- `components/analyzer/v2/AnalyzerGoalStep.tsx`
- `components/analyzer/v2/AnalyzerNicheStep.tsx`
- `components/analyzer/v2/AnalyzerProgress.tsx`
- `components/analyzer/v2/AnalyzerShell.tsx`
- `components/analyzer/v2/AnalyzerHistoryQuickList.tsx`

### Results

- `components/results/v2/ViralScoreBadge.tsx`
- `components/results/v2/AnalysisVerdictCard.tsx`
- `components/results/v2/AnalysisCategoryCard.tsx`
- `components/results/v2/KeepChangeList.tsx`
- `components/results/v2/RepostVersionPanel.tsx`
- `components/results/v2/AlternativeScriptCard.tsx`
- `components/results/v2/EditingPlanChecklist.tsx`
- `components/results/v2/RecommendedCTACard.tsx`
- `components/results/v2/PlanGateOverlay.tsx`

### Dashboard

- `components/dashboard/v2/DashboardProgressSummary.tsx`
- `components/dashboard/v2/DashboardAnalysisHistory.tsx`
- `components/dashboard/v2/DashboardVideosToRework.tsx`
- `components/dashboard/v2/DashboardBestScores.tsx`
- `components/dashboard/v2/PlanUsageCard.tsx`
- `components/dashboard/v2/TikTokConnectionStatusCard.tsx`
- `components/dashboard/v2/DashboardQuickActions.tsx`

### Pricing

- `components/pricing/v2/PricingPlanCardV2.tsx`
- `components/pricing/v2/PricingValueSection.tsx`
- `components/pricing/v2/PricingComparisonV2.tsx`

## 5. Ordre Recommande des Changements

1. Landing V2 pure UI.
2. Analyzer layout V2 sans changement API.
3. ResultsPanel V2 avec mapping compatible `AnalysisResult`.
4. Dashboard V2 par extraction de composants purs.
5. Pricing V2 copy/layout en gardant `CheckoutButton`.
6. Navbar et pages auth en harmonisation finale.
7. Plus tard seulement : enrichissement backend pour champs V2 natifs.

## 6. Strategie pour Refaire la Landing sans Casser le Reste

Approche recommandee :

1. Creer des composants V2 sous `components/landing/v2/`.
2. Garder `app/page.tsx` stable au debut.
3. Remplacer progressivement le contenu interne de `HomeLanding.tsx` par une composition V2.
4. Garder les liens critiques :
   - CTA principal vers `/analyzer`.
   - Pricing vers `/pricing`.
   - Checkout uniquement via `CheckoutButton`.
5. Eviter les dependencies inutiles.
6. Ne pas supprimer tout de suite les classes globales `landing-*`.

Ce qu'il faut changer :

- Headline : passer de "Domine TikTok" a "Comprends pourquoi ta video TikTok floppe".
- Hero : montrer une preview de resultat V2 plutot qu'un mockup trop abstrait.
- Sections : probleme, analyse, resultat concret, avant/apres, pour qui, pricing teaser.
- CTA : "Analyser ma video" partout ou l'intention est haute.

Ce qu'il faut eviter :

- Rebrancher Stripe autrement.
- Ajouter un faux formulaire dans la landing.
- Faire dependre la landing de donnees auth.
- Modifier `CheckoutButton`.

Validation landing :

- `/` charge sans erreur.
- CTA `/analyzer` fonctionne.
- CTA pricing fonctionne.
- Aucun scroll horizontal mobile.
- Le premier viewport explique clairement "flop -> diagnostic -> version a reposter".

## 7. Strategie pour Refaire l'Analyzer sans Casser OpenAI, Quota, Upload

Principe :

Changer l'interface autour du flux existant, pas le flux lui-meme.

Zones a ne pas toucher dans la premiere passe :

- `processAnalyzeResponse`
- `analyzeFromUpload`
- `extractVideoFramesFromFile`
- `extractAudioFromVideo`
- appel `/api/transcribe`
- appel `/api/analyze`
- gestion 429 quota
- `GuestGate`
- `PremiumGate`
- incrementation optimistic et refresh `/api/auth/me`

Plan technique :

1. Ajouter des etats UI locaux :
   - `selectedGoal`
   - `selectedNiche`
   - `currentStep`
2. Ne pas inclure `selectedGoal` et `selectedNiche` dans le body `/api/analyze` au debut.
3. Extraire le formulaire upload actuel dans `AnalyzerUploadStep`.
4. Ajouter `AnalyzerGoalStep` et `AnalyzerNicheStep` comme couches de qualification front.
5. Garder le bouton final qui appelle toujours `analyzeFromUpload`.
6. Remplacer le loader par `AnalyzerProgress`, alimente par `extractStatus` existant.
7. Garder l'historique rapide dans un composant separe.

Evolution future :

- Une fois l'UI stabilisee, enrichir `/api/analyze` avec `goal` et `niche`.
- Puis adapter le prompt OpenAI.
- Puis etendre `AnalysisResult`.

Validation analyzer :

- Upload MP4 fonctionne.
- Lien TikTok optionnel conserve le meme comportement.
- Erreur lien invalide toujours affichee.
- Invite non connecte voit toujours `GuestGate`.
- Quota atteint affiche toujours `PremiumGate`.
- `/api/transcribe` est appele seulement dans les memes conditions.
- `/api/analyze` recoit le meme payload qu'avant en phase 1.
- Resultats s'affichent toujours dans `ResultsPanel`.

## 8. Strategie pour Refaire `ResultsPanel` en Gardant Compatibilite

Probleme :

La spec V2 demande des champs qui n'existent pas encore nativement dans `AnalysisResult` :

- clarte ;
- CTA ;
- points a garder ;
- points a changer ;
- version amelioree a reposter ;
- script alternatif ;
- plan de montage ;
- CTA recommande.

Strategie compatible :

1. Ne pas changer `lib/types.ts` en phase 1.
2. Creer un mapper pur, par exemple `lib/analysis-result-v2.ts`, plus tard si necessaire.
3. Dans une premiere passe, `ResultsPanel` peut deriver un modele V2 depuis les champs existants :
   - `score viral` depuis `viralityScore`.
   - `verdict` depuis `finalVerdict` ou `buildSummary`.
   - `hook` depuis `data.hook`.
   - `rythme` depuis `data.editing`.
   - `retention` depuis `data.retention`.
   - `clarte` derivee de `hook.analysis`, `comparativeInsight` ou fallback front.
   - `CTA` derive des `improvements` contenant `cta`, `comment`, `follow`, `fin`.
   - `points a garder` depuis `strengths`.
   - `points a changer` depuis `weaknesses` et `improvements`.
   - `version a reposter` comme bloc compose a partir du meilleur hook/reco + top improvements.
   - `script alternatif` en template front tant que le backend ne le genere pas.
   - `plan de montage` depuis recommendations montage/retention.
4. Conserver les gates plan actuels :
   - Free : preview limitee.
   - Pro : version a reposter plus complete.
   - Scale : insights viraux et strategie.

Structure V2 cible du composant :

- Top : score + verdict + statut.
- Bloc "A corriger en premier".
- Bloc "Garde / Change".
- Categories : Hook, Rythme, Retention, Clarte, CTA.
- Bloc central : "Version a reposter".
- Script alternatif.
- Plan de montage.
- CTA recommande.
- Stats publiques si disponibles.
- Gates Pro/Scale.

Validation results :

- Anciennes analyses de l'historique s'affichent encore.
- Les champs optionnels absents ne cassent pas le rendu.
- Free garde les limites visibles.
- Pro/Scale gardent les contenus debloques.
- Les stats publiques restent lisibles quand `observedMetrics` existe.

## 9. Risques Techniques

### Risque 1 - Casser les payloads `/api/analyze`

Cause :

Refonte analyzer trop proche de `analyzeFromUpload`.

Mitigation :

Ne pas modifier le body envoye en phase 1. Ajouter objectif/niche uniquement en UI locale.

### Risque 2 - Casser les quotas

Cause :

Modification de `authUser`, `guestCount`, `effectiveCount`, `isLimitReached`, ou gestion 429.

Mitigation :

Ne pas toucher a la logique quota. Tester Free, invite, limite atteinte.

### Risque 3 - Casser l'upload ou la transcription

Cause :

Refactor mal controle de `videoFile`, extraction frames/audio ou appels async.

Mitigation :

Extraire seulement le rendu du formulaire, garder le handler parent.

### Risque 4 - Casser les anciennes analyses

Cause :

`ResultsPanel` suppose des nouveaux champs non presents dans l'historique.

Mitigation :

Tous les nouveaux blocs doivent avoir des fallbacks depuis `AnalysisResult` actuel.

### Risque 5 - Casser Stripe depuis la pricing ou dashboard

Cause :

Modification de `CheckoutButton`, `handleScaleUpgrade`, `handleCancelPlan`, `stripeSessionId`.

Mitigation :

Ne pas modifier ces handlers pendant la refonte UI.

### Risque 6 - Casser TikTok OAuth visuellement

Cause :

Suppression ou mauvais placement de `TikTokConnectCard` et du flash `tiktokFlash`.

Mitigation :

Dashboard V2 doit garder les props TikTok et l'etat flash.

### Risque 7 - Regressions responsive

Cause :

Landing et ResultsPanel tres riches, cards nombreuses, textes longs.

Mitigation :

Verifier mobile en priorite : 360px, 390px, 430px, puis desktop.

### Risque 8 - CSS global trop lourd

Cause :

Ajouter encore des classes globales a `app/globals.css`.

Mitigation :

Preferer Tailwind local et composants. Ne globaliser qu'un motif vraiment reutilise.

## 10. Checklist de Validation Apres Chaque Phase

### Apres Phase 1 - Landing

- `npm.cmd run build`
- `/` charge correctement.
- Pas d'erreur console sur la landing.
- CTA "Analyser ma video" va vers `/analyzer`.
- CTA pricing va vers `/pricing`.
- Mobile 360px sans overflow horizontal.
- Hero explique clairement la promesse V2.
- Aucun changement Git hors fichiers landing prevus.

### Apres Phase 2 - Analyzer

- `npm.cmd run build`
- Upload video toujours possible.
- Lien TikTok invalide affiche une erreur.
- Analyse connectee appelle toujours `/api/transcribe` puis `/api/analyze`.
- Invite non connecte voit toujours `GuestGate`.
- Limite atteinte affiche toujours `PremiumGate`.
- `AnalysisCounter` affiche encore les quotas.
- Les choix objectif/niche ne cassent pas l'analyse meme s'ils restent front-only.
- Aucun changement dans `app/api/*`.

### Apres Phase 3 - ResultsPanel

- `npm.cmd run build`
- Nouvelle analyse affiche le resultat V2.
- Ancienne analyse depuis historique s'affiche sans crash.
- Free voit les gates.
- Pro/Scale voient les blocs avances.
- Stats publiques s'affichent si disponibles.
- Bouton "Analyser une autre video" fonctionne.

### Apres Phase 4 - Dashboard

- `npm.cmd run build`
- Redirection non connecte vers login fonctionne.
- Dashboard connecte charge.
- Historique visible selon plan.
- Quotas analyses/hooks corrects.
- TikTokConnectCard visible avec bon etat.
- Flash `?tiktok=connected`, `?tiktok=db`, etc. toujours affiche.
- Upgrade Scale Pro -> Scale toujours declenche le meme endpoint.
- Annulation plan ouvre toujours la modal.

### Apres Phase 5 - Pricing

- `npm.cmd run build`
- Boutons Pro/Scale appellent toujours `CheckoutButton`.
- CTA Free va vers `/analyzer`.
- Prix affiches depuis `DISPLAY_CATALOG_PRO_EUR` et `DISPLAY_CATALOG_SCALE_EUR`.
- Les limites viennent toujours de `plan-limits`.
- Aucun changement dans routes Stripe.

### Apres Phase 6 - Navbar/Auth Polish

- `npm.cmd run build`
- Navbar desktop et mobile fonctionnent.
- Login/signup/reset restent accessibles.
- Utilisateur connecte voit toujours menu user.
- Utilisateur non connecte voit login + CTA.
- FeedbackButton reste accessible.

## Conclusion Technique

La V2 doit etre implementee comme une refonte progressive de presentation et de parcours, pas comme une reecriture produit complete.

La sequence la plus prudente :

1. Repositionner la landing.
2. Encadrer l'analyzer avec des etapes V2 sans changer les appels API.
3. Rendre `ResultsPanel` plus actionnable avec des fallbacks.
4. Transformer le dashboard en espace de progression.
5. Repackager le pricing.
6. Harmoniser navigation et auth.

Principe directeur :

> Tant que l'interface V2 n'est pas stable, les contrats serveur restent intacts.
