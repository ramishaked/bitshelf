import { randomUUID } from "expo-crypto";

// Readable slug for the public link (spec 7.3): latin name if there is one,
// plus a short random suffix so revoking and resharing yields a fresh URL.
export function makeSlug(nameEn: string | null): string {
  const base = (nameEn ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
  return base ? `${base}-${suffix}` : `shelf-${suffix}`;
}

// The public gallery is served by the Next.js app (spec 8.1)
const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:3000";

export function publicGalleryUrl(slug: string): string {
  return `${WEB_URL.replace(/\/$/, "")}/g/${slug}`;
}
