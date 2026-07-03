import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import SettingsService from '@/lib/settingsService';

const DEFAULT_PART_SIZE = 64 * 1024 * 1024;
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

type MultipartSettings = {
  endpointUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

export type MultipartUploadTarget = {
  client: S3Client;
  settings: MultipartSettings;
  bucketName: string;
};

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[()[\]{}]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return sanitized || 'upload.bin';
}

export function normalizeS3ObjectKey(pathPrefix: string, fileName: string): string {
  const normalizedPrefix = pathPrefix
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\.\./g, '')
    .trim();

  const basePrefix = normalizedPrefix
    ? normalizedPrefix.endsWith('/')
      ? normalizedPrefix
      : `${normalizedPrefix}/`
    : '';

  return `${basePrefix}${sanitizeFileName(fileName)}`;
}

export function getMultipartPartSize(fileSize: number): number {
  if (!Number.isFinite(fileSize) || fileSize <= 0) return DEFAULT_PART_SIZE;

  const minimumPartSize = Math.ceil(fileSize / 10000);
  return Math.max(DEFAULT_PART_SIZE, minimumPartSize);
}

export async function getMultipartUploadTarget(volume: string): Promise<MultipartUploadTarget> {
  if (!volume || typeof volume !== 'string') {
    throw new Error('Volume is required.');
  }

  const settingsService = new SettingsService();
  const { settings } = await settingsService.getSettings('user-with-settings');

  if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
    throw new Error('S3 configuration is incomplete.');
  }

  const multipartSettings: MultipartSettings = {
    endpointUrl: settings.s3.endpointUrl,
    accessKeyId: settings.s3.accessKeyId,
    secretAccessKey: settings.s3.secretAccessKey,
    region: (settings.s3.region || 'us-east-1').toLowerCase(),
  };

  const client = new S3Client({
    endpoint: multipartSettings.endpointUrl,
    region: multipartSettings.region,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: {
      accessKeyId: multipartSettings.accessKeyId,
      secretAccessKey: multipartSettings.secretAccessKey,
    },
  });

  return {
    client,
    settings: multipartSettings,
    bucketName: volume,
  };
}

export async function createMultipartUpload(input: {
  volume: string;
  path: string;
  fileName: string;
  contentType?: string;
  fileSize: number;
}) {
  const target = await getMultipartUploadTarget(input.volume);
  const key = normalizeS3ObjectKey(input.path || '', input.fileName);
  const partSize = getMultipartPartSize(input.fileSize);

  const command = new CreateMultipartUploadCommand({
    Bucket: target.bucketName,
    Key: key,
    ContentType: input.contentType || 'application/octet-stream',
  });

  const result = await target.client.send(command);
  if (!result.UploadId) {
    throw new Error('S3 did not return an upload id.');
  }

  return {
    uploadId: result.UploadId,
    key,
    partSize,
    filePath: `/runpod-volume/${key}`,
    s3Url: `${target.settings.endpointUrl.replace(/\/$/, '')}/${target.bucketName}/${key}`,
  };
}

export async function createUploadPartUrl(input: {
  volume: string;
  key: string;
  uploadId: string;
  partNumber: number;
}) {
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
    throw new Error('Part number must be between 1 and 10000.');
  }

  const target = await getMultipartUploadTarget(input.volume);
  const command = new UploadPartCommand({
    Bucket: target.bucketName,
    Key: input.key,
    UploadId: input.uploadId,
    PartNumber: input.partNumber,
  });

  const url = await getSignedUrl(target.client, command, {
    expiresIn: SIGNED_URL_EXPIRES_SECONDS,
  });

  return { url };
}

export async function uploadMultipartPartStream(input: {
  volume: string;
  key: string;
  uploadId: string;
  partNumber: number;
  body: Readable;
  contentLength?: number;
}) {
  if (!Number.isInteger(input.partNumber) || input.partNumber < 1 || input.partNumber > 10000) {
    throw new Error('Part number must be between 1 and 10000.');
  }

  const target = await getMultipartUploadTarget(input.volume);
  const result = await target.client.send(
    new UploadPartCommand({
      Bucket: target.bucketName,
      Key: input.key,
      UploadId: input.uploadId,
      PartNumber: input.partNumber,
      Body: input.body,
      ContentLength: input.contentLength,
    })
  );

  return {
    partNumber: input.partNumber,
    eTag: result.ETag || null,
  };
}

async function listCompletedParts(input: {
  client: S3Client;
  bucketName: string;
  key: string;
  uploadId: string;
}): Promise<CompletedPart[]> {
  const parts: CompletedPart[] = [];
  let partNumberMarker: string | undefined;

  do {
    const result = await input.client.send(
      new ListPartsCommand({
        Bucket: input.bucketName,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumberMarker: partNumberMarker,
      })
    );

    for (const part of result.Parts || []) {
      if (part.PartNumber && part.ETag) {
        parts.push({
          PartNumber: part.PartNumber,
          ETag: part.ETag,
        });
      }
    }

    partNumberMarker = result.NextPartNumberMarker;
  } while (partNumberMarker);

  return parts.sort((a, b) => (a.PartNumber || 0) - (b.PartNumber || 0));
}

export async function completeMultipartUpload(input: {
  volume: string;
  key: string;
  uploadId: string;
  parts?: Array<{ partNumber: number; eTag?: string | null }>;
}) {
  const target = await getMultipartUploadTarget(input.volume);
  const providedParts = (input.parts || [])
    .filter((part) => Number.isInteger(part.partNumber) && !!part.eTag)
    .map((part) => ({
      PartNumber: part.partNumber,
      ETag: part.eTag || undefined,
    }))
    .sort((a, b) => a.PartNumber - b.PartNumber);

  const listedParts = await listCompletedParts({
    client: target.client,
    bucketName: target.bucketName,
    key: input.key,
    uploadId: input.uploadId,
  });
  const parts = listedParts.length > 0 ? listedParts : providedParts;

  if (parts.length === 0) {
    throw new Error('No uploaded parts were found.');
  }

  await target.client.send(
    new CompleteMultipartUploadCommand({
      Bucket: target.bucketName,
      Key: input.key,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    })
  );

  return {
    key: input.key,
    filePath: `/runpod-volume/${input.key}`,
    s3Url: `${target.settings.endpointUrl.replace(/\/$/, '')}/${target.bucketName}/${input.key}`,
  };
}

export async function abortMultipartUpload(input: {
  volume: string;
  key: string;
  uploadId: string;
}) {
  const target = await getMultipartUploadTarget(input.volume);

  await target.client.send(
    new AbortMultipartUploadCommand({
      Bucket: target.bucketName,
      Key: input.key,
      UploadId: input.uploadId,
    })
  );

  return { success: true };
}
