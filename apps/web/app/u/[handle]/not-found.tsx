import { darkColors, spacing } from "@bitshelf/ui/theme";

export default function CollectorNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <div
          style={{
            fontFamily: "ui-monospace, monospace",
            color: darkColors.accent,
            fontSize: 13,
            direction: "ltr",
          }}
        >
          BitShelf
        </div>
        <h1 style={{ margin: `${spacing.md}px 0 ${spacing.sm}px`, fontSize: 24 }}>
          העמוד לא נמצא
        </h1>
        <p style={{ color: darkColors.textSecondary, lineHeight: 1.5, margin: 0 }}>
          עמוד האספן אינו קיים או שאינו פומבי כרגע.
        </p>
      </div>
    </main>
  );
}
