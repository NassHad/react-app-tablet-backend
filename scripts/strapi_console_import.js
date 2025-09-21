// Copy and paste this into your Strapi console (http://localhost:1338/admin)
// This script will import the Osram lights data step by step

console.log('🚀 Starting Osram Lights Import...');

// Step 1: Create Brands
console.log('📝 Step 1: Creating brands...');
const brands = [
  'ABARTH', 'ALFA ROMEO', 'AUDI', 'BMW', 'CITROEN', 'DACIA', 'FIAT', 'FORD', 'HONDA', 'HYUNDAI',
  'JAGUAR', 'KIA', 'LAND ROVER', 'LEXUS', 'MAZDA', 'MERCEDES-BENZ', 'MINI', 'MITSUBISHI', 'NISSAN', 'OPEL',
  'PEUGEOT', 'PORSCHE', 'RENAULT', 'SEAT', 'SKODA', 'SUBARU', 'SUZUKI', 'TOYOTA', 'VOLKSWAGEN', 'VOLVO'
];

const brandIds = {};
for (const brandName of brands) {
  try {
    const brand = await strapi.entityService.create('api::lights-brand.lights-brand', {
      data: {
        name: brandName,
        slug: brandName.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        publishedAt: new Date()
      }
    });
    brandIds[brandName] = brand.id;
    console.log(`✅ Created brand: ${brandName} (ID: ${brand.id})`);
  } catch (error) {
    console.error(`❌ Error creating brand ${brandName}:`, error.message);
  }
}

// Step 2: Create Positions
console.log('📝 Step 2: Creating positions...');
const positions = [
  'Feu de croisement', 'Feu de route', 'Éclairage jour', 'Feu de position',
  'Feu de brouillard', 'Feu de recul', 'Feu de stop', 'Feu de clignotant',
  'Feu de position arrière', 'Feu de brouillard arrière', 'Feu de plaque', 'Feu de tableau de bord'
];

const positionIds = {};
for (const positionName of positions) {
  try {
    const position = await strapi.entityService.create('api::lights-position.lights-position', {
      data: {
        name: positionName,
        slug: positionName.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        publishedAt: new Date()
      }
    });
    positionIds[positionName] = position.id;
    console.log(`✅ Created position: ${positionName} (ID: ${position.id})`);
  } catch (error) {
    console.error(`❌ Error creating position ${positionName}:`, error.message);
  }
}

console.log('🎉 Basic setup complete!');
console.log('📊 Brand IDs:', brandIds);
console.log('📊 Position IDs:', positionIds);
console.log('');
console.log('Next: Run the model import script to create models and light data...');
