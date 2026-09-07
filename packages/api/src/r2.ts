import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Photo sizes per spec: 2000px stored, 1200px medium, 400px thumb.
// The client resizes before upload, this module only signs the upload.

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export function isSupportedPhotoContentType(contentType: string): boolean {
  return contentType in EXTENSION_BY_CONTENT_TYPE;
}

export interface UploadTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set, see .env.example at the repo root`);
  }
  return value;
}

export async function createPhotoUploadUrl(contentType: string): Promise<UploadTarget> {
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  if (!extension) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }

  const accountId = requireEnv("R2_ACCOUNT_ID");
  const bucket = requireEnv("R2_BUCKET");
  const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });

  const key = `photos/${randomUUID()}.${extension}`;
  const expiresInSeconds = 600;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );

  return {
    key,
    uploadUrl,
    publicUrl: `${publicBaseUrl.replace(/\/$/, "")}/${key}`,
    expiresInSeconds,
  };
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_BASE_URL &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

// turns stored public URLs back into object keys; foreign URLs are skipped
export function photoKeyOf(url: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

// batch delete, used by account deletion; R2 caps DeleteObjects at 1000 keys
export async function deletePhotoObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  const bucket = requireEnv("R2_BUCKET");
  for (let i = 0; i < keys.length; i += 1000) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) },
      }),
    );
  }
}
