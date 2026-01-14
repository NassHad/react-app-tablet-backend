#!/usr/bin/env python3
import json
import os
import re
import unicodedata
from collections import defaultdict

# File paths
script_dir = os.path.dirname(os.path.abspath(__file__))
exide_vehicles_file = os.path.join(script_dir, 'liste_affectation', 'exide-vehicles.json')
output_file = os.path.join(script_dir, 'json_data', 'exide-battery-products.json')

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

def convert_date(date_str):
    """Convert YYYYMM format to YYYY-MM-01 format"""
    if not date_str or not isinstance(date_str, str) or len(date_str) != 6:
        return ""
    
    try:
        year = date_str[:4]
        month = date_str[4:6]
        # Validate month is between 01-12
        if int(month) < 1 or int(month) > 12:
            return ""
        return f"{year}-{month}-01"
    except (ValueError, IndexError):
        return ""

def extract_battery_options(battery_obj):
    """Extract battery options from battery object"""
    if not battery_obj or not isinstance(battery_obj, dict):
        return {"option1": "", "option2": "", "option3": ""}
    
    return {
        "option1": battery_obj.get("option1", "") or "",
        "option2": battery_obj.get("option2", "") or "",
        "option3": battery_obj.get("option3", "") or ""
    }

def clean_motorisation_name(name):
    """Remove parentheses and their contents from motorisation name"""
    if not isinstance(name, str):
        return ""
    # Remove everything in parentheses including the parentheses
    # First try to match complete parentheses pairs
    cleaned = re.sub(r'\s*\([^)]*\)', '', name)
    # If there's still an opening parenthesis (unclosed), remove everything from it to the end
    if '(' in cleaned:
        cleaned = cleaned[:cleaned.index('(')].strip()
    return cleaned.strip()

def clean_model_name(name):
    """Remove parentheses and their contents from model name"""
    if not isinstance(name, str):
        return ""
    # Remove everything in parentheses including the parentheses
    # First try to match complete parentheses pairs
    cleaned = re.sub(r'\s*\([^)]*\)', '', name)
    # If there's still an opening parenthesis (unclosed), remove everything from it to the end
    if '(' in cleaned:
        cleaned = cleaned[:cleaned.index('(')].strip()
    return cleaned.strip()

def motorisations_are_equal(m1, m2):
    """Check if two motorisations are equal (dates and battery options match)"""
    # Compare cleaned motorisation names
    if clean_motorisation_name(m1.get('motorisation', '')) != clean_motorisation_name(m2.get('motorisation', '')):
        return False
    
    # Compare dates
    if m1.get('startDate') != m2.get('startDate'):
        return False
    if m1.get('endDate') != m2.get('endDate'):
        return False
    
    # Compare fuel (should also match)
    if m1.get('fuel') != m2.get('fuel'):
        return False
    
    # Compare all battery options
    battery_keys = ['batteryAGM', 'batteryEFB', 'batteryPremium', 'batteryExcell', 'batteryClassic']
    for key in battery_keys:
        b1 = m1.get(key, {})
        b2 = m2.get(key, {})
        if (b1.get('option1') != b2.get('option1') or
            b1.get('option2') != b2.get('option2') or
            b1.get('option3') != b2.get('option3')):
            return False
    
    return True

print("Reading exide-vehicles.json...")
with open(exide_vehicles_file, 'r', encoding='utf-8') as f:
    exide_data = json.load(f)

vehicles = exide_data.get('vehicles', [])
print(f"Found {len(vehicles)} vehicles to process")

# Group vehicles by brand+model
grouped_vehicles = defaultdict(list)

for vehicle in vehicles:
    make = vehicle.get('make', '').strip()
    model = vehicle.get('model', '').strip()
    
    if not make or not model:
        continue
    
    # Use brand+model as key for grouping
    key = f"{make}|||{model}"
    grouped_vehicles[key].append(vehicle)

print(f"Grouped into {len(grouped_vehicles)} brand+model combinations")

# Transform grouped vehicles into battery products format
battery_products = []

for key, vehicle_list in grouped_vehicles.items():
    # Extract brand and model from key
    make, model = key.split('|||')
    
    brand = make
    brand_slug = slugify(brand)
    model_name = model
    model_slug = slugify(model_name)
    
    # Collect motorisations
    motorisations_raw = []
    
    for vehicle in vehicle_list:
        motorisation_type = vehicle.get('type', '').strip()
        fuel_type = vehicle.get('fuelType', '').strip()
        date_from = vehicle.get('dateFrom', '')
        date_to = vehicle.get('dateTo', '')
        batteries = vehicle.get('batteries', {})
        
        # Convert dates
        start_date = convert_date(date_from)
        end_date = convert_date(date_to) if date_to else ""
        
        # Extract battery options
        battery_agm = extract_battery_options(batteries.get('agm', {}))
        battery_efb = extract_battery_options(batteries.get('efb', {}))
        battery_premium = extract_battery_options(batteries.get('premium', {}))
        battery_excell = extract_battery_options(batteries.get('excell', {}))
        battery_classic = extract_battery_options(batteries.get('classic', {}))
        
        # Create motorisation object
        motorisation = {
            "motorisation": motorisation_type,
            "fuel": fuel_type,
            "startDate": start_date,
            "endDate": end_date,
            "batteryAGM": battery_agm,
            "batteryEFB": battery_efb,
            "batteryPremium": battery_premium,
            "batteryExcell": battery_excell,
            "batteryClassic": battery_classic
        }
        
        motorisations_raw.append(motorisation)
    
    # Clean motorisation names and merge duplicates
    motorisations = []
    seen_motorisations = []
    
    for motorisation in motorisations_raw:
        # Clean the motorisation name
        cleaned_name = clean_motorisation_name(motorisation.get('motorisation', ''))
        
        # Create cleaned motorisation object
        cleaned_motorisation = motorisation.copy()
        cleaned_motorisation['motorisation'] = cleaned_name
        
        # Check if we've already seen an identical motorisation
        is_duplicate = False
        for seen in seen_motorisations:
            if motorisations_are_equal(cleaned_motorisation, seen):
                is_duplicate = True
                break
        
        # If not a duplicate, add it
        if not is_duplicate:
            motorisations.append(cleaned_motorisation)
            seen_motorisations.append(cleaned_motorisation)
    
    # Create battery product object
    battery_product = {
        "brand": brand,
        "brandSlug": brand_slug,
        "model": model_name,
        "modelSlug": model_slug,
        "motorisations": motorisations
    }
    
    battery_products.append(battery_product)

print(f"\nTransformed {len(battery_products)} battery products")
print(f"Total motorisations: {sum(len(p['motorisations']) for p in battery_products)}")

# Merge products with same brand and cleaned model name
print("\nMerging products with same brand and cleaned model name...")
merged_products_map = defaultdict(list)

# Group products by brand + cleaned_model_name
for product in battery_products:
    brand = product['brand']
    model = product['model']
    cleaned_model = clean_model_name(model)
    merge_key = f"{brand}|||{cleaned_model}"
    merged_products_map[merge_key].append(product)

print(f"Found {len(merged_products_map)} unique brand+cleaned_model combinations")

# Merge products within each group
merged_battery_products = []

for merge_key, products_to_merge in merged_products_map.items():
    brand, cleaned_model = merge_key.split('|||')
    
    # If only one product, use it as-is but update model name and slug
    if len(products_to_merge) == 1:
        product = products_to_merge[0]
        product['model'] = cleaned_model
        product['modelSlug'] = slugify(cleaned_model)
        merged_battery_products.append(product)
    else:
        # Merge multiple products
        # Use the first product as base
        merged_product = products_to_merge[0].copy()
        merged_product['model'] = cleaned_model
        merged_product['modelSlug'] = slugify(cleaned_model)
        
        # Combine all motorisations from all products
        all_motorisations = []
        for product in products_to_merge:
            all_motorisations.extend(product['motorisations'])
        
        # Deduplicate motorisations
        merged_motorisations = []
        seen_motorisations = []
        
        for motorisation in all_motorisations:
            # Check if we've already seen an identical motorisation
            is_duplicate = False
            for seen in seen_motorisations:
                if motorisations_are_equal(motorisation, seen):
                    is_duplicate = True
                    break
            
            # If not a duplicate, add it
            if not is_duplicate:
                merged_motorisations.append(motorisation)
                seen_motorisations.append(motorisation)
        
        merged_product['motorisations'] = merged_motorisations
        merged_battery_products.append(merged_product)

print(f"Merged into {len(merged_battery_products)} battery products")
print(f"Total motorisations: {sum(len(p['motorisations']) for p in merged_battery_products)}")

# Replace battery_products with merged products
battery_products = merged_battery_products

# Save to JSON file
print(f"\nSaving to {output_file}...")
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(battery_products, f, indent=2, ensure_ascii=False)

print(f"Successfully created {output_file}")

# Show summary
if battery_products:
    print(f"\nSummary:")
    print(f"  Total products: {len(battery_products)}")
    print(f"  Total motorisations: {sum(len(p['motorisations']) for p in battery_products)}")
    
    # Show first product as example
    print(f"\nFirst product example:")
    first_product = battery_products[0]
    print(f"  Brand: {first_product['brand']} ({first_product['brandSlug']})")
    print(f"  Model: {first_product['model']} ({first_product['modelSlug']})")
    print(f"  Motorisations: {len(first_product['motorisations'])}")
    if first_product['motorisations']:
        print(f"  First motorisation: {first_product['motorisations'][0]['motorisation']}")

