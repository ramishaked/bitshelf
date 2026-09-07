import { File } from "expo-file-system";
import {
  adoptServerProfile,
  clearDeletedGalleryIds,
  clearDeletedIds,
  getProfile,
  getSetting,
  listDeletedGalleryIds,
  listDeletedIds,
  listGalleryItemIds,
  listItems,
  listUnsynced,
  listUnsyncedGalleries,
  listWishes,
  markGalleriesSynced,
  markSynced,
  mergeServerGalleries,
  mergeServerItems,
  saveWish,
  setSetting,
  updateItemPhotos,
  type LocalGallery,
  type LocalItem,
  type LocalPhoto,
  type LocalProfile,
  type LocalWish,
} from "./store";

// Pushes locally saved items, galleries and photos to the server (spec 10:
// offline writes queue up and go out when there is network). Photos upload
// to R2 via signed URLs; when R2 is not configured yet the photo step is
// skipped and retried on a later run.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

// keeps a single run short, the interval loop picks up the rest
const MAX_PHOTO_UPLOADS_PER_RUN = 8;

type GetToken = () => Promise<string | null>;

let running = false;
// the full-catalog pull runs once per app session, later runs only push
let pulledOnce = false;

interface UploadTarget {
  uploadUrl: string;
  publicUrl: string;
}

async function requestUploadUrl(token: string): Promise<UploadTarget | null> {
  const response = await fetch(`${API_URL}/api/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contentType: "image/jpeg" }),
  });
  if (!response.ok) return null;
  return (await response.json()) as UploadTarget;
}

async function uploadFile(uri: string, target: UploadTarget): Promise<boolean> {
  const bytes = await new File(uri).bytes();
  const response = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: bytes,
  });
  return response.ok;
}

interface PendingPhoto {
  item: LocalItem;
  photo: LocalPhoto;
  sortOrder: number;
}

// photos missing a remote URL, oldest items first
function collectPendingPhotos(): PendingPhoto[] {
  const pending: PendingPhoto[] = [];
  for (const item of listItems()) {
    item.photos.forEach((photo, index) => {
      if (!photo.remoteUrl) pending.push({ item, photo, sortOrder: index });
    });
  }
  return pending.slice(0, MAX_PHOTO_UPLOADS_PER_RUN);
}

interface PhotoRow {
  id: string;
  itemId: string;
  url: string;
  thumbUrl: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

// uploads full + thumb for each pending photo, records the remote URLs
// locally, and returns the rows for the sync payload. Stops on the first
// server-side failure (usually R2 keys not configured yet).
async function uploadPendingPhotos(token: string): Promise<PhotoRow[]> {
  const rows: PhotoRow[] = [];
  for (const { item, photo, sortOrder } of collectPendingPhotos()) {
    try {
      const fullTarget = await requestUploadUrl(token);
      if (!fullTarget) return rows;
      const thumbTarget = await requestUploadUrl(token);
      if (!thumbTarget) return rows;
      if (!(await uploadFile(photo.uri, fullTarget))) return rows;
      if (!(await uploadFile(photo.thumbUri, thumbTarget))) return rows;

      const current = listItems().find((i) => i.id === item.id);
      if (!current) continue;
      const updated = current.photos.map((p) =>
        p.id === photo.id
          ? { ...p, remoteUrl: fullTarget.publicUrl, remoteThumbUrl: thumbTarget.publicUrl }
          : p,
      );
      updateItemPhotos(item.id, updated);
      rows.push({
        id: photo.id,
        itemId: item.id,
        url: fullTarget.publicUrl,
        thumbUrl: thumbTarget.publicUrl,
        isPrimary: photo.isPrimary,
        sortOrder,
      });
    } catch {
      return rows;
    }
  }
  return rows;
}

// photos already uploaded ride along with their unsynced item rows, so the
// server photo table stays aligned after edits
function uploadedPhotoRows(): PhotoRow[] {
  const rows: PhotoRow[] = [];
  for (const item of listUnsynced()) {
    item.photos.forEach((photo, index) => {
      if (photo.remoteUrl) {
        rows.push({
          id: photo.id,
          itemId: item.id,
          url: photo.remoteUrl,
          thumbUrl: photo.remoteThumbUrl ?? null,
          isPrimary: photo.isPrimary,
          sortOrder: index,
        });
      }
    });
  }
  return rows;
}

function galleryPayload(gallery: LocalGallery) {
  return {
    id: gallery.id,
    nameHe: gallery.nameHe,
    nameEn: gallery.nameEn,
    descriptionHe: gallery.descriptionHe,
    visibility: gallery.visibility,
    publicSlug: gallery.publicSlug,
    showValue: gallery.showValue,
    createdAt: gallery.createdAt,
    updatedAt: gallery.updatedAt,
    itemIds: listGalleryItemIds(gallery.id),
  };
}

export async function syncNow(getToken: GetToken): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    const unsynced = listUnsynced();
    const unsyncedGalleries = listUnsyncedGalleries();
    const deletedIds = listDeletedIds();
    const deletedGalleryIds = listDeletedGalleryIds();
    const token = await getToken();
    if (!token) return 0;

    // R2 uploads happen first so the photo rows can ride on this sync call
    const uploadedNow = await uploadPendingPhotos(token);

    const photoRows = [...uploadedPhotoRows(), ...uploadedNow].filter(
      (row, index, all) => all.findIndex((r) => r.id === row.id) === index,
    );
    const wishlistDirty = getSetting("wishlist_dirty") === "1";
    const profileDirty = getSetting("profile_dirty") === "1";
    if (
      pulledOnce &&
      unsynced.length === 0 &&
      unsyncedGalleries.length === 0 &&
      photoRows.length === 0 &&
      deletedIds.length === 0 &&
      deletedGalleryIds.length === 0 &&
      !wishlistDirty &&
      !profileDirty
    ) {
      return 0;
    }

    const payload = unsynced.map(({ photos, ...item }: LocalItem) => item);
    const response = await fetch(`${API_URL}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        items: payload,
        galleries: unsyncedGalleries.map(galleryPayload),
        photos: photoRows,
        // full list every time: small, and wholesale replace on the server
        // covers deletions without tombstones
        wishlist: listWishes(),
        profile: profileDirty ? getProfile() : undefined,
        deletedIds,
        deletedGalleryIds,
      }),
    });
    if (!response.ok) {
      console.warn("sync failed", response.status);
      return 0;
    }
    const result = (await response.json()) as {
      syncedIds?: string[];
      syncedGalleryIds?: string[];
      deletedIds?: string[];
      deletedGalleryIds?: string[];
      serverGalleries?: (LocalGallery & { itemIds: string[] })[];
      serverWishlist?: LocalWish[];
      serverProfile?: Partial<LocalProfile> | null;
      serverItems?: (Omit<LocalItem, "photos" | "synced"> & {
        photos: {
          id: string;
          url: string;
          thumbUrl: string | null;
          isPrimary: boolean;
        }[];
      })[];
    };
    const syncedIds = new Set(result.syncedIds ?? []);
    const sent = unsynced
      .filter((item) => syncedIds.has(item.id))
      .map((item) => ({ id: item.id, updatedAt: item.updatedAt }));
    markSynced(sent);
    const syncedGalleryIds = new Set(result.syncedGalleryIds ?? []);
    markGalleriesSynced(
      unsyncedGalleries
        .filter((g) => syncedGalleryIds.has(g.id))
        .map((g) => ({ id: g.id, updatedAt: g.updatedAt })),
    );
    clearDeletedIds(result.deletedIds ?? []);
    clearDeletedGalleryIds(result.deletedGalleryIds ?? []);
    mergeServerGalleries(result.serverGalleries ?? []);
    // the push above delivered the current list, the flags can drop
    setSetting("wishlist_dirty", "0");
    if (profileDirty) setSetting("profile_dirty", "0");
    // fresh install adopts the server's profile (no local one yet)
    adoptServerProfile(result.serverProfile ?? null);

    // wishlist pull: only a device with no list adopts the server's (fresh
    // install); anywhere else the local list is the source of truth
    const serverWishes = result.serverWishlist ?? [];
    if (listWishes().length === 0 && serverWishes.length > 0) {
      for (const wish of serverWishes) saveWish(wish);
      setSetting("wishlist_dirty", "0");
    }

    // pull: adopt server items this device has never seen. Remote URLs go
    // straight into the photo slots, expo-image caches them on disk.
    const pulled = (result.serverItems ?? []).map((item) => ({
      ...item,
      synced: true,
      photos: item.photos
        .filter((p) => p.url)
        .map((p) => ({
          id: p.id,
          uri: p.url,
          thumbUri: p.thumbUrl ?? p.url,
          isPrimary: p.isPrimary,
          remoteUrl: p.url,
          remoteThumbUrl: p.thumbUrl ?? undefined,
        })),
    }));
    const added = mergeServerItems(pulled);
    pulledOnce = true;
    return sent.length + added;
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
