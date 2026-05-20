# Trend Intelligence

Radar tendances lit d'abord le cache Supabase, puis lance un scan manuel ou cron quand une source est configuree.

## Configuration

Variables serveur requises pour des donnees reelles :

- `APIFY_TOKEN`
- `APIFY_TIKTOK_TRENDS_ACTOR_ID`
- `APIFY_TIKTOK_SEARCH_ACTOR_ID`
- `APIFY_TIKTOK_HASHTAG_ACTOR_ID`
- `TREND_SCAN_COUNTRIES`
- `TREND_SCAN_LANGUAGE`
- `TREND_SCAN_DEFAULT_NICHES`
- `TREND_SCAN_MAX_ITEMS`
- `TREND_SCAN_CACHE_MINUTES`
- `CRON_SECRET`

`NEXT_PUBLIC_TRENDS_DEMO_MODE=true` est reserve au local. En production, garde `false` pour ne pas afficher de tendances inventees.

## Routes

- `GET /api/trends/overview` : cockpit compact, top decisions, preuves, plan 24h.
- `POST /api/trends/scan` : lance un scan Apify pour l'utilisateur connecte.
- `GET /api/trends/status` : dernier job.
- `GET /api/trends/clusters` : clusters filtres.
- `POST /api/trends/recommendations` : sauvegarde/retrouve une recommandation.
- `GET /api/trends/sources/status` : statut provider/cache.
- `GET|POST /api/cron/trends-scan` : scan cron securise par `CRON_SECRET`.

## Lancer un scan

```bash
curl -X POST http://localhost:3000/api/trends/scan \
  -H "content-type: application/json" \
  -d '{"niches":["business","creator_growth"],"countries":["FR"],"keywords":["hook viral","avant apres"],"force":true}'
```

La route exige une session Viralynz. Le cron utilise :

```bash
curl "https://www.viralynz.com/api/cron/trends-scan?secret=$CRON_SECRET"
```

## Pipeline

1. Apify collecte des videos TikTok publiques.
2. `normalize.ts` nettoie les captions, extrait hook/pattern, calcule les rates.
3. `cluster.ts` groupe les signaux par pattern, niche, pays et langue.
4. `scoring.ts` calcule velocity, acceleration, saturation, risque, confiance et score final.
5. `repository.ts` stocke raw items, clusters, preuves et recommandations dans Supabase.
6. Le cockpit affiche uniquement des clusters caches ou le mode demo explicite.
