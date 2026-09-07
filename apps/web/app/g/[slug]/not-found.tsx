import { darkColors, spacing } from "@bitshelf/ui/theme";

// Friendly stand-in for a slug that is not on the server: either the link
// was revoked, or the gallery has not synced from the device yet. Replaces
// the bare white default 404 (Rami saw a blank page from an unsynced link).
export default function GalleryNotFound() {
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
          הגלריה לא נמצאה
        </h1>
        <p style={{ color: darkColors.textSecondary, lineHeight: 1.5, margin: 0 }}>
          הקישור בוטל, או שהגלריה עדיין לא סונכרנה מהמכשיר. אם רק שיתפת אותה, פתחו את
          הגלריה באפליקציה, ודאו שהיא מסומנת כמסונכרנת, ונסו שוב.
        </p>
      </div>
    </main>
  );
}
