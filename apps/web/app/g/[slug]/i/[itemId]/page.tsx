import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { darkColors, radius, spacing } from "@bitshelf/ui/theme";
import {
  loadPublicGallery,
  STATUS_HE,
  statusColorFor,
} from "../../../../../lib/public-gallery";

// Single item inside a public gallery (spec 8.1). Same data source as the
// grid page, so the same fields stay hidden.
export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ slug: string; itemId: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, itemId } = await params;
  const gallery = await loadPublicGallery(slug).catch(() => null);
  const item = gallery?.items.find((i) => i.id === itemId);
  if (!item) return { title: "BitShelf" };
  return {
    title: `${item.title} | BitShelf`,
    openGraph: {
      title: item.title,
      images: item.photos[0] ? [{ url: item.photos[0].url }] : undefined,
    },
  };
}

export default async function PublicItemPage({ params }: Params) {
  const { slug, itemId } = await params;
  const gallery = await loadPublicGallery(slug).catch(() => null);
  const item = gallery?.items.find((i) => i.id === itemId);
  if (!gallery || !item) notFound();

  const status = item.workingStatus ?? "untested";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: spacing.lg }}>
      <nav style={{ padding: `${spacing.md}px 0` }}>
        <Link
          href={`/g/${slug}`}
          style={{ color: darkColors.accent, textDecoration: "none", fontSize: 14 }}
        >
          {"→ "}
          {gallery.name.he ?? gallery.name.en}
        </Link>
      </nav>

      {item.photos.length > 0 ? (
        <div
          style={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            borderRadius: radius.card,
          }}
        >
          {item.photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={item.title}
              style={{
                width: "100%",
                maxHeight: 440,
                objectFit: "contain",
                backgroundColor: darkColors.surface,
                scrollSnapAlign: "center",
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      ) : null}

      <h1
        style={{
          margin: `${spacing.lg}px 0 0`,
          fontSize: 24,
          direction: "ltr",
          textAlign: "right",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {item.title}
      </h1>

      <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: darkColors.surface,
            borderRadius: radius.tag,
            padding: "5px 10px",
            fontSize: 13,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: statusColorFor(item.workingStatus),
            }}
          />
          {STATUS_HE[status] ?? status}
        </span>
        {item.conditionGrade != null ? (
          <span
            style={{
              backgroundColor: darkColors.surface,
              borderRadius: radius.tag,
              padding: "5px 10px",
              fontSize: 13,
            }}
          >
            {`חיצוני ${item.conditionGrade}/5`}
          </span>
        ) : null}
      </div>

      {item.attributes.length > 0 ? (
        <dl
          style={{
            margin: `${spacing.lg}px 0 0`,
            backgroundColor: darkColors.surface,
            borderRadius: radius.card,
            padding: spacing.lg,
          }}
        >
          {item.attributes.map((attr) => (
            <div
              key={attr.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing.md,
                padding: `${spacing.xs}px 0`,
              }}
            >
              <dt style={{ color: darkColors.textSecondary, fontSize: 13 }}>
                {attr.label}
              </dt>
              <dd
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontFamily: "ui-monospace, monospace",
                  direction: "ltr",
                }}
              >
                {attr.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

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
      </footer>
    </main>
  );
}
