# Handoff: BitShelf — Liquid Glass redesign

Target repo: `ramishaked/bitshelf` (branch `main`). Design docs live in `docs/spec.md` and the design system in `DESIGN.md`.

## Overview
Redesign the BitShelf app UI to adopt Apple's Liquid Glass design language (iOS 26 / Xcode 26 SDK), while keeping the layouts, content, colors and Hebrew RTL behavior shown in the attached mockups.

## About the design files
`BitShelf Screens.dc.html` is a **design reference built in HTML** — five phone-frame mockups showing intended look and content, not production code. Recreate these screens in the app's existing environment using its established patterns. Open the HTML file in a browser to view it.

## Fidelity
High-fidelity: colors, spacing, typography, copy and layout in the mockups are final. The **material treatment** (glass) is what changes in this redesign — see mapping below.

## Screens in the mockup (right to left, RTL page)
1. **01 גלריה** — collection photo grid: large title, גלריה/דשבורד segmented control, search field, filter chips row, 3-column photo wall (2px gaps, status dot top-right, lock glyph top-left, monospace name on gradient), floating add button bottom-left, 4-tab bar.
2. **02 פריט** — item detail: swipeable photo hero (236px), title + year/region/shelf, status chips (working dot, condition 4/5, CIB), estimated-value card ($180 / **$260** / $340 with confidence note), set card (linked items + add), disclosure rows (רכישה, פרטים טכניים, יומן תיקונים), bottom actions שתף / למכירה / ערוך.
3. **05 מידע על הדגם** — model info sub-screen (opens from פרטים טכניים): back button, spec table (mono LTR values), רקע היסטורי paragraph, שווה לדעת collector bullets, גרסאות ידועות row, AI-generated disclaimer footer.
4. **03 אישור אחרי זיהוי AI** — post-capture confirm: photo card with count/duration badge, editable field rows (יצרן, דגם + variant chips, גרסה/שנה flagged לבדוקin warn color, אזור), condition star picker + functional-state chips, location row, שמור לאוסף / צלם שוב.
5. **04 דשבורד** — stat cards (214 items, $18.4k), לפי יצרן bar list, functional-state 4-up, דורש טיפול row, נוספו לאחרונה thumbnail strip.

## Liquid Glass mapping (SwiftUI, iOS 26 SDK)
Rebuild with the system APIs — do not fake glass with blur+opacity:

- **Recompile with Xcode 26**: standard `TabView`, `NavigationStack` toolbars, sheets and search fields adopt Liquid Glass automatically. Prefer this over custom chrome.
- **Tab bar**: standard `TabView` with SF Symbols (Collection, Galleries, Favorites, Profile). Add `.tabBarMinimizeBehavior(.onScrollDown)` on the gallery so the photo wall gets the full screen while scrolling.
- **Floating add button**: `Button` + `.buttonStyle(.glassProminent)` tinted with the accent (`#5CE65C` dark / `#1E9E3A` light), positioned bottom-leading (RTL-aware — use leading, not `.left`). Keep the soft glow shadow.
- **Search field**: `.searchable(...)` on the gallery — it renders as a glass capsule near the keyboard on iOS 26.
- **Segmented control (גלריה/דשבורד)** and **filter chips**: group in a `GlassEffectContainer`; chips as capsules with `.glassEffect(.regular.interactive())`, active chip tinted `.glassEffect(.regular.tint(accentDark).interactive())`.
- **Item screen bottom actions**: a glass toolbar — `.glassProminent` for שתף, `.glass` for למכירה / ערוך — floating over content, not pinned to an opaque bar.
- **Cards (value, set, dashboard stats)**: keep as tonal surfaces (`surface` colors below), NOT glass. Liquid Glass is for the navigation/control layer floating above content; content cards stay opaque per the design system ("separate surfaces by tone, not lines").
- **Photo hero + grid**: edge-to-edge photos; let glass toolbar/status controls float over them (that's where Liquid Glass shines).
- **Status/nav bars over photos**: system materials handle legibility; do not add custom scrims beyond the existing name gradient on tiles.
- **Respect Reduce Transparency / Increase Contrast**: system glass handles this automatically — another reason not to hand-roll it.

## Design tokens (from DESIGN.md / mockup)
Dark: page `#050605`, bg `#0E0F0D`, surface `#1A1C18`, surface-2 `#23261F`, text `#EDEFE8`, muted `#9AA096`, line `#2A2D27`, accent `#5CE65C`, accent-dark `#2E8F2E`, warn `#F5A524`, bad `#E0563F`, untested `#7A7F76`.
Light: page `#E4E6E0`, bg `#F4F5F1`, surface `#FFFFFF`, surface-2 `#ECEEE8`, text `#161815`, muted `#6B7066`, accent `#1E9E3A`, accent-dark `#167A2C`.
Type: SF Pro / SF Hebrew; SF Mono for identifying numbers (years, prices, serials, counts). Bitmap font only in logo/splash/empty states. Radii: chips 999, fields/cards 10–12, buttons 12. No drop shadows in dark mode (glow on the add button is the exception).

## Interactions
- Gallery tile → item screen. פרטים טכניים row → model-info screen (push). Hero photo swipes with page dots. AI confirm: chips select variant, stars set condition, warn-colored fields are tappable to correct. All screens RTL; numerals and Latin model names stay LTR (`unicode-bidi: isolate` in the mockup — use `\u2066`/environment layout direction in SwiftUI).

## Assets
- `logo-reference.png`, `icon-reference.png` — brand lockups (phosphor green pixel art).
- Photos in the mockup are Wikimedia Commons reference shots; the real app uses user photos.

## Suggested prompt for Claude Code
> Read design_handoff_liquid_glass/README.md and open BitShelf Screens.dc.html in a browser. Redesign the BitShelf UI to adopt iOS 26 Liquid Glass per the mapping in the README: recompile against the iOS 26 SDK, use standard TabView/NavigationStack/searchable chrome, glassEffect for chips and floating controls, glassProminent for the add button and primary actions. Keep layouts, copy, Hebrew RTL and the color tokens exactly as in the mockups; content cards stay tonal, not glass. Work screen by screen: gallery, item detail, model info, AI confirm, dashboard.
