# Design System

AllTrails Trailblazer-inspired. Forest greens reflect Belize (jungle, nature, community).

---

## Colors (`src/theme/colors.ts`)

### Primary — Forest Green

| Token | Hex | Usage |
|-------|-----|-------|
| `forest-900` | `#142800` | Deepest — primary text, headers |
| `forest-800` | `#1c2513` | Dark backgrounds |
| `forest-700` | `#2b381f` | Secondary dark |
| `forest-600` | `#274312` | Buttons, active states |
| `forest-500` | `#4c5c43` | Muted green |
| `forest-400` | `#656e5e` | Icons inactive, subtle text |

### Neutral

| Token | Hex | Usage |
|-------|-----|-------|
| `neutral-0` | `#ffffff` | White |
| `neutral-50` | `#f6f6f4` | Page background |
| `neutral-100` | `#efefec` | Card background |
| `neutral-200` | `#dbdad2` | Borders, dividers |
| `neutral-300` | `#c2c2b8` | Disabled state |
| `neutral-400` | `#a7a99f` | Placeholder text |
| `neutral-500` | `#8b9182` | Secondary text |

### Accent

| Token | Hex | Usage |
|-------|-----|-------|
| `accent-green` | `#51c152` | Success, CTA, active tab |
| `neon-green` | `#65f67b` | Highlights, badges |
| `neon-teal` | `#49de61` | Secondary accent |
| `accent-blue` | `#4967f6` | Links, info states |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `error` | `#d32f2f` | Errors, strikes, SOS |
| `warning` | `#f9a825` | Caution states |

---

## Typography (`src/theme/typography.ts`)

Two font families loaded via `expo-font` from `assets/fonts/`:

- **Work Sans** — display / headings (Medium 500, SemiBold 600, Bold 700)
- **Manrope** — body / UI text (Regular 400, Medium 500, SemiBold 600, Bold 700)

### Scale (9 variants)

| Variant | Family | Size / Line Height | Letter spacing | Weights available |
|---|---|---|---|---|
| `display` | Work Sans | 44 / 48 | -1.0 | bold |
| `h1` | Work Sans | 32 / 38 | -0.6 | bold |
| `h2` | Work Sans | 26 / 32 | -0.4 | bold |
| `h3` | Work Sans | 22 / 28 | -0.2 | medium / semibold / bold |
| `subtitle` | Manrope | 18 / 26 | 0 | regular / medium / semibold / bold |
| `body` | Manrope | 16 / 24 | 0 | regular / medium / semibold / bold |
| `bodySm` | Manrope | 14 / 20 | 0.1 | regular / medium / semibold / bold |
| `caption` | Manrope | 12 / 16 | 0.2 | regular / medium / semibold |
| `overline` | Manrope | 11 / 14 | 0.6 (uppercase) | medium |

### Tones

`text` (default), `muted`, `subtle`, `inverse`, `onAccent`, `danger`, `accent`. Tones resolve light/dark automatically through `SemanticColors`.

### Usage

Always use the `<Text>` wrapper from `@/components/ui/Text`. Never import `Text` from `react-native` in feature code.

```tsx
import { Text } from '@/components/ui/Text';

<Text variant="h2">Page title</Text>
<Text variant="body" tone="muted">Subtitle copy</Text>
<Text variant="bodySm" weight="semibold" tone="danger">Warning</Text>
```

For raw `TextStyle` (e.g. inside a `StyleSheet`), use `t(variant, weight?, tone?)` from `useTheme()` or `resolveTextStyle(variant, weight)` from `@/theme`.

### Escape hatch

If a one-off component genuinely needs a non-token font/size (e.g. a brand mark, animated number, third-party widget), import `react-native`'s `Text` and add a comment on the same line:

```tsx
import { Text as RNText } from 'react-native'; // kanek-allow-typography
```

The lint rule (see below) ignores any line containing `kanek-allow-typography`.

---

## Icons (`src/components/icons/`)

All icons are **custom SVG components** using `react-native-svg`. **No emoji anywhere in the UI.**

Default size: 24x24. Style: outlined stroke. Colors: `forest-400` inactive, `accent-green` active.

| Component | Usage |
|-----------|-------|
| `Compass` | Explore tab |
| `PlusCircle` | Post tab |
| `ClipboardList` | Activity tab |
| `User` | Profile tab |
| `CircleDot` | Post type badges |
| `AlertTriangle` | Warnings / caution badges |
| `Check` | Confirmation / success checks |
| `Construction` | Construction notices |
| `Download` | File / receipt download |
| `Fuel` | Gas prices |
| `Lock` | Secure storage / auth |
| `Map` | Map view toggles |
| `Star` | Ratings |
| `Clock` | Punctuality |
| `MapPin` | Locations |
| `Navigation` | Route direction |
| `Phone` | Contact / profile phone |
| `ShieldAlert` | SOS button |
| `Receipt` | Transactions |
| `QrCode` | E-Kyash QR |
| `Search` | Search bar |
| `Filter` | Filter controls |
| `ChevronLeft` | Back navigation |
| `ChevronRight` | Forward/detail |
| `ChevronDown` | Expand / dropdown |
| `ChevronUp` | Collapse / scroll up |
| `Bell` | Notifications |
| `Send` | Send message |
| `MessageCircle` | Messages / chat |
| `Package` | Package delivery |
| `ExternalLink` | External links |
| `X` | Close / dismiss |

---

## Component Styling

### Buttons
- Shape: Pill (full border-radius)
- Primary: `forest-600` background, white text
- Secondary: Outlined, `forest-600` border
- Disabled: `neutral-300` background, `neutral-500` text

### Cards
- Border radius: 12px
- Background: `neutral-100`
- Shadow: Subtle drop shadow
- Padding: 16px

### Bottom Tab Bar
- Height: 60px
- Padding bottom: 8px
- Background: `neutral-0` (#ffffff)
- Border top: `neutral-200`
- Active: `accent-green`
- Inactive: `forest-400`
- Label: Manrope-Regular, 11px

### Map Controls
- Floating circular buttons
- White background with shadow
- 44px touch target

---

## Component Library (`src/components/ui/`)

| Component | Purpose |
|-----------|---------|
| `Button` | Primary action button (pill-shaped) |
| `TextInput` | Form input with label + placeholder |
| `Card` | Rounded container with shadow |
| `Badge` | Status/type badge (colored) |
| `Avatar` | Circular user avatar (initials fallback) |
| `SearchBar` | Rounded search input |
| `FilterChip` | Toggle filter button |
| `EmptyState` | Empty state message with icon |
| `InAppToast` | Toast notification overlay |
| `GlassView` | Frosted glass effect container |
| `ScreenBackground` | Full-screen background wrapper |
| `ScreenHeader` | Standard screen header with back nav |
| `Skeleton` | Loading skeleton placeholder |
| `TopographicBg` | Topographic pattern background |

---

## Post Card Variants (`src/components/cards/`)

| Component | Post Type / Purpose |
|-----------|---------------------|
| `RouteOfferCard` | Driver offering seats (`route_offer`) |
| `RouteRequestCard` | Rider looking for ride (`route_request`) |
| `ErrandCard` | Task/errand (`errand`) |
| `JobCard` | Work opportunity (`job`) |
| `GasPriceCard` | Gas station price report |
| `RouteInfoCard` | Route distance/duration/cost widget |
| `TopRoutesSection` | Popular routes feed widget |
| `PostCardShell` | Common card wrapper with interactive feedback |
| `HeroMap` | Interactive map preview in feed header |
| `HeroGradient` | Top visual gradient background |
| `PriceBadge` | Formatted price display pill |
| `MetaItem` | Standard icon + text metadata row |

---

## Form Components (`src/components/forms/`)

| Component | Purpose |
|-----------|---------|
| `FormField` | Label + input + error wrapper |
| `LocationInput` | Mapbox address search + map picker |
| `DateInput` | Calendar date picker |
| `TimeInput` | Time picker (HH:MM) |
| `DateTimePicker` | Combined date + time |
| `PriceInput` | Currency input (BZD cents) |
