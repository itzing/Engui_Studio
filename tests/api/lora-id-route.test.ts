import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    loRA: {
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { PATCH } from '@/app/api/lora/[id]/route';

function patchRequest(body: unknown) {
  return new Request('http://localhost/api/lora/lora-id', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }) as Parameters<typeof PATCH>[0];
}

const params = { params: Promise.resolve({ id: 'lora-id' }) };

function loraRecord(overrides: Partial<{
  targetOverride: string | null;
  baseModel: string;
}> = {}) {
  return {
    id: 'lora-id',
    name: 'portrait',
    fileName: 'portrait.safetensors',
    s3Path: '/runpod-volume/loras/portrait.safetensors',
    s3Url: 'https://s3.local/portrait.safetensors',
    fileSize: BigInt(128),
    extension: '.safetensors',
    targetOverride: overrides.targetOverride ?? 'image',
    baseModel: overrides.baseModel ?? 'z-image',
    uploadedAt: new Date('2026-08-29T01:00:00Z'),
    workspaceId: 'default',
  };
}

describe('LoRA metadata route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates baseModel when targetOverride is omitted', async () => {
    mockPrisma.loRA.update.mockResolvedValue(loraRecord({
      targetOverride: 'image',
      baseModel: 'krea2-turbo',
    }));

    const response = await PATCH(patchRequest({ baseModel: 'krea2-turbo' }), params);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.loRA.update).toHaveBeenCalledWith({
      where: { id: 'lora-id' },
      data: {
        baseModel: 'krea2-turbo',
        targetOverride: 'image',
      },
    });
    expect(json.lora.baseModel).toBe('krea2-turbo');
    expect(json.lora.targetOverride).toBe('image');
  });

  it('updates targetOverride when baseModel is omitted', async () => {
    mockPrisma.loRA.update.mockResolvedValue(loraRecord({
      targetOverride: 'video',
      baseModel: 'z-image',
    }));

    const response = await PATCH(patchRequest({ targetOverride: 'video' }), params);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.loRA.update).toHaveBeenCalledWith({
      where: { id: 'lora-id' },
      data: {
        targetOverride: 'video',
      },
    });
    expect(json.lora.targetOverride).toBe('video');
  });
});
