import React, { useMemo, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, FlatList, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack } from '@/lib/helpers';
import { ScreenHeader } from '@/components/ui';
import { ExploreMapContent } from '@/components/map/ExploreMapContent';
import { colors, typography, spacing, borderRadius, shadows } from '@/theme';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetRoadReportsQuery, useGetGasPricesQuery } from '@/store/api/reportsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { DISTRICT_CENTERS, DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
import { searchPlaces, type GeocodeSuggestion } from '@/lib/geocode';
import type { BelizeDistrict } from '@/types/database';
import type { RootState } from '@/store';

/** Colors for each post type pin */
const PIN_COLORS: Record<string, string> = {
  route_offer: colors.accent.green,
  route_request: colors.accent.blue,
  errand: colors.warning,
  package: '#9c27b0',
  job: colors.forest[500],
};

const REPORT_PIN_COLOR = colors.error;
const GAS_PIN_COLOR = colors.forest[600];

export default function ExploreMapScreen() {
  const { data: posts } = useGetPostsQuery({});
  const { data: roadReports } = useGetRoadReportsQuery();
  const { data: gasPrices } = useGetGasPricesQuery();

  // User GPS from Redux
  const userLat = useSelector((s: RootState) => s.location.latitude);
  const userLng = useSelector((s: RootState) => s.location.longitude);
  const hasGPS = userLat != null && userLng != null;

  // Profile district as fallback — use explicit district, or infer from address_line
  const userId = useSelector((s: RootState) => s.auth.user?.id);
  const { data: profile } = useGetMyProfileQuery(userId ?? '', { skip: !userId });
  // Derive both district (for highlight overlay) and a specific center from address keywords.
  // Town-level centers are used when available so the camera lands on the actual town,
  // not the midpoint of a large district.
  const { profileDistrict, profileCenter } = useMemo<{
    profileDistrict: BelizeDistrict | null;
    profileCenter: { latitude: number; longitude: number } | null;
  }>(() => {
    // Check address_line FIRST — provides town-level precision.
    // Only fall back to profile.district (district-center) if no keyword matches.
    const addr = (profile?.address_line ?? '').toLowerCase();

    // Cayo — specific towns before the generic "cayo" keyword
    if (['san ignacio', 'santa elena'].some((k) => addr.includes(k)))
      return { profileDistrict: 'cayo', profileCenter: { latitude: 17.155, longitude: -89.073 } };
    if (['belmopan'].some((k) => addr.includes(k)))
      return { profileDistrict: 'cayo', profileCenter: { latitude: 17.251, longitude: -88.767 } };
    if (['benque'].some((k) => addr.includes(k)))
      return { profileDistrict: 'cayo', profileCenter: { latitude: 17.075, longitude: -89.137 } };
    if (['spanish lookout'].some((k) => addr.includes(k)))
      return { profileDistrict: 'cayo', profileCenter: { latitude: 17.300, longitude: -88.986 } };
    if (['cayo'].some((k) => addr.includes(k)))
      return { profileDistrict: 'cayo', profileCenter: DISTRICT_CENTERS.cayo };

    // Belize district towns
    if (['belize city'].some((k) => addr.includes(k)))
      return { profileDistrict: 'belize', profileCenter: { latitude: 17.497, longitude: -88.189 } };
    if (['ladyville', 'hattieville', 'sandhill', 'belize'].some((k) => addr.includes(k)))
      return { profileDistrict: 'belize', profileCenter: DISTRICT_CENTERS.belize };

    // Corozal
    if (['corozal'].some((k) => addr.includes(k)))
      return { profileDistrict: 'corozal', profileCenter: { latitude: 18.391, longitude: -88.394 } };

    // Orange Walk
    if (['orange walk'].some((k) => addr.includes(k)))
      return { profileDistrict: 'orange_walk', profileCenter: { latitude: 18.087, longitude: -88.561 } };

    // Stann Creek
    if (['dangriga'].some((k) => addr.includes(k)))
      return { profileDistrict: 'stann_creek', profileCenter: { latitude: 16.969, longitude: -88.230 } };
    if (['placencia'].some((k) => addr.includes(k)))
      return { profileDistrict: 'stann_creek', profileCenter: { latitude: 16.525, longitude: -88.368 } };
    if (['hopkins', 'independence', 'stann creek'].some((k) => addr.includes(k)))
      return { profileDistrict: 'stann_creek', profileCenter: DISTRICT_CENTERS.stann_creek };

    // Toledo
    if (['punta gorda'].some((k) => addr.includes(k)))
      return { profileDistrict: 'toledo', profileCenter: { latitude: 16.100, longitude: -88.806 } };
    if (['toledo', 'big falls'].some((k) => addr.includes(k)))
      return { profileDistrict: 'toledo', profileCenter: DISTRICT_CENTERS.toledo };

    // No keyword match — fall back to profile.district field (district-center only)
    if (profile?.district) {
      return { profileDistrict: profile.district, profileCenter: DISTRICT_CENTERS[profile.district] };
    }

    return { profileDistrict: null, profileCenter: null };
  }, [profile?.district, profile?.address_line]);

  // Determine initial camera: GPS → profile town/district center → Belize-wide
  const { initialCenter, initialZoom } = useMemo(() => {
    if (hasGPS) {
      return { initialCenter: { latitude: userLat, longitude: userLng }, initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    if (profileCenter) {
      return { initialCenter: profileCenter, initialZoom: DEFAULT_NEARBY_ZOOM };
    }
    return { initialCenter: undefined, initialZoom: undefined };
  }, [hasGPS, userLat, userLng, profileCenter]);

  const postPoints = useMemo(
    () =>
      (posts ?? [])
        .filter(
          (p): p is PostWithAuthor & { origin_lat: number; origin_lng: number } =>
            p.origin_lat != null && p.origin_lng != null,
        )
        .map((p) => ({
          id: p.id,
          lng: p.origin_lng,
          lat: p.origin_lat,
          color: PIN_COLORS[p.type] ?? colors.forest[400],
          label: p.title,
        })),
    [posts],
  );

  const reportPoints = useMemo(
    () =>
      (roadReports ?? []).map((r) => ({
        id: r.id,
        lng: r.lng,
        lat: r.lat,
        color: REPORT_PIN_COLOR,
        label: r.type,
      })),
    [roadReports],
  );

  const gasPoints = useMemo(
    () =>
      (gasPrices ?? []).map((g) => ({
        id: g.id,
        lng: g.station_lng,
        lat: g.station_lat,
        color: GAS_PIN_COLOR,
        label: g.station_name,
      })),
    [gasPrices],
  );

  const handlePinPress = (id: string) => {
    router.push(`/(tabs)/explore/${id}`);
  };

  const [headerHeight, setHeaderHeight] = useState(64);

  // ── Search state ───────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyToRef = useRef<((lat: number, lng: number, zoom?: number) => void) | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      const results = await searchPlaces(text, { limit: 5 });
      setSearchResults(results);
    }, 300);
  }, []);

  const handleSearchSelect = useCallback((item: GeocodeSuggestion) => {
    flyToRef.current?.(item.lat, item.lng, 15);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    Keyboard.dismiss();
  }, []);

  const toggleSearch = useCallback(() => {
    setSearchOpen((prev) => {
      if (prev) {
        setSearchQuery('');
        setSearchResults([]);
        Keyboard.dismiss();
      }
      return !prev;
    });
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Map fills entire area */}
      <View style={styles.mapContainer}>
        <ExploreMapContent
          posts={postPoints}
          reports={reportPoints}
          gasStations={gasPoints}
          onPinPress={handlePinPress}
          onFlyToRef={flyToRef}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          showUserLocation={hasGPS}
          highlightDistrict={profileDistrict}
          compassTopOffset={headerHeight}
        />

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <ScreenHeader
            onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          >
            <View style={styles.headerRow}>
            <Pressable
              style={({ pressed }) => [styles.feedButton, pressed && styles.feedButtonPressed]}
              onPress={() => safeGoBack('/(tabs)/explore/')}
              hitSlop={8}
            >
              <Icon name="chevron-left" size={18} color={colors.neutral[0]} />
              <Text style={styles.feedButtonLabel}>Feed</Text>
            </Pressable>
            {searchOpen ? (
              <View style={styles.searchInputWrapper}>
                <Icon name="search" size={18} color={colors.neutral[400]} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  placeholder="Search places..."
                  placeholderTextColor={colors.neutral[400]}
                  autoFocus
                  returnKeyType="search"
                />
              </View>
            ) : (
              <Text style={styles.headerTitle}>Map View</Text>
            )}
            <Pressable onPress={toggleSearch} hitSlop={12}>
              <Icon name={searchOpen ? 'x' : 'search'} size={24} color={colors.neutral[0]} />
            </Pressable>
          </View>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.searchResultItem, pressed && styles.searchResultPressed]}
                    onPress={() => handleSearchSelect(item)}
                  >
                    <Icon name="map-pin" size={16} color={item.source === 'local' ? colors.accent.green : colors.accent.blue} />
                    <Text style={styles.searchResultText} numberOfLines={1}>{item.place_name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </ScreenHeader>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendRow color={colors.accent.green} label="Driver Offering" />
          <LegendRow color={colors.accent.blue} label="Riders Looking" />
          <LegendRow color={colors.warning} label="Errand" />
          <LegendRow color="#9c27b0" label="Package" />
          <LegendRow color={colors.forest[500]} label="Job" />
          <LegendRow color={REPORT_PIN_COLOR} label="Road Report" />
          <LegendRow color={GAS_PIN_COLOR} label="Gas Station" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  mapContainer: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.neutral[0],
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body2,
    color: colors.forest[900],
    padding: 0,
    height: 32,
  },
  searchResults: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    maxHeight: 200,
    ...shadows.md,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  searchResultPressed: {
    backgroundColor: colors.neutral[100],
  },
  searchResultText: {
    flex: 1,
    ...typography.body2,
    color: colors.forest[900],
  },
  legend: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadows.md,
  },
  feedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  feedButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  feedButtonLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.neutral[0],
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.forest[900],
  },
});
