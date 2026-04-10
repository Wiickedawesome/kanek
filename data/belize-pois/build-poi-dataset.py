#!/usr/bin/env python3
"""
Build a clean Belize POI dataset from OSM GeoJSON export.
Produces a compact JSON array for embedding in the mobile app.

Categories map OSM tags to user-friendly types that matter for
ride-share / mobility / errand context.
"""

import json
import sys
from collections import Counter

# Map OSM tag values → app-friendly category
CATEGORY_MAP = {
    # Amenity
    'restaurant': 'restaurant',
    'fast_food': 'restaurant',
    'cafe': 'cafe',
    'bar': 'bar',
    'pub': 'bar',
    'nightclub': 'bar',
    'bank': 'bank',
    'atm': 'bank',
    'pharmacy': 'pharmacy',
    'hospital': 'hospital',
    'clinic': 'hospital',
    'doctors': 'hospital',
    'dentist': 'hospital',
    'school': 'school',
    'college': 'school',
    'university': 'school',
    'kindergarten': 'school',
    'fuel': 'gas_station',
    'bus_station': 'transport',
    'taxi': 'transport',
    'ferry_terminal': 'transport',
    'car_rental': 'transport',
    'police': 'government',
    'fire_station': 'government',
    'post_office': 'government',
    'townhall': 'government',
    'courthouse': 'government',
    'embassy': 'government',
    'library': 'government',
    'community_centre': 'community',
    'place_of_worship': 'worship',
    'marketplace': 'market',
    'car_wash': 'services',
    'veterinary': 'services',
    # Shop
    'supermarket': 'supermarket',
    'convenience': 'store',
    'grocery': 'store',
    'general': 'store',
    'hardware': 'store',
    'clothes': 'store',
    'shoes': 'store',
    'electronics': 'store',
    'mobile_phone': 'store',
    'furniture': 'store',
    'department_store': 'store',
    'variety_store': 'store',
    'bakery': 'food_shop',
    'butcher': 'food_shop',
    'seafood': 'food_shop',
    'greengrocer': 'food_shop',
    'hairdresser': 'services',
    'beauty': 'services',
    'car_repair': 'services',
    'car_parts': 'services',
    'laundry': 'services',
    'dry_cleaning': 'services',
    'travel_agency': 'services',
    'gift': 'store',
    'books': 'store',
    'stationery': 'store',
    # Tourism
    'hotel': 'hotel',
    'guest_house': 'hotel',
    'hostel': 'hotel',
    'motel': 'hotel',
    'resort': 'hotel',
    'attraction': 'attraction',
    'museum': 'attraction',
    'viewpoint': 'attraction',
    'zoo': 'attraction',
    'information': 'attraction',
    # Office
    'government': 'government',
    # Healthcare (separate from amenity)
    # Leisure
    'park': 'park',
    'sports_centre': 'park',
    'stadium': 'park',
    'nature_reserve': 'park',
}

# Tags to scan (in priority order)
TAG_KEYS = ['amenity', 'shop', 'tourism', 'office', 'healthcare', 'leisure']

def get_centroid(geometry):
    """Get centroid for Point or Polygon geometries."""
    gtype = geometry.get('type', '')
    coords = geometry.get('coordinates', [])
    
    if gtype == 'Point':
        return coords[0], coords[1]  # lng, lat
    elif gtype in ('Polygon', 'MultiPolygon'):
        # Compute centroid from first ring
        ring = coords[0] if gtype == 'Polygon' else coords[0][0]
        if not ring:
            return None, None
        lng = sum(c[0] for c in ring) / len(ring)
        lat = sum(c[1] for c in ring) / len(ring)
        return lng, lat
    elif gtype == 'LineString':
        if not coords:
            return None, None
        mid = coords[len(coords) // 2]
        return mid[0], mid[1]
    return None, None

def main():
    with open('belize-pois-raw.geojson', 'r') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    pois = []
    category_counts = Counter()
    skipped_no_name = 0
    skipped_no_cat = 0
    
    for feat in features:
        props = feat.get('properties', {})
        name = (props.get('name') or '').strip()
        
        # Skip unnamed features — they're useless for autocomplete
        if not name:
            skipped_no_name += 1
            continue
        
        # Find category
        category = None
        for key in TAG_KEYS:
            val = props.get(key)
            if val and val in CATEGORY_MAP:
                category = CATEGORY_MAP[val]
                break
        
        # Fall back: if it has a shop=yes or office=yes with a name, still include
        if not category:
            if props.get('shop'):
                category = 'store'
            elif props.get('office'):
                category = 'services'
            elif props.get('healthcare'):
                category = 'hospital'
            else:
                skipped_no_cat += 1
                continue
        
        # Get coordinates
        geom = feat.get('geometry', {})
        lng, lat = get_centroid(geom)
        if lng is None or lat is None:
            continue
        
        # Belize bounding box check
        if not (15.889 <= lat <= 18.497 and -89.225 <= lng <= -87.485):
            continue
        
        # Extract useful secondary info
        addr_street = props.get('addr:street', '')
        addr_city = props.get('addr:city', '')
        phone = props.get('phone', '')
        opening_hours = props.get('opening_hours', '')
        
        # Build address hint
        address_parts = [p for p in [addr_street, addr_city] if p]
        address = ', '.join(address_parts) if address_parts else ''
        
        poi = {
            'n': name,                              # name
            'c': category,                          # category
            'lt': round(lat, 6),                    # latitude
            'ln': round(lng, 6),                    # longitude
        }
        # Optional fields — only include if present to save space
        if address:
            poi['a'] = address
        if phone:
            poi['p'] = phone
        if opening_hours:
            poi['h'] = opening_hours
        
        pois.append(poi)
        category_counts[category] += 1
    
    # Deduplicate by name + coordinates (within ~50m)
    seen = set()
    unique_pois = []
    for poi in pois:
        # Round to ~110m grid for dedup
        key = (poi['n'].lower(), round(poi['lt'], 3), round(poi['ln'], 3))
        if key not in seen:
            seen.add(key)
            unique_pois.append(poi)
    
    # Sort by category then name for better compression
    unique_pois.sort(key=lambda p: (p['c'], p['n']))
    
    print(f'Raw features: {len(features)}')
    print(f'Skipped (no name): {skipped_no_name}')
    print(f'Skipped (no category): {skipped_no_cat}')
    print(f'Before dedup: {len(pois)}')
    print(f'Final POIs: {len(unique_pois)}')
    print(f'\nCategory breakdown:')
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f'  {cat}: {count}')
    
    # Write compact JSON
    with open('belize-pois.json', 'w') as f:
        json.dump(unique_pois, f, separators=(',', ':'))
    
    # Also write pretty version for inspection
    with open('belize-pois-pretty.json', 'w') as f:
        json.dump(unique_pois[:20], f, indent=2)
    
    import os
    size = os.path.getsize('belize-pois.json')
    print(f'\nOutput size: {size:,} bytes ({size/1024:.1f} KB)')

if __name__ == '__main__':
    main()
