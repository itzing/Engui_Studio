import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSettings, listFiles, mockPrisma } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listFiles: vi.fn(),
  mockPrisma: {
    loRA: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    loRAHelperProfile: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/settingsService', () => ({
  default: class SettingsService {
    getSettings = getSettings;
  },
}));

vi.mock('@/lib/s3Service', () => ({
  default: class S3Service {
    listFiles = listFiles;
  },
}));

import { POST } from '@/app/api/lora/sync/route';

function request(body: unknown) {
  return new Request('http://localhost/api/lora/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

describe('POST /api/lora/sync', () => {
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
    listFiles.mockResolvedValue([
      {
        key: 'loras/keep.safetensors',
        type: 'file',
        extension: '.safetensors',
        size: 1024,
        lastModified: new Date('2026-07-29T10:00:00Z'),
      },
      {
        key: 'loras/new.ckpt',
        type: 'file',
        extension: '.ckpt',
        size: 2048,
        lastModified: new Date('2026-07-29T11:00:00Z'),
      },
      {
        key: 'loras/readme.txt',
        type: 'file',
        extension: '.txt',
        size: 64,
        lastModified: new Date('2026-07-29T12:00:00Z'),
      },
    ]);
  });

  it('imports missing S3 LoRAs and deletes database records missing from S3 for the workspace', async () => {
    mockPrisma.loRA.findFirst.mockImplementation(({ where }: { where: { s3Path: string } }) => {
      if (where.s3Path === '/runpod-volume/loras/keep.safetensors') {
        return Promise.resolve({ id: 'keep-id' });
      }

      return Promise.resolve(null);
    });
    mockPrisma.loRA.create.mockResolvedValue({
      id: 'new-id',
      name: 'new',
      fileName: 'new.ckpt',
      fileSize: BigInt(2048),
    });
    mockPrisma.loRA.findMany.mockResolvedValue([
      {
        id: 'keep-id',
        fileName: 'keep.safetensors',
        s3Path: '/runpod-volume/loras/keep.safetensors',
      },
      {
        id: 'stale-id',
        fileName: 'stale.safetensors',
        s3Path: '/runpod-volume/loras/stale.safetensors',
      },
    ]);
    mockPrisma.loRAHelperProfile.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.loRA.deleteMany.mockResolvedValue({ count: 1 });

    const response = await POST(request({ workspaceId: 'ws-1' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.loRA.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'new',
        fileName: 'new.ckpt',
        s3Path: '/runpod-volume/loras/new.ckpt',
        workspaceId: 'ws-1',
      }),
    });
    expect(mockPrisma.loRA.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1' },
      select: {
        id: true,
        fileName: true,
        s3Path: true,
      },
    });
    expect(mockPrisma.loRA.deleteMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['stale-id'],
        },
      },
    });
    expect(mockPrisma.loRAHelperProfile.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { loraId: { in: ['stale-id'] } },
          { highLoraId: { in: ['stale-id'] } },
          { lowLoraId: { in: ['stale-id'] } },
        ],
      },
    });
    expect(json).toMatchObject({
      success: true,
      synced: [{ id: 'new-id', name: 'new', fileName: 'new.ckpt', fileSize: '2048' }],
      deleted: [
        {
          id: 'stale-id',
          fileName: 'stale.safetensors',
          s3Path: '/runpod-volume/loras/stale.safetensors',
        },
      ],
      total: 2,
    });
  });

  it('limits stale record pruning to null workspace records when no workspace is provided', async () => {
    mockPrisma.loRA.findFirst.mockResolvedValue({ id: 'existing-id' });
    mockPrisma.loRA.findMany.mockResolvedValue([]);

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(mockPrisma.loRA.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspaceId: null },
    }));
    expect(mockPrisma.loRA.deleteMany).not.toHaveBeenCalled();
  });
});
