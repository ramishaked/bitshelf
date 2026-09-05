# BitShelf Design System

Snapshot from the Claude Design project "BitShelf" (claude.ai/design, project 98212b5e), pulled 05.09.2026. The tokens here are the approved source for `packages/ui/theme.ts` (spec 15.5).

Mobile-first collection manager for retro computers and video game consoles (1970s to 1990s). iOS native feel, also runs on web. Hebrew UI by default with full RTL; English optional. Users are adult collectors who care about their machines and want to see them, not manage a database.

## Brand

- Logo: pixel-art shelf holding a computer, cartridge, floppy and book, with "BitShelf" in a bitmap font. Phosphor green on black, subtle scanlines and glow. Files: logo-reference.png (full), icon-reference.png (app icon: shelf with computer and floppy only, no text).
- Voice: spoken, professional, short. No hype, no cute.
- Retro is a seasoning, not the dish. Scanlines, glow and the bitmap font appear only in the logo, the splash screen and empty states. Every other screen is clean, modern iOS.

## Principles

1. Image first. Photos are the hero, the interface is the background. The gallery grid is the main screen, never a table.
2. Minimum forms. Progressive disclosure for advanced details. Quick actions from the photo itself.
3. Two separate condition dimensions, always shown side by side: cosmetic condition (1 to 5 stars) and working status (working / partial / not working / untested / for parts). Never merged into one indicator.
4. Private by default. Serial numbers, purchase prices and storage locations never appear in shared views.

## Colors

Dark mode is default.

| Token | Dark | Light | Use |
|---|---|---|---|
| background | #0E0F0D | #F4F5F1 | screen background |
| surface | #1A1C18 | #FFFFFF | cards, chips, inputs |
| surface-2 | #23261F | #ECEEE8 | pressed states, nested surfaces |
| text | #EDEFE8 | #161815 | primary text |
| text-muted | #9AA096 | #6B7066 | secondary text, labels |
| line | #2A2D27 | #DDE0D8 | dividers (use sparingly) |
| accent | #5CE65C | #1E9E3A | primary buttons, active tab, active chips, selected states |
| accent-dark | #2E8F2E | #167A2C | pressed accent, active chip background |
| on-accent | #0E0F0D | #FFFFFF | text on accent buttons |
| status-working | #5CE65C | #1E9E3A | working |
| status-partial | #F5A524 | #D98C0E | partially working, low-confidence AI fields |
| status-broken | #E0563F | #C7432E | not working, needs attention |
| status-untested | #7A7F76 | #8A8F86 | untested, unknown |
| glow | rgba(92,230,92,.35) | rgba(30,158,58,.3) | floating add button shadow |

Logo green is #3DF23D; the UI accent is deliberately a little softer.

## Typography

- UI: SF Pro (system font on iOS). Hebrew: SF Hebrew. On web fall back to system-ui.
- Numbers that identify things (serial numbers, years, prices, item counts): SF Mono / monospace.
- Bitmap / pixel font: logo, splash and empty states only. Never in body copy or buttons.
- Sizes: large title 28 bold, title 22 bold, body 16, secondary 14, caption 12. Line height 1.3.

## Layout and components

- Corner radius 12 on cards and buttons, 8 on tags, 999 on chips.
- No drop shadows in dark mode. Separate surfaces by tone, not by lines.
- Photo grid: 3 columns, 2px gaps, square tiles, so photos form a wall. Each tile has a small status dot (working status color) top-right and a lock glyph top-left when private. Item name in monospace on a bottom gradient.
- Tab bar: standard iOS, SF Symbols, four tabs (Collection, Galleries, Favorites, Profile). Active tab in accent. Background is the screen background with a top line divider.
- Floating add button: accent circle with soft glow, bottom-left in RTL.
- Chips row for filters, horizontal scroll, active chip in accent-dark with white text.
- Cards: surface background, 12 radius, 12 to 14 padding, label in text-muted 13 above content.
- Status tags: small surface pill with a colored dot and the status word.
- Value display: fair value in monospace 26 accent, low and high in monospace 13 muted on either side.
- Buttons: primary is accent background with on-accent text; secondary is surface background with text color. Height 48.

## RTL rules

- Hebrew is the default language; design in RTL first.
- Latin strings (manufacturer, model, numbers) stay LTR inside RTL layouts and never break.
- Icons that imply direction (back, chevrons) mirror in RTL.

## Do not

- No white or light grey backgrounds in dark mode.
- No gradients except the bottom gradient on photo tiles.
- No emoji in UI copy.
- No em dashes or en dashes in any copy. Use comma, period, colon or parentheses.
- No pixel font or scanlines outside logo, splash and empty states.

## Screens in the canvas

The canvas (bitshelf-screens.dc.html) holds five artboards, iPhone 375pt, Hebrew RTL:

1. 01 gallery: collection grid with segmented gallery/dashboard, search, filter chips, floating add button.
2. 02 item: photo carousel, title, status tags row, value card, set card, collapsed info rows, action buttons.
3. 03 AI confirm: identified fields, low-confidence fields in amber with alternatives chips, two separate condition pickers, save.
4. 04 dashboard: count and value cards, manufacturer bars, working-status split, needs-attention card, recently added.
5. 05 model info: AI-generated model spec, history and tips. Not in docs/spec.md yet, see STATUS.md.
