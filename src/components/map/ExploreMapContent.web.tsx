import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_ACCESS_TOKEN, BELIZE_CENTER, BELIZE_ZOOM, BELIZE_BOUNDS } from '@/lib/mapbox';
import { DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
import { getDistrictBoundariesGeoJSON } from '@/lib/belizeDistricts';
import type { BelizeDistrict } from '@/types/database';

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
  onGasPress?: (id: string) => void;
  onRecenterRef?: React.MutableRefObject<(() => void) | null>;
  onFlyToRef?: React.MutableRefObject<((lat: number, lng: number, zoom?: number) => void) | null>;
  initialCenter?: { latitude: number; longitude: number };
  initialZoom?: number;
  showUserLocation?: boolean;
  highlightDistrict?: BelizeDistrict | null;
  compassTopOffset?: number;
}

export function ExploreMapContent({
  posts,
  reports,
  gasStations,
  onPinPress,
  onGasPress,
  onRecenterRef,
  onFlyToRef,
  initialCenter,
  initialZoom,
  showUserLocation = false,
  highlightDistrict,
  compassTopOffset = 64,
}: ExploreMapContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onPinPressRef = useRef(onPinPress);
  onPinPressRef.current = onPinPress;
  const onGasPressRef = useRef(onGasPress);
  onGasPressRef.current = onGasPress;

  // Capture initial values in refs so map init effect runs only once
  const initialCenterRef = useRef(initialCenter);
  const initialZoomRef = useRef(initialZoom);

  const postsGeoJson = useMemo(() => toFeatureCollection(posts), [posts]);
  const reportsGeoJson = useMemo(() => toFeatureCollection(reports), [reports]);
  const gasGeoJson = useMemo(() => toFeatureCollection(gasStations), [gasStations]);

  const districtGeoJSON = useMemo(() => getDistrictBoundariesGeoJSON(highlightDistrict), [highlightDistrict]);

  const recenter = useCallback(() => {
    const c = initialCenterRef.current ?? BELIZE_CENTER;
    const z = initialZoomRef.current ?? BELIZE_ZOOM;
    mapRef.current?.flyTo({ center: [c.longitude, c.latitude], zoom: z, duration: 600 });
  }, []);

  // Expose recenter to parent
  useEffect(() => {
    if (onRecenterRef) onRecenterRef.current = recenter;
  }, [onRecenterRef, recenter]);

  // Expose flyTo to parent (for search-to-location)
  useEffect(() => {
    if (onFlyToRef) {
      onFlyToRef.current = (lat: number, lng: number, flyZoom?: number) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom: flyZoom ?? 14, duration: 800 });
      };
    }
  }, [onFlyToRef]);

  // Fly to initialCenter whenever it changes after mount (profile data loaded late)
  useEffect(() => {
    if (!mapRef.current || !initialCenter) return;
    initialCenterRef.current = initialCenter;
    initialZoomRef.current = initialZoom;
    mapRef.current.flyTo({
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: initialZoom ?? DEFAULT_NEARBY_ZOOM,
      duration: 600,
    });
  }, [initialCenter?.latitude, initialCenter?.longitude, initialZoom]);

  // Push NavigationControl below the header overlay
  useEffect(() => {
    const ctrl = containerRef.current?.querySelector('.mapboxgl-ctrl-top-right') as HTMLElement | null;
    if (ctrl) ctrl.style.top = `${compassTopOffset}px`;
  }, [compassTopOffset]);

  // Update district highlight layer when highlightDistrict changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('districts') as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(districtGeoJSON);
  }, [districtGeoJSON]);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const center = initialCenterRef.current ?? BELIZE_CENTER;
    const zoom = initialZoomRef.current ?? BELIZE_ZOOM;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [center.longitude, center.latitude],
      zoom,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: [
        [BELIZE_BOUNDS.west - 0.5, BELIZE_BOUNDS.south - 0.5],
        [BELIZE_BOUNDS.east + 0.5, BELIZE_BOUNDS.north + 0.5],
      ],
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    // Push nav control below header immediately after adding
    const navCtrl = containerRef.current.querySelector('.mapboxgl-ctrl-top-right') as HTMLElement | null;
    if (navCtrl) navCtrl.style.top = `${compassTopOffset}px`;

    if (showUserLocation) {
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
      }), 'top-right');
    }

    map.on('load', () => {
      // District boundary overlay
      map.addSource('districts', { type: 'geojson', data: districtGeoJSON });
      map.addLayer({
        id: 'districts-fill',
        type: 'fill',
        source: 'districts',
        paint: {
          'fill-color': ['case', ['==', ['get', 'highlighted'], true], 'rgba(81,193,82,0.18)', 'rgba(39,67,18,0.05)'],
          'fill-opacity': 1,
        },
      });
      map.addLayer({
        id: 'districts-border',
        type: 'line',
        source: 'districts',
        paint: {
          'line-color': ['case', ['==', ['get', 'highlighted'], true], 'rgba(81,193,82,0.90)', 'rgba(39,67,18,0.22)'],
          'line-width': ['case', ['==', ['get', 'highlighted'], true], 2, 1],
        },
      });

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
          'circle-color': '#d32f2f',
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

      // Click handler for individual gas pins
      map.on('click', 'gas-prices-circles', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onGasPressRef.current?.(id);
      });

      // Cursor for clickable layers
      map.on('mouseenter', 'posts-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'posts-circles', () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', 'gas-prices-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'gas-prices-circles', () => { map.getCanvas().style.cursor = ''; });
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
