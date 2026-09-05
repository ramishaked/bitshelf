import { listUnsynced, markSynced, type LocalItem } from "./store";

// Pushes locally saved items to the server (spec 10: offline writes queue up
// and go out when there is network). Photos wait for R2.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

type GetToken = () => Promise<string | null>;

let running = false;

export async function syncNow(getToken: GetToken): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const unsynced = listUnsynced();
    if (unsynced.length === 0) return 0;
    const token = await getToken();
    if (!token) return 0;

    const payload = unsynced.map(({ photos, ...item }: LocalItem) => item);
    const response = await fetch(`${API_URL}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: payload }),
    });
    if (!response.ok) {
      console.warn("sync failed", response.status);
      return 0;
    }
    const result = (await response.json()) as { syncedIds?: string[] };
    const syncedIds = new Set(result.syncedIds ?? []);
    const sent = unsynced
      .filter((item) => syncedIds.has(item.id))
      .map((item) => ({ id: item.id, updatedAt: item.updatedAt }));
    markSynced(sent);
    return sent.length;
  } catch (err) {
    // offline or server down, the queue just waits
    console.warn("sync error", err);
    return 0;
  } finally {
    running = false;
  }
}

// lets the item form ask for a sync right after save, without importing auth
let trigger: (() => void) | null = null;

export function setSyncTrigger(fn: (() => void) | null): void {
  trigger = fn;
}

export function requestSync(): void {
  trigger?.();
}
