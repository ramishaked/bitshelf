// eBay Browse API client (spec 9): asking prices only, phase 1. Free tier
// with a registered key pair; sold prices need the gated Insights API and
// are not built in.

export interface EbayListing {
  price: number;
  currency: string;
  url: string | null;
  title: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const clientId = process.env.EBAY_CLIENT_ID ?? "";
  const secret = process.env.EBAY_CLIENT_SECRET ?? "";
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  if (!response.ok) {
    throw new Error(`ebay token failed: ${response.status}`);
  }
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// up to 20 active fixed-price listings for the query (spec 9 step 1)
export async function searchAskingPrices(
  query: string,
  limit = 20,
): Promise<EbayListing[]> {
  const token = await getToken();
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    filter: "buyingOptions:{FIXED_PRICE}",
  });
  const response = await fetch(
    `https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`ebay search failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    itemSummaries?: {
      title?: string;
      itemWebUrl?: string;
      price?: { value?: string; currency?: string };
    }[];
  };
  return (data.itemSummaries ?? [])
    .map((item) => ({
      price: Number(item.price?.value ?? 0),
      currency: item.price?.currency ?? "USD",
      url: item.itemWebUrl ?? null,
      title: item.title ?? "",
    }))
    .filter((l) => l.price > 0);
}
