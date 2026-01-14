#!/usr/bin/env python3
import requests
import json
import os

all_models = []
page = 1
page_size = 25

# Create json_data directory if it doesn't exist
os.makedirs('json_data', exist_ok=True)

while True:
    url = f"http://localhost:1338/api/models?pagination[page]={page}&pagination[pageSize]={page_size}"
    print(f"Fetching page {page}...")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        all_models.extend(data.get('data', []))
        
        pagination = data.get('meta', {}).get('pagination', {})
        current_page = pagination.get('page', page)
        page_count = pagination.get('pageCount', 1)
        
        print(f"Page {current_page}/{page_count}, Total models so far: {len(all_models)}")
        
        if current_page >= page_count:
            break
            
        page += 1
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {page}: {e}")
        break

# Save to JSON file
output = {
    "data": all_models,
    "meta": {
        "total": len(all_models)
    }
}

output_path = 'json_data/models.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully saved {len(all_models)} models to {output_path}")

