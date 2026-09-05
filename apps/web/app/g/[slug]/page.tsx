import { darkColors, spacing } from "@bitshelf/ui/theme";

// Public gallery page, server-rendered for instant load and correct link
// previews (spec 7.7). Placeholder until galleries land in week 4.
export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        padding: spacing.xl,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 22 }}>גלריה ציבורית</h1>
      <p
        style={{
          margin: 0,
          fontFamily: "ui-monospace, monospace",
          color: darkColors.textPrimary,
          direction: "ltr",
        }}
      >
        {slug}
      </p>
      <p style={{ margin: 0, color: darkColors.textSecondary }}>
        תוכן הגלריה יוצג כאן כשיהיו גלריות משותפות.
      </p>
    </main>
  );
}
