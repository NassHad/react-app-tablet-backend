// Test script to debug the import process
try {
  require('ts-node/register/transpile-only');
} catch (e) {
  console.error('ts-node is missing. Run: npm i -D ts-node typescript @types/node');
  process.exit(1);
}

const fs = require("fs");
const path = require("path");

console.log('Starting test script...');

async function test() {
  try {
    console.log('Loading Strapi...');
    const { createStrapi } = require('@strapi/strapi');
    
    console.log('Creating Strapi instance...');
    const strapi = await createStrapi();
    
    console.log('Starting Strapi...');
    await strapi.start();
    
    console.log('Strapi started successfully!');
    
    // Test basic functionality
    console.log('Testing brand count...');
    const brandCount = await strapi.entityService.count('api::brand.brand');
    console.log(`Found ${brandCount} brands`);
    
    console.log('Testing model count...');
    const modelCount = await strapi.entityService.count('api::model.model');
    console.log(`Found ${modelCount} models`);
    
    console.log('Destroying Strapi...');
    await strapi.destroy();
    console.log('Test completed successfully!');
    
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  }
}

test();
