#!/bin/bash

# Import Exide brands and models using curl
# Usage: bash scripts/import-exide-brands-models.sh [--test]

STRAPI_URL="${STRAPI_URL:-http://localhost:1338}"
DATA_FILE="scripts/liste_affectation/exide-vehicles-by-brand.json"
TEST_MODE=false

# Check for test flag
if [[ "$*" == *"--test"* ]]; then
  TEST_MODE=true
  echo "🧪 TEST MODE: Will import only first 5 brands"
fi

echo "🚀 Starting Exide brands and models import..."
echo "📁 Reading: $DATA_FILE"
echo "🌐 Strapi URL: $STRAPI_URL"
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "❌ Error: jq is required but not installed"
  echo "   Install it with: sudo apt-get install jq"
  exit 1
fi

# Check if data file exists
if [[ ! -f "$DATA_FILE" ]]; then
  echo "❌ Error: Data file not found: $DATA_FILE"
  exit 1
fi

# Slugify function in bash
slugify() {
  echo "$1" | iconv -t ascii//TRANSLIT | sed -E 's/[^a-zA-Z0-9]+/-/g' | sed -E 's/^-+\|-+$//g' | tr '[:upper:]' '[:lower:]'
}

# Get all brand names from JSON
brand_names=($(jq -r 'keys[]' "$DATA_FILE"))
total_brands=${#brand_names[@]}

if $TEST_MODE; then
  brand_names=("${brand_names[@]:0:5}")
fi

brands_to_process=${#brand_names[@]}

echo "📊 Found $total_brands brands in file"
if $TEST_MODE; then
  echo "   Processing only first $brands_to_process brands"
fi
echo ""

echo "--- Phase 1: Importing Brands ---"
echo ""

# Fetch existing brands to avoid duplicates
echo "📥 Fetching existing brands (this may take multiple requests)..."
declare -A brand_id_map
page=1
total_pages=1

while (( page <= total_pages )); do
  if (( page == 1 )); then
    existing_brands_json=$(curl -s "$STRAPI_URL/api/brands")
  else
    # For subsequent pages, use page parameter
    existing_brands_json=$(curl -s "$STRAPI_URL/api/brands?pagination%5Bpage%5D=$page")
  fi

  if [[ -z "$existing_brands_json" ]] || [[ "$existing_brands_json" == *"error"* ]]; then
    echo "❌ Error: Failed to fetch existing brands from Strapi (page $page)"
    exit 1
  fi

  # Get total pages from first request
  if (( page == 1 )); then
    total_pages=$(echo "$existing_brands_json" | jq -r '.meta.pagination.pageCount // 1')
    echo "   Need to fetch $total_pages page(s)"
  fi

  # Parse brands and store their IDs
  while IFS= read -r line; do
    slug=$(echo "$line" | jq -r '.slug')
    id=$(echo "$line" | jq -r '.id')
    brand_id_map["$slug"]=$id
  done < <(echo "$existing_brands_json" | jq -c '.data[]')

  ((page++))
done

echo "   Found ${#brand_id_map[@]} existing brands"
echo ""

created_brands=0
skipped_brands=0
failed_brands=0

for brand_name in "${brand_names[@]}"; do
  brand_slug=$(slugify "$brand_name")

  if [[ -n "${brand_id_map[$brand_slug]}" ]]; then
    echo "⏭️  Skipped brand: $brand_name ($brand_slug) - already exists"
    ((skipped_brands++))
  else
    # Create brand
    response=$(curl -s -X POST "$STRAPI_URL/api/brands" \
      -H "Content-Type: application/json" \
      -d "{\"data\":{\"name\":\"$brand_name\",\"slug\":\"$brand_slug\",\"isActive\":true}}")

    # Check if creation was successful
    if echo "$response" | jq -e '.data.id' > /dev/null 2>&1; then
      brand_id=$(echo "$response" | jq -r '.data.id')
      brand_id_map["$brand_slug"]=$brand_id
      echo "✅ Created brand: $brand_name ($brand_slug)"
      ((created_brands++))
    else
      echo "❌ Error creating brand: $brand_name"
      echo "   Response: $(echo "$response" | jq -c '.')"
      ((failed_brands++))
    fi
  fi
done

echo ""
echo "📈 Brand Import Summary:"
echo "   ✅ Created: $created_brands brands"
echo "   ⏭️  Skipped: $skipped_brands brands (already existed)"
echo "   ❌ Failed: $failed_brands brands"
echo ""

echo "--- Phase 2: Importing Models ---"
echo ""

# Count total models
total_models=0
for brand_name in "${brand_names[@]}"; do
  model_count=$(jq -r ".[\"$brand_name\"] | length" "$DATA_FILE")
  ((total_models += model_count))
done

echo "📊 Found $total_models models across $brands_to_process brands"
echo ""

# Fetch existing models
echo "📥 Fetching existing models (this may take multiple requests)..."
declare -A existing_model_slugs
page=1
total_pages=1

while (( page <= total_pages )); do
  if (( page == 1 )); then
    existing_models_json=$(curl -s "$STRAPI_URL/api/models")
  else
    existing_models_json=$(curl -s "$STRAPI_URL/api/models?pagination%5Bpage%5D=$page")
  fi

  if [[ -z "$existing_models_json" ]] || [[ "$existing_models_json" == *"error"* ]]; then
    echo "   ⚠️  Failed to fetch page $page, stopping pagination"
    break
  fi

  # Get total pages from first request
  if (( page == 1 )); then
    total_pages=$(echo "$existing_models_json" | jq -r '.meta.pagination.pageCount // 1')
    echo "   Need to fetch $total_pages page(s)"
  fi

  # Parse models and store their slugs
  while IFS= read -r line; do
    slug=$(echo "$line" | jq -r '.slug')
    existing_model_slugs["$slug"]=1
  done < <(echo "$existing_models_json" | jq -c '.data[]')

  ((page++))
done

echo "   Found ${#existing_model_slugs[@]} existing models"
echo ""

created_models=0
skipped_models=0
failed_models=0
processed_count=0

for brand_name in "${brand_names[@]}"; do
  brand_slug=$(slugify "$brand_name")
  brand_id="${brand_id_map[$brand_slug]}"

  if [[ -z "$brand_id" ]]; then
    echo "⚠️  Brand ID not found for \"$brand_name\" ($brand_slug), skipping models"
    model_count=$(jq -r ".[\"$brand_name\"] | length" "$DATA_FILE")
    ((failed_models += model_count))
    continue
  fi

  # Get models for this brand
  models=($(jq -r ".[\"$brand_name\"][]" "$DATA_FILE"))

  for model_name in "${models[@]}"; do
    model_slug=$(slugify "$model_name")

    if [[ -n "${existing_model_slugs[$model_slug]}" ]]; then
      ((skipped_models++))
    else
      # Create model
      response=$(curl -s -X POST "$STRAPI_URL/api/models" \
        -H "Content-Type: application/json" \
        -d "{\"data\":{\"name\":\"$model_name\",\"slug\":\"$model_slug\",\"brand\":$brand_id,\"isActive\":true}}")

      if echo "$response" | jq -e '.data.id' > /dev/null 2>&1; then
        existing_model_slugs["$model_slug"]=1
        ((created_models++))
      else
        echo "❌ Error creating model: $model_name → $brand_name"
        ((failed_models++))
      fi
    fi

    ((processed_count++))

    # Progress logging every 100 models
    if (( processed_count % 100 == 0 )); then
      echo "📊 Progress: $processed_count/$total_models models processed..."
    fi
  done
done

echo ""
echo "📈 Model Import Summary:"
echo "   ✅ Created: $created_models models"
echo "   ⏭️  Skipped: $skipped_models models (already existed)"
echo "   ❌ Failed: $failed_models models"
echo ""

echo "🎉 Import completed successfully!"
echo ""
echo "📊 Final Summary:"
echo "   Brands - Created: $created_brands, Skipped: $skipped_brands, Failed: $failed_brands"
echo "   Models - Created: $created_models, Skipped: $skipped_models, Failed: $failed_models"

if $TEST_MODE; then
  echo ""
  echo "💡 Test mode completed - run without --test flag to import all data"
fi
