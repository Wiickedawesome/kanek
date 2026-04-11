# Deep Links Setup — kanek.bz

## Overview

Universal Links (iOS) and App Links (Android) allow `https://kanek.bz/post/123` to open directly in the Kanek app.

## What's already configured

- **`app.json`** — `ios.associatedDomains` and `android.intentFilters` for `kanek.bz`
- **`public/.well-known/apple-app-site-association`** — iOS verification file (needs Team ID)
- **`public/.well-known/assetlinks.json`** — Android verification file (needs SHA-256 fingerprint)

## Remaining steps

### 1. Replace placeholders

**iOS — Apple Team ID:**
In `public/.well-known/apple-app-site-association`, replace `APPLE_TEAM_ID` with your 10-character Apple Developer Team ID (found at https://developer.apple.com/account → Membership).

**Android — SHA-256 fingerprint:**
```bash
# Get fingerprint from EAS credentials
eas credentials --platform android
# Copy the SHA-256 fingerprint and paste into public/.well-known/assetlinks.json
```

### 2. Host the verification files

The `.well-known` files must be served from `https://kanek.bz/.well-known/` with `Content-Type: application/json`.

**Option A — GitHub Pages (recommended, free):**

1. Create a repo named `kanek-bz-site` (or use the main repo's `docs/` folder)
2. Copy `public/.well-known/` into the repo root
3. Add a `_config.yml`:
   ```yaml
   include:
     - .well-known
   ```
4. Enable GitHub Pages in repo Settings → Pages → Deploy from branch
5. Add a `CNAME` file containing: `kanek.bz`
6. Configure DNS at your registrar:
   - `A` record → `185.199.108.153` (GitHub Pages IP)
   - `A` record → `185.199.109.153`
   - `A` record → `185.199.110.153`
   - `A` record → `185.199.111.153`
   - `CNAME` for `www` → `<your-github-username>.github.io`

**Option B — Cloudflare Pages:**
1. Upload `public/.well-known/` to a Cloudflare Pages project
2. Point `kanek.bz` DNS to Cloudflare
3. Cloudflare handles HTTPS automatically

### 3. Verify

```bash
# iOS
curl -I https://kanek.bz/.well-known/apple-app-site-association
# Should return 200 with application/json

# Android
curl https://kanek.bz/.well-known/assetlinks.json
# Validate at https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://kanek.bz&relation=delegate_permission/common.handle_all_urls
```

### 4. Add Expo Router linking config

Once the domain is live, add a linking handler in `app/_layout.tsx` if needed for path-to-screen mapping. Expo Router's file-based routing handles most cases automatically.

## Supported deep link paths

| URL Pattern | Opens Screen |
|---|---|
| `https://kanek.bz/post/:id` | Post detail |
| `https://kanek.bz/profile/:id` | User profile |
| `https://kanek.bz/invite/:code` | Invite/referral |
