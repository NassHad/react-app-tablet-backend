# 📱 Guide Frontend - Tri des catégories par `order`

## 🎯 Résumé des modifications backend

Le backend a été mis à jour pour trier automatiquement les catégories par le champ `order` :
- ✅ **API REST** (`/api/categories`) : Tri automatique par `order:asc`
- ✅ **Endpoint Sync** (`/api/sync/:tabletId`) : Catégories triées par `order:asc`
- ✅ **Base SQLite** : Colonne `order` ajoutée dans la table `categories`

---

## 🔍 Ce que le frontend doit faire

### 1. **API REST (Mode Online)**

**✅ Aucune action requise** - Le backend trie déjà automatiquement !

Lorsque vous appelez `/api/categories`, les catégories sont déjà triées par `order:asc` :

```typescript
// Exemple d'appel API
const response = await fetch('/api/categories');
const categories = await response.json();

// Les catégories sont déjà triées par order
// Vous pouvez les utiliser directement
categories.forEach(category => {
  console.log(category.name, category.order);
});
```

**Note** : Si vous souhaitez un tri différent, vous pouvez toujours passer le paramètre `sort` dans la requête :
```typescript
// Trier par nom si besoin
const response = await fetch('/api/categories?sort=name:asc');
```

---

### 2. **SQLite (Mode Offline - Application Tablette)**

**⚠️ Action requise** : Vous devez trier les catégories par `order` lors de la récupération depuis SQLite.

#### A. Mettre à jour la requête SQL

Lorsque vous récupérez les catégories depuis SQLite, ajoutez `ORDER BY order ASC` :

```typescript
// ❌ AVANT (tri par id)
const query = `
  SELECT * FROM categories 
  WHERE active = 1
  ORDER BY id ASC
`;

// ✅ APRÈS (tri par order)
const query = `
  SELECT * FROM categories 
  WHERE active = 1
  ORDER BY order ASC, id ASC
`;
```

**Note** : `ORDER BY order ASC, id ASC` permet de :
- Trier d'abord par `order` (ordre personnalisé)
- En cas d'égalité ou de `NULL`, trier par `id` (ordre de secours)

#### B. Exemple complet avec Capacitor SQLite

```typescript
import { SQLiteDBConnection } from '@capacitor-community/sqlite';

async function getCategories(): Promise<Category[]> {
  const db: SQLiteDBConnection = await getDatabaseConnection();
  
  const result = await db.query(`
    SELECT 
      id,
      name,
      slug,
      icon,
      active,
      order
    FROM categories 
    WHERE active = 1
    ORDER BY 
      CASE WHEN "order" IS NULL THEN 1 ELSE 0 END,
      "order" ASC,
      id ASC
  `);
  
  return result.values as Category[];
}
```

**Explication du tri** :
- `CASE WHEN "order" IS NULL THEN 1 ELSE 0 END` : Met les catégories sans `order` à la fin
- `"order" ASC` : Trie par ordre croissant
- `id ASC` : Tri de secours en cas d'égalité

#### C. Alternative : Trier en JavaScript

Si vous préférez trier côté JavaScript après la récupération :

```typescript
async function getCategories(): Promise<Category[]> {
  const db: SQLiteDBConnection = await getDatabaseConnection();
  
  const result = await db.query(`
    SELECT * FROM categories WHERE active = 1
  `);
  
  const categories = result.values as Category[];
  
  // Trier par order, puis par id
  return categories.sort((a, b) => {
    // Si order est null, mettre à la fin
    if (a.order === null && b.order === null) return a.id - b.id;
    if (a.order === null) return 1;
    if (b.order === null) return -1;
    
    // Trier par order
    if (a.order !== b.order) return a.order - b.order;
    
    // En cas d'égalité, trier par id
    return a.id - b.id;
  });
}
```

---

### 3. **Mise à jour du type TypeScript**

Assurez-vous que votre interface `Category` inclut le champ `order` :

```typescript
interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  active: boolean;
  order: number | null; // ⭐ Nouveau champ
}
```

---

### 4. **Synchronisation SQLite**

Lors de la synchronisation depuis l'endpoint `/api/sync/:tabletId`, les catégories incluent maintenant le champ `order` :

```typescript
// Exemple de synchronisation
async function syncCategories() {
  const response = await fetch(`/api/sync/${tabletId}`);
  const data = await response.json();
  
  // Les catégories sont déjà triées par order
  const categories = data.data.categories;
  
  // Insérer dans SQLite
  for (const category of categories) {
    await db.execute(`
      INSERT OR REPLACE INTO categories 
      (id, name, slug, icon, active, "order")
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      category.id,
      category.name,
      category.slug,
      category.icon,
      category.isActive,
      category.order ?? null // Gérer les valeurs null
    ]);
  }
}
```

**Important** : Assurez-vous que votre table SQLite a bien la colonne `order` :

```sql
-- Migration SQLite (si nécessaire)
ALTER TABLE categories ADD COLUMN "order" INTEGER;
```

---

## 📋 Checklist Frontend

- [ ] **API REST** : Aucune action (déjà géré par le backend)
- [ ] **SQLite - Requête** : Ajouter `ORDER BY order ASC, id ASC` dans les requêtes
- [ ] **SQLite - Migration** : Vérifier que la colonne `order` existe dans la table
- [ ] **TypeScript** : Ajouter `order: number | null` dans l'interface `Category`
- [ ] **Synchronisation** : Inclure le champ `order` lors de l'insertion en SQLite
- [ ] **Tests** : Vérifier que les catégories s'affichent dans le bon ordre

---

## 🎨 Exemples d'utilisation

### Page des catégories

```typescript
function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  async function loadCategories() {
    if (isOnline) {
      // API REST - déjà trié
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data);
    } else {
      // SQLite - trier par order
      const cats = await getCategories(); // Déjà trié dans la requête SQL
      setCategories(cats);
    }
  }
  
  return (
    <div>
      {categories.map(category => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
```

### Navigation Navbar

```typescript
function Navbar() {
  const [categories, setCategories] = useState<Category[]>([]);
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  async function loadCategories() {
    // Même logique que pour la page des catégories
    const cats = await getCategories();
    setCategories(cats);
  }
  
  return (
    <nav>
      {categories.map(category => (
        <NavLink key={category.id} to={`/category/${category.slug}`}>
          {category.name}
        </NavLink>
      ))}
    </nav>
  );
}
```

---

## ⚠️ Notes importantes

1. **Valeurs NULL** : Les catégories sans `order` doivent être affichées en dernier
2. **Compatibilité** : Si une catégorie n'a pas de `order`, utiliser `id` comme tri de secours
3. **Migration** : Si votre base SQLite existante n'a pas la colonne `order`, ajoutez-la avec `ALTER TABLE`
4. **Performance** : Le tri SQL est plus performant que le tri JavaScript pour de grandes listes

---

## 🚀 Prochaines étapes

1. Mettre à jour les requêtes SQLite pour inclure `ORDER BY order ASC`
2. Tester l'affichage des catégories dans l'ordre correct
3. Vérifier que la synchronisation inclut bien le champ `order`
4. Mettre à jour les types TypeScript si nécessaire

---

**✅ Le backend est prêt ! Il ne reste plus qu'à mettre à jour les requêtes SQLite côté frontend.**
