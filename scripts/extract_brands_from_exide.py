#!/usr/bin/env python3
import json
import os

# Read the JSON file
input_file = 'liste_affectation/exide-vehicles-by-brand.json'
output_file = 'json_data/exide-brands.json'

# Create json_data directory if it doesn't exist
os.makedirs('json_data', exist_ok=True)

print(f"Reading {input_file}...")
with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract all brand names (keys)
brands = list(data.keys())

# Sort brands alphabetically
brands.sort()

# Create output structure
output = {
    "data": brands,
    "meta": {
        "total": len(brands),
        "source": "exide-vehicles-by-brand.json"
    }
}

# Save to JSON file
print(f"Saving {len(brands)} brands to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully extracted {len(brands)} brands:")
print(f"First 10 brands: {brands[:10]}")
print(f"Last 10 brands: {brands[-10:]}")

