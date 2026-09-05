import { NextResponse } from "next/server";
import { loadPublicGallery } from "../../../../lib/public-gallery";

// Public JSON for the mobile guest viewer (spec 3: guests see one public
// gallery through its link, no account). Same filtered shape as the web page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const gallery = await loadPublicGallery(slug).catch(() => null);
  if (!gallery) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(gallery);
}
