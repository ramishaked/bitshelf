import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { darkColors, spacing } from "@bitshelf/ui/theme";
import { Breadcrumb } from "../../../components/breadcrumb";
import { loadPublicGallery, statusColorFor } from "../../../lib/public-gallery";

// The public link is the only outside view (spec 8.1). Always fresh so a
// revoked link dies immediately.
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await loadPublicGallery(slug).catch(() => null);
  if (!gallery) return { title: "BitShelf" };
  const title = gallery.name.he ?? gallery.name.en ?? "BitShelf";
  return {
    title: `${title} | BitShelf`,
    description: gallery.description?.he ?? `${gallery.itemCount} פריטים באוסף`,
    openGraph: {
      title,
      description: gallery.description?.he ?? `${gallery.itemCount} פריטים באוסף`,
      images: gallery.coverUrl ? [{ url: gallery.coverUrl }] : undefined,
    },
  };
}

export default async function PublicGalleryPage({ params }: Params) {
  const { slug } = await params;
  const gallery = await loadPublicGallery(slug).catch(() => null);
  if (!gallery) notFound();

  const title = gallery.name.he ?? gallery.name.en ?? "";

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: spacing.lg }}>
      <Breadcrumb
        crumbs={[
          { label: "הלובי", href: "/" },
          ...(gallery.collector
            ? [{ label: gallery.collector.title, href: `/u/${gallery.collector.handle}` }]
            : []),
        ]}
      />
      <header style={{ padding: `${spacing.lg}px 0 ${spacing.md}px` }}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            color: darkColors.accent,
            fontSize: 13,
            direction: "ltr",
            textAlign: "right",
          }}
        >
          BitShelf
        </div>
        <h1 style={{ margin: `${spacing.sm}px 0 0`, fontSize: 26 }}>{title}</h1>
        {gallery.description?.he ? (
          <p style={{ margin: `${spacing.xs}px 0 0`, color: darkColors.textSecondary }}>
            {gallery.description.he}
          </p>
        ) : null}
        <p
          style={{
            margin: `${spacing.xs}px 0 0`,
            color: darkColors.textSecondary,
            fontSize: 13,
          }}
        >
          {gallery.itemCount} פריטים
        </p>
      </header>

      {gallery.items.length === 0 ? (
        <p style={{ color: darkColors.textSecondary }}>אין פריטים בגלריה הזאת.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 2,
          }}
        >
          {gallery.items.map((item) => {
            const photo =
              item.photos.find((p) => p.isPrimary) ?? item.photos[0] ?? null;
            return (
              <Link
                key={item.id}
                href={`/g/${slug}/i/${item.id}`}
                style={{
                  position: "relative",
                  display: "block",
                  aspectRatio: "1",
                  overflow: "hidden",
                  backgroundColor: darkColors.surface,
                  textDecoration: "none",
                }}
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.thumbUrl ?? photo.url}
                    alt={item.title}
                    loading="lazy"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : null}
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    insetInlineEnd: 6,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: statusColorFor(item.workingStatus),
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    insetInline: 0,
                    bottom: 0,
                    padding: "22px 6px 5px",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
                    color: "#FFFFFF",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 11,
                    direction: "ltr",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.title}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <footer
        style={{
          marginTop: spacing.xl,
          padding: `${spacing.lg}px 0`,
          color: darkColors.textSecondary,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "ui-monospace, monospace",
            color: darkColors.accent,
            direction: "ltr",
          }}
        >
          BitShelf
        </span>
        {" · "}
        ניהול אוסף רטרו
      </footer>
    </main>
  );
}
