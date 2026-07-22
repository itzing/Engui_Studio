import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    preset: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from '@/app/api/create/video-presets/route';
import { DELETE } from '@/app/api/create/video-presets/[id]/route';

function buildPresetRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'video-preset-1',
    userId: 'workspace-1',
    name: 'Mobile preset',
    type: 'video-create:wan22',
    options: JSON.stringify({
      modelId: 'wan22',
      prompt: 'move forward',
      showAdvanced: true,
      parameterValues: { length: 81 },
      createdAt: 100,
      updatedAt: 200,
    }),
    createdAt: new Date('2026-07-22T10:00:00.000Z'),
    ...overrides,
  };
}

describe('video create presets routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
  });

  it('lists workspace video presets from the shared preset table', async () => {
    mockPrisma.preset.findMany.mockResolvedValue([
      buildPresetRecord({ id: 'old', name: 'Old', options: JSON.stringify({ modelId: 'wan22', prompt: 'old', createdAt: 100, updatedAt: 100 }) }),
      buildPresetRecord({ id: 'new', name: 'New', options: JSON.stringify({ modelId: 'wan22', prompt: 'new', createdAt: 200, updatedAt: 300 }) }),
    ]);

    const response = await GET(new Request('http://localhost/api/create/video-presets?workspaceId=workspace-1&modelId=wan22') as unknown as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.preset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'workspace-1', type: 'video-create:wan22' },
    }));
    expect(payload.presets.map((preset: { id: string }) => preset.id)).toEqual(['new', 'old']);
  });

  it('syncs legacy local presets into workspace-scoped server storage', async () => {
    mockPrisma.preset.upsert.mockResolvedValue(buildPresetRecord());
    mockPrisma.preset.findMany.mockResolvedValue([buildPresetRecord()]);

    const response = await POST(new Request('http://localhost/api/create/video-presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'workspace-1',
        presets: [{
          id: 'video-preset-1',
          modelId: 'wan22',
          name: 'Mobile preset',
          prompt: 'move forward',
          showAdvanced: true,
          parameterValues: { length: 81 },
          createdAt: 100,
          updatedAt: 200,
        }],
      }),
    }) as unknown as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(mockPrisma.preset.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'video-preset-1' },
      create: expect.objectContaining({
        id: 'video-preset-1',
        userId: 'workspace-1',
        type: 'video-create:wan22',
      }),
    }));
  });

  it('deletes a video preset only inside the active workspace', async () => {
    mockPrisma.preset.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.preset.findMany.mockResolvedValue([]);

    const response = await DELETE(new Request('http://localhost/api/create/video-presets/video-preset-1', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'workspace-1' }),
    }) as unknown as NextRequest, { params: Promise.resolve({ id: 'video-preset-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.presets).toEqual([]);
    expect(mockPrisma.preset.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'video-preset-1',
        userId: 'workspace-1',
        type: { startsWith: 'video-create:' },
      },
    });
  });
});
