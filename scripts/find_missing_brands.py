#!/usr/bin/env python3
import json
import os

# File paths
brands_file = 'json_data/brands.json'
exide_brands_file = 'json_data/exide-brands.json'
output_file = 'json_data/missing-brands.json'

# Create json_data directory if it doesn't exist
os.makedirs('json_data', exist_ok=True)

# Helper function to clean brand names
def clean_brand_name(name):
    if not isinstance(name, str):
        return None
    # Remove BOM and other invisible characters
    name = name.strip()
    name = name.replace('\ufeff', '').strip()
    # Filter out invalid entries
    if not name or name.lower() in ['marque', 'brand', '']:
        return None
    return name if name else None

print("Reading brands.json (Strapi database)...")
with open(brands_file, 'r', encoding='utf-8') as f:
    brands_data = json.load(f)

print("Reading exide-brands.json (Exide data)...")
with open(exide_brands_file, 'r', encoding='utf-8') as f:
    exide_brands_data = json.load(f)

# Extract brand names from brands.json (Strapi database)
strapi_brands = set()
if isinstance(brands_data.get('data'), list):
    for brand in brands_data['data']:
        if isinstance(brand, dict) and 'name' in brand:
            cleaned = clean_brand_name(brand['name'])
            if cleaned:
                strapi_brands.add(cleaned)
        elif isinstance(brand, str):
            cleaned = clean_brand_name(brand)
            if cleaned:
                strapi_brands.add(cleaned)

# Extract brand names from exide-brands.json
exide_brands = set()
if isinstance(exide_brands_data.get('data'), list):
    for brand in exide_brands_data['data']:
        if isinstance(brand, str):
            cleaned = clean_brand_name(brand)
            if cleaned:
                exide_brands.add(cleaned)

print(f"\nBrands in Strapi database: {len(strapi_brands)}")
print(f"Brands in Exide data: {len(exide_brands)}")

# Find brands that are in Exide but NOT in Strapi
missing_brands = exide_brands - strapi_brands

# Convert to sorted list
missing_brands_list = sorted(list(missing_brands))

print(f"Brands missing from Strapi: {len(missing_brands_list)}")

# Create output structure
output = {
    "data": missing_brands_list,
    "meta": {
        "total": len(missing_brands_list),
        "total_in_strapi": len(strapi_brands),
        "total_in_exide": len(exide_brands),
        "description": "Brands that exist in Exide data but are missing from Strapi database"
    }
}

# Save to JSON file
print(f"\nSaving {len(missing_brands_list)} missing brands to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully created {output_file}")
print(f"\nFirst 10 missing brands: {missing_brands_list[:10]}")
print(f"Last 10 missing brands: {missing_brands_list[-10:]}")

# Show some examples
if missing_brands_list:
    print(f"\nSample of missing brands:")
    for i, brand in enumerate(missing_brands_list[:20], 1):
        print(f"  {i}. {brand}")
    if len(missing_brands_list) > 20:
        print(f"  ... and {len(missing_brands_list) - 20} more")

