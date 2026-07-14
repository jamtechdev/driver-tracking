# Mapbox setup — push/pull safe

Tokens live in **`.env` only** (gitignored). One command syncs everything local.

## First time (Windows or Mac)

```bash
cp .env.example .env
# Edit .env — paste MAPBOX_ACCESS_TOKEN (pk.…) and MAPBOX_DOWNLOADS_TOKEN (sk.…)
npm run setup:mapbox
```

## After every `git pull`

```bash
npm run setup:mapbox
```

Or `npm install` — if `.env` exists, sync runs automatically.

## What `setup:mapbox` writes (all gitignored / local)

| File | Token |
|------|--------|
| `src/config/env.local.ts` | pk (JS / directions API) |
| `android/app/src/main/res/values/mapbox_access_token.xml` | pk (Android native) |
| `android/local.properties` | sk (Android Maven download) |
| `ios/DriverTracking/Info.plist` | pk (iOS native — local only, don't commit) |

## Mac/iOS only — `pod install`

Add `sk.…` to `~/.netrc` once (not in git):

```
machine api.mapbox.com
login mapbox
password YOUR_SK_TOKEN
```

```bash
chmod 600 ~/.netrc
cd ios && pod install && cd ..
npm run ios
```

## Share tokens with team

Send `pk` + `sk` via Slack/WhatsApp — **never** commit to GitHub.

Each developer keeps their own `.env` on each machine.

## Push / pull workflow

1. **Push** — only code; no tokens in repo ✅
2. **Pull** on other machine — `npm run setup:mapbox` restores local files from `.env` ✅

No Mapbox login needed — only the keys.
