import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Modal, StyleSheet, Pressable, ActivityIndicator, TextInput as RNTextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { MapPickerContent } from './MapPickerContent';
import { Icon } from '@/components/icons';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { reverseGeocode, BELIZE_CENTER } from '@/lib/mapbox';
import { searchPlaces as searchGeocode, type GeocodeSuggestion } from '@/lib/geocode';
import { isInBelize } from '@/lib/helpers';
import { showAlert } from '@/lib/alert';
import type { RootState } from '@/store';
import { Text } from '@/components/ui/Text';

type SearchResult = GeocodeSuggestion;

interface MapPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }, placeName: string) => void;
  /** If provided, map opens here; otherwise uses GPS or Belize center */
  initialCoords?: { latitude: number; longitude: number } | null;
  title?: string;
}

export function MapPicker({ visible, onClose, onConfirm, initialCoords, title = 'Drop Pin' }: MapPickerProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
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
      const items = await searchGeocode(text, { limit: 6, minChars: 2 });
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
    if (!isInBelize(center.latitude, center.longitude)) {
      showAlert(
        'Outside Belize',
        'Pick a location inside Belize. Drag the map until the pin is on a Belize address.',
      );
      return;
    }
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
            <Icon name="x" size={24} color={c.text} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <Icon name="search" size={18} color={c.textMuted} />
            <RNTextInput
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Search places, landmarks, stores..."
              placeholderTextColor={c.textMuted}
              style={styles.searchInput}
              autoCapitalize="words"
              returnKeyType="search"
            />
            {searching && <ActivityIndicator size="small" color={c.textMuted} />}
            {query.length > 0 && !searching && (
              <Pressable
                onPress={() => { setQuery(''); setResults([]); setShowResults(false); }}
                hitSlop={8}
              >
                <Icon name="x" size={16} color={c.textMuted} />
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
                  <Icon name="map-pin" size={16} color={c.textMuted} />
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
            <Icon name="map-pin" size={40} color={c.text} />
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

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...type.h3.bold,
    color: c.text,
    textAlign: 'center',
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    zIndex: 100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.bg,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'web' ? spacing.sm : spacing.xs,
  },
  searchInput: {
    ...type.bodySm.regular,
    flex: 1,
    color: c.text,
    paddingVertical: spacing.xs,
    ...Platform.select({
      web: { outlineStyle: 'none' } as Record<string, string>,
      ios: {} as Record<string, string>,
      android: {} as Record<string, string>,
    }),
  },
  resultsDropdown: {
    maxHeight: 240,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
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
    borderBottomColor: c.border,
  },
  resultText: {
    ...type.bodySm.regular,
    flex: 1,
    color: c.text,
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
    ...type.caption.regular,
    color: c.text,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
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
    ...type.body.bold,
    color: '#ffffff',
  },
});
