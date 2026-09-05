import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPhotoUploadUrl, isSupportedPhotoContentType } from "@bitshelf/api";

const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

// POST { contentType } -> { key, uploadUrl, publicUrl, expiresInSeconds }
// Signed PUT to Cloudflare R2. The client resizes before upload (spec 10).
export async function POST(request: Request) {
  if (!clerkEnabled) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { contentType?: unknown } | null;
  const contentType = body?.contentType;
  if (typeof contentType !== "string" || !isSupportedPhotoContentType(contentType)) {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 400 });
  }

  const target = await createPhotoUploadUrl(contentType);
  return NextResponse.json(target);
}
