import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { darkColors } from "@bitshelf/ui/theme";

export const metadata: Metadata = {
  title: "BitShelf",
  description: "ניהול אוסף מחשבי רטרו וקונסולות",
};

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          backgroundColor: darkColors.background,
          color: darkColors.textPrimary,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{page}</ClerkProvider> : page;
}
