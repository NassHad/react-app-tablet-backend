#!/usr/bin/env python3
import json
import os
import re
import unicodedata

# File paths (relative to scripts directory)
script_dir = os.path.dirname(os.path.abspath(__file__))
exide_vehicles_file = os.path.join(script_dir, 'liste_affectation', 'exide-vehicles-by-brand.json')
strapi_models_file = os.path.join(script_dir, 'json_data', 'models.json')
output_file = os.path.join(script_dir, 'json_data', 'missing-models-by-brand.json')

# Create json_data directory if it doesn't exist
json_data_dir = os.path.join(script_dir, 'json_data')
os.makedirs(json_data_dir, exist_ok=True)

# Slugify function to match Strapi's slug generation
def slugify(text):
    """Convert text to slug format matching Strapi's slugify"""
    if not isinstance(text, str):
        return ""
    
    # Normalize unicode characters
    text = unicodedata.normalize('NFKD', text)
    
    # Convert to lowercase
    text = text.lower()
    
    # Replace & with ' and '
    text = text.replace('&', ' and ')
    
    # Replace non-alphanumeric characters with hyphens
    text = re.sub(r'[^a-z0-9]+', '-', text)
    
    # Remove leading/trailing hyphens
    text = text.strip('-')
    
    return text

# Helper function to clean model names
def clean_model_name(name):
    if not isinstance(name, str):
        return None
    name = name.strip()
    if not name:
        return None
    return name

print("Reading exide-vehicles-by-brand.json (Exide data)...")
with open(exide_vehicles_file, 'r', encoding='utf-8') as f:
    exide_data = json.load(f)

print("Reading models.json (Strapi database)...")
with open(strapi_models_file, 'r', encoding='utf-8') as f:
    strapi_data = json.load(f)

# Extract all existing model names and slugs from Strapi
strapi_models = set()
strapi_model_slugs = set()

if isinstance(strapi_data.get('data'), list):
    for model in strapi_data['data']:
        if isinstance(model, dict):
            # Add model name
            if 'name' in model:
                cleaned = clean_model_name(model['name'])
                if cleaned:
                    strapi_models.add(cleaned)
            # Add model slug
            if 'slug' in model:
                slug = model['slug']
                if slug:
                    strapi_model_slugs.add(slug.lower())

print(f"Found {len(strapi_models)} models in Strapi database")
print(f"Found {len(strapi_model_slugs)} model slugs in Strapi database")

# Find missing models grouped by brand
missing_models_by_brand = {}
total_missing = 0
brands_with_missing = 0

print("\nComparing models by brand...")
for brand_name, exide_models in exide_data.items():
    if not isinstance(exide_models, list):
        continue
    
    missing_models = []
    
    for model_name in exide_models:
        cleaned_name = clean_model_name(model_name)
        if not cleaned_name:
            continue
        
        # Check if model exists by name or slug
        model_slug = slugify(cleaned_name)
        model_exists = (
            cleaned_name in strapi_models or 
            model_slug.lower() in strapi_model_slugs
        )
        
        if not model_exists:
            missing_models.append(cleaned_name)
    
    if missing_models:
        missing_models_by_brand[brand_name] = missing_models
        total_missing += len(missing_models)
        brands_with_missing += 1

print(f"\nFound {total_missing} missing models across {brands_with_missing} brands")

# Save to JSON file (without metadata, just the object)
print(f"\nSaving missing models to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(missing_models_by_brand, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully created {output_file}")

# Show summary
if missing_models_by_brand:
    print(f"\nSummary:")
    print(f"  Total brands with missing models: {brands_with_missing}")
    print(f"  Total missing models: {total_missing}")
    
    # Show first few brands with missing models
    print(f"\nFirst 10 brands with missing models:")
    for i, (brand, models) in enumerate(list(missing_models_by_brand.items())[:10], 1):
        print(f"  {i}. {brand}: {len(models)} missing models")
        if models:
            print(f"     Examples: {', '.join(models[:3])}")
    
    if len(missing_models_by_brand) > 10:
        print(f"  ... and {len(missing_models_by_brand) - 10} more brands")

