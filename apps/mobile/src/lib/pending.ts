import type { LocalPhoto } from "./store";

// Hands the captured photos from the camera screen to the confirm screen.
// Route params cannot carry this much data.

let pendingPhotos: LocalPhoto[] = [];

export function setPendingPhotos(photos: LocalPhoto[]): void {
  pendingPhotos = photos;
}

export function takePendingPhotos(): LocalPhoto[] {
  const photos = pendingPhotos;
  pendingPhotos = [];
  return photos;
}
