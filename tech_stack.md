# ⚙️ Stack technique détaillée

## Frontend
- **React + TypeScript + Vite**
- **Capacitor** pour le bridge natif Android
- **TailwindCSS** pour le style
- **Framer Motion** pour les animations tactiles

## Base de données
- SQLite stockée localement :
  - Fichier : `tablet-app.db`
  - Accès via : `@capacitor-community/sqlite`
  - Service principal : `databaseService.ts`

## Backend
- **Strapi v5**
- Contient les entités :
  - `categories`
  - `products`
  - `vehicles`
  - `compatibilities`
  - `specific-questions`
- Fournit une API `/api/sync/:tabletId` pour exporter un snapshot JSON

## Synchronisation
- Mode offline → online ponctuel
- Fonction `runSync()` déclenchée manuellement :
  - Récupère un JSON Strapi
  - Mets à jour SQLite en transaction (BEGIN / COMMIT)
- Versionnage via `db_version`

## Déploiement
- **Capacitor build** → Android Studio → APK signé
- Gestion tablette via **Scalefusion** :
  - Mode “Single App”
  - MAJ via nouvelle APK ou sync manuelle

