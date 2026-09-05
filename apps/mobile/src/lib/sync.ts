import { File } from "expo-file-system";
import {
  listGalleryItemIds,
  listItems,
  listUnsynced,
  listUnsyncedGalleries,
  markGalleriesSynced,
  markSynced,
  updateItemPhotos,
  type LocalGallery,
  type LocalItem,
  type LocalPhoto,
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
    const token = await getToken();
    if (!token) return 0;

    // R2 uploads happen first so the photo rows can ride on this sync call
    const uploadedNow = await uploadPendingPhotos(token);

    const photoRows = [...uploadedPhotoRows(), ...uploadedNow].filter(
      (row, index, all) => all.findIndex((r) => r.id === row.id) === index,
    );
    if (
      unsynced.length === 0 &&
      unsyncedGalleries.length === 0 &&
      photoRows.length === 0
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
      }),
    });
    if (!response.ok) {
      console.warn("sync failed", response.status);
      return 0;
    }
    const result = (await response.json()) as {
      syncedIds?: string[];
      syncedGalleryIds?: string[];
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
