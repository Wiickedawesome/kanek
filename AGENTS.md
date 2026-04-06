# AGENTS.md

Community Mobility Board for Belize — React Native (Expo SDK 55) + Supabase + Next.js admin.

## Architecture

Three apps in one repo: **mobile** (root), **admin** (`admin/`), **edge functions** (`supabase/functions/`).
Mobile screens live in `app/` (Expo Router file-based), all business logic in `src/`.
Path alias `@/*` maps to `src/*` (see `tsconfig.json`).

## Data Flow

All data fetching uses **RTK Query with `fakeBaseQuery()`** — queries call the Supabase JS client directly, never HTTP endpoints.
See `src/store/api/postsApi.ts` for the canonical pattern: `queryFn` → `supabase.from().select()` → return `{ data }` or `{ error: { status: 'CUSTOM_ERROR', data: msg } }`.
9 API slices in `src/store/api/`, 4 sync slices in `src/store/slices/`. All registered in `src/store/index.ts`.

## Navigation — Tab Isolation (Critical)

Expo Router binds routes to their owning tab. Never navigate to another tab's route directly — it switches tabs and breaks back-navigation.
**Pattern:** Shared screens use a component in `src/components/` with a `backFallback` prop, thin wrappers per tab:
```
src/components/PostDetailScreen.tsx              ← shared logic
app/(tabs)/explore/[postId].tsx                  ← <PostDetailScreen backFallback="/(tabs)/explore/" />
app/(tabs)/activity/post/[postId].tsx            ← <PostDetailScreen backFallback="/(tabs)/activity/" />
```
Use `safeGoBack(fallback)` from `src/lib/helpers.ts` for back navigation.

## Key Conventions

- **No emoji in UI** — all icons are custom SVG in `src/components/icons/` using `react-native-svg`. Each icon accepts `{ size, color }` via `IconProps`. Barrel export + `<Icon name="..." />` lookup in `src/components/icons/index.tsx`.
- **Prices in cents** (integer) everywhere — format with `formatBZD(cents)` from `src/lib/helpers.ts` for display (`1500` → `"$15.00"`).
- **Coordinates** validated against `BELIZE_BBOX` in `src/lib/constants.ts`.
- **Phone** format: `+501` + 7 digits. Validate with `PHONE_REGEX`.
- **Validate at boundaries only** — forms and edge functions. Internal code trusts validated data.
- **Cross-platform alerts** — use `showAlert`/`showConfirm` from `src/lib/alert.ts` (not `Alert.alert` directly).
- **Platform-specific files** — use `.web.tsx` suffix (e.g., `HCaptcha.tsx` native stub vs `HCaptcha.web.tsx` real widget).

## Design System

Tokens in `src/theme/` — import via `import { colors, typography, spacing } from '@/theme'`.
Colors: forest greens (`colors.forest[900]` = `#142800`), accent (`colors.accent.green` = `#51c152`), neutral backgrounds (`colors.neutral[50]`).
Fonts: **Work Sans** (headings), **Manrope** (body) — loaded in `app/_layout.tsx`.
UI primitives in `src/components/ui/` with barrel export.

## Auth & Onboarding

Auth bootstraps in `app/_layout.tsx` via `useAuthListener()` (called once at root).
`useOnboardingStatus()` hook determines if user needs role-select → id-upload → driver-docs.
Tab layout in `app/(tabs)/_layout.tsx` redirects incomplete onboarding to the correct auth screen.
Sign-out clears Redux state first, then Supabase session (see `useAuth().signOut` in `src/hooks/useAuth.ts`).

## Database

Types auto-generated: `supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts`.
**Never modify deployed migrations** — create new files in `supabase/migrations/`. Every table needs RLS policies.

## Edge Functions

13 Deno functions in `supabase/functions/`. Shared code in `supabase/functions/_shared/`.
Deploy: `supabase functions deploy`. Secrets set in Supabase dashboard (not in code).

## Commands

```bash
npm install --legacy-peer-deps    # required flag for peer dep conflicts
npm start                         # Expo dev server
npm run typecheck                 # tsc --noEmit
npm run lint                      # ESLint
cd admin && npm run dev           # Admin panel (localhost:3001)
supabase db push                  # Apply migrations
supabase functions deploy         # Deploy edge functions
```

## Anti-Patterns

- Don't add `baseQuery` with HTTP — always `fakeBaseQuery()` with Supabase client
- Don't use `Alert.alert` directly — use `showAlert`/`showConfirm` for web compat
- Don't navigate cross-tab — duplicate the screen wrapper per tab
- Don't hardcode dollar amounts — use cents (integer), format at display
- Don't put validation in internal code — only at form and edge function boundaries

