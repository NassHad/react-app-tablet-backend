console.log('Testing script execution...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);

// Test if we can require the files
try {
  console.log('Testing file access...');
  const fs = require('fs');
  const path = require('path');
  
  const modelsPath = path.join(process.cwd(), 'scripts', 'models.json');
  console.log('Models file path:', modelsPath);
  console.log('Models file exists:', fs.existsSync(modelsPath));
  
  if (fs.existsSync(modelsPath)) {
    const data = JSON.parse(fs.readFileSync(modelsPath, 'utf8'));
    console.log('Models file loaded successfully, count:', data.length);
    console.log('First model:', data[0]);
  }
  
  console.log('✅ Basic file operations work');
} catch (err) {
  console.error('❌ Error:', err.message);
}

console.log('Script completed');
