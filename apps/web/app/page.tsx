import { brand, darkColors, radius, spacing } from "@bitshelf/ui/theme";

// Landing page for the web app. Public galleries are viewed through their
// own /g/<slug> links; this page just explains what BitShelf is so the
// domain stands on its own (no app needed to reach it).
const features: { title: string; body: string }[] = [
  {
    title: "קטלוג עם תמונות",
    body: "כל פריט עם תמונות, יצרן, דגם, שנה, מצב חיצוני ומצב תפקודי, סטים ויומן תיקונים.",
  },
  {
    title: "זיהוי בעזרת AI",
    body: "מצלמים פריט, וה-AI ממלא את השדות. מאשרים, מתקנים, שומרים בשניות.",
  },
  {
    title: "חלון ראווה לשיתוף",
    body: "הופכים גלריה לציבורית ומשתפים בקישור או QR. נפתח בכל דפדפן, בלי אפליקציה ובלי חשבון.",
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(600px 360px at 30% -8%, ${darkColors.accentSoft}, transparent), ${darkColors.background}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${spacing.xxl * 2}px ${spacing.lg}px`,
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
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
          חלון הראווה לאוסף הרטרו שלך
        </h1>
        <p
          style={{
            margin: `${spacing.sm}px 0 0`,
            fontSize: 17,
            lineHeight: 1.5,
            color: darkColors.textSecondary,
            maxWidth: 560,
          }}
        >
          BitShelf מנהל אוספי מחשבי רטרו וקונסולות: מצלמים, מזהים, ומשתפים גלריות
          ציבוריות בקישור אחד. הניהול נעשה מהאפליקציה בטלפון, והצפייה פתוחה לכולם
          בדפדפן.
        </p>

        <div
          style={{
            marginTop: spacing.xl + spacing.sm,
            display: "grid",
            gap: spacing.md,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: darkColors.surface,
                borderRadius: radius.card,
                padding: `${spacing.md + 2}px ${spacing.md + 2}px`,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600 }}>{f.title}</div>
              <div
                style={{
                  marginTop: spacing.xs,
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: darkColors.textSecondary,
                }}
              >
                {f.body}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: spacing.xxl,
            fontSize: 13,
            color: darkColors.textSecondary,
          }}
        >
          קיבלת קישור לגלריה? פשוט פתח אותו, אין צורך בחשבון.
        </p>
      </div>
    </main>
  );
}
