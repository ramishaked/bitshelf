import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import type { LocalPhoto } from "./store";

// Sends the resized photos (2000px, jpeg) to the identify endpoint.
// One request, all photos (spec 6.1 step 3).

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export interface IdentifyResult {
  category: string;
  title: string;
  attributes: Record<string, unknown>;
  confidence: number;
  field_confidence?: Record<string, number>;
  alternatives?: string[];
  notes?: string | null;
}

type GetToken = () => Promise<string | null>;

export async function identifyPhotos(
  photos: LocalPhoto[],
  getToken: GetToken,
): Promise<IdentifyResult> {
  const token = await getToken();
  if (!token) {
    throw new Error("not signed in");
  }
  const images = await Promise.all(
    photos.slice(0, 4).map(async (photo) => ({
      base64: await readAsStringAsync(photo.uri, { encoding: EncodingType.Base64 }),
      mediaType: "image/jpeg" as const,
    })),
  );
  const response = await fetch(`${API_URL}/api/identify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ images }),
  });
  if (!response.ok) {
    throw new Error(`identify failed: ${response.status}`);
  }
  const data = (await response.json()) as { result: IdentifyResult };
  return data.result;
}
