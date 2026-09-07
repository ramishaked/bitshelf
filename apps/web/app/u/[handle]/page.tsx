import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brand, darkColors, radius, spacing } from "@bitshelf/ui/theme";
import { loadCollectorShowcase } from "../../../lib/public-gallery";

// Collector showcase: one public page per collector, bio header plus a card
// for each published gallery. Always fresh so unpublishing takes effect at
// once (spec 8.1.2).
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const showcase = await loadCollectorShowcase(handle).catch(() => null);
  if (!showcase) return { title: "BitShelf" };
  return {
    title: `${showcase.title} | BitShelf`,
    description: showcase.bio ?? `${showcase.galleries.length} גלריות`,
    openGraph: {
      title: showcase.title,
      description: showcase.bio ?? undefined,
      images: showcase.galleries.find((g) => g.coverUrl)?.coverUrl
        ? [{ url: showcase.galleries.find((g) => g.coverUrl)!.coverUrl! }]
        : undefined,
    },
  };
}

export default async function CollectorPage({ params }: Params) {
  const { handle } = await params;
  const showcase = await loadCollectorShowcase(handle).catch(() => null);
  if (!showcase) notFound();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(680px 400px at 28% -8%, ${darkColors.accentSoft}, transparent), ${darkColors.background}`,
        padding: `${spacing.xxl}px ${spacing.lg}px`,
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <header style={{ marginBottom: spacing.xl }}>
          <div
            style={{
              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
              letterSpacing: 3,
              color: brand.logoGreen,
              textShadow: `0 0 14px ${brand.logoGreen}`,
              fontSize: 15,
              direction: "ltr",
              textAlign: "right",
            }}
          >
            BitShelf
          </div>
          <h1 style={{ margin: `${spacing.sm}px 0 0`, fontSize: 32, fontWeight: 700 }}>
            {showcase.title}
          </h1>
          {showcase.bio ? (
            <p
              style={{
                margin: `${spacing.sm}px 0 0`,
                fontSize: 16,
                lineHeight: 1.5,
                color: darkColors.textSecondary,
                maxWidth: 620,
              }}
            >
              {showcase.bio}
            </p>
          ) : null}
        </header>

        {showcase.galleries.length === 0 ? (
          <p style={{ color: darkColors.textSecondary }}>עוד אין גלריות פומביות.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            }}
          >
            {showcase.galleries.map((g) => (
              <Link
                key={g.slug}
                href={`/g/${g.slug}`}
                style={{
                  display: "block",
                  background: darkColors.surface,
                  borderRadius: radius.card,
                  overflow: "hidden",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    aspectRatio: "4 / 3",
                    background: darkColors.surface2,
                    position: "relative",
                  }}
                >
                  {g.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={g.coverUrl}
                      alt={g.name.he ?? ""}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ padding: `${spacing.sm + 2}px ${spacing.md}px` }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {g.name.he ?? g.name.en ?? ""}
                  </div>
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 13,
                      color: darkColors.textSecondary,
                    }}
                  >
                    {g.itemCount} פריטים
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p style={{ marginTop: spacing.xxl, fontSize: 13, color: darkColors.textSecondary }}>
          נבנה עם BitShelf
        </p>
      </div>
    </main>
  );
}
