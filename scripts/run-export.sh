#!/bin/bash

# Export All Brands & Models Script Runner
# This script runs the export using Strapi's console

echo "🎯 Starting Brand & Model Export"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must be run from project root directory"
  exit 1
fi

# Run the export using strapi console
echo "📦 Loading Strapi and running export..."
echo "This may take 45-60 seconds..."
echo ""

npm run strapi -- console --script scripts/export-all-brands-models.js

echo ""
echo "✅ Export complete!"
echo "📁 Check scripts/exported_data/ for the output files"
