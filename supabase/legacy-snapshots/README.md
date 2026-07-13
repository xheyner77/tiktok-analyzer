# Archives SQL historiques

Ce dossier conserve les anciens scripts SQL de Viralynz uniquement pour leur
provenance et leur consultation. Ils ne font pas partie de l'historique actif
des migrations Supabase et ne doivent jamais être appliqués en bloc.

L'historique actif se trouve dans `supabase/migrations`. Il contient uniquement
des fichiers horodatés dont les versions ont été réconciliées avec le registre
`supabase_migrations.schema_migrations` du projet distant le 13 juillet 2026.

Plusieurs fichiers archivés sont destructifs, obsolètes ou contradictoires avec
le schéma actuellement déployé. Ne les renommez pas pour les rendre applicables
et ne les poussez pas directement. Toute évolution de schéma doit être créée
comme une nouvelle migration forward-only, par exemple avec :

```powershell
npx.cmd supabase migration new nom_de_la_migration
```

Avant tout déploiement, validez la nouvelle migration sur une base locale ou
une branche Supabase, puis contrôlez l'historique et le dry-run distant.
