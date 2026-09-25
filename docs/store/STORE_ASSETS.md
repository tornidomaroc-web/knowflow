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
and a separate 512×512 listing icon uploaded in the Console. The owner's
internal mark (`src/app/_brand/mark.ts`, register #99) is a different
thing again: it is the web home-screen tile and the share card, and it is
not what the stores receive.

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

### 3.1 App Store (iPhone-only submission, §5 below)

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

### 3.3 Which screens, in which order (both stores, both languages)

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
| Privacy | App Privacy labels (data collected: email, user content, usage data, identifiers; linked to identity; not used for tracking) | Data safety form, including the account-deletion declaration (PIVOT §7, Phase 10) |
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
