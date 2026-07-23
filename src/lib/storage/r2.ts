import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getOptionalStorageConfig, type StorageConfig } from "./config";

const PART_URL_EXPIRY_SECONDS = 60 * 60; // parts of long uploads
const DOWNLOAD_URL_EXPIRY_SECONDS = 10 * 60;

let cachedClient: { key: string; client: S3Client } | null = null;

function getClient(config: StorageConfig): S3Client {
  const cacheKey = `${config.accountId}:${config.accessKeyId}:${config.bucket}`;

  if (cachedClient?.key !== cacheKey) {
    cachedClient = {
      key: cacheKey,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        // Recent AWS SDK versions add a default request checksum
        // (x-amz-checksum-crc32) to signed URLs. A browser doing a direct
        // PUT never sends that header, so R2 rejects the part and the
        // upload fails. Only compute checksums when an operation requires
        // one, which keeps presigned part URLs signable by the browser.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }

  return cachedClient.client;
}

export function requireStorage(): { config: StorageConfig; client: S3Client } {
  const config = getOptionalStorageConfig();

  if (!config) {
    throw new Error("R2 storage is not configured.");
  }

  return { config, client: getClient(config) };
}

export async function createMultipartUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const { config, client } = requireStorage();

  const result = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
  );

  if (!result.UploadId) {
    throw new Error("R2 did not return an upload id.");
  }

  return result.UploadId;
}

export async function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const { config, client } = requireStorage();

  return getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: PART_URL_EXPIRY_SECONDS },
  );
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<void> {
  const { config, client } = requireStorage();

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }),
  );
}

export async function abortMultipartUpload(
  key: string,
  uploadId: string,
): Promise<void> {
  const { config, client } = requireStorage();

  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: config.bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  const { config, client } = requireStorage();

  await client.send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

export async function headObject(
  key: string,
): Promise<{ byteSize: number | null; contentType: string | null } | null> {
  const { config, client } = requireStorage();

  try {
    const result = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
    );

    return {
      byteSize:
        typeof result.ContentLength === "number" ? result.ContentLength : null,
      contentType: result.ContentType ?? null,
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

export async function presignGetObject(
  key: string,
  downloadFilename?: string,
): Promise<string> {
  const { config, client } = requireStorage();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ...(downloadFilename
        ? {
            ResponseContentDisposition: `attachment; filename="${downloadFilename.replaceAll('"', "")}"`,
          }
        : {}),
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS },
  );
}
