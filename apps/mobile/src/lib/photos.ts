import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Directory, File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { LocalPhoto } from "./store";

// Photos are resized on device before anything else happens (spec: 2000px
// stored, 400px thumb, thumbnails generated client side). Originals are not
// kept. Files live in the app documents directory until server sync uploads
// them to R2.

const photosDir = new Directory(Paths.document, "photos");

function ensureDir(): void {
  if (!photosDir.exists) {
    photosDir.create({ intermediates: true });
  }
}

function persist(tempUri: string, name: string): string {
  const dest = new File(photosDir, name);
  new File(tempUri).move(dest);
  return dest.uri;
}

export interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

async function resizeTo(asset: PickedAsset, longSide: number): Promise<string> {
  const landscape = asset.width >= asset.height;
  const current = landscape ? asset.width : asset.height;
  const target = Math.min(longSide, current);
  const resize = landscape ? { width: target } : { height: target };
  const result = await manipulateAsync(asset.uri, [{ resize }], {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

export async function processAsset(asset: PickedAsset): Promise<LocalPhoto> {
  ensureDir();
  const id = randomUUID();
  const fullUri = await resizeTo(asset, 2000);
  const thumbUri = await resizeTo(asset, 400);
  return {
    id,
    uri: persist(fullUri, `${id}.jpg`),
    thumbUri: persist(thumbUri, `${id}.thumb.jpg`),
    isPrimary: false,
  };
}

export async function addPhotos(source: "camera" | "library"): Promise<LocalPhoto[]> {
  ensureDir();
  let result: ImagePicker.ImagePickerResult;
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return [];
    result = await ImagePicker.launchCameraAsync({ quality: 1 });
  } else {
    result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 8,
      quality: 1,
    });
  }
  if (result.canceled) return [];
  const photos: LocalPhoto[] = [];
  for (const asset of result.assets) {
    photos.push(await processAsset(asset));
  }
  return photos;
}

export function deletePhotoFiles(photos: LocalPhoto[]): void {
  for (const photo of photos) {
    for (const uri of [photo.uri, photo.thumbUri]) {
      try {
        new File(uri).delete();
      } catch {
        // already gone
      }
    }
  }
}
