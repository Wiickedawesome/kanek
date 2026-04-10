import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ActivityIndicator, Platform, TextInput as RNTextInput } from 'react-native';
import { Icon } from '@/components/icons';
import { MapPicker } from '@/components/map/MapPicker';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import { searchPlaces, type GeocodeSuggestion } from '@/lib/geocode';

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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);
  const selectedCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);
    try {
      const items = await searchPlaces(query, { limit: 5, minChars: 3 });
      setSuggestions(items);
      setShowDropdown(items.length > 0);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
          <Icon name="map-pin" size={18} color={colors.forest[400]} />
          <RNTextInput
            value={value}
            onChangeText={handleChangeText}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder={placeholder}
            placeholderTextColor={colors.neutral[400]}
            style={styles.input}
            autoCapitalize="words"
          />
          {loading && <ActivityIndicator size="small" color={colors.forest[400]} />}
          <Pressable onPress={() => setShowMapPicker(true)} hitSlop={8} style={styles.mapBtn}>
            <Icon name="map-pin" size={18} color={colors.forest[900]} />
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
              <Icon name="map-pin" size={14} color={colors.neutral[400]} />
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

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
  },
  wrapperOpen: {
    zIndex: 100,
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
    ...typography.body2Bold,
    color: colors.forest[400],
  },
  required: {
    ...typography.body2Bold,
    color: colors.error,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  mapBtn: {
    padding: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.neutral[100],
  },
  input: {
    ...typography.body1,
    flex: 1,
    color: colors.forest[900],
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
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginTop: 4,
    ...shadows.md,
    zIndex: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[100],
  },
  suggestionText: {
    ...typography.body2,
    flex: 1,
    color: colors.forest[900],
  },
  error: {
    ...typography.caption,
    color: colors.error,
  },
});
