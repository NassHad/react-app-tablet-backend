# 📋 Résumé de la catégorie Filters

## 🎯 Vue d'ensemble

La catégorie **Filters** gère les filtres automobiles (huile, air, diesel, habitacle) de la marque **PURFLUX**. Le système est composé de deux entités principales :
- **FilterProduct** : Catalogue des produits filtres disponibles
- **FilterCompatibility** : Compatibilité véhicule ↔ filtres

---

## 📊 Structure des données

### 1. FilterProduct (Catalogue des produits)

**Schéma Strapi** : `api::filter-product.filter-product`

**Champs principaux** :
- `brand` : String (défaut: "PURFLUX")
- `filterType` : Enumération (`oil`, `air`, `diesel`, `cabin`)
- `reference` : String (ex: "L330", "CS701")
- `fullReference` : String (optionnel)
- `fullName` : String (nom complet du produit)
- `ean` : String (unique, code EAN)
- `internalSKU` : String (unique, référence interne)
- `category` : String
- `isActive` : Boolean (défaut: true)
- `slug` : UID (basé sur `reference`)
- `img` : Media (image du produit)
- `brandImg` : Media (logo de la marque)

**Table SQLite** : `filter_products` (⚠️ **NON IMPLÉMENTÉE dans le sync actuel**)

### 2. FilterCompatibility (Compatibilité véhicule)

**Schéma Strapi** : `api::filter-compatibility.filter-compatibility`

**Champs principaux** :
- `brand` : Relation (manyToOne → `api::brand.brand`)
- `model` : Relation (manyToOne → `api::model.model`)
- `vehicleModel` : String (ex: "CITROEN C4 II")
- `vehicleVariant` : String (ex: "1.6 HDi 110")
- `engineCode` : String (ex: "312A1000")
- `power` : String (puissance)
- `productionStart` : String (date de début de production)
- `productionEnd` : String (date de fin de production)
- `filters` : JSON (structure complexe avec arrays pour chaque type)
- `metadata` : JSON (notes, commentaires)

**Structure du champ `filters` (JSON)** :
```json
{
  "oil": [
    { "ref": "56-CS701", "notes": ["Note 1", "Note 2"] },
    { "ref": "37-L330", "notes": [] }
  ],
  "air": [
    { "ref": "A123", "notes": [] }
  ],
  "diesel": [
    { "ref": "D456", "notes": [] }
  ],
  "cabin": [
    { "ref": "C789", "notes": [] }
  ]
}
```

**Table SQLite** : `filter_compatibilities` (⚠️ **NON IMPLÉMENTÉE dans le sync actuel**)

---

## 🔌 Endpoints API disponibles

### Endpoints de base (CRUD Strapi)
- `GET /api/filter-products` : Liste tous les produits filtres
- `GET /api/filter-products/:id` : Détails d'un produit
- `GET /api/filter-compatibilities` : Liste toutes les compatibilités
- `GET /api/filter-compatibilities/:id` : Détails d'une compatibilité

### Endpoints personnalisés

#### 1. Recherche de compatibilité
```
GET /api/filter-compatibility/search?brand=ABARTH&model=500 II&engine=312A1000&filterType=oil
```
**Paramètres** :
- `brand` : Nom de la marque (requis)
- `model` : Nom du modèle (requis)
- `engine` : Code moteur (requis)
- `filterType` : Type de filtre (`oil`, `air`, `diesel`, `cabin`) - optionnel

**Réponse** :
```json
{
  "data": [
    {
      "id": 1,
      "vehicleModel": "ABARTH 500 II",
      "engineCode": "312A1000",
      "filters": { ... }
    }
  ],
  "meta": {
    "total": 1,
    "filters": { "brand": "ABARTH", "model": "500 II", ... }
  }
}
```

#### 2. Obtenir les variantes d'un véhicule
```
GET /api/filter-compatibility/variants?brand=ABARTH&model=500 II
```
**Réponse** :
```json
{
  "data": [
    {
      "variant": "1.4 Turbo 135",
      "fullName": "ABARTH 500 II 1.4 Turbo 135",
      "engineCode": "312A1000",
      "power": "135",
      "id": 123
    }
  ],
  "meta": { "total": 5, "brand": "ABARTH", "model": "500 II" }
}
```

#### 3. Trouver les produits disponibles
```
GET /api/filter-compatibility/find-products?brand=CITROEN&model=C4 II&variant=1.6 HDi 110&filterType=oil
```
**Paramètres** :
- `brand` : Nom de la marque (requis)
- `model` : Nom du modèle (requis)
- `variant` : Variante du véhicule (optionnel)
- `filterType` : Type de filtre (requis)

**Réponse** :
```json
{
  "data": [
    {
      "id": 456,
      "reference": "CS701",
      "fullName": "Filtre à huile CS701",
      "filterType": "oil",
      "img": { "url": "..." },
      "brandImg": { "url": "..." },
      "compatibilityMetadata": {
        "vehicleVariant": "1.6 HDi 110",
        "engineCode": "312A1000",
        "notes": ["Note importante"]
      }
    }
  ],
  "meta": {
    "total": 2,
    "found": true,
    "filters": { ... },
    "availability": {
      "availableReferences": ["CS701", "L330"],
      "unavailableReferences": ["X999"]
    }
  }
}
```

#### 4. Obtenir les produits disponibles pour une compatibilité
```
GET /api/filter-compatibility/:id/available-products?filterType=oil
```

#### 5. Matcher un produit par référence
```
POST /api/filter-compatibility/match-product
Body: { "compatibilityRef": "37-L330", "filterType": "oil" }
```

---

## 🔍 Récupération des données

### Par marque uniquement

**Via l'endpoint de compatibilité** :
```typescript
// Récupérer toutes les compatibilités d'une marque
const compatibilities = await strapi.entityService.findMany(
  'api::filter-compatibility.filter-compatibility',
  {
    filters: {
      brand: { name: { $eq: 'CITROEN' } }
    },
    populate: ['brand', 'model']
  }
);
```

**Via l'endpoint vehicle-products** :
```typescript
// Récupérer tous les produits (incluant filters) pour une marque/modèle
GET /api/vehicle-products/:brandSlug/:modelSlug
// Retourne: { Batteries: [], Lights: [], Wipers: [], Filters: [], Oil: [] }
```

### Par marque ET modèle

**Méthode recommandée** : Utiliser `vehicle-products` service
```typescript
// Dans vehicle-products/services/vehicle-products.ts
async getFilterProducts(brandName: string, modelName: string, motorisation?: string, vehicleModel?: string)
```

**Exemple d'utilisation** :
```typescript
const service = strapi.service('api::vehicle-products.vehicle-products');
const filters = await service.getFilterProducts('CITROEN', 'C4 II', '1.6 HDi', 'CITROEN C4 II');
```

**Filtres appliqués** :
- Recherche par `brand.name` et `model.name`
- Filtrage optionnel par `engineCode` (si motorisation fournie)
- Filtrage optionnel par `vehicleModel` (si vehicleModel fourni)

**Processus de matching** :
1. Récupération des `FilterCompatibility` correspondantes
2. Extraction des références de filtres (excluant `oil` pour `getFilterProducts`)
3. Pour chaque référence, matching intelligent avec `FilterProduct` :
   - Nettoyage de la référence (ex: "56-CS701" → "CS701")
   - Recherche exacte d'abord
   - Si aucun résultat, recherche "starts with" (ex: "CS701" match "CS701A", "CS701AY")
4. Retour des produits actifs uniquement

### Par type de filtre

**Via filter-compatibility service** :
```typescript
const service = strapi.service('api::filter-compatibility.filter-compatibility');
const products = await service.findProductByReference('CS701', 'oil');
```

**Types de filtres disponibles** :
- `oil` : Filtre à huile
- `air` : Filtre à air
- `diesel` : Filtre à gasoil
- `cabin` : Filtre d'habitacle

---

## 🖼️ Gestion des images

### Structure des images

**Dans FilterProduct** :
- `img` : Image du produit (Media Strapi)
- `brandImg` : Logo de la marque (Media Strapi)

### Récupération des images

**Dans les requêtes** :
```typescript
const products = await strapi.entityService.findMany('api::filter-product.filter-product', {
  populate: {
    img: true,        // Popule l'image du produit
    brandImg: true    // Popule le logo de la marque
  }
});
```

**Format de réponse** :
```json
{
  "img": {
    "id": 123,
    "url": "/uploads/filter_product_img_abc123.jpg",
    "formats": {
      "small": { "url": "/uploads/small_filter_product_img_abc123.jpg" },
      "thumbnail": { "url": "/uploads/thumbnail_filter_product_img_abc123.jpg" }
    }
  },
  "brandImg": {
    "id": 456,
    "url": "/uploads/purflux_logo.jpg"
  }
}
```

### ⚠️ Images dans SQLite

**État actuel** : Les images des filters **ne sont PAS synchronisées** dans SQLite car :
- Les tables `filter_products` et `filter_compatibilities` ne sont **pas créées** dans le sync
- Aucune logique d'insertion n'existe dans `sync/services/sync.ts`

**Pour implémenter** :
1. Ajouter les tables dans `generateSqliteSeed()` :
   ```sql
   CREATE TABLE IF NOT EXISTS filter_products (
     id INTEGER PRIMARY KEY,
     brand TEXT NOT NULL DEFAULT 'PURFLUX',
     filter_type TEXT NOT NULL CHECK (filter_type IN ('oil', 'air', 'diesel', 'cabin')),
     reference TEXT NOT NULL,
     full_reference TEXT,
     full_name TEXT NOT NULL,
     ean TEXT UNIQUE NOT NULL,
     internal_sku TEXT UNIQUE NOT NULL,
     category TEXT NOT NULL,
     is_active BOOLEAN DEFAULT true,
     slug TEXT UNIQUE NOT NULL,
     img_url TEXT,
     brandImg_url TEXT,
     created_at TEXT,
     updated_at TEXT
   );
   ```

2. Ajouter la récupération dans `getSyncData()` :
   ```typescript
   filterProducts: await strapi.entityService.findMany('api::filter-product.filter-product', {
     populate: { img: true, brandImg: true }
   })
   ```

3. Ajouter l'insertion dans `generateInsertSQL()` avec extraction des URLs d'images

---

## 📅 Gestion des dates

### Dates dans FilterCompatibility

**Champs de dates** :
- `productionStart` : String (date de début de production)
- `productionEnd` : String (date de fin de production)

**Format** : Les dates sont stockées comme **String** (pas de type Date dans Strapi)

**Exemple** :
```json
{
  "productionStart": "2008",
  "productionEnd": "2014"
}
```

### Récupération des dates

**Les dates sont bien récupérées** dans les requêtes standard :
```typescript
const compatibilities = await strapi.entityService.findMany(
  'api::filter-compatibility.filter-compatibility',
  {
    populate: ['brand', 'model']
  }
);
// productionStart et productionEnd sont inclus dans la réponse
```

**⚠️ Note importante** : Les dates sont stockées comme String, donc :
- Pas de validation de format automatique
- Pas de conversion de timezone
- Format libre (peut être "2008", "2008-01", "2008-01-15", etc.)

### Dates dans SQLite

**État actuel** : Les dates **ne sont PAS synchronisées** car les tables filters ne sont pas dans le sync.

**Si implémenté** : Les dates seraient stockées comme TEXT dans SQLite :
```sql
production_start TEXT,
production_end TEXT
```

---

## 📊 État actuel des données dans la base

### Dans Strapi

✅ **FilterProduct** :
- Entité créée et fonctionnelle
- Schéma défini avec tous les champs nécessaires
- Endpoints CRUD disponibles
- Service de matching intelligent implémenté

✅ **FilterCompatibility** :
- Entité créée et fonctionnelle
- Schéma défini avec relations brand/model
- Endpoints personnalisés disponibles
- Service de recherche et matching implémenté

### Dans SQLite (Base de données tablette)

❌ **FilterProduct** :
- **Table NON créée** dans `sync/services/sync.ts`
- **Données NON synchronisées**
- **Images NON disponibles** offline

❌ **FilterCompatibility** :
- **Table NON créée** dans `sync/services/sync.ts`
- **Données NON synchronisées**
- **Dates NON disponibles** offline

### Impact

**Conséquence** : Les filters ne sont **pas disponibles en mode offline** sur la tablette. Toutes les requêtes doivent passer par l'API Strapi.

**Pour rendre les filters disponibles offline** :
1. Ajouter les tables dans `generateSqliteSeed()`
2. Ajouter la récupération dans `getSyncData()`
3. Ajouter l'insertion dans `generateInsertSQL()`
4. Gérer les images (chemins relatifs comme pour lights/wipers)
5. Tester la synchronisation complète

---

## 🔄 Workflow de récupération des filters

### Workflow actuel (via API Strapi)

```
1. Utilisateur sélectionne : Marque + Modèle
   ↓
2. Frontend appelle : GET /api/vehicle-products/:brandSlug/:modelSlug
   ↓
3. Backend (vehicle-products service) :
   - Convertit brandSlug → brandName
   - Convertit modelSlug → modelName
   - Appelle getFilterProducts(brandName, modelName)
   ↓
4. getFilterProducts() :
   - Recherche FilterCompatibility par brand.name + model.name
   - Extrait les références de filtres (oil, air, diesel, cabin)
   - Pour chaque référence, appelle findProductByReference()
   ↓
5. findProductByReference() :
   - Nettoie la référence (ex: "56-CS701" → "CS701")
   - Recherche exacte dans FilterProduct
   - Si aucun résultat, recherche "starts with"
   - Retourne les produits avec images populées
   ↓
6. Retour au frontend : Array de FilterProduct avec images
```

### Workflow souhaité (offline avec SQLite)

```
1. Utilisateur sélectionne : Marque + Modèle
   ↓
2. Frontend interroge SQLite :
   SELECT * FROM filter_compatibilities 
   WHERE brand_id = ? AND model_id = ?
   ↓
3. Pour chaque compatibilité :
   - Parse le JSON filters
   - Pour chaque référence, recherche dans filter_products
   ↓
4. Retour des produits avec chemins d'images relatifs
```

---

## 📝 Notes importantes

### Matching intelligent des références

Le système implémente un **matching intelligent** pour gérer les variations de références :
- **Nettoyage** : "56-CS701" → "CS701" (supprime le préfixe)
- **Exact match** : Recherche d'abord "CS701" exact
- **Fuzzy match** : Si aucun résultat, recherche "CS701*" (starts with)
- **Exemple** : "CS701" peut matcher "CS701", "CS701A", "CS701AY"

### Séparation Oil / Filters

Dans `vehicle-products`, il y a une **séparation** :
- `getFilterProducts()` : Retourne oil, air, diesel, cabin (exclut `oil`)
- `getOilProducts()` : Retourne uniquement les filtres `oil`

**Raison** : L'huile est considérée comme une catégorie séparée dans l'interface.

### Performance

**Optimisations actuelles** :
- Index sur `brand_id` et `model_id` dans FilterCompatibility (si SQLite)
- Limite de 100 résultats par requête dans `findProductByReference()`
- Utilisation de Map pour dédupliquer les produits

**Points d'attention** :
- Les requêtes peuvent être lentes si beaucoup de compatibilités
- Le matching produit par produit peut être optimisé avec des batch queries

---

## ✅ Checklist d'implémentation SQLite

Pour rendre les filters disponibles offline :

- [ ] Ajouter table `filter_products` dans `generateSqliteSeed()`
- [ ] Ajouter table `filter_compatibilities` dans `generateSqliteSeed()`
- [ ] Ajouter index sur `brand_id`, `model_id` dans `filter_compatibilities`
- [ ] Ajouter récupération `filterProducts` dans `getSyncData()`
- [ ] Ajouter récupération `filterCompatibilities` dans `getSyncData()`
- [ ] Ajouter insertion `filter_products` dans `generateInsertSQL()`
- [ ] Ajouter insertion `filter_compatibilities` dans `generateInsertSQL()`
- [ ] Gérer les images (chemins relatifs)
- [ ] Tester la synchronisation complète
- [ ] Documenter les requêtes SQLite pour le frontend

---

## 🔗 Références

- **Schéma FilterProduct** : `src/api/filter-product/content-types/filter-product/schema.json`
- **Schéma FilterCompatibility** : `src/api/filter-compatibility/content-types/filter-compatibility/schema.json`
- **Service FilterCompatibility** : `src/api/filter-compatibility/services/filter-compatibility.ts`
- **Controller FilterCompatibility** : `src/api/filter-compatibility/controllers/filter-compatibility.ts`
- **Service VehicleProducts** : `src/api/vehicle-products/services/vehicle-products.ts`
- **Service Sync** : `src/api/sync/services/sync.ts`
- **Documentation DB** : `db_structure.md` (lignes 376-435)
