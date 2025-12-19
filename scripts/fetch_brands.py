#!/usr/bin/env python3
import requests
import json

all_brands = []
page = 1
page_size = 25

while True:
    url = f"http://localhost:1338/api/brands?pagination[page]={page}&pagination[pageSize]={page_size}"
    print(f"Fetching page {page}...")
    
    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        
        all_brands.extend(data.get('data', []))
        
        pagination = data.get('meta', {}).get('pagination', {})
        current_page = pagination.get('page', page)
        page_count = pagination.get('pageCount', 1)
        
        print(f"Page {current_page}/{page_count}, Total brands so far: {len(all_brands)}")
        
        if current_page >= page_count:
            break
            
        page += 1
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching page {page}: {e}")
        break

# Save to JSON file
output = {
    "data": all_brands,
    "meta": {
        "total": len(all_brands)
    }
}

with open('brands.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, indent=2, ensure_ascii=False)

print(f"\nSuccessfully saved {len(all_brands)} brands to brands.json")

