#!/usr/bin/env python3
import json
import os
import requests

# Configuration
STRAPI_URL = os.getenv('STRAPI_URL', 'http://localhost:1338')
API_TOKEN = os.getenv('STRAPI_API_TOKEN', '')

# File paths
script_dir = os.path.dirname(os.path.abspath(__file__))
output_file = os.path.join(script_dir, 'json_data', 'models-without-brand.json')

# Create json_data directory if it doesn't exist
json_data_dir = os.path.join(script_dir, 'json_data')
os.makedirs(json_data_dir, exist_ok=True)

# Headers
headers = {
    'Content-Type': 'application/json'
}
if API_TOKEN:
    headers['Authorization'] = f'Bearer {API_TOKEN}'

print(f"Fetching models from {STRAPI_URL}/api/models...")

all_models = []
page = 1
page_size = 100
has_more = True

while has_more:
    try:
        url = f"{STRAPI_URL}/api/models"
        params = {
            'pagination[page]': page,
            'pagination[pageSize]': page_size,
            'populate': 'brand'  # Populate brand to check if it's null
        }
        
        print(f"Fetching page {page}...")
        response = requests.get(url, params=params, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        
        if 'data' in data and isinstance(data['data'], list):
            models = data['data']
            print(f"  Found {len(models)} models on page {page}")
            
            # Filter models without brand
            models_without_brand = [model for model in models if not model.get('brand')]
            all_models.extend(models_without_brand)
            
            if models_without_brand:
                print(f"  Found {len(models_without_brand)} models without brand on this page")
            
            # Check pagination
            if 'meta' in data and 'pagination' in data['meta']:
                pagination = data['meta']['pagination']
                current_page = pagination.get('page', page)
                page_count = pagination.get('pageCount', 1)
                
                print(f"  Page {current_page}/{page_count}")
                
                if current_page >= page_count:
                    has_more = False
                else:
                    page += 1
            else:
                # No pagination info, assume single page
                has_more = False
        else:
            print("  No data found or unexpected format")
            has_more = False
            
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {page}: {e}")
        has_more = False
    except Exception as e:
        print(f"Unexpected error: {e}")
        has_more = False

print(f"\nTotal models without brand: {len(all_models)}")

# Prepare output
output_data = {
    "data": all_models,
    "meta": {
        "total": len(all_models),
        "description": "Models that don't have a brand assigned"
    }
}

# Save to JSON file
print(f"\nSaving to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

print(f"Successfully saved {len(all_models)} models without brand to {output_file}")

# Show summary
if all_models:
    print(f"\nSummary:")
    print(f"  Total models without brand: {len(all_models)}")
    print(f"\nSample models (first 5):")
    for i, model in enumerate(all_models[:5], 1):
        print(f"  {i}. {model.get('name', 'N/A')} (ID: {model.get('id', 'N/A')}, Slug: {model.get('slug', 'N/A')})")
else:
    print("\nNo models without brand found!")

