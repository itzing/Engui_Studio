import { beforeEach, describe, expect, it, vi } from 'vitest';

const { completeMultipartUpload, createMultipartUpload, deleteFile, getSettings, mockPrisma } = vi.hoisted(() => ({
  completeMultipartUpload: vi.fn(),
  createMultipartUpload: vi.fn(),
  deleteFile: vi.fn(),
  getSettings: vi.fn(),
  mockPrisma: {
    loRA: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/settingsService', () => ({
  default: class SettingsService {
    getSettings = getSettings;
  },
}));

vi.mock('@/lib/s3MultipartUpload', () => ({
  completeMultipartUpload,
  createMultipartUpload,
}));

vi.mock('@/lib/s3Service', () => ({
  default: class S3Service {
    deleteFile = deleteFile;
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { POST as initPost } from '@/app/api/lora/multipart/init/route';
import { POST as finalizePost } from '@/app/api/lora/multipart/finalize/route';

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Parameters<typeof initPost>[0];
}

describe('LoRA multipart upload routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({
      settings: {
        s3: {
          endpointUrl: 'https://s3.local',
          accessKeyId: 'access',
          secretAccessKey: 'secret',
          bucketName: 'models',
          region: 'us-east-1',
          timeout: 30000,
          useGlobalNetworking: true,
        },
      },
    });
  });

  it('initializes LoRA uploads in the loras prefix using the configured bucket', async () => {
    createMultipartUpload.mockResolvedValue({
      uploadId: 'upload-id',
      key: 'loras/model.safetensors',
      partSize: 64,
      filePath: '/runpod-volume/loras/model.safetensors',
      s3Url: 'https://s3.local/models/loras/model.safetensors',
    });

    const response = await initPost(jsonRequest('http://localhost/api/lora/multipart/init', {
      fileName: 'model.safetensors',
      fileSize: 128,
      contentType: 'application/octet-stream',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(createMultipartUpload).toHaveBeenCalledWith({
      volume: 'models',
      path: 'loras',
      fileName: 'model.safetensors',
      contentType: 'application/octet-stream',
      fileSize: 128,
    });
    expect(json).toMatchObject({
      success: true,
      volume: 'models',
      uploadId: 'upload-id',
      key: 'loras/model.safetensors',
    });
  });

  it('finalizes multipart upload and creates a LoRA database record', async () => {
    completeMultipartUpload.mockResolvedValue({
      key: 'loras/model.safetensors',
      filePath: '/runpod-volume/loras/model.safetensors',
      s3Url: 'https://s3.local/models/loras/model.safetensors',
    });
    mockPrisma.loRA.create.mockResolvedValue({
      id: 'lora-id',
      name: 'model',
      fileName: 'model.safetensors',
      s3Path: '/runpod-volume/loras/model.safetensors',
      s3Url: 'https://s3.local/models/loras/model.safetensors',
      fileSize: BigInt(128),
      extension: '.safetensors',
      targetOverride: null,
      uploadedAt: new Date('2026-08-11T13:20:00Z'),
      workspaceId: 'default',
    });

    const response = await finalizePost(jsonRequest('http://localhost/api/lora/multipart/finalize', {
      volume: 'models',
      key: 'loras/model.safetensors',
      uploadId: 'upload-id',
      fileName: 'model.safetensors',
      fileSize: 128,
      workspaceId: 'default',
      parts: [{ partNumber: 1, eTag: 'etag' }],
    }) as Parameters<typeof finalizePost>[0]);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(completeMultipartUpload).toHaveBeenCalledWith({
      volume: 'models',
      key: 'loras/model.safetensors',
      uploadId: 'upload-id',
      parts: [{ partNumber: 1, eTag: 'etag' }],
    });
    expect(mockPrisma.loRA.create).toHaveBeenCalledWith({
      data: {
        name: 'model',
        fileName: 'model.safetensors',
        s3Path: '/runpod-volume/loras/model.safetensors',
        s3Url: 'https://s3.local/models/loras/model.safetensors',
        fileSize: BigInt(128),
        extension: '.safetensors',
        workspaceId: 'default',
      },
    });
    expect(json.lora.fileSize).toBe('128');
  });

  it('rejects finalize for keys outside loras', async () => {
    const response = await finalizePost(jsonRequest('http://localhost/api/lora/multipart/finalize', {
      volume: 'models',
      key: 'other/model.safetensors',
      uploadId: 'upload-id',
      fileName: 'model.safetensors',
      fileSize: 128,
    }) as Parameters<typeof finalizePost>[0]);

    expect(response.status).toBe(400);
    expect(completeMultipartUpload).not.toHaveBeenCalled();
    expect(mockPrisma.loRA.create).not.toHaveBeenCalled();
  });
});
