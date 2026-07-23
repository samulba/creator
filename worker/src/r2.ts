import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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

/**
 * Downloads an object to a local file, streamed chunk by chunk — the file is
 * never held in memory. The render step uses this: cutting many clips from a
 * local copy is far faster and more reliable than seeking into a presigned
 * URL over HTTP for every clip (long recordings made that path time out).
 */
export async function downloadToFile(
  objectKey: string,
  destPath: string,
  options: {
    onProgress?: (downloadedBytes: number, totalBytes: number | null) => void;
  } = {},
): Promise<void> {
  const result = await client.send(
    new GetObjectCommand({ Bucket: env.r2.bucket, Key: objectKey }),
  );
  if (!result.Body) {
    throw new Error("R2 returned an empty body for the requested object.");
  }
  const total =
    typeof result.ContentLength === "number" ? result.ContentLength : null;
  let downloaded = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloaded += chunk.length;
      options.onProgress?.(downloaded, total);
      callback(null, chunk);
    },
  });
  await pipeline(
    result.Body as unknown as Readable,
    counter,
    createWriteStream(destPath),
  );
}

/**
 * Uploads a local file as a stream with an explicit length — a final render
 * can be gigabytes, and buffering it with readFile would risk OOM.
 */
export async function uploadFile(
  objectKey: string,
  filePath: string,
  contentType: string,
): Promise<void> {
  const { size } = await stat(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: objectKey,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
    }),
  );
}

export async function uploadBuffer(
  objectKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2.bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    }),
  );
}
