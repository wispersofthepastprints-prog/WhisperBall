# Whisper Ball — Product Requirements (Internal Testing Build)

## Overview
Whisper Ball is a modern table-ball game by **Wispers of the Past**. It honors a 1972-era mechanic (two paddles, one ball, score by getting it past the opponent) while rendering a 2026-grade interaction model: drag-anywhere paddle control, flick-to-curve, haptic feedback, full audio (paddle/wall/score/menu/rally-bonus/win/lose + looping ambient), tiered obstacles, multi-ball, and a restrained "Whisper" aesthetic (obsidian / ivory / gold).

**Status:** Beta build ready for Google Play Console **Internal testing** track.
**Target launch (production):** 5/6/26.

## Tech Stack
- **Frontend:** Expo SDK 54 · React Native 0.81 · Expo Router 6 · New Architecture
- **Animation/Physics:** react-native-reanimated 4 (`useFrameCallback` + `useSharedValue` on UI thread)
- **Gestures:** react-native-gesture-handler (`Gesture.Pan`)
- **Audio:** expo-audio (modern replacement for expo-av) — 11 one-shots + 1 looping ambient
- **Feedback:** expo-haptics
- **Persistence:** AsyncStorage via `@/src/utils/storage`, namespaced `wb:*`
- **Orientation:** landscape locked via `app.json`

## Identity (final — locked at first Play upload)
- **Display name:** Whisper Ball
- **Android package / iOS bundle:** `com.wispersofthepast.whisperball`
- **Version:** 1.0.0 · Android versionCode 1 · iOS buildNumber 1
- **Publisher:** Wispers of the Past

## Modes
| Mode | Notes |
|---|---|
| **Quick Match** | vs adaptive CPU. CPU skill drifts ±0.03–0.07 per round based on score margin. First to 7. |
| **Campaign** | 50 hand-tuned levels. Ball speed 0.8x→2.2x. Paddle 1.4x→0.45x. CPU 0.35→0.97. 3-star scoring by opponent score at win. Sequential unlock (need ≥1 star on N-1 to unlock N). Obstacles from L25 (count tiers at L35, L45+ adds vertical oscillation). Multi-ball from L40. |
| **Daily Challenge** | Deterministic seed per UTC date (mulberry32 + FNV-1a). Same parameters, ball angles, and obstacle layout for every player on a given day. Local daily-best score persisted per date. First to 9. |
| **Local 2P** | Two-thumb shared phone. Left half = p1, right half = p2. No CPU. Either side can curve. |

## Game Feel
- **Drag-anywhere paddle** on your half (PanGesture, eased smoothing in physics loop)
- **Slow-start serve**: ball releases at 55% of target speed, ramps to 100% over 3.5s. Per-paddle-hit `speedUp` (1.025–1.06× per hit) then compounds on top.
- **Curve ball**: flick your paddle hard at impact (>280 px/s tracked via low-pass filtered shared value). Ball picks up perpendicular acceleration (capped at 1400 px/s²) that decays over ~0.6s. Visual: trail lengthens + "CURVE" pill flashes. Audio: medium haptic.
- **Spin** proportional to where ball strikes paddle (offset from center)
- **Tiered obstacles**: L25–34 = 1 center bar · L35–44 = 2 stacked bars · L45–50 = 3 bars + slow vertical sine oscillation. Curve dampens to 40% on obstacle hit.
- **Multi-ball** (L40+): second ball spawns at serve, full independent physics, can be curved separately.
- **Rally milestones**: chime at 5/10/25/50 hits (per audio spec).
- **Themes**: Whisper (default) + 1972 (unlock at first 50-hit rally) — theme-aware SFX swap automatically.

## Audio (12/12 wired)
| Trigger | Whisper file | 1972 file | Vol |
|---|---|---|---|
| Paddle hit | `paddle_hit.wav` | `retro_paddle_hit.wav` | 0.85 |
| Wall / obstacle hit | `wall_hit.wav` | `retro_wall_hit.wav` | 0.70 |
| Score | `score.wav` | `retro_score.wav` | 0.90 |
| Rally milestone (5/10/25/50) | `rally_bonus.wav` | shared | 0.90 |
| Round win | `win.wav` | shared | 0.90 |
| Round lose | `lose.wav` | shared | 0.90 |
| Menu primary tap | `menu_select.wav` | shared | 0.70 |
| Menu back / cancel | `menu_back.wav` | shared | 0.70 |
| Ambient (looping bed in game) | `ambient_drone.wav` | shared | 0.35 |

Ambient starts on game-screen mount, pauses on pause, stops on round end so the win/lose sting can breathe, stops on exit.

## Persistence (AsyncStorage, namespaced `wb:`)
- `wb:campaign:stars` — `{ [levelId]: 0..3 }`
- `wb:bestRally` — global longest paddle hit streak
- `wb:unlocked:1972` — boolean
- `wb:theme` · `wb:sound` · `wb:haptics`
- `wb:daily:best` — `{ [dateKey]: score }`
- `wb:quick:best` — best rally in Quick Match

## Settings Screen
- Theme picker (Whisper / 1972 — 1972 shows lock + best-rally hint until unlocked)
- Sound toggle (mutes SFX + ambient loop in real time; chirps confirmation when re-enabled)
- Haptics toggle
- About info (version, publisher)

## Architecture
```
/app/frontend/
├── app/
│   ├── _layout.tsx        # GestureHandlerRootView + SafeAreaProvider + Stack (icon prewarm preserved)
│   ├── index.tsx          # Main menu (greeting + 1 primary + 3 secondary cards + settings corner)
│   ├── game.tsx           # Pong engine — physics, audio, gestures, obstacles, curve, multi-ball, overlays
│   ├── campaign.tsx       # 50-level grid with star + obstacle/multi-ball tags
│   └── settings.tsx       # Theme / sound / haptics
├── src/game/
│   ├── theme.ts           # Whisper + 1972 themes (colors, glow, scanlines flag)
│   ├── levels.ts          # 50-level parameter table + LevelConfig type
│   ├── seed.ts            # mulberry32 + FNV-1a date-seed for Daily Challenge
│   ├── persistence.ts     # AsyncStorage wrapper
│   └── audio.ts           # expo-audio manager — one-shot + looping with graceful no-op on miss
└── assets/audio/          # 12 .wav files (10 SFX + 1 ambient + 1 retro variant set)
```

## Deferred (post-internal-test, requires production decision)
- **Firebase async multiplayer** / online daily leaderboard / friend codes — needs project setup + INTERNET permission addition + privacy policy update
- **RevenueCat IAPs** — Premium $2.99 full unlock + Theme IAPs $0.99. Needs dev build + RC dashboard config.
- **Ad placements** — between-rounds banner for Free tier. Same caveat as IAPs.

## Play Store Readiness
- ✅ Package name + bundle ID set (`com.wispersofthepast.whisperball`)
- ✅ Version + versionCode + buildNumber set
- ✅ Orientation locked landscape
- ✅ Dark UI style
- ✅ New Architecture enabled
- ✅ Android `VIBRATE` permission declared (only one required)
- ✅ No `INTERNET` permission — fully offline
- ✅ Adaptive icon background set to brand obsidian
- ✅ Splash screen background matches brand
- ✅ All audio bundled at build time (no streaming)
- ✅ Privacy policy written (`/app/PRIVACY_POLICY.md`) and **hosted live** at https://wispersofthepastprints-prog.github.io/WhisperBall/privacy-policy.html
- ✅ Terms of Service hosted live at https://wispersofthepastprints-prog.github.io/WhisperBall/terms-of-service.html
- ✅ Both URLs linked from inside the app (Settings → About)
- ✅ Store listing copy drafted (`/app/PLAY_CONSOLE_CHECKLIST.md`)
- ⏳ Feature graphic (1024×500) needs to be designed
- ⏳ 2–8 phone screenshots needed
- ⏳ Tester email list needs to be added in Play Console

See `/app/PLAY_CONSOLE_CHECKLIST.md` for the full step-by-step from build → upload → tester rollout.

## Known dev-only console warnings (not bugs, not user-facing)
- `shadow*` style props deprecation on `react-native-web` — works correctly on native iOS/Android.
- `props.pointerEvents` deprecation on `react-native-web` — works correctly on native.
- These appear only on the Expo web preview and have no effect on the Android build or Play submission.
