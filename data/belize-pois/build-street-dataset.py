#!/usr/bin/env python3
"""
Extract named streets/roads from Belize OSM PBF and merge them into the
POI dataset for local address search.

Pipeline:
  1. osmium tags-filter → extract highway ways
  2. ogr2ogr → convert to GeoJSON lines
  3. Compute midpoints, dedup by name+~1km grid
  4. Merge with existing POI dataset
  5. Write combined output to src/data/belize-pois.json

Prerequisites: osmium-tool, gdal (ogr2ogr), python3
"""

import json
import os
import subprocess
import sys
import tempfile
from collections import Counter

# Highway types to extract (named roads + streets, skip tracks/paths/service)
HIGHWAY_TYPES = [
    'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
    'residential', 'unclassified', 'living_street', 'pedestrian',
]

# Human-friendly labels for street category display
HIGHWAY_LABELS = {
    'motorway': 'highway',
    'trunk': 'highway',
    'primary': 'main road',
    'secondary': 'road',
    'tertiary': 'road',
    'residential': 'street',
    'unclassified': 'road',
    'living_street': 'street',
    'pedestrian': 'street',
}

# Belize bounding box
BELIZE_BBOX = {
    'south': 15.889, 'north': 18.497,
    'west': -89.225, 'east': -87.485,
}

# Rough district assignment by lat/lng
DISTRICTS = [
    ('Corozal',    18.15, 18.50, -88.60, -87.80),
    ('Orange Walk', 17.70, 18.30, -89.10, -88.30),
    ('Belize',     17.30, 17.80, -88.60, -87.90),
    ('Cayo',       16.70, 17.40, -89.23, -88.40),
    ('Stann Creek', 16.50, 17.10, -88.80, -88.10),
    ('Toledo',      15.88, 16.60, -89.23, -88.30),
]


def get_district(lat, lng):
    """Rough district assignment based on coordinates."""
    for name, s, n, w, e in DISTRICTS:
        if s <= lat <= n and w <= lng <= e:
            return name
    return ''


def extract_streets(pbf_path, tmp_dir):
    """Extract named street ways from PBF → GeoJSON."""
    osm_path = os.path.join(tmp_dir, 'streets.osm')
    geojson_path = os.path.join(tmp_dir, 'streets.geojson')

    hw_filter = ','.join(f'highway={t}' for t in HIGHWAY_TYPES)

    print(f'Extracting highway ways from {pbf_path}...')
    subprocess.run([
        'osmium', 'tags-filter', pbf_path,
        f'w/{hw_filter.replace(",", " w/")}',
        '-f', 'osm', '-o', osm_path, '--overwrite',
    ], check=True)

    # Actually osmium tags-filter takes multiple args, not comma-separated
    # Let me fix the command
    filter_args = [f'w/highway={t}' for t in HIGHWAY_TYPES]

    subprocess.run(
        ['osmium', 'tags-filter', pbf_path] + filter_args +
        ['-f', 'osm', '-o', osm_path, '--overwrite'],
        check=True,
    )

    print('Converting to GeoJSON...')
    subprocess.run([
        'ogr2ogr', '-f', 'GeoJSON', geojson_path,
        osm_path, 'lines',
        '-where', 'name IS NOT NULL',
    ], check=True)

    with open(geojson_path) as f:
        data = json.load(f)

    return data['features']


def process_streets(features):
    """Convert street features to compact POI-like entries."""
    unique = {}

    for feat in features:
        props = feat.get('properties', {})
        name = (props.get('name') or '').strip()
        if not name:
            continue

        geom = feat.get('geometry', {})
        coords = geom.get('coordinates', [])

        if geom['type'] != 'LineString' or not coords:
            continue

        # Use midpoint of the line
        mid = coords[len(coords) // 2]
        lng, lat = mid[0], mid[1]

        # Belize bbox check
        if not (BELIZE_BBOX['south'] <= lat <= BELIZE_BBOX['north'] and
                BELIZE_BBOX['west'] <= lng <= BELIZE_BBOX['east']):
            continue

        hw_type = props.get('highway', 'road')
        label = HIGHWAY_LABELS.get(hw_type, 'road')
        district = get_district(lat, lng)

        # Dedup by name + ~1km grid (0.01 deg ≈ 1.1km)
        key = (name.lower(), round(lat, 2), round(lng, 2))

        if key not in unique:
            entry = {
                'n': name,
                'c': 'street',
                'lt': round(lat, 6),
                'ln': round(lng, 6),
            }
            # Build address string: "Street Type, District" for context
            addr_parts = [label.title()]
            if district:
                addr_parts.append(district)
            entry['a'] = ', '.join(addr_parts)

            unique[key] = entry

    return list(unique.values())


def main():
    pbf_path = 'belize-latest.osm.pbf'
    poi_path = 'belize-pois.json'
    output_path = '../../src/data/belize-pois.json'

    if not os.path.exists(pbf_path):
        print(f'Error: {pbf_path} not found. Download from Geofabrik first.')
        sys.exit(1)

    # Load existing POIs
    with open(poi_path) as f:
        pois = json.load(f)
    print(f'Existing POIs: {len(pois)}')

    # Extract and process streets
    with tempfile.TemporaryDirectory() as tmp_dir:
        features = extract_streets(pbf_path, tmp_dir)
        print(f'Named street segments: {len(features)}')

        streets = process_streets(features)
        print(f'Street entries (deduped ~1km): {len(streets)}')

    # Merge: POIs first, then streets
    combined = pois + streets

    # Sort by category then name
    combined.sort(key=lambda p: (p['c'], p['n']))

    # Category breakdown
    cats = Counter(p['c'] for p in combined)
    print(f'\nCombined dataset: {len(combined)} entries')
    print('Category breakdown:')
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f'  {cat}: {count}')

    # Write compact JSON
    with open(output_path, 'w') as f:
        json.dump(combined, f, separators=(',', ':'))

    size = os.path.getsize(output_path)
    print(f'\nOutput: {output_path}')
    print(f'Size: {size:,} bytes ({size / 1024:.1f} KB)')

    # Also update the local copy
    with open(poi_path.replace('.json', '-with-streets.json'), 'w') as f:
        json.dump(combined, f, separators=(',', ':'))

    # Pretty sample for inspection
    street_sample = [s for s in streets if s.get('c') == 'street'][:10]
    print('\nSample streets:')
    for s in street_sample:
        print(f'  {s["n"]} — {s.get("a", "")} ({s["lt"]}, {s["ln"]})')


if __name__ == '__main__':
    main()
