import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    loRA: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    loRAHelperProfile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { POST } from '@/app/api/lora/helper-profile/route';

function request(body: unknown) {
  return new Request('http://localhost/api/lora/helper-profile', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

describe('POST /api/lora/helper-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pair helper profile with notes and recommended weights', async () => {
    mockPrisma.loRA.findMany.mockResolvedValue([{ id: 'high-id' }, { id: 'low-id' }]);
    mockPrisma.loRAHelperProfile.findFirst.mockResolvedValue(null);
    mockPrisma.loRAHelperProfile.create.mockResolvedValue({
      id: 'profile-id',
      workspaceId: 'ws-1',
      scope: 'pair',
      loraId: null,
      highLoraId: 'high-id',
      lowLoraId: 'low-id',
      notes: 'trigger words',
      recommendedHighWeight: 0.7,
      recommendedLowWeight: 0.8,
    });

    const response = await POST(request({
      workspaceId: 'ws-1',
      scope: 'pair',
      highLoraId: 'high-id',
      lowLoraId: 'low-id',
      notes: 'trigger words',
      recommendedHighWeight: '0.7',
      recommendedLowWeight: '0.8',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.loRAHelperProfile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        scope: 'pair',
        highLoraId: 'high-id',
        lowLoraId: 'low-id',
        notes: 'trigger words',
        recommendedHighWeight: 0.7,
        recommendedLowWeight: 0.8,
      }),
    });
    expect(json).toMatchObject({
      success: true,
      profile: { id: 'profile-id' },
    });
  });

  it('rejects notes longer than 8000 characters', async () => {
    const response = await POST(request({
      scope: 'single',
      loraId: 'lora-id',
      notes: 'x'.repeat(8001),
    }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
    expect(mockPrisma.loRA.findUnique).not.toHaveBeenCalled();
  });

  it('updates an existing single helper profile without recommended weights', async () => {
    mockPrisma.loRA.findUnique.mockResolvedValue({ id: 'lora-id' });
    mockPrisma.loRAHelperProfile.findFirst.mockResolvedValue({ id: 'profile-id' });
    mockPrisma.loRAHelperProfile.update.mockResolvedValue({
      id: 'profile-id',
      scope: 'single',
      loraId: 'lora-id',
      notes: 'new note',
      recommendedHighWeight: null,
      recommendedLowWeight: null,
    });

    const response = await POST(request({
      scope: 'single',
      loraId: 'lora-id',
      notes: 'new note',
      recommendedHighWeight: '1',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.loRAHelperProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-id' },
      data: expect.objectContaining({
        scope: 'single',
        loraId: 'lora-id',
        recommendedHighWeight: null,
        recommendedLowWeight: null,
      }),
    });
    expect(json.success).toBe(true);
  });
});
