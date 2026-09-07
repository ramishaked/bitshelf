import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { SiteFooter, SiteNav } from "../components/site-chrome";
import { site } from "../lib/site";

export const metadata: Metadata = {
  title: `${site.name}: ${site.tagline}`,
  description:
    "ניהול אוספי מחשבי רטרו וקונסולות: מצלמים, מזהים בעזרת AI, ומפרסמים חלון ראווה בקישור אחד.",
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="he" dir="rtl">
      <body>
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
