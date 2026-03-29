import React, { useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { MAPBOX_ACCESS_TOKEN, BELIZE_BOUNDS } from '@/lib/mapbox';

// Inject mapbox-gl CSS on first load
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

interface MapPickerContentProps {
  initialCenter: { latitude: number; longitude: number };
  onCenterChange: (coords: { latitude: number; longitude: number }) => void;
}

export function MapPickerContent({ initialCenter, onCenterChange }: MapPickerContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;

  useEffect(() => {
    if (!containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: 14,
      minZoom: 6,
      maxZoom: 18,
      maxBounds: [
        [BELIZE_BOUNDS.west - 0.5, BELIZE_BOUNDS.south - 0.5],
        [BELIZE_BOUNDS.east + 0.5, BELIZE_BOUNDS.north + 0.5],
      ],
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
    );

    map.on('moveend', () => {
      const center = map.getCenter();
      onCenterChangeRef.current({ latitude: center.lat, longitude: center.lng });
    });

    mapRef.current = map;
    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, width: '100%', height: '100%' }}
    />
  );
}
