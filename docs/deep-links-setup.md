# Deep Links Setup — kanek.bz

## Overview

Universal Links (iOS) and App Links (Android) allow `https://kanek.bz/...` URLs to open directly in the Kanek mobile app.

The domain verification files are hosted directly on the production domain via Firebase Hosting from the sibling repository `/home/wicked/Projects/kanek.bz`.

## Active Configuration

### 1. Mobile App (`app.json`)
- **iOS associated domains:** `applinks:kanek.bz`
- **Android intent filters:**
  - Scheme: `https`, Host: `kanek.bz`
  - Auto-verify: `true`
  - Path prefixes: `/explore`, `/post`, `/activity`, `/profile`, `/invite`, `/auth`

### 2. Hosted Verification Files (`kanek.bz/public/.well-known/`)
Served automatically with `Content-Type: application/json` by Firebase Hosting on `https://kanek.bz/.well-known/`:

#### iOS: `apple-app-site-association`
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["6VR44TAYT7.bz.kanek.app"],
        "paths": ["/explore/*", "/post/*", "/activity/*", "/profile/*", "/invite/*", "/auth/*"]
      }
    ]
  }
}
```

#### Android: `assetlinks.json`
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "bz.kanek.app",
      "sha256_cert_fingerprints": [
        "B7:E3:12:0D:5E:A2:9F:2A:6E:2E:54:8A:79:05:60:5D:AC:F4:24:95:53:8B:79:15:33:BD:83:91:51:32:59:C6"
      ]
    }
  }
]
```

## Hosting & Verification

The verification files are committed in `kanek.bz/public/.well-known/` and deployed automatically to Firebase Hosting (`site: kanek-bz`).

### Verify Deployment:
```bash
# iOS Verification
curl -I https://kanek.bz/.well-known/apple-app-site-association

# Android Verification
curl -s https://kanek.bz/.well-known/assetlinks.json | jq .
```

## Supported Deep Link Paths

| URL Pattern | Opens Screen |
|---|---|
| `https://kanek.bz/post/:id` | Post detail |
| `https://kanek.bz/profile/:id` | User profile |
| `https://kanek.bz/invite/:code` | Invite/referral |
| `https://kanek.bz/activity/*` | Trip activity & tracking |
| `https://kanek.bz/auth/callback` | OAuth redirect code exchange |
| `kanek://auth/callback` | Native URL scheme callback |
