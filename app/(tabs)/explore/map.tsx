import React, { useMemo, useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput, FlatList, Keyboard, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { router } from 'expo-router';
import { Icon } from '@/components/icons';
import { safeGoBack, getTimeAgo, isInBelize } from '@/lib/helpers';
import { reverseGeocode } from '@/lib/mapbox';
import { ScreenHeader, useFloatingTabBarPad } from '@/components/ui';
import { ExploreMapContent } from '@/components/map/ExploreMapContent';
import { colors, type, spacing, borderRadius, shadows, useTheme } from '@/theme';
import type { SemanticColors } from '@/theme/semanticColors';
import { useGetPostsQuery, type PostWithAuthor } from '@/store/api/postsApi';
import { useGetGasPricesQuery, useVerifyGasPriceMutation } from '@/store/api/reportsApi';
import { useGetMyProfileQuery } from '@/store/api/profilesApi';
import { DISTRICT_CENTERS, DEFAULT_NEARBY_ZOOM } from '@/lib/constants';
import { searchPlaces, type GeocodeSuggestion } from '@/lib/geocode';
import type { BelizeDistrict } from '@/types/database';
import type { RootState } from '@/store';
import { Text } from '@/components/ui/Text';

/** Colors for each post type pin */
const PIN_COLORS: Record<string, string> = {
  route_offer: colors.accent.green,
  route_request: colors.accent.blue,
  errand: colors.accent.orange,
  package: '#9c27b0',
  job: colors.accent.yellow,
};

const GAS_PIN_COLOR = colors.error;

export default function ExploreMapScreen() {
  const { c } = useTheme();
  const styles = createStyles(c);
  const tabBarPad = useFloatingTabBarPad();
  const { data: posts } = useGetPostsQuery({});
  const { data: gasPrices } = useGetGasPricesQuery();
  const [verifyGasPrice] = useVerifyGasPriceMutation();

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
            p.origin_lat != null &&
            p.origin_lng != null &&
            isInBelize(p.origin_lat, p.origin_lng),
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


  const gasPoints = useMemo(
    () =>
      (gasPrices ?? [])
        .filter((g) => isInBelize(g.station_lat, g.station_lng))
        .map((g) => ({
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

  const handleGasPress = async (id: string) => {
    const g = (gasPrices ?? []).find((x) => x.id === id);
    if (!g) return;
    const fmt = (cents: number | null) => (cents == null ? '—' : `$${(cents / 100).toFixed(2)} BZD/gal`);

    // Fetch registered address via reverse-geocode
    let address = '';
    try {
      address = await reverseGeocode(g.station_lat, g.station_lng);
    } catch {
      // ignore
    }

    const body = [
      address ? address : `${g.station_lat.toFixed(5)}, ${g.station_lng.toFixed(5)}`,
      '',
      `Regular: ${fmt(g.regular_cents)}`,
      `Premium: ${fmt(g.premium_cents)}`,
      `Diesel:  ${fmt(g.diesel_cents)}`,
      '',
      `Reported ${getTimeAgo(g.reported_at)} • ${g.verified_count ?? 0} verified`,
    ].join('\n');

    const isOwner = g.reporter_id === userId;
    const goEdit = () => router.push(`/modals/report-gas?id=${g.id}`);
    const goNew = () => router.push('/modals/report-gas');
    const doVerify = () => {
      verifyGasPrice(g.id);
      // After verify, offer to add a fresh report
      goNew();
    };

    if (Platform.OS === 'web') {
      // Web: sequential confirm dialogs
      if (isOwner) {
        const editFirst = window.confirm(`${g.station_name}\n\n${body}\n\nEdit this report? (Cancel = Verify instead)`);
        if (editFirst) { goEdit(); return; }
        if (window.confirm('Verify this price?')) { doVerify(); return; }
        goNew();
      } else {
        if (window.confirm(`${g.station_name}\n\n${body}\n\nVerify this price?`)) { doVerify(); return; }
        goNew();
      }
      return;
    }

    const buttons: Parameters<typeof Alert.alert>[2] = [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add New Report', onPress: goNew },
      { text: 'Verify', onPress: doVerify },
    ];
    if (isOwner) {
      buttons.splice(2, 0, { text: 'Edit', onPress: goEdit });
    }
    Alert.alert(g.station_name, body, buttons, { cancelable: true });
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
          gasStations={gasPoints}
          onPinPress={handlePinPress}
          onGasPress={handleGasPress}
          onFlyToRef={flyToRef}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          showUserLocation={hasGPS}
          highlightDistrict={profileDistrict}
          compassTopOffset={headerHeight}
          recenterBottomOffset={tabBarPad + spacing.md + 48 + spacing.sm}
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
              <Icon name="chevron-left" size={18} color={c.text} />
              <Text style={styles.feedButtonLabel}>Feed</Text>
            </Pressable>
            {searchOpen ? (
              <View style={styles.searchInputWrapper}>
                <Icon name="search" size={18} color={c.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  placeholder="Search places..."
                  placeholderTextColor={c.textMuted}
                  autoFocus
                  returnKeyType="search"
                />
              </View>
            ) : (
              <Text style={styles.headerTitle}>Map View</Text>
            )}
            <Pressable onPress={toggleSearch} hitSlop={12}>
              <Icon name={searchOpen ? 'x' : 'search'} size={24} color={c.text} />
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
        <View style={[styles.legend, { bottom: tabBarPad + spacing.md }]}>
          <LegendRow color={colors.accent.green} label="Driver Offering" />
          <LegendRow color={colors.accent.blue} label="Riders Looking" />
          <LegendRow color={colors.warning} label="Errand" />
          <LegendRow color="#9c27b0" label="Package" />
          <LegendRow color={c.textMuted} label="Job" />
          <LegendRow color={GAS_PIN_COLOR} label="Gas Station" />
        </View>

        {/* Gas-report FAB — bottom-right, above tab bar */}
        <Pressable
          style={[styles.gasFab, { bottom: tabBarPad + spacing.md }]}
          onPress={() => router.push('/modals/report-gas')}
          accessibilityLabel="Report gas price"
          accessibilityRole="button"
        >
          <Icon name="fuel" size={20} color={colors.neutral[0]} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  const { c } = useTheme();
  const styles = createStyles(c);
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (c: SemanticColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
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
    ...type.h3.bold,
    color: c.text,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...type.bodySm.regular,
    color: c.text,
    padding: 0,
    height: 32,
  },
  searchResults: {
    marginHorizontal: spacing.xl,
    backgroundColor: c.surface,
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
    borderBottomColor: c.border,
  },
  searchResultPressed: {
    backgroundColor: c.bg,
  },
  searchResultText: {
    flex: 1,
    ...type.bodySm.regular,
    color: c.text,
  },
  legend: {
    position: 'absolute',
    left: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: c.border,
    ...shadows.md,
  },
  gasFab: {
    position: 'absolute',
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  feedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surface,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: c.border,
  },
  feedButtonPressed: {
    backgroundColor: c.surfaceElevated,
  },
  feedButtonLabel: {
    ...type.caption.regular,
    fontWeight: '700',
    color: c.text,
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
    ...type.caption.regular,
    color: c.text,
  },
});
