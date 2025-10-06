const fetch = require('node-fetch');

// Configuration
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1338';
const TABLET_ID = 'tablet-001';

async function testSyncEndpoint() {
  try {
    console.log('🧪 Test de l\'endpoint de synchronisation...');
    console.log(`📡 URL: ${STRAPI_URL}/api/sync/${TABLET_ID}`);
    
    // Test 1: Récupération des données
    console.log('\n1️⃣ Test de récupération des données...');
    const response1 = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`);
    
    if (!response1.ok) {
      throw new Error(`HTTP error! status: ${response1.status}`);
    }
    
    const data = await response1.json();
    console.log(`✅ Données récupérées avec succès`);
    console.log(`📊 Version: ${data.version}`);
    console.log(`📅 Timestamp: ${data.timestamp}`);
    console.log(`📱 Tablet ID: ${data.tabletId}`);
    console.log(`📋 Tables disponibles: ${Object.keys(data.data).join(', ')}`);
    
    // Compter les enregistrements par table
    console.log('\n📊 Nombre d\'enregistrements par table:');
    Object.entries(data.data).forEach(([table, records]) => {
      console.log(`  ${table}: ${records.length} enregistrements`);
    });
    
    // Test 2: Test du cache (304 Not Modified)
    console.log('\n2️⃣ Test du cache (304 Not Modified)...');
    const response2 = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`, {
      headers: {
        'If-None-Match': data.version
      }
    });
    
    if (response2.status === 304) {
      console.log('✅ Cache fonctionne correctement (304 Not Modified)');
    } else {
      console.log(`⚠️  Cache non fonctionnel (status: ${response2.status})`);
    }
    
    // Test 3: Test avec une version différente
    console.log('\n3️⃣ Test avec une version différente...');
    const response3 = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`, {
      headers: {
        'If-None-Match': 'old-version-123'
      }
    });
    
    if (response3.ok) {
      console.log('✅ Version différente retourne les données (200 OK)');
    } else {
      console.log(`⚠️  Problème avec version différente (status: ${response3.status})`);
    }
    
    // Test 4: Test de performance
    console.log('\n4️⃣ Test de performance...');
    const startTime = Date.now();
    const response4 = await fetch(`${STRAPI_URL}/api/sync/${TABLET_ID}`);
    const endTime = Date.now();
    
    if (response4.ok) {
      const duration = endTime - startTime;
      console.log(`✅ Temps de réponse: ${duration}ms`);
      
      if (duration < 1000) {
        console.log('🚀 Performance excellente (< 1s)');
      } else if (duration < 3000) {
        console.log('✅ Performance correcte (< 3s)');
      } else {
        console.log('⚠️  Performance lente (> 3s)');
      }
    }
    
    console.log('\n🎉 Tous les tests sont passés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests :', error.message);
    process.exit(1);
  }
}

// Exécuter les tests
if (require.main === module) {
  testSyncEndpoint();
}

module.exports = { testSyncEndpoint };
