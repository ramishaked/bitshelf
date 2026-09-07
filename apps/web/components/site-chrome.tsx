import Link from "next/link";
import { site } from "../lib/site";

// Sticky top bar and footer shared by every public page, so the lobby and
// the legal pages are one click away from anywhere.
export function SiteNav() {
  return (
    <header className="site-nav">
      <div className="container">
        <Link href="/" className="wordmark" aria-label={`${site.name}, לדף הבית`}>
          {site.name}
        </Link>
        <nav className="nav-links" aria-label="ניווט ראשי">
          <Link href="/#collectors">אספנים</Link>
          <Link href="/#how" className="nav-secondary">
            איך זה עובד
          </Link>
          <Link href="/#pricing" className="nav-secondary">
            מחיר
          </Link>
          <Link href="/#about" className="nav-secondary">
            על המפתח
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div>
          <span className="wordmark" style={{ fontSize: 15 }}>
            {site.name}
          </span>
          <span style={{ marginInlineStart: 12 }}>
            {site.name} {site.version}. פותח על ידי {site.developer.name}. {year}.
          </span>
        </div>
        <div className="footer-links">
          <Link href="/terms">תנאי שימוש והסרת אחריות</Link>
          <Link href="/privacy">פרטיות</Link>
          <a href={`mailto:${site.developer.email}`}>צור קשר</a>
        </div>
      </div>
    </footer>
  );
}
