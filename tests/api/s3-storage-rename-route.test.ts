import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSettings, renameObject, s3Constructor } = vi.hoisted(() => ({
  getSettings: vi.fn(),
  renameObject: vi.fn(),
  s3Constructor: vi.fn(),
}));

vi.mock('@/lib/settingsService', () => ({
  default: class SettingsService {
    getSettings = getSettings;
  },
}));

vi.mock('@/lib/s3Service', () => ({
  default: class S3Service {
    constructor(config: unknown) {
      s3Constructor(config);
    }

    renameObject = renameObject;
  },
}));

import { POST } from '@/app/api/s3-storage/rename/route';

function request(body: unknown) {
  return new Request('http://localhost/api/s3-storage/rename', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as any;
}

describe('POST /api/s3-storage/rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({
      settings: {
        s3: {
          endpointUrl: 'https://s3.local',
          accessKeyId: 'access',
          secretAccessKey: 'secret',
          region: 'us-east-1',
          useGlobalNetworking: true,
        },
      },
    });
    renameObject.mockResolvedValue({
      sourceKey: 'loras/old.safetensors',
      destinationKey: 'loras/new.safetensors',
    });
  });

  it('renames one file inside the same S3 prefix', async () => {
    const response = await POST(request({
      volume: 'models',
      key: 'loras/old.safetensors',
      newName: 'new.safetensors',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      sourceKey: 'loras/old.safetensors',
      destinationKey: 'loras/new.safetensors',
    });
    expect(s3Constructor).toHaveBeenCalledWith(expect.objectContaining({
      bucketName: 'models',
      useGlobalNetworking: true,
    }));
    expect(renameObject).toHaveBeenCalledWith('loras/old.safetensors', 'loras/new.safetensors');
  });

  it('rejects names that would move the file to another folder', async () => {
    const response = await POST(request({
      volume: 'models',
      key: 'loras/old.safetensors',
      newName: '../new.safetensors',
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('folder separators');
    expect(renameObject).not.toHaveBeenCalled();
  });

  it('rejects unchanged names before touching S3', async () => {
    const response = await POST(request({
      volume: 'models',
      key: 'loras/old.safetensors',
      newName: 'old.safetensors',
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain('different file name');
    expect(renameObject).not.toHaveBeenCalled();
  });
});
