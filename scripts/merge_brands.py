#!/usr/bin/env python3
import json
import os

# File paths
brands_file = 'json_data/brands.json'
exide_brands_file = 'json_data/exide-brands.json'
output_file = 'json_data/all-brands-unique.json'

# Create json_data directory if it doesn't exist
os.makedirs('json_data', exist_ok=True)

print("Reading brands.json...")
with open(brands_file, 'r', encoding='utf-8') as f:
    brands_data = json.load(f)

print("Reading exide-brands.json...")
with open(exide_brands_file, 'r', encoding='utf-8') as f:
    exide_brands_data = json.load(f)

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

# Extract brand names from brands.json (objects with "name" field)
brands_from_api = set()
if isinstance(brands_data.get('data'), list):
    for brand in brands_data['data']:
        if isinstance(brand, dict) and 'name' in brand:
            cleaned = clean_brand_name(brand['name'])
            if cleaned:
                brands_from_api.add(cleaned)
        elif isinstance(brand, str):
            cleaned = clean_brand_name(brand)
            if cleaned:
                brands_from_api.add(cleaned)

# Extract brand names from exide-brands.json (simple strings)
exide_brands = set()
if isinstance(exide_brands_data.get('data'), list):
    for brand in exide_brands_data['data']:
        if isinstance(brand, str):
            cleaned = clean_brand_name(brand)
            if cleaned:
                exide_brands.add(cleaned)

print(f"\nBrands from API: {len(brands_from_api)}")
print(f"Brands from Exide: {len(exide_brands)}")

# Combine both sets (automatically removes duplicates)
all_unique_brands = brands_from_api.union(exide_brands)

# Convert to sorted list
all_unique_brands_list = sorted(list(all_unique_brands))

print(f"Total unique brands: {len(all_unique_brands_list)}")

# Find brands only in API
only_in_api = brands_from_api - exide_brands
print(f"Brands only in API: {len(only_in_api)}")

# Find brands only in Exide
only_in_exide = exide_brands - brands_from_api
print(f"Brands only in Exide: {len(only_in_exide)}")

# Find common brands
common_brands = brands_from_api.intersection(exide_brands)
print(f"Common brands: {len(common_brands)}")

# Create output structure
output = {
    "data": all_unique_brands_list,
    "meta": {
        "total": len(all_unique_brands_list),
        "from_api": len(brands_from_api),
        "from_exide": len(exide_brands),
        "common": len(common_brands),
        "only_in_api": len(only_in_api),
        "only_in_exide": len(only_in_exide)
    }
}

# Save to JSON file
print(f"\nSaving {len(all_unique_brands_list)} unique brands to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully created {output_file}")
print(f"\nFirst 10 brands: {all_unique_brands_list[:10]}")
print(f"Last 10 brands: {all_unique_brands_list[-10:]}")

