# BitShelf

Collection manager for retro computers and consoles. iOS first (native feel), web second, Android later.
Owner: Rami. Solo project, built with Claude Code. Hebrew UI by default, English optional, full RTL.

## Read first

- `docs/spec.md` is the source of truth. Do not invent features that are not in it. If something is ambiguous, ask once, then proceed and note the assumption in the PR description.
- `docs/mockup.html` shows the four core screens (gallery, item, AI confirm, dashboard). Match its hierarchy, not its pixel values.
- `docs/logo-reference.png` and `docs/icon-reference.png` are references, not assets. Vector assets live in `packages/ui/assets/`.
- Section 2 of the spec (principles) wins over any convenience. Image first. Private by default. Single item by default. Condition and working status are two separate dimensions everywhere.

## Stack (do not change without asking)

- Monorepo, pnpm workspaces + Turborepo: `apps/mobile` (Expo, expo-router), `apps/web` (Next.js, public gallery pages + API routes), `packages/api`, `packages/db` (Drizzle + Neon Postgres), `packages/ui` (theme, components), `packages/i18n`.
- Auth: Clerk (Apple, Google, email). Guest mode for public galleries.
- Photos: Cloudflare R2. Max 2000px stored, 400px thumb, 1200px medium. Thumbnails generated on device before upload.
- AI: Claude API, vision. One system prompt per CollectionType, stored in the seed. Output is JSON only.
- Prices: eBay Browse API (asking prices). PriceCharting is out. No AI price estimates, ever.
- Local cache: expo-sqlite. Grid must open from cache in under 1 second.
- Lists: FlashList. Images: expo-image with disk cache.
- Payments (phase 3 only): RevenueCat.

## Data model rules

- Core vs Vertical, see spec section 4.0. Generic fields are real columns on `items`; domain fields go in `attributes` (jsonb) validated against `collection_types.attributes_schema`.
- `manufacturer`, `model`, `year` are generated columns from `attributes` for fast filtering.
- Only one CollectionType exists: `retro_tech`, seeded from `packages/db/seeds/retro_tech.json`. Do not build a second vertical or a schema editor.
- `parent_item_id` depth is 1. A child cannot have children.
- `serial_number`, `purchase_price`, `storage_location`, `notes` never appear in any shared or public view.

## UI rules

- Theme tokens in `packages/ui/theme.ts`. No hex values anywhere else.
- Dark is default. Light mode must work on every screen.
- Retro styling (scanlines, glow, bitmap font) only on splash, empty states and the logo. Nowhere else.
- RTL: every screen tested in both directions. Latin strings (model names, numbers) wrapped in LTR isolate.
- All strings through i18next, `he.json` and `en.json`. Hebrew is written first; English is not a translation placeholder.
- Status colors: working = green, partial = amber, not working / needs attention = red, untested = grey. Never merge condition grade and working status into one indicator.
- Minimum forms. Every field that can be completed later must not block saving.

## Writing rules (for any Hebrew or English text in the app, docs, commits)

- No em dash or en dash anywhere, including code comments and commit messages. Use comma, period, colon or parentheses.
- No curly quotes, no ellipsis character, no emoji in UI copy.
- Hebrew copy is spoken-professional, short, no translationese. If a sentence sounds translated from English, rewrite it.

## Workflow

- One phase at a time, following spec section 14. Do not start phase N+1 work while phase N is open.
- Before touching code in a new area, run `pnpm typecheck` and `pnpm test` and keep them green.
- Commits: small, one concern each, message in English, imperative.
- After each feature: update `docs/spec.md` if reality diverged from it, and say so in the commit.
- Never run `eas submit` or anything that publishes. Rami does that.
- Never store secrets in the repo. `.env.example` lists every variable with a comment.

## Definition of done for phase 1

Rami can, on his own iPhone via TestFlight: photograph an item, confirm the AI fields, save in under 30 seconds; browse 200+ items smoothly; filter and search; create a gallery and share a public link; see a dashboard; export CSV + ZIP. Shelf scan works behind a feature flag and is labeled Beta.
