import { brand, darkColors, spacing } from "@bitshelf/ui/theme";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: "ui-monospace, monospace",
          letterSpacing: 3,
          color: brand.logoGreen,
          textShadow: `0 0 12px ${brand.logoGreen}`,
          direction: "ltr",
        }}
      >
        BitShelf
      </h1>
      <p style={{ margin: 0, color: darkColors.textSecondary }}>
        ניהול אוסף מחשבי רטרו וקונסולות. האתר בבנייה.
      </p>
    </main>
  );
}
