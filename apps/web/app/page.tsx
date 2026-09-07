import Link from "next/link";
import { listLobbyPhotos, listPublishedCollectors } from "../lib/public-gallery";
import { site } from "../lib/site";

// The one main page: a landing for newcomers and the lobby of the community.
// The hero is a wall of real photos from published galleries, the app's own
// signature view, under a scrim. Always fresh so a new collector shows up
// at once (spec 8.1.2).
export const dynamic = "force-dynamic";

const steps = [
  {
    title: "מצלמים",
    body: "כמה זוויות מהטלפון: חזית, גב, תווית. בלי טפסים לפני זה.",
  },
  {
    title: "ה-AI מזהה",
    body: "יצרן, דגם, גרסה ושנה מתמלאים לבד. מאשרים, מתקנים במקום, שומרים.",
  },
  {
    title: "מסדרים",
    body: "מצב חיצוני ומצב תפקודי בנפרד, סטים, מיקום אחסון ויומן תיקונים.",
  },
  {
    title: "מפרסמים",
    body: "גלריה או עמוד אספן שלם, בקישור קבוע שנפתח בכל דפדפן בלי חשבון.",
  },
];

const features = [
  {
    title: "קיר תמונות, לא טבלה",
    body: "האוסף נראה כמו האוסף. אריחים מקצה לקצה, צביטה לשינוי גודל, סינון בלחיצה.",
  },
  {
    title: "מידע על כל דגם",
    body: "רקע היסטורי, מפרט וגרסאות ידועות, מופקים פעם אחת ומשותפים לכל האספנים.",
  },
  {
    title: "הערכת שווי",
    body: "טווח נמוך, סביר וגבוה לפי מחירים מבוקשים בשוק, מתעדכן בלחיצה.",
  },
  {
    title: "פרטי כברירת מחדל",
    body: "מספר סידורי, מחיר רכישה ומיקום אחסון לעולם לא יוצאים בקישור ציבורי.",
  },
  {
    title: "עובד גם בלי רשת",
    body: "הכול נשמר על המכשיר קודם ומסתנכרן כשיש חיבור. הגריד נפתח מיד.",
  },
  {
    title: "ייצוא חופשי",
    body: "האוסף שלך הוא שלך. ייצוא ל-CSV בלחיצה, ומחיקת חשבון מלאה מתוך האפליקציה.",
  },
];

export default async function HomePage() {
  const [collectors, wall] = await Promise.all([
    listPublishedCollectors().catch(() => []),
    listLobbyPhotos(18).catch(() => []),
  ]);
  // fill the grid to a full wall even while the community is small; each row
  // starts two photos later so the same picture never sits next to itself
  const tiles =
    wall.length > 0
      ? Array.from({ length: 18 }, (_, i) => wall[(i + Math.floor(i / 6) * 2) % wall.length]!)
      : [];

  return (
    <main>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-wall" aria-hidden="true">
          {tiles.length > 0
            ? tiles.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${url}-${i}`} src={url} alt="" loading={i < 6 ? "eager" : "lazy"} />
              ))
            : Array.from({ length: 18 }, (_, i) => <div className="tile" key={i} />)}
        </div>
        <div className="hero-scrim" />
        <div className="container hero-content">
          <h1 id="hero-title">{site.tagline}</h1>
          <p>
            {site.name} מנהל אוספי מחשבי רטרו וקונסולות מהטלפון: מצלמים פריט, ה-AI ממלא את
            הפרטים, ובלחיצה אחת האוסף הופך לחלון ראווה ציבורי שכל אחד יכול לפתוח בדפדפן.
          </p>
          <div className="hero-actions">
            <a href="#collectors" className="btn btn-primary">
              לגלריות של האספנים
            </a>
            <a href="#how" className="btn btn-glass">
              איך זה עובד
            </a>
          </div>
        </div>
      </section>

      <section className="section" id="collectors">
        <div className="container">
          <h2>אספנים בקהילה</h2>
          <p className="lede">
            כל מי שכאן בחר לפרסם את חלון הראווה שלו. פתחו, הכירו דרך הסיפור, וראו את
            הגלריות.
          </p>
          {collectors.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>
              עוד אין אספנים שפרסמו עמוד. הראשון שיפרסם מהאפליקציה יופיע כאן.
            </p>
          ) : (
            <div className="collectors">
              {collectors.map((c) => (
                <Link key={c.handle} href={`/u/${c.handle}`} className="collector-card">
                  <div
                    className="collector-mosaic"
                    style={{ gridTemplateColumns: `repeat(${Math.max(1, c.covers.length)}, 1fr)` }}
                  >
                    {c.covers.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="" loading="lazy" />
                    ))}
                  </div>
                  <div className="collector-body">
                    <div className="collector-title">{c.title}</div>
                    {c.bio ? <div className="collector-bio">{c.bio}</div> : null}
                    <div className="collector-meta">{c.galleryCount} גלריות</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <h2>איך זה עובד</h2>
          <p className="lede">מצילום ועד קישור ציבורי, בלי טפסים ארוכים באמצע.</p>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.title}>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <h2>מה יש בפנים</h2>
          <p className="lede">נבנה סביב עקרון אחד: קודם התמונה, ופרטי לפני ציבורי.</p>
          <div className="features">
            {features.map((f) => (
              <div className="feature" key={f.title}>
                <span className="dot" aria-hidden="true" />
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <h2>מחיר</h2>
          <p className="lede">{site.pricing.note}</p>
          <div className="pricing">
            <div className="price-panel">
              <div className="price-amount">{site.pricing.current}</div>
              <ul>
                <li>קטלוג ללא הגבלת פריטים ותמונות</li>
                <li>זיהוי AI ומידע על דגמים</li>
                <li>גלריות ציבוריות ועמוד אספן</li>
                <li>הערכות שווי, ייצוא CSV, מחיקת חשבון</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="about">
        <div className="container">
          <h2>על המפתח</h2>
          <div className="about">
            <div>
              <p>
                {site.name} נבנה על ידי {site.developer.name} ({site.developer.nameLatin}),
                אספן מחשבי רטרו, כפרויקט אישי: הכלי שהיה חסר לו כדי לתעד ולהראות את
                האוסף.
              </p>
              <p>
                האפליקציה פותחה עם Claude Code. השירות ניתן כמות שהוא ובחינם בשלב הזה;
                הפרטים המלאים ב<Link href="/terms">תנאי השימוש</Link> וב
                <Link href="/privacy">מדיניות הפרטיות</Link>.
              </p>
            </div>
            <div>
              <p>יש לך אוסף? רוצה להצטרף לקהילה, לדווח על תקלה או להציע רעיון?</p>
              <a href={`mailto:${site.developer.email}`} className="btn btn-glass">
                כתוב ל{site.developer.name}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
