import Link from "next/link";
import { brand, darkColors, radius, spacing } from "@bitshelf/ui/theme";
import { listPublishedCollectors } from "../lib/public-gallery";

// Community home (spec 8.1.2): the one main page. A short intro, then every
// collector who published a showcase, each linking to their /u/<handle>
// page. Always fresh so a newly published collector appears at once.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const collectors = await listPublishedCollectors().catch(() => []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(600px 360px at 30% -8%, ${darkColors.accentSoft}, transparent), ${darkColors.background}`,
        padding: `${spacing.xxl * 2}px ${spacing.lg}px`,
      }}
    >
      <div style={{ width: "100%", maxWidth: 960, margin: "0 auto" }}>
        <div
          style={{
            fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
            letterSpacing: 4,
            fontSize: 34,
            color: brand.logoGreen,
            textShadow: `0 0 16px ${brand.logoGreen}`,
            direction: "ltr",
            textAlign: "right",
          }}
        >
          BitShelf
        </div>
        <h1 style={{ margin: `${spacing.md}px 0 0`, fontSize: 30, fontWeight: 700 }}>
          קהילת אספני הרטרו
        </h1>
        <p
          style={{
            margin: `${spacing.sm}px 0 0`,
            fontSize: 17,
            lineHeight: 1.5,
            color: darkColors.textSecondary,
            maxWidth: 600,
          }}
        >
          אספנים של מחשבי רטרו וקונסולות מציגים כאן את חלונות הראווה שלהם. הניהול
          נעשה מהאפליקציה בטלפון, והצפייה פתוחה לכולם בדפדפן, בלי חשבון.
        </p>

        <h2
          style={{
            margin: `${spacing.xl + spacing.md}px 0 ${spacing.md}px`,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          אספנים
        </h2>

        {collectors.length === 0 ? (
          <p style={{ color: darkColors.textSecondary }}>עוד אין אספנים שפרסמו עמוד.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: spacing.md,
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {collectors.map((c) => (
              <Link
                key={c.handle}
                href={`/u/${c.handle}`}
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
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.max(1, c.covers.length)}, 1fr)`,
                    gap: 2,
                    aspectRatio: "3 / 1.4",
                    background: darkColors.surface2,
                  }}
                >
                  {c.covers.length === 0 ? (
                    <div />
                  ) : (
                    c.covers.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={url}
                        src={url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ))
                  )}
                </div>
                <div style={{ padding: `${spacing.sm + 2}px ${spacing.md}px ${spacing.md}px` }}>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{c.title}</div>
                  {c.bio ? (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: darkColors.textSecondary,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {c.bio}
                    </div>
                  ) : null}
                  <div
                    style={{
                      marginTop: spacing.sm,
                      fontSize: 13,
                      color: darkColors.textSecondary,
                    }}
                  >
                    {c.galleryCount} גלריות
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p style={{ marginTop: spacing.xxl, fontSize: 13, color: darkColors.textSecondary }}>
          קיבלת קישור לגלריה או לאספן? פשוט פתח אותו, אין צורך בחשבון.
        </p>
      </div>
    </main>
  );
}
