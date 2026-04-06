import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, TextInput as RNTextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { MapPickerContent } from './MapPickerContent';
import { Icon } from '@/components/icons';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import { reverseGeocode, BELIZE_CENTER, MAPBOX_ACCESS_TOKEN } from '@/lib/mapbox';
import { BELIZE_BBOX } from '@/lib/constants';
import type { RootState } from '@/store';

interface SearchResult {
  id: string;
  place_name: string;
  lat: number;
  lng: number;
}

interface MapPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }, placeName: string) => void;
  /** If provided, map opens here; otherwise uses GPS or Belize center */
  initialCoords?: { latitude: number; longitude: number } | null;
  title?: string;
}

export function MapPicker({ visible, onClose, onConfirm, initialCoords, title = 'Drop Pin' }: MapPickerProps) {
  const insets = useSafeAreaInsets();
  const userLat = useSelector((s: RootState) => s.location.latitude);
  const userLng = useSelector((s: RootState) => s.location.longitude);

  const defaultCenter = useMemo(
    () =>
      initialCoords ??
      (userLat != null && userLng != null ? { latitude: userLat, longitude: userLng } : null) ??
      { latitude: BELIZE_CENTER.latitude, longitude: BELIZE_CENTER.longitude },
    [initialCoords, userLat, userLng],
  );

  const [center, setCenter] = useState(defaultCenter);
  const [loading, setLoading] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Key to force MapPickerContent to re-render with new center
  const [mapKey, setMapKey] = useState(0);

  // Reset state when modal opens
  const handleShow = useCallback(() => {
    setCenter(defaultCenter);
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, [defaultCenter]);

  const searchPlaces = useCallback(async (text: string) => {
    if (text.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const bbox = `${BELIZE_BBOX.west},${BELIZE_BBOX.south},${BELIZE_BBOX.east},${BELIZE_BBOX.north}`;
      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
        `?access_token=${MAPBOX_ACCESS_TOKEN}&bbox=${bbox}&country=BZ&limit=6` +
        `&types=place,locality,neighborhood,address,poi`;
      const res = await fetch(url);
      const data = await res.json();
      const items: SearchResult[] = (data.features ?? []).map(
        (f: { id: string; place_name: string; center: [number, number] }) => ({
          id: f.id,
          place_name: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
        }),
      );
      setResults(items);
      setShowResults(items.length > 0);
    } catch {
      setResults([]);
      setShowResults(false);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchPlaces(text), 300);
    },
    [searchPlaces],
  );

  const handleSelectResult = useCallback((item: SearchResult) => {
    const newCenter = { latitude: item.lat, longitude: item.lng };
    setCenter(newCenter);
    setQuery(item.place_name);
    setResults([]);
    setShowResults(false);
    // Force MapPickerContent to re-mount with new initialCenter
    setMapKey((k) => k + 1);
  }, []);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const placeName = await reverseGeocode(center.latitude, center.longitude);
      onConfirm(center, placeName);
    } finally {
      setLoading(false);
    }
  }, [center, onConfirm]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleShow}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Icon name="x" size={24} color={colors.forest[900]} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <Icon name="search" size={18} color={colors.neutral[400]} />
            <RNTextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Search places, landmarks, stores..."
              placeholderTextColor={colors.neutral[400]}
              style={styles.searchInput}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={colors.forest[400]} />}
            {query.length > 0 && !searching && (
              <Pressable
                onPress={() => { setQuery(''); setResults([]); setShowResults(false); }}
                hitSlop={8}
              >
                <Icon name="x" size={16} color={colors.neutral[400]} />
              </Pressable>
            )}
          </View>

          {/* Search results dropdown */}
          {showResults && results.length > 0 && (
            <ScrollView style={styles.resultsDropdown} keyboardShouldPersistTaps="handled">
              {results.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.resultItem}
                  onPress={() => handleSelectResult(item)}
                  activeOpacity={0.7}
                >
                  <Icon name="map-pin" size={16} color={colors.forest[400]} />
                  <Text style={styles.resultText} numberOfLines={2}>
                    {item.place_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Map with center pin overlay */}
        <View style={styles.mapContainer}>
          <MapPickerContent key={mapKey} initialCenter={center} onCenterChange={setCenter} />

          {/* Fixed center pin */}
          <View style={styles.pinOverlay} pointerEvents="none">
            <Icon name="map-pin" size={40} color={colors.forest[900]} />
          </View>

          {/* Crosshair hint */}
          <View style={styles.hintContainer} pointerEvents="none">
            <Text style={styles.hintText}>Drag the map to position the pin</Text>
          </View>
        </View>

        {/* Confirm button */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            style={[styles.confirmBtn, loading && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.neutral[0]} />
            ) : (
              <Text style={styles.confirmText}>Confirm Location</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.forest[900],
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[100],
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? spacing.sm : spacing.xs,
  },
  searchInput: {
    ...typography.body2,
    flex: 1,
    color: colors.forest[900],
    paddingVertical: spacing.xs,
    ...Platform.select({
      web: { outlineStyle: 'none' } as Record<string, string>,
      ios: {} as Record<string, string>,
      android: {} as Record<string, string>,
    }),
  },
  resultsDropdown: {
    maxHeight: 240,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginTop: spacing.xs,
    ...shadows.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[100],
  },
  resultText: {
    ...typography.body2,
    flex: 1,
    color: colors.forest[900],
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  pinOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
  },
  hintContainer: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    ...typography.caption,
    color: colors.forest[900],
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[200],
  },
  confirmBtn: {
    backgroundColor: colors.forest[900],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    ...typography.body1Bold,
    color: colors.neutral[0],
  },
});
