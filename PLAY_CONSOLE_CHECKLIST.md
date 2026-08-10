# Play Console — Internal Testing Checklist

Use this file as your step-by-step setup guide for getting Whisper Ball onto Google Play Console's **Internal testing** track.

---

## 1. Identity & Versioning (already configured in `app.json`)

| Field | Value |
|---|---|
| App display name | **Whisper Ball** |
| Android package name | `com.wispersofthepast.whisperball` |
| iOS bundle ID | `com.wispersofthepast.whisperball` |
| version | `1.0.0` |
| Android `versionCode` | `1` |
| iOS `buildNumber` | `1` |
| Orientation | landscape (locked) |
| UI style | dark |
| New Architecture | enabled |

> **Important:** the package name **cannot be changed** after the first APK/AAB upload. The current value combines your business name + game name in reverse-DNS form. If you want a different one, change it now before publishing.

---

## 2. Privacy Policy & Terms of Service — LIVE URLs

Both documents are hosted on GitHub Pages and are publicly accessible.

| Document | URL |
|---|---|
| **Privacy Policy** | https://wispersofthepastprints-prog.github.io/WhisperBall/privacy-policy.html |
| **Terms of Service** | https://wispersofthepastprints-prog.github.io/WhisperBall/terms-of-service.html |

Both URLs are also linked from inside the app (Settings → About → tappable rows).

Paste the **Privacy Policy URL** above into Play Console → Policy → App content → Privacy Policy. The Terms of Service URL is not required by Play Console but is good practice to have.

A backup Markdown source of the privacy policy is kept in the repo at **`/app/PRIVACY_POLICY.md`**.

---

## 3. Build the Android App Bundle (.aab)

Inside Emergent:

1. Click the **Publish** button (top-right of the editor)
2. Select **Android build (AAB)**
3. Emergent will generate a signed bundle and a download link
4. Save the `.aab` file locally

(Internal testing accepts both `.apk` and `.aab`, but **`.aab` is required for the production track later**, so build it now to save a step.)

---

## 4. Play Console — One-time Setup

If this is your first app:

1. Sign up at https://play.google.com/console (one-time $25 developer fee)
2. Verify your identity (Google takes 1–3 business days)
3. Set up a payments profile (required even for free apps)

---

## 5. Create the App Listing

In Play Console:

1. **All apps → Create app**
2. App details:
   - **App name:** Whisper Ball
   - **Default language:** English (United States)
   - **App or game:** Game
   - **Free or paid:** Free
3. Confirm declarations (developer policies, US export laws)
4. Click **Create app**

---

## 6. App Content (required questionnaires)

Fill these in `Policy → App content`. With our zero-data-collection design, answers are mostly "No":

| Section | Answer |
|---|---|
| **Privacy policy** | Paste your hosted URL |
| **App access** | All functionality available without restrictions / login |
| **Ads** | No, my app doesn't contain ads |
| **Content rating** | Run the questionnaire → likely **Everyone / PEGI 3**. Genre: Casual. No violence, no sex, no profanity, no gambling, no user-generated content. |
| **Target audience** | Ages 13+ *(or whatever you choose; the app is suitable for all ages)* |
| **News app** | No |
| **COVID-19 contact tracing** | No |
| **Data safety** | "No data collected" — confirm collection: **None** |
| **Government apps** | No |
| **Financial features** | No |
| **Health** | No |

---

## 7. Store Listing Copy (paste-ready)

### Short description (max 80 characters)
> A modern table-ball game. Curve, rally, and outlast the CPU across 50 levels.

### Full description (max 4000 characters)
> **Whisper Ball — Pong's spirit, polished for 2026.**
>
> Drag your paddle. Flick to curve. Rally past the breaking point. Whisper Ball is a precision table-ball game that takes a classic mechanic and renders it with modern feel — smooth 60fps physics, tactile haptics, restrained sound design, and one of the cleanest table aesthetics on Android.
>
> **MODES**
> • **Quick Match** — Drop straight into a game against an adaptive CPU. Beat it convincingly and it'll come back harder.
> • **Campaign** — 50 hand-tuned levels. Ball speeds up, your paddle shrinks, obstacles appear, then multiply, then move. Three stars per level.
> • **Daily Challenge** — One seed, the same for every player worldwide, refreshed at UTC midnight. See how long your best rally holds up overnight.
> • **Local 2P** — Two thumbs, one phone. Drag a half each. No CPU, no mercy.
>
> **WHAT MAKES IT FEEL DIFFERENT**
> • **Curve the ball** by flicking your paddle into it. The ball bends mid-flight.
> • **Rally milestones** at 5, 10, 25, 50 hits — celebratory chime, growing trail.
> • **Two themes** — the default Whisper (obsidian + ivory + gold) and a hidden 1972 theme that unlocks when you hit a 50-rally for the first time.
> • **Slow-start serve** so every point has room to breathe before the rally accelerates.
> • **Landscape-only** on phones and tablets. Two-handed by design.
>
> **WHAT YOU WON'T FIND**
> No ads. No microtransactions. No accounts. No internet permission. No data collection of any kind. Just a game.
>
> Made by Wispers of the Past.

### Graphic assets needed (must upload to Play Console)

| Asset | Spec |
|---|---|
| App icon | 512×512 PNG, 32-bit (already in `/app/frontend/assets/images/icon.png`) |
| Feature graphic | 1024×500 JPG/PNG, no transparency, no rounded corners |
| Phone screenshots | 16:9 landscape, min 1080px on long edge, 2–8 images |
| Tablet (7") screenshots | optional but recommended |
| Tablet (10") screenshots | optional but recommended |

**Recommended screenshot order:**
1. Main menu (greeting + Quick Match card visible)
2. Mid-rally (showing paddle + ball + curve trail)
3. Campaign grid (showing star progress)
4. Multi-obstacle level (L45+ chaos)
5. End screen with stars

---

## 8. Internal Testing Track

1. Play Console → **Testing → Internal testing → Create new release**
2. Upload the `.aab` from step 3
3. Release name: `1.0.0 (1)`
4. Release notes (paste-ready):
   > First internal beta of Whisper Ball.
   > • 4 modes — Quick Match, 50-level Campaign, Daily Challenge, Local 2P
   > • Curve ball mechanic + tiered obstacles + multi-ball
   > • Whisper + hidden 1972 themes
   > • Full audio + haptics
   > • No ads, no data collection
5. **Testers tab → Create email list** → add your tester Gmail addresses (up to 100)
6. Save → Review release → **Start rollout to Internal testing**

Internal testing builds become available to testers via an opt-in link, usually within ~10 minutes.

---

## 9. Pre-flight Checklist

Before you click **Start rollout**, confirm:

- [ ] Package name is final (`com.wispersofthepast.whisperball`) — cannot change later
- [ ] Privacy policy is live at a public URL
- [ ] App icon is sharp and centered (foreground only, transparent edges) at 512×512
- [ ] Adaptive icon background is the obsidian #0A0A0F (already set)
- [ ] All 12 audio files are bundled (check by playing on a device with sound on)
- [ ] Campaign saves/restores stars after closing the app
- [ ] Best rally persists between sessions
- [ ] 1972 theme unlocks at a 50-hit rally (test by setting a debug score temporarily, or just play a few games)
- [ ] Pause/resume preserves score and rally
- [ ] Back gesture / system back button doesn't break navigation
- [ ] Tablet rendering still looks balanced (test in Android Studio emulator at 10")

---

## 10. After Internal Testing

When you're happy with internal feedback:

1. Bump `versionCode` to `2` and `version` to e.g. `1.0.1`
2. Re-build via Emergent's Publish button
3. Promote the existing release from Internal → **Closed testing** (private alpha) or → **Open testing** (public beta) using the Play Console "Promote release" button
4. Or graduate straight to Production once content rating, store listing, and main store listing graphics are all approved

---

## Notes

- Internal testing has **no review time** — releases go live in minutes.
- Closed/Open testing and Production go through Google review (1–7 days first time, faster after).
- Google now requires **target API level 34** (Android 14). Expo SDK 54 satisfies this automatically.
- The app does not request the `INTERNET` permission, so Play Console may flag it as a "non-networked" app — that's correct and expected.
