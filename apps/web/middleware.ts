import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Guest mode: public gallery pages and the landing page need no account (spec 3, 11)
const isPublicRoute = createRouteMatcher(["/", "/g(.*)", "/sign-in(.*)", "/sign-up(.*)"]);

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

// Without Clerk keys the middleware is a no-op so the site still runs in development
export default clerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        await auth.protect();
      }
    })
  : function middleware() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
