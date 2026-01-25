import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// Utiliser fetch natif de Node 18+ (disponible globalement)
// Si Node < 18, utiliser: import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const TABLET_ID = process.env.TABLET_ID || 'tablet-001';
// Images sont stockées dans public/assets/img/products/ pour être incluses dans le build Vite
// Cela garantit la cohérence avec getImageUrl() dans environment.ts
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'assets', 'img', 'products');

/**
 * Extrait l'URL d'un objet Media Strapi
 * IMPORTANT: On utilise l'URL principale (media.url) pour être cohérent avec getImageUrl()
 * qui extrait le filename de l'URL principale stockée dans la base de données.
 */
function extractImageUrl(media) {
  if (!media) return null;
  if (typeof media === 'string') return media;
  // Priorité: url principale > formats.small > formats.thumbnail
  // On utilise l'URL principale pour que le nom de fichier corresponde à ce que getImageUrl() attend
  return media.url || media.formats?.small?.url || media.formats?.thumbnail?.url || null;
}

/**
 * Extrait le nom de fichier depuis une URL Strapi
 * Ex: /uploads/904600_OSRAM_ORIGINAL_P21_W_d26195cca1.jpg -> 904600_OSRAM_ORIGINAL_P21_W_d26195cca1.jpg
 */
function extractFilenameFromUrl(url) {
  if (!url) return null;
  const parts = url.split('/');
  return parts[parts.length - 1];
}

/**
 * Télécharge une image et la sauvegarde localement
 */
async function downloadImage(imageUrl, filename) {
  try {
    // Construire l'URL complète si c'est une URL relative
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `${STRAPI_URL}${imageUrl}`;

    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Convertir la réponse en buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Créer le dossier si nécessaire
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }

    // Sauvegarder l'image directement dans IMAGES_DIR (pas de sous-dossiers)
    const fullPath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`✅ ${filename}`);
    return filename;
  } catch (error) {
    console.error(`❌ Erreur ${imageUrl}:`, error.message);
    return null;
  }
}

/**
 * Détermine le préfixe pour une catégorie
 * Cohérent avec getImageUrl() dans environment.ts
 */
function getCategoryPrefix(category) {
  const prefixMap = {
    'lights': 'light_',
    'battery': 'battery_',
    'wipers': 'wiper_'
  };
  return prefixMap[category] || '';
}

/**
 * Télécharge toutes les images pour une catégorie
 * Utilise la même convention de nommage que downloadAllImages.js :
 * - Images produit: {prefix}{filename} (ex: light_904600_OSRAM_P21_W.jpg)
 * - Images marque: brand_{filename} (ex: brand_LOGO_OSRAM.jpg)
 */
async function downloadCategoryImages(data, category) {
  const images = [];
  let downloaded = 0;
  let skipped = 0;
  const downloadedUrls = new Set(); // Éviter les doublons
  const prefix = getCategoryPrefix(category);

  for (const item of data) {
    const imgUrl = extractImageUrl(item.img);
    if (imgUrl && !downloadedUrls.has(imgUrl)) {
      downloadedUrls.add(imgUrl);
      const filename = extractFilenameFromUrl(imgUrl);
      if (filename) {
        // Convention: {prefix}{filename} -> light_904600_OSRAM.jpg
        const localPath = `${prefix}${filename}`;
        const result = await downloadImage(imgUrl, localPath);
        if (result) {
          images.push({ id: item.id, type: 'img', path: result });
          downloaded++;
        } else {
          skipped++;
        }
      }
    }

    const brandImgUrl = extractImageUrl(item.brandImg);
    if (brandImgUrl && !downloadedUrls.has(brandImgUrl)) {
      downloadedUrls.add(brandImgUrl);
      const filename = extractFilenameFromUrl(brandImgUrl);
      if (filename) {
        // Convention: brand_{filename} -> brand_LOGO_OSRAM.jpg
        const localPath = `brand_${filename}`;
        const result = await downloadImage(brandImgUrl, localPath);
        if (result) {
          images.push({ id: item.id, type: 'brandImg', path: result });
          downloaded++;
        } else {
          skipped++;
        }
      }
    }
  }

  return { images, downloaded, skipped };
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🖼️  Téléchargement des images...');
  console.log(`📡 Strapi URL: ${STRAPI_URL}`);
  console.log(`📁 Destination: ${IMAGES_DIR}\n`);
  
  // Créer le dossier images
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${IMAGES_DIR}\n`);
  }
  
  try {
    // Récupérer les données depuis Strapi
    console.log('🔄 Récupération des données depuis Strapi...');
    const response = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const syncData = await response.json();
    const data = syncData.data || syncData;
    console.log('✅ Données récupérées\n');
    
    let totalDownloaded = 0;
    let totalSkipped = 0;
    
    // Télécharger les images pour chaque catégorie
    if (data.lightData && data.lightData.length > 0) {
      console.log(`📥 Lights (${data.lightData.length} items)...`);
      const result = await downloadCategoryImages(data.lightData, 'lights');
      totalDownloaded += result.downloaded;
      totalSkipped += result.skipped;
      console.log(`   ✅ ${result.downloaded} téléchargées, ${result.skipped} échouées\n`);
    }
    
    if (data.batteryData && data.batteryData.length > 0) {
      console.log(`📥 Battery (${data.batteryData.length} items)...`);
      const result = await downloadCategoryImages(data.batteryData, 'battery');
      totalDownloaded += result.downloaded;
      totalSkipped += result.skipped;
      console.log(`   ✅ ${result.downloaded} téléchargées, ${result.skipped} échouées\n`);
    }
    
    if (data.wipersData && data.wipersData.length > 0) {
      console.log(`📥 Wipers (${data.wipersData.length} items)...`);
      const result = await downloadCategoryImages(data.wipersData, 'wipers');
      totalDownloaded += result.downloaded;
      totalSkipped += result.skipped;
      console.log(`   ✅ ${result.downloaded} téléchargées, ${result.skipped} échouées\n`);
    }
    
    if (data.filterProducts && data.filterProducts.length > 0) {
      console.log(`📥 Filters (${data.filterProducts.length} items)...`);
      const result = await downloadCategoryImages(data.filterProducts, 'filters');
      totalDownloaded += result.downloaded;
      totalSkipped += result.skipped;
      console.log(`   ✅ ${result.downloaded} téléchargées, ${result.skipped} échouées\n`);
    }
    
    console.log('✅ Téléchargement terminé !');
    console.log(`📊 Total: ${totalDownloaded} images téléchargées, ${totalSkipped} échouées`);
    
  } catch (error) {
    console.error('❌ Erreur lors du téléchargement:', error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || 
                     import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  main();
}

export { main };
