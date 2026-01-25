# 📱 Mise à jour Frontend - Synchronisation light_data et wipers_data

## 🎯 Résumé des modifications

Les modifications backend permettent maintenant de synchroniser :
- ✅ **Les données EAN pour les lights** (champ `EAN` dans `light_data`)
- ✅ **Toutes les données wipers** (nouvelle table `wipers_data`)
- ✅ **Les images avec chemins relatifs** (stockées dans l'APK)

---

## 📊 Nouvelles structures SQLite

### Table `light_data` - Champs ajoutés

La table `light_data` contient maintenant tous les champs de référence :

```sql
CREATE TABLE light_data (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL,
  brand TEXT,              -- NOUVEAU
  category TEXT,           -- NOUVEAU
  description TEXT,
  EAN INTEGER,             -- NOUVEAU ⭐
  refGTI INTEGER,          -- NOUVEAU
  brandImg TEXT,
  img TEXT,
  isActive BOOLEAN DEFAULT 1,  -- NOUVEAU
  specifications TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**Champs importants** :
- `EAN` : Code EAN du produit (INTEGER)
- `refGTI` : Référence GTI (INTEGER)
- `brand` : Marque du produit
- `category` : Catégorie du produit
- `img` / `brandImg` : **Chemins relatifs** vers les images (ex: `images/lights/123_img.jpg`)

### Table `wipers_data` - Nouvelle table

```sql
CREATE TABLE wipers_data (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  category TEXT,
  brand TEXT,
  size TEXT,
  description TEXT,
  isActive BOOLEAN DEFAULT 1,
  brandImg TEXT,
  img TEXT,
  gtiCode INTEGER,
  genCode INTEGER,
  created_at TEXT,
  updated_at TEXT
);
```

**Champs importants** :
- `ref` : Référence du produit
- `brand` : Marque
- `size` : Taille de l'essuie-glace
- `gtiCode` / `genCode` : Codes de référence
- `img` / `brandImg` : **Chemins relatifs** vers les images (ex: `images/wipers/789_img.jpg`)

---

## 🔍 Requêtes SQLite pour le frontend

### 1. Récupérer les données lights par EAN

```typescript
// Rechercher un produit par son code EAN
const getLightByEAN = async (ean: number) => {
  const result = await db.execute(
    `SELECT * FROM light_data WHERE EAN = ? AND isActive = 1`,
    [ean]
  );
  return result.rows?.[0] || null;
};
```

### 2. Récupérer les données lights par référence

```typescript
// Rechercher par référence
const getLightByRef = async (ref: string) => {
  const result = await db.execute(
    `SELECT * FROM light_data WHERE ref = ? AND isActive = 1`,
    [ref]
  );
  return result.rows?.[0] || null;
};
```

### 3. Récupérer les données lights par marque

```typescript
// Lister tous les produits d'une marque
const getLightsByBrand = async (brand: string) => {
  const result = await db.execute(
    `SELECT * FROM light_data WHERE brand = ? AND isActive = 1 ORDER BY ref`,
    [brand]
  );
  return result.rows || [];
};
```

### 4. Récupérer toutes les données wipers

```typescript
// Récupérer toutes les données wipers actives
const getAllWipersData = async () => {
  const result = await db.execute(
    `SELECT * FROM wipers_data WHERE isActive = 1 ORDER BY brand, ref`
  );
  return result.rows || [];
};
```

### 5. Récupérer les wipers par référence

```typescript
// Rechercher un essuie-glace par référence
const getWiperByRef = async (ref: string) => {
  const result = await db.execute(
    `SELECT * FROM wipers_data WHERE ref = ? AND isActive = 1`,
    [ref]
  );
  return result.rows?.[0] || null;
};
```

### 6. Récupérer les wipers par marque

```typescript
// Lister les essuie-glaces d'une marque
const getWipersByBrand = async (brand: string) => {
  const result = await db.execute(
    `SELECT * FROM wipers_data WHERE brand = ? AND isActive = 1 ORDER BY ref`,
    [brand]
  );
  return result.rows || [];
};
```

### 7. Récupérer les wipers par taille

```typescript
// Rechercher par taille
const getWipersBySize = async (size: string) => {
  const result = await db.execute(
    `SELECT * FROM wipers_data WHERE size = ? AND isActive = 1`,
    [size]
  );
  return result.rows || [];
};
```

---

## 🖼️ Affichage des images

Les images sont stockées avec des **chemins relatifs** dans SQLite :
- `images/lights/123_img.jpg`
- `images/lights/123_brand.jpg`
- `images/battery/456_img.jpg`
- `images/wipers/789_img.jpg`

### Option 1 : Via Capacitor Assets (Recommandé)

```typescript
import { Capacitor } from '@capacitor/core';

function ProductImage({ imagePath }: { imagePath: string | null }) {
  if (!imagePath) {
    return (
      <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
        <span className="text-gray-400">Pas d'image</span>
      </div>
    );
  }
  
  // Capacitor convertit automatiquement les chemins assets
  // Les images sont dans android/app/src/main/assets/images/
  const imageSrc = Capacitor.convertFileSrc(`/assets/${imagePath}`);
  
  return (
    <img 
      src={imageSrc} 
      alt="Product" 
      className="w-full h-48 object-contain"
      onError={(e) => {
        // Fallback si l'image n'existe pas
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}
```

### Option 2 : Via Capacitor Filesystem

```typescript
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useState, useEffect } from 'react';

function useLocalImage(imagePath: string | null) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!imagePath) {
      setImageSrc(null);
      setLoading(false);
      return;
    }
    
    async function loadImage() {
      try {
        setLoading(true);
        
        // Lire l'image depuis les assets Android
        const file = await Filesystem.readFile({
          path: imagePath,
          directory: Directory.Resources // Pour les assets
        });
        
        // Convertir en data URL pour l'affichage
        const dataUrl = `data:image/jpeg;base64,${file.data}`;
        setImageSrc(dataUrl);
        setError(null);
        
      } catch (err) {
        console.error('Erreur chargement image:', err);
        setError('Image non disponible');
        setImageSrc(null);
      } finally {
        setLoading(false);
      }
    }
    
    loadImage();
  }, [imagePath]);
  
  return { imageSrc, loading, error };
}

// Utilisation dans un composant
function ProductImage({ imagePath }: { imagePath: string | null }) {
  const { imageSrc, loading, error } = useLocalImage(imagePath);
  
  if (loading) {
    return <div className="animate-pulse bg-gray-200 w-full h-48" />;
  }
  
  if (error || !imageSrc) {
    return (
      <div className="bg-gray-100 w-full h-48 flex items-center justify-center">
        <span className="text-gray-400">Image non disponible</span>
      </div>
    );
  }
  
  return <img src={imageSrc} alt="Product" className="w-full h-48 object-contain" />;
}
```

### Option 3 : Via require() (si images dans public/)

Si vous copiez les images dans `public/assets/images/` :

```typescript
function ProductImage({ imagePath }: { imagePath: string | null }) {
  if (!imagePath) return null;
  
  try {
    // Les images doivent être dans public/assets/images/
    const imageSrc = require(`../assets/${imagePath}`);
    return <img src={imageSrc} alt="Product" className="w-full h-48 object-contain" />;
  } catch {
    return (
      <div className="bg-gray-100 w-full h-48 flex items-center justify-center">
        <span className="text-gray-400">Image non trouvée</span>
      </div>
    );
  }
}
```

---

## 📝 Exemples d'utilisation complets

### Exemple 1 : Afficher un produit light avec EAN

```typescript
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { databaseService } from './services/databaseService';

interface LightData {
  id: number;
  ref: string;
  brand: string;
  category: string;
  description: string;
  EAN: number;
  refGTI: number;
  img: string;
  brandImg: string;
  isActive: boolean;
}

function LightProductDetail({ ean }: { ean: number }) {
  const [lightData, setLightData] = useState<LightData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadLightData() {
      try {
        const result = await databaseService.execute(
          `SELECT * FROM light_data WHERE EAN = ? AND isActive = 1`,
          [ean]
        );
        
        if (result.rows && result.rows.length > 0) {
          setLightData(result.rows[0] as LightData);
        }
      } catch (error) {
        console.error('Erreur chargement light data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadLightData();
  }, [ean]);
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  if (!lightData) {
    return <div>Aucun produit trouvé pour ce code EAN</div>;
  }
  
  const imageSrc = lightData.img 
    ? Capacitor.convertFileSrc(`/assets/${lightData.img}`)
    : null;
  
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold">{lightData.ref}</h2>
      <p className="text-gray-600">{lightData.brand}</p>
      
      {imageSrc && (
        <img 
          src={imageSrc} 
          alt={lightData.ref}
          className="w-full h-64 object-contain mt-4"
        />
      )}
      
      <div className="mt-4">
        <p><strong>EAN:</strong> {lightData.EAN}</p>
        <p><strong>Référence GTI:</strong> {lightData.refGTI || 'N/A'}</p>
        <p><strong>Description:</strong> {lightData.description}</p>
      </div>
    </div>
  );
}
```

### Exemple 2 : Liste des wipers avec images

```typescript
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { databaseService } from './services/databaseService';

interface WipersData {
  id: number;
  ref: string;
  brand: string;
  size: string;
  description: string;
  gtiCode: number;
  genCode: number;
  img: string;
  brandImg: string;
}

function WipersList() {
  const [wipers, setWipers] = useState<WipersData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadWipers() {
      try {
        const result = await databaseService.execute(
          `SELECT * FROM wipers_data WHERE isActive = 1 ORDER BY brand, ref`
        );
        
        setWipers(result.rows as WipersData[] || []);
      } catch (error) {
        console.error('Erreur chargement wipers:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadWipers();
  }, []);
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Essuie-glaces</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {wipers.map((wiper) => {
          const imageSrc = wiper.img 
            ? Capacitor.convertFileSrc(`/assets/${wiper.img}`)
            : null;
          
          return (
            <div key={wiper.id} className="border rounded-lg p-4">
              <h3 className="font-bold">{wiper.ref}</h3>
              <p className="text-sm text-gray-600">{wiper.brand}</p>
              {wiper.size && <p className="text-sm">Taille: {wiper.size}</p>}
              
              {imageSrc && (
                <img 
                  src={imageSrc} 
                  alt={wiper.ref}
                  className="w-full h-32 object-contain mt-2"
                />
              )}
              
              {wiper.description && (
                <p className="text-xs text-gray-500 mt-2">{wiper.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Exemple 3 : Recherche par EAN

```typescript
import { useState } from 'react';
import { databaseService } from './services/databaseService';

function EANSearch() {
  const [ean, setEan] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  async function searchByEAN() {
    if (!ean) return;
    
    setLoading(true);
    try {
      const dbResult = await databaseService.execute(
        `SELECT * FROM light_data WHERE EAN = ? AND isActive = 1`,
        [parseInt(ean)]
      );
      
      if (dbResult.rows && dbResult.rows.length > 0) {
        setResult(dbResult.rows[0]);
      } else {
        setResult(null);
        alert('Aucun produit trouvé pour ce code EAN');
      }
    } catch (error) {
      console.error('Erreur recherche:', error);
      alert('Erreur lors de la recherche');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="p-4">
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={ean}
          onChange={(e) => setEan(e.target.value)}
          placeholder="Code EAN"
          className="flex-1 border rounded px-4 py-2"
        />
        <button
          onClick={searchByEAN}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-2 rounded"
        >
          {loading ? 'Recherche...' : 'Rechercher'}
        </button>
      </div>
      
      {result && (
        <div className="border rounded p-4">
          <h3 className="font-bold text-lg">{result.ref}</h3>
          <p className="text-gray-600">{result.brand}</p>
          <p className="mt-2"><strong>EAN:</strong> {result.EAN}</p>
          {result.description && <p className="mt-2">{result.description}</p>}
        </div>
      )}
    </div>
  );
}
```

---

## 🔄 Processus de synchronisation

### 1. Télécharger les images (avant build)

```bash
# Télécharger toutes les images depuis Strapi
node scripts/download-images.js
```

Les images seront placées dans :
```
android/app/src/main/assets/images/
├── lights/
│   ├── 123_img.jpg
│   ├── 123_brand.jpg
│   └── ...
├── battery/
│   └── ...
└── wipers/
    └── ...
```

### 2. Générer la base SQLite

```bash
# Générer la base avec les chemins relatifs
node scripts/generateSeed.js
```

### 3. Build l'APK

Les images seront incluses dans l'APK automatiquement lors du build Android.

---

## ⚠️ Points importants

1. **Chemins relatifs** : Les images sont stockées avec des chemins relatifs (`images/lights/123_img.jpg`), pas des URLs complètes
2. **EAN** : Le champ EAN est de type INTEGER dans SQLite
3. **isActive** : Toujours filtrer par `isActive = 1` pour ne récupérer que les produits actifs
4. **Images manquantes** : Toujours gérer le cas où l'image n'existe pas (fallback/placeholder)
5. **Performance** : Les images sont locales, donc chargement instantané une fois l'APK installé

---

## 🧪 Tests recommandés

1. ✅ Vérifier que les données EAN sont bien présentes dans `light_data`
2. ✅ Vérifier que les données wipers sont bien présentes dans `wipers_data`
3. ✅ Tester la recherche par EAN
4. ✅ Tester l'affichage des images avec les chemins relatifs
5. ✅ Vérifier que les images s'affichent correctement dans l'APK

---

## 📚 Ressources

- Documentation Capacitor Assets : https://capacitorjs.com/docs/guides/assets
- Documentation Capacitor Filesystem : https://capacitorjs.com/docs/apis/filesystem
- Structure SQLite : Voir `db_structure.md`
