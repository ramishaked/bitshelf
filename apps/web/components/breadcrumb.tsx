import Link from "next/link";
import { darkColors, spacing } from "@bitshelf/ui/theme";

export interface Crumb {
  label: string;
  href: string;
}

// Way back up the public site: lobby (community home), collector page,
// gallery. The current page is not listed; every crumb is a link.
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav
      aria-label="ניווט"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: spacing.sm,
        padding: `${spacing.md}px 0 0`,
        fontSize: 14,
      }}
    >
      {crumbs.map((c, i) => (
        <span key={c.href} style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          {i > 0 ? <span style={{ color: darkColors.textSecondary }}>{"/"}</span> : null}
          <Link href={c.href} style={{ color: darkColors.accent, textDecoration: "none" }}>
            {i === 0 ? "→ " : ""}
            {c.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
