import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Platform, TextInput as RNTextInput } from 'react-native';
import { Icon } from '@/components/icons';
import { MapPicker } from '@/components/map/MapPicker';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { searchPlaces, type GeocodeSuggestion } from '@/lib/geocode';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { Text } from '@/components/ui/Text';

type Suggestion = GeocodeSuggestion;

export interface LocationCoords {
  lat: number;
  lng: number;
}

interface LocationInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onLocationSelect?: (coords: LocationCoords) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
}

/**
 * Address input with Mapbox Geocoding autocomplete, bounded to Belize.
 */
export function LocationInput({
  label,
  value,
  onChangeText,
  onLocationSelect,
  error,
  placeholder = 'Enter address',
  required,
}: LocationInputProps) {
  const { c } = useTheme();
  const styles = createStyles(c);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);
  const selectedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const searchIdRef = useRef(0);
  const ownPosition = useSelector((s: RootState) => ({
    latitude: s.location.latitude,
    longitude: s.location.longitude,
  }));

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      searchIdRef.current += 1;
      setSuggestions([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }

    const requestId = ++searchIdRef.current;
    setLoading(true);
    try {
      const items = await searchPlaces(query, {
        limit: 5,
        minChars: 3,
        proximity:
          ownPosition.latitude != null && ownPosition.longitude != null
            ? { lat: ownPosition.latitude, lng: ownPosition.longitude }
            : null,
      });
      if (requestId !== searchIdRef.current) return; // superseded
      setSuggestions(items);
      setShowDropdown(items.length > 0);
    } catch {
      if (requestId === searchIdRef.current) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    } finally {
      if (requestId === searchIdRef.current) setLoading(false);
    }
  }, [ownPosition.latitude, ownPosition.longitude]);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => fetchSuggestions(text), 350);
    },
    [onChangeText, fetchSuggestions],
  );

  const handleSelect = useCallback(
    (item: Suggestion) => {
      selectingRef.current = true;
      onChangeText(item.place_name);
      onLocationSelect?.({ lat: item.lat, lng: item.lng });
      selectedCoordsRef.current = { latitude: item.lat, longitude: item.lng };
      setSuggestions([]);
      setShowDropdown(false);
    },
    [onChangeText, onLocationSelect],
  );

  const handleMapConfirm = useCallback(
    (coords: { latitude: number; longitude: number }, placeName: string) => {
      onChangeText(placeName);
      onLocationSelect?.({ lat: coords.latitude, lng: coords.longitude });
      selectedCoordsRef.current = coords;
      setShowMapPicker(false);
    },
    [onChangeText, onLocationSelect],
  );

  const handleBlur = useCallback(() => {
    // Delay hide so onPress on suggestion can fire first
    setTimeout(() => {
      if (!selectingRef.current) {
        setShowDropdown(false);
      }
      selectingRef.current = false;
    }, 200);
  }, []);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0) {
      setShowDropdown(true);
    }
  }, [suggestions]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <View style={[styles.wrapper, showDropdown && styles.wrapperOpen]}>
      <View style={styles.fieldContainer}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
        <View style={[styles.inputRow, error ? styles.errorBorder : undefined]}>
          <Icon name="map-pin" size={18} color={c.textMuted} />
          <RNTextInput
            value={value}
            onChangeText={handleChangeText}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder}
            placeholderTextColor={c.textMuted}
            style={styles.input}
            autoCapitalize="words"
          />
          {loading && <ActivityIndicator size="small" color={c.textMuted} />}
          <Pressable onPress={() => setShowMapPicker(true)} hitSlop={8} style={styles.mapBtn}>
            <Icon name="map-pin" size={18} color={c.text} />
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionItem}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Icon name="map-pin" size={14} color={c.textMuted} />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {item.place_name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <MapPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={handleMapConfirm}
        initialCoords={selectedCoordsRef.current}
        title={`${label} — Drop Pin`}
      />
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  wrapperOpen: {
    zIndex: 1000,
    elevation: 1000,
  },
  fieldContainer: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    ...type.bodySm.bold,
    color: c.textMuted,
  },
  required: {
    ...type.bodySm.bold,
    color: colors.error,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  mapBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: c.bg,
  },
  input: {
    ...type.body.regular,
    flex: 1,
    color: c.text,
    ...Platform.select({
      web: { outlineStyle: 'none' } as Record<string, string>,
      ios: {} as Record<string, string>,
      android: {} as Record<string, string>,
    }),
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    marginTop: 4,
    ...shadows.md,
    zIndex: 1001,
    elevation: 1001,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  suggestionText: {
    ...type.bodySm.regular,
    flex: 1,
    color: c.text,
  },
  error: {
    ...type.caption.regular,
    color: colors.error,
  },
});
