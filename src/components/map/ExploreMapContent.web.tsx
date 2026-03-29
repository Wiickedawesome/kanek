import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM, BELIZE_BOUNDS } from '@/lib/mapbox';

// Inject mapbox-gl CSS
if (typeof document !== 'undefined') {
  const linkId = 'mapbox-gl-css';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://api.mapbox.com/mapbox-gl-js/v${mapboxgl.version}/mapbox-gl.css`;
    document.head.appendChild(link);
  }
}

interface GeoPoint {
  id: string;
  lng: number;
  lat: number;
  color: string;
  label?: string;
}

export interface ExploreMapContentProps {
  posts: GeoPoint[];
  reports: GeoPoint[];
  gasStations: GeoPoint[];
  onPinPress?: (id: string) => void;
  onRecenterRef?: React.MutableRefObject<(() => void) | null>;
}

export function ExploreMapContent({
  posts,
  reports,
  gasStations,
  onPinPress,
  onRecenterRef,
}: ExploreMapContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onPinPressRef = useRef(onPinPress);
  onPinPressRef.current = onPinPress;

  const postsGeoJson = useMemo(() => toFeatureCollection(posts), [posts]);
  const reportsGeoJson = useMemo(() => toFeatureCollection(reports), [reports]);
  const gasGeoJson = useMemo(() => toFeatureCollection(gasStations), [gasStations]);

  const recenter = useCallback(() => {
    mapRef.current?.flyTo({
      center: [BELIZE_CENTER.longitude, BELIZE_CENTER.latitude],
      zoom: BELIZE_ZOOM,
      duration: 600,
    });
  }, []);

  // Expose recenter to parent
  useEffect(() => {
    if (onRecenterRef) onRecenterRef.current = recenter;
  }, [onRecenterRef, recenter]);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [BELIZE_CENTER.longitude, BELIZE_CENTER.latitude],
      zoom: BELIZE_ZOOM,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: [
        [BELIZE_BOUNDS.west - 0.5, BELIZE_BOUNDS.south - 0.5],
        [BELIZE_BOUNDS.east + 0.5, BELIZE_BOUNDS.north + 0.5],
      ],
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Posts layer (clustered)
      map.addSource('posts', {
        type: 'geojson',
        data: postsGeoJson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: 'posts-clusters',
        type: 'circle',
        source: 'posts',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 50, 32],
          'circle-color': '#2e7d32',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'posts-cluster-count',
        type: 'symbol',
        source: 'posts',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 13,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'posts-circles',
        type: 'circle',
        source: 'posts',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Reports layer (clustered)
      map.addSource('road-reports', {
        type: 'geojson',
        data: reportsGeoJson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: 'road-reports-clusters',
        type: 'circle',
        source: 'road-reports',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-color': '#d32f2f',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'road-reports-cluster-count',
        type: 'symbol',
        source: 'road-reports',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'road-reports-circles',
        type: 'circle',
        source: 'road-reports',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Gas stations layer (clustered)
      map.addSource('gas-prices', {
        type: 'geojson',
        data: gasGeoJson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: 'gas-prices-clusters',
        type: 'circle',
        source: 'gas-prices',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 16, 10, 22, 50, 28],
          'circle-color': '#2e7d32',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });
      map.addLayer({
        id: 'gas-prices-cluster-count',
        type: 'symbol',
        source: 'gas-prices',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });
      map.addLayer({
        id: 'gas-prices-circles',
        type: 'circle',
        source: 'gas-prices',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Click cluster to zoom in
      for (const layerId of ['posts-clusters', 'road-reports-clusters', 'gas-prices-clusters']) {
        map.on('click', layerId, (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const sourceId = (map.getLayer(layerId) as any)?.source as string;
          const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource;
          const clusterId = feature.properties?.cluster_id;
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return;
            map.easeTo({
              center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom,
            });
          });
        });
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }

      // Click handler for individual post pins
      map.on('click', 'posts-circles', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onPinPressRef.current?.(id);
      });

      // Cursor for clickable layers
      map.on('mouseenter', 'posts-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'posts-circles', () => { map.getCanvas().style.cursor = ''; });
    });

    mapRef.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sources when data changes
  useEffect(() => {
    const src = mapRef.current?.getSource('posts') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(postsGeoJson);
  }, [postsGeoJson]);

  useEffect(() => {
    const src = mapRef.current?.getSource('road-reports') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(reportsGeoJson);
  }, [reportsGeoJson]);

  useEffect(() => {
    const src = mapRef.current?.getSource('gas-prices') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(gasGeoJson);
  }, [gasGeoJson]);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
}

function toFeatureCollection(points: GeoPoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: { id: p.id, color: p.color, label: p.label ?? '' },
    })),
  };
}
