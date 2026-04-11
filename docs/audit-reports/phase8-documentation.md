# Phase 8 — Documentation Audit Report

**Date:** 2025-07-22
**Scope:** All documentation (README, docs/, AGENTS.md, copilot-instructions, inline)
**Files Audited:** 17 documentation files + source verification against codebase

---

## Critical Findings (Misleading / Dangerous)

### H-1 — Sign-Out Misses 2 API Slice Resets (Code Bug + Doc Gap)
- **Severity:** High
- **File(s):** `docs/ux-logic-audit.md`, `src/hooks/useAuth.ts`
- **Issue:** UX audit says "All 9 API slices are now properly reset" on sign-out. Actual codebase has **11** API slices but only 9 are reset in `useAuth.ts` sign-out. `contractEventsApi` and `driverDocumentsApi` are never cleared.
- **Reality:** Cached contract events and driver documents from one user persist in Redux after sign-out, potentially leaking to the next user who signs in.
- **Fix:** Add `dispatch(contractEventsApi.util.resetApiState())` and `dispatch(driverDocumentsApi.util.resetApiState())` to `useAuth.ts` sign-out. Update UX audit doc to list 11 slices.

### H-2 — Admin Panel Docs List Phantom API Routes
- **Severity:** High
- **File(s):** `docs/admin-panel.md`
- **Issue:** Docs list 6 API routes including `/api/posts/action` and `/api/transactions/action`. These routes **do not exist** in the codebase.
- **Reality:** Only 5 API routes exist: `admins/invite`, `drivers/review`, `flags/action`, `riders/review`, `users/action`. The real `admins/invite` route is not documented at all.
- **Fix:** Remove phantom routes, add `admins/invite`, correct route count.

### H-3 — Migration Count Off by 17 (33 → 50)
- **Severity:** High
- **File(s):** `README.md`, `.github/copilot-instructions.md`, `docs/database-schema.md`
- **Issue:** Multiple docs say "33 SQL migration files." Actual count is **50**. `docs/database-schema.md` migration index stops at migration 33 — migrations 34–50 are completely undocumented.
- **Reality:** 17 migrations (security audit fixes, Phase 1–7 changes) were added but never reflected in docs.
- **Fix:** Update all counts to 50. Add migration 34–50 entries to `docs/database-schema.md` migration index.

### H-4 — API Slice Count Off by 2 (9 → 11)
- **Severity:** High
- **File(s):** `README.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/state-management.md`
- **Issue:** All docs say "9 API slices." Actual count is **11**: `contractEventsApi` and `driverDocumentsApi` are completely undocumented.
- **Reality:** `src/store/api/` contains: bookingsApi, checkinsApi, contractEventsApi, driverDocumentsApi, ekyashApi, messagesApi, notificationsApi, postsApi, profilesApi, ratingsApi, reportsApi.
- **Fix:** Update all counts to 11. Add descriptions for contractEventsApi and driverDocumentsApi to `docs/state-management.md`.

### H-5 — Edge Function Count Off by 1 (13 → 14)
- **Severity:** High
- **File(s):** `README.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/README.md`, `docs/architecture.md`, `docs/edge-functions.md`
- **Issue:** All docs say "13 edge functions." Actual count is **14**. `notify-user` function is completely undocumented.
- **Reality:** `supabase/functions/` contains 14 functions + 2 shared files. `notify-user` was added but never documented anywhere.
- **Fix:** Update all counts to 14. Add `notify-user` documentation to `docs/edge-functions.md` and the edge function tables in copilot-instructions/README.

### H-6 — Admin Panel Missing 5 Pages from Docs
- **Severity:** High
- **File(s):** `docs/admin-panel.md`
- **Issue:** Docs list 8 pages. Actual admin panel has 12 pages. Missing from docs: `/(admin)/admins/page.tsx`, `/(admin)/drivers/[id]/page.tsx`, `/(admin)/riders/[id]/page.tsx`, `/(admin)/users/[id]/page.tsx`, `/(admin)/flags/[id]/page.tsx`.
- **Reality:** The admins management page and all 4 detail/review pages are undocumented.
- **Fix:** Add all missing pages to docs/admin-panel.md route table.

---

## Stale References

| Doc File | Reference | Documented | Actual |
|----------|-----------|------------|--------|
| README.md | React Native version | 0.83.2 | 0.83.4 |
| .github/copilot-instructions.md | React Native version | 0.83.2 | 0.83.4 |
| docs/architecture.md | React Native version | 0.83.2 | 0.83.4 |
| README.md | Migration count | 33 | 50 |
| .github/copilot-instructions.md | Migration count | 33 | 50 |
| docs/database-schema.md | Migration count | 33 | 50 |
| README.md | API slice count | 9 | 11 |
| AGENTS.md | API slice count | 9 | 11 |
| .github/copilot-instructions.md | API slice count | 9 | 11 |
| docs/state-management.md | API slice count | 9 | 11 |
| README.md | Edge function count | 13 | 14 |
| AGENTS.md | Edge function count | 13 | 14 |
| .github/copilot-instructions.md | Edge function count | 13 | 14 |
| docs/README.md | Edge function count | 13 | 14 |
| docs/architecture.md | Edge function count | 13 | 14 |
| docs/edge-functions.md | Edge function count | 13 | 14 |
| docs/state-management.md | Hook count | 6 | 7 |
| docs/design-system.md | UI component count | 9 | 14 |
| docs/ux-logic-audit.md | Sign-out API slice count | 9 | 11 |
| PLAN.md | Expo SDK version | 52 | 55 |

---

## Missing Documentation

| Topic | Where It Should Be | Priority |
|-------|-------------------|----------|
| `contractEventsApi` slice | docs/state-management.md | High |
| `driverDocumentsApi` slice | docs/state-management.md | High |
| `notify-user` edge function | docs/edge-functions.md | High |
| `useOnboardingStatus` hook | docs/state-management.md | Medium |
| 5 UI components (GlassView, ScreenBackground, ScreenHeader, Skeleton, TopographicBg) | docs/design-system.md | Medium |
| 4+ icon components (Bell, ChevronDown, ChevronUp, ExternalLink, MessageCircle, Send) | docs/design-system.md | Medium |
| `messages/[contractId]` screen | docs/navigation.md | Medium |
| `privacy.tsx`, `terms.tsx` profile screens | docs/navigation.md | Medium |
| `notifications.tsx` in activity + profile | docs/navigation.md | Medium |
| `selfie-checkin`, `report-detail`, `user-profile` modals | docs/navigation.md | Medium |
| Admin `admins` page + 4 detail pages | docs/admin-panel.md | Medium |
| Admin `admins/invite` API route | docs/admin-panel.md | Medium |
| Migrations 34–50 in migration index | docs/database-schema.md | Medium |

---

## Cross-Reference Inconsistencies

| Item | Source A | Source B | Discrepancy |
|------|---------|---------|-------------|
| Edge function count | copilot-instructions.md: "13" | supabase/functions/: 14 | Off by 1 — missing `notify-user` |
| Edge function count | AGENTS.md: "13" | supabase/functions/: 14 | Off by 1 — missing `notify-user` |
| Edge function count | docs/edge-functions.md: "13" | supabase/functions/: 14 | Off by 1 — missing `notify-user` |
| API slice count | copilot-instructions.md: "9" | src/store/api/: 11 | Off by 2 — missing contractEventsApi, driverDocumentsApi |
| API slice count | AGENTS.md: "9" | src/store/api/: 11 | Off by 2 |
| API slice count | docs/state-management.md: "9" | src/store/api/: 11 | Off by 2 |
| Migration count | copilot-instructions.md: "33" | supabase/migrations/: 50 | Off by 17 |
| Migration count | docs/database-schema.md: "33" | supabase/migrations/: 50 | Off by 17 |
| Hook count | docs/state-management.md: "6" | src/hooks/: 7 | Off by 1 — missing useOnboardingStatus |
| RN version | README.md: "0.83.2" | package.json: "0.83.4" | Patch version stale |
| UI components | docs/design-system.md: 9 listed | src/components/ui/: 14 | Off by 5 |
| Admin API routes | docs/admin-panel.md: 6 routes | admin/app/api/: 5 routes | 2 phantom + 1 missing |
| Admin pages | docs/admin-panel.md: 8 pages | admin/app/(admin)/: 12 | Off by 4 (+ detail pages) |
| Sign-out slices | docs/ux-logic-audit.md: 9 | src/hooks/useAuth.ts: 9 reset / 11 exist | 2 slices not reset |

---

## Documentation Coverage Matrix

| Area | Doc Exists | Accurate | Complete | Priority Update |
|------|-----------|----------|----------|-----------------|
| Project overview (README) | ✅ | ⚠️ Stale counts | ⚠️ Missing 2 slices | High |
| AI instructions (AGENTS.md) | ✅ | ⚠️ Stale counts | ⚠️ | High |
| AI instructions (copilot-instructions) | ✅ | ⚠️ Stale counts | ⚠️ | High |
| Database schema | ✅ | ⚠️ Count stale | ❌ Missing 17 migrations | High |
| Architecture | ✅ | ⚠️ Stale version/count | ✅ | Medium |
| Design system | ✅ | ✅ Colors verified | ⚠️ Missing 5 UI + icons | Medium |
| Navigation | ✅ | ✅ Patterns correct | ⚠️ Missing 6+ screens | Medium |
| State management | ✅ | ⚠️ Stale counts | ⚠️ Missing 2 slices + 1 hook | High |
| Payments | ✅ | ✅ | ✅ | None |
| Edge functions | ✅ | ⚠️ Count stale | ⚠️ Missing notify-user | High |
| Environment setup | ✅ | ✅ | ✅ | None |
| Admin panel | ✅ | ❌ Phantom routes | ❌ Missing 5 pages + 1 route | High |
| Store launch checklist | ✅ | ✅ | ✅ | None |
| Security audit (AUDIT.md) | ✅ | ✅ Statuses correct | ✅ Point-in-time | None |
| UX audit | ✅ | ⚠️ Stale slice count | ⚠️ Sign-out bug | High |
| Project plan (PLAN.md) | ✅ | ⚠️ SDK 52 (living doc) | ⚠️ Living doc | Low |

---

## Recommended Updates (Prioritized)

1. **Fix sign-out code bug** — Add `contractEventsApi` and `driverDocumentsApi` reset to `src/hooks/useAuth.ts` sign-out function. This is a data leak.

2. **Update all stale counts in bulk** — Migration (33→50), API slices (9→11), edge functions (13→14), hooks (6→7) across: README.md, AGENTS.md, .github/copilot-instructions.md, docs/state-management.md, docs/edge-functions.md, docs/database-schema.md, docs/README.md, docs/architecture.md.

3. **Fix admin panel docs** — Remove phantom API routes (posts/action, transactions/action). Add real route (admins/invite). Add admins page and 4 detail pages.

4. **Document missing API slices** — Add contractEventsApi and driverDocumentsApi descriptions to docs/state-management.md.

5. **Document notify-user edge function** — Add to docs/edge-functions.md and the edge function tables in copilot-instructions.md and README.md.

6. **Update navigation docs** — Add messages/[contractId], privacy, terms, notifications screens and missing modals.

7. **Update design system docs** — Add 5 missing UI components and 4+ missing icons.

8. **Update database-schema.md migration index** — Add entries for migrations 34–50.

9. **Update RN version** — 0.83.2 → 0.83.4 in README.md, copilot-instructions.md, docs/architecture.md.

10. **Update UX audit sign-out section** — Change "9 API slices" to "11" and add the 2 missing entries.

---

## Summary

- **Critical/High findings:** 6 (H-1 through H-6)
- **Stale references:** 20 instances across 10 files
- **Missing documentation:** 14 topics
- **Cross-reference inconsistencies:** 14 discrepancies
- **Docs up to date:** 4/16 fully accurate (Payments, Environment Setup, Store Checklist, AUDIT.md)
- **Code bug found:** 1 (sign-out missing 2 API slice resets — potential data leak)

### Severity Breakdown
| Severity | Count | Description |
|----------|-------|-------------|
| High | 6 | Misleading counts, phantom routes, sign-out data leak |
| Medium | 8 | Missing screens, components, icons in docs |
| Low | 2 | PLAN.md stale SDK, minor version drift |
| Info | 4 | Docs fully accurate, no action needed |
