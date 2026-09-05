import { Image } from "react-native";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { processAsset } from "./photos";
import type { LocalPhoto } from "./store";

// Shelf scan client (spec 6.3): send one shelf photo, get detected items
// with fractional bounding boxes, crop each box into its own photo.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export interface ScanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ScannedItem {
  box: ScanBox;
  category: string;
  title: string;
  attributes: Record<string, unknown>;
  confidence: number;
}

type GetToken = () => Promise<string | null>;

export async function scanShelfPhoto(
  photo: LocalPhoto,
  getToken: GetToken,
): Promise<ScannedItem[]> {
  const token = await getToken();
  if (!token) {
    throw new Error("not signed in");
  }
  const base64 = await readAsStringAsync(photo.uri, {
    encoding: EncodingType.Base64,
  });
  const response = await fetch(`${API_URL}/api/shelf-scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image: { base64, mediaType: "image/jpeg" } }),
  });
  if (!response.ok) {
    throw new Error(`shelf scan failed: ${response.status}`);
  }
  const data = (await response.json()) as { items: ScannedItem[] };
  return data.items;
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      reject,
    );
  });
}

// Cuts one detected box out of the shelf photo and runs it through the
// regular photo pipeline (2000px + thumb, persisted files).
export async function cropBox(shelfUri: string, box: ScanBox): Promise<LocalPhoto> {
  const { width, height } = await imageSize(shelfUri);
  const crop = {
    originX: Math.round(box.x * width),
    originY: Math.round(box.y * height),
    width: Math.max(1, Math.round(box.w * width)),
    height: Math.max(1, Math.round(box.h * height)),
  };
  const result = await manipulateAsync(shelfUri, [{ crop }], {
    compress: 0.9,
    format: SaveFormat.JPEG,
  });
  return processAsset({
    uri: result.uri,
    width: result.width,
    height: result.height,
  });
}
