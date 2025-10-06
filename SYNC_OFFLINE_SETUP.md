# Configuration Offline - Backend Strapi

Ce document explique comment configurer le backend Strapi pour la synchronisation offline des tablettes.

## 🚀 Démarrage rapide

### 1. Installer les dépendances

```bash
npm install
```

### 2. Démarrer Strapi en mode développement

```bash
npm run dev
```

### 3. Générer le seed SQLite

```bash
# Pour l'environnement de développement
npm run generate-seed

# Pour l'environnement de production
npm run generate-seed:prod
```

## 📁 Structure des fichiers

```
src/api/sync/
├── controllers/
│   └── sync.ts          # Contrôleur pour l'endpoint /api/sync/:tabletId
├── services/
│   └── sync.ts          # Service de synchronisation et génération SQLite
└── routes/
    └── sync.ts          # Routes de l'API

scripts/
└── generate-sqlite-seed.js  # Script de génération du fichier .db

android/app/src/main/assets/databases/
└── tablet-app.db        # Base SQLite générée (à packager dans l'APK)
```

## 🔧 Configuration

### Variables d'environnement

Créez un fichier `.env` avec :

```env
STRAPI_URL=http://localhost:1338
STRAPI_API_TOKEN=your_api_token_here
NODE_ENV=development
```

### Endpoint de synchronisation

L'endpoint `/api/sync/:tabletId` est maintenant disponible et :

- ✅ **Sans authentification** (pour les tablettes)
- ✅ **Support du cache HTTP** (ETag, 304 Not Modified)
- ✅ **Récupération de toutes les données** nécessaires
- ✅ **Versioning des données** pour la synchronisation

## 📊 Données synchronisées

L'endpoint récupère et synchronise :

- **Categories** - Catégories de produits
- **Products** - Produits généraux
- **Vehicles** - Véhicules
- **Vehicle Types** - Types de véhicules
- **Brands** - Marques
- **Models** - Modèles
- **Battery Brands** - Marques de batteries
- **Battery Models** - Modèles de batteries
- **Battery Products** - Produits de batteries
- **Battery Data** - Données de compatibilité batteries
- **Lights Products** - Produits d'éclairage
- **Lights Positions** - Positions d'éclairage
- **Lights Position Data** - Données de position d'éclairage
- **Light Data** - Données d'éclairage
- **Compatibilities** - Compatibilités
- **Specific Questions** - Questions spécifiques
- **Motorisations** - Motorisations

## 🗄️ Base SQLite générée

Le script génère une base SQLite optimisée avec :

- ✅ **Tables relationnelles** avec clés étrangères
- ✅ **Indexes** pour les performances
- ✅ **Contraintes d'unicité** (slug, etc.)
- ✅ **Versioning** des données
- ✅ **Support des relations** Strapi

## 🔄 Processus de synchronisation

### 1. Génération du seed initial

```bash
# Démarrer Strapi
npm run dev

# Dans un autre terminal, générer le seed
npm run generate-seed
```

### 2. Utilisation de l'endpoint

```bash
# Récupérer les données pour une tablette
curl "http://localhost:1338/api/sync/tablet-001"

# Vérifier si les données sont à jour
curl -H "If-None-Match: 1234567890" "http://localhost:1338/api/sync/tablet-001"
```

### 3. Réponse de l'endpoint

```json
{
  "version": "1234567890",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "tabletId": "tablet-001",
  "data": {
    "categories": [...],
    "products": [...],
    "vehicles": [...],
    // ... toutes les autres tables
  }
}
```

## 🚀 Intégration avec le frontend

Le frontend doit :

1. **Lire uniquement depuis SQLite** (pas d'appels API directs)
2. **Utiliser l'endpoint de sync** pour les mises à jour
3. **Gérer le versioning** des données
4. **Implémenter la logique offline-first**

## 🔧 Maintenance

### Mise à jour des données

1. Modifier les données dans Strapi
2. Redémarrer Strapi si nécessaire
3. Régénérer le seed : `npm run generate-seed`
4. Redéployer l'APK avec la nouvelle base

### Debugging

- Vérifier les logs Strapi pour les erreurs de sync
- Utiliser un client SQLite pour inspecter la base générée
- Tester l'endpoint avec curl/Postman

## 📱 Déploiement

1. **Générer le seed** avec les données de production
2. **Copier** `tablet-app.db` dans `android/app/src/main/assets/databases/`
3. **Build** l'APK avec Capacitor
4. **Installer** sur les tablettes

## 🆘 Dépannage

### Erreur "Cannot find module 'sqlite3'"

```bash
npm install sqlite3
```

### Erreur de connexion à Strapi

Vérifiez que Strapi est démarré et accessible sur `http://localhost:1338`

### Base SQLite corrompue

Supprimez `tablet-app.db` et régénérez :

```bash
rm android/app/src/main/assets/databases/tablet-app.db
npm run generate-seed
```

## 📈 Performance

- **Taille de la base** : ~1-5 MB selon les données
- **Temps de génération** : ~10-30 secondes
- **Temps de sync** : ~1-5 secondes
- **Temps de démarrage** : Instantané (base locale)

## 🔒 Sécurité

- L'endpoint de sync est **sans authentification** (pour les tablettes)
- Utilisez un **token API** si nécessaire
- Limitez l'accès par **IP** si possible
- Chiffrez la base SQLite si sensible
