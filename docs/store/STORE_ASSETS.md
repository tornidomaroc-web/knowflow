# Store assets: the exact specifications, and the iPhone-only ruling

Written 2026-09-25 for Phase 10 (PIVOT_PLAN.md §7). The app icon and the
store icon are designed by the owner outside this repository; nothing here
draws one. This file says exactly what each store accepts, so the files the
owner produces are right the first time, and records the device ruling.

The screenshot and Play listing figures below were read on 2026-09-25 from
App Store Connect Help (screenshot specifications) and the Google Play
Console Help (store listing assets). The iOS icon figures are the standing
Xcode asset-catalog requirements (1024 px, opaque, square); Apple's HIG
page could not be read by the tool this session, so the owner re-reads it
the week of submission. The stores change these pages; re-read all three
then and correct this file in place.

## 1. The app icon (on the phone) and the store icon (in the listing)

Apple uses ONE artwork for both: the 1024×1024 icon in the Xcode asset
catalog is what App Store Connect lists, and iOS derives every on-device
size from it. Google Play uses two: the adaptive icon inside the APK/AAB,
and a separate 512×512 listing icon uploaded in the Console. Since #282
(2026-10-15) there is one artwork everywhere: the owner's approved master
`assets/brand/AppIcon-1024.png`, from which `scripts/brand/gen-app-icons.py`
writes the iOS and Android icons, the splash screens, the web favicon and
tile and the share-card mark (`src/app/_brand/mark.ts` is gone).

### 1.1 iOS / App Store — one file

| Property | Requirement |
|---|---|
| Size | **1024 × 1024 px**, PNG (or the single-size PNG placed in `AppIcon.appiconset`) |
| Alpha | **None.** Fully opaque; a transparent pixel is a validation failure. |
| Corners | **Square.** iOS applies the superellipse mask itself; a pre-rounded icon shows dark corners. |
| Colour | sRGB or Display P3; 8-bit; no embedded transparency layer |
| Safe zone | Keep the artwork's essential ink inside the central ~80% (the mask and the concentric corner radius eat the edges; register #99 measured this for the web tile) |
| Text | Avoid words; the name sits under the icon |
| Dark / tinted variants (iOS 18+) | Optional: a dark variant (transparent background allowed **only** in the dark/tinted appearance files) and a tinted variant (greyscale). If not supplied, iOS derives them. |
| Where it goes | `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (Capacitor project, Phase 8) |

### 1.2 Android / Google Play — two files plus the adaptive layers

| Asset | Requirement |
|---|---|
| **Listing icon** (Play Console → Store listing) | **512 × 512 px**, 32-bit PNG with alpha, **≤ 1024 KB**. Play rounds the corners and adds the shadow; supply a **square, full-bleed** image, no pre-rounded corners, no drop shadow. |
| **Adaptive icon** (in the app) | Two layers, each **108 × 108 dp** (432 × 432 px at xxxhdpi): a **foreground** with the mark inside the central **66 dp** safe circle, and a **background** (solid warm dark `#14110d` is fine). Supplied as PNG per density or as vector drawables; Capacitor's asset tool generates the densities from one 1024 source. |
| Legacy icon | Not needed on Android 8+; the adaptive icon covers it. |
| Where it goes | `android/app/src/main/res/mipmap-*/` (Phase 8) |

### 1.3 One source file for the owner to hand over

A single **1024 × 1024 PNG, opaque, square corners, essential ink inside the
central 80%**, on the warm dark ground. From it: the iOS icon as is; the Play
listing icon by downscaling to 512; the Android foreground layer by placing
the mark at the adaptive safe-zone scale on a transparent 432 canvas with
the background layer as the flat ground colour. If a light-ground version
is wanted for the iOS light appearance, hand over a second 1024 file.

## 2. Google Play feature graphic

| Property | Requirement |
|---|---|
| Size | **1024 × 500 px**, JPEG or 24-bit PNG (**no alpha**) (Play Console Help, read 2026-09-25) |
| Content | Keep text and the mark away from the outer ~10% (the Console crops for some placements); do not repeat the icon at full size; no store badges or prices |
| Required? | Required to be featured or shown with a promo video; effectively required |

## 3. Screenshots

### 3.0 App Store, iOS 1.1 (item 4i, 2026-11-23): what holds now

Read on 2026-11-23 from Apple's "Screenshot specifications"
(https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications):
"To submit your app, you must provide screenshots for the following required
display sizes: iPhone: At least one screenshot for iPhone with Dynamic Island
(medium display)." That class (iPhone 18 Pro, 17 Pro, 17, 16 Pro, 16, 15
Pro, 15, 14 Pro) takes **1206 × 2622** or 1179 × 2556 portrait. The 6.9-inch
class ("Dynamic Island, large display": 1320 × 2868, 1290 × 2796, 1260 ×
2736) is still accepted, but it is no longer the required one. Version 1.0.1
(approved 2026-10-29) carries the 6.9-inch set only, and nothing proves that
App Store Connect still accepts 1.1 with that set alone. **So the 1.1 set
ships at both sizes:** 1320 × 2868 and 1206 × 2622, drawn from one template
and one capture (`scripts/store-shots/render.mjs --set 1.1 --size …`,
`frame-1.1.mjs`). The capture is scaled, never stretched. 1 to 10 per size
per language, no alpha.

| | 1.1 set |
|---|---|
| Look | Design C **light** (ground `#f4ede1`, ink `#1a1611`, gold phrase `#7a580e`); a light clay phone with no island, no buttons and no Apple mark; no dark shot |
| Screens | **Six**, the same six in both languages, in this order: subjects, a subject's materials, the camera sheet, summary, Ask with its sources, quiz |
| Captions | `docs/store/screenshots-designed/captions-1.1.json`, built by `scripts/store-shots/captions_1_1.py` from the owner-approved file of 2026-11-23 11:57Z (`captions-1.1.approved.json`, v2, SHA-256 `341a19f6…2c780740`; it replaced the 11:32Z file, whose en 04, 05 and 06 broke badly on two lines), checked byte for byte in CI |
| Checks (both sizes) | ≤ 2 lines, gold phrase in one piece, ≤ 6 words, no dash, no @, no price/plan/upgrade/free/pro word, no platform or store name, Rubik covers every letter, Arabic joined, caption ≥ 32 px above the phone, exact size, no alpha; and, new: no word alone on a line, no KEEP_TOGETHER phrase split, ink and gold ≥ 4.5:1 read from the rendered pixels, Latin runs isolated in an Arabic caption, no line ending on a small word (English: that, on, of, the, ...; Arabic: any word of one or two letters). Each new check has a planted case that must fail (for the small word: the rejected en 05 and en 06 as they wrap, and Arabic 06 broken after its two-letter word). |
| Locales | ar-SA: Arabic six. en-US and en-GB: English six. **fr-FR: English six** (new). Without a set of its own, fr-FR shows the primary (Arabic) set. The app has no French, and a French phone opens it in English, so the English set is the accurate one for that listing. |

**Decided order of the later work (owner, 2026-11-23):**

1. **PR 2: capture steps** (`scripts/store-seed/capture_steps.py`,
   `check_capture.py`): the six screens per language in design C, the
   camera sheet (three page photos from `docs/store/screenshot-content/pages/`,
   made by `make_pages.py`, nothing sent), the live Ask in both languages,
   and the readings on every shot (theme light, status-bar ink dark, no
   purchase or platform word, no `data-kf-iap`, no e-mail, no dialog or
   keyboard, sources and microphone in 05). Proved without macOS in
   store-shots.yml (self-test with planted failures; the steps on the
   preview pages). Merged next.
2. **ONE capture right after PR 2 merges (owner, 2026-11-23, correcting the
   earlier order: it does not wait for item 4j).** 2 Ask calls, 0 page reads.
   The frame job pushes `store/shots-<run>` with 12 raw and 24 framed PNGs
   (`docs/store/screenshots-1.1/<l>/`, `docs/store/screenshots-designed/1.1/<size>/<l>/`)
   for review PR 2b. If item 4j removes the microphone, only the Ask shot is
   captured again.
3. **PR 3: `scripts/asc/store_setup.py` for 1.1** (two display types, the
   version 1.1 only, fr-FR English), after the capture.

### 3.1 App Store (iPhone-only submission, §5 below), the 1.0 and 1.0.1 set: HISTORY

*Kept as written for 1.0 and 1.0.1 (dark theme, five screens, 1320 × 2868
only, `captions.json`). Where it disagrees with §3.0, §3.0 holds.*

| Property | Requirement |
|---|---|
| Required set | **6.5" display: 1284 × 2778** portrait (2778 × 1284 landscape) is required unless a **6.9"** set is supplied instead: **1320 × 2868**, 1290 × 2796 or 1260 × 2736 portrait. Supply the 6.9" set (iPhone 16 Pro Max class); App Store Connect scales it to the other iPhone sizes. **1 to 10** screenshots. (App Store Connect Help, read 2026-09-25.) |
| Optional sets | 6.1" (1170 × 2532 / 1125 × 2436 / 1080 × 2340) and 5.5" (1242 × 2208) are scaled from the larger set when not supplied. |
| Format | `.png`, `.jpg` or `.jpeg`, sRGB, **no alpha channel or transparency**, no rounded corners, no status bar mock with a wrong time (use 9:41 or crop it) |
| Content rules | Must show the app as it runs; no device frames with a different device; localised per storefront (**Arabic and English sets**, since the listing is in both) |

### 3.2 Google Play

| Property | Requirement |
|---|---|
| Phone screenshots | **2 to 8**, JPEG or 24-bit PNG (**no alpha**), each side **320 to 3840 px** and the long side at most twice the short side; Play recommends at least 1080 px on the short side in 9:16 portrait; supply **1080 × 2340** or **1284 × 2778** portrait. (Play Console Help, read 2026-09-25.) |
| Tablet screenshots (7" and 10") and Chromebook | Required only when tablet or Chromebook support is declared: then **at least 4**, sides **1080 to 7680 px**, 16:9 or 9:16. **Not supplied** (§5). |
| Content rules | No misleading device frames, no prices or "free" claims that differ from the listing, localised per language |

### 3.3 Which screens, in which order (both stores, both languages): HISTORY, the 2026-09-25 plan (the 1.1 App Store set is in §3.0)

The set the owner takes on a device once Phase 8 builds the shell, from the
screens this run shipped, dark theme (the default), each with one line of
caption above the phone:

1. Student home, full state (streak, plan meters, subjects with progress).
2. Subjects (the cards with materials · summarised · quizzed).
3. A subject page (the header counts, materials with their study kit).
4. Ask, with an answer and its citation pills.
5. A summary open on a material.
6. A quiz in progress.
7. Settings (language, appearance) — optional.

## 4. Other listing assets

| Asset | App Store | Google Play |
|---|---|---|
| Name | ≤ 30 characters: **KnowFlow** | ≤ 30 characters |
| Subtitle / short description | ≤ 30 characters | ≤ 80 characters |
| Description | ≤ 4000 characters, per language | ≤ 4000 characters, per language |
| Promotional text | ≤ 170 characters, editable without a release | — |
| Keywords | ≤ 100 characters, comma-separated | — (indexed from the description) |
| Privacy | App Privacy labels: the exact answers are in `docs/store/ASC_ANSWERS.md` §1 (name, e-mail, other user content, user ID, product interaction, other diagnostic data; all linked, none for tracking; corrected 2026-10-10, the earlier list omitted name and diagnostics) | Data safety form, including the account-deletion declaration (PIVOT §7, Phase 10) |
| Support / privacy URLs | `https://tryknowflow.com/en/contact`, `https://tryknowflow.com/en/privacy` | the same |
| Age rating | Questionnaire; students may be minors → no ads until Phase 9 rules the ads posture | Content rating questionnaire |
| Category | Education | Education |

## 5. iPhone or iPad: ruled iPhone-only for the first submission

Capacitor's iOS template targets **Universal** (iPhone and iPad). For the
first submission KnowFlow ships **iPhone-only** (`TARGETED_DEVICE_FAMILY =
1` in the Xcode target; the App Store lists it as iPhone, and iPad users can
still install it in compatibility mode).

Why, in order of weight:

1. **Review runs on what is declared.** A Universal app is reviewed on an
   iPad, needs the 13" iPad screenshot set (2064 × 2752), and every screen
   must be right at 1032 × 1376 points in both orientations. None of the
   screens in this run were designed or looked at at that size; the
   dashboard's `md` breakpoint (768px) puts an iPad into the desktop
   layout, which was designed for a desk, not a lap.
2. **The audience is on phones.** The market ruling (Morocco and the Gulf,
   §7, 2026-09-08) and every measurement in the register are phone-width.
3. **It is reversible without a resubmission cost.** Adding iPad later is a
   target setting, a screenshot set and an update; removing it after a
   Universal launch means telling existing iPad users the app is gone.

Google Play has the equivalent: tablet screenshots are only required when
tablet support is declared; the Android shell declares phones only for the
first submission (`<supports-screens>` large/xlarge false, or a device
catalog exclusion in the Console).

Recorded here and in `docs/PROGRESS.md` (Section 7, 2026-09-25). Reopen
when a real iPad layout has been designed and looked at.
