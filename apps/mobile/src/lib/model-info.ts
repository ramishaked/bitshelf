import { getSetting, setSetting } from "./store";

// "About the model" card and screen (spec 4.6.1). The record is shared by
// all users and generated on the server; the device caches it in SQLite and
// polls while generation runs (it takes a minute or three on Opus with web
// search, the item screen never waits).

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export interface ModelInfo {
  manufacturer: string;
  model: string;
  variant: string;
  releaseYear: number | null;
  discontinuedYear: number | null;
  summary: { he?: string; en?: string };
  specs: Record<string, string>;
  links: { label: string; url: string }[];
  tips: { he?: string[]; en?: string[] };
  knownVersions: string | null;
}

type GetToken = () => Promise<string | null>;

function cacheKey(manufacturer: string, model: string): string {
  return `model_info:${manufacturer}:${model}`.toLowerCase();
}

export function getCachedModelInfo(
  manufacturer: string,
  model: string,
): ModelInfo | null {
  const raw = getSetting(cacheKey(manufacturer, model));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ModelInfo;
  } catch {
    return null;
  }
}

async function fetchExisting(
  manufacturer: string,
  model: string,
  variant: string,
): Promise<ModelInfo | null> {
  const params = new URLSearchParams({ manufacturer, model, variant });
  const response = await fetch(`${API_URL}/api/model-info?${params}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { status: string; data?: ModelInfo };
  return data.status === "ready" && data.data ? data.data : null;
}

// kicks generation on the server; resolves when the record is ready or the
// wait budget runs out (the caller keeps showing the skeleton either way)
export async function ensureModelInfo(
  manufacturer: string,
  model: string,
  variant: string,
  getToken: GetToken,
): Promise<ModelInfo | null> {
  const cached = getCachedModelInfo(manufacturer, model);
  if (cached) return cached;

  const existing = await fetchExisting(manufacturer, model, variant);
  if (existing) {
    setSetting(cacheKey(manufacturer, model), JSON.stringify(existing));
    return existing;
  }

  const token = await getToken();
  if (!token) return null;
  // fire and forget: the server generates and saves even when we stop waiting
  void fetch(`${API_URL}/api/model-info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ manufacturer, model, variant }),
  }).catch(() => undefined);

  // poll for up to four minutes
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    const ready = await fetchExisting(manufacturer, model, variant).catch(() => null);
    if (ready) {
      setSetting(cacheKey(manufacturer, model), JSON.stringify(ready));
      return ready;
    }
  }
  return null;
}
