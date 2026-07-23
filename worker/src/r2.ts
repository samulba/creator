import { readFile } from "node:fs/promises";

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "./env.js";

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.r2.accessKeyId,
    secretAccessKey: env.r2.secretAccessKey,
  },
  // Match the web app: don't add default request checksums, which break
  // signing for tools (ffmpeg/ffprobe) that read presigned URLs directly.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/**
 * Presigned GET URL for FFprobe/FFmpeg to read the source over HTTP range
 * requests — avoids downloading multi-GB files to the worker just to read
 * metadata.
 */
export function presignGet(objectKey: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: env.r2.bucket, Key: objectKey }),
    { expiresIn },
  );
}

export async function headObject(
  objectKey: string,
): Promise<{ byteSize: number | null } | null> {
  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: env.r2.bucket, Key: objectKey }),
    );
    return {
      byteSize:
        typeof result.ContentLength === "number" ? result.ContentLength : null,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      (error.name === "NotFound" || error.name === "NoSuchKey")
    ) {
      return null;
    }
    throw error;
  }
}

export async function uploadFile(
  objectKey: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const body = await readFile(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}
