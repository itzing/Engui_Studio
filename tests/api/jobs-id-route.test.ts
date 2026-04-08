import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findUnique: vi.fn(),
    },
    galleryAsset: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: function PrismaClient() {
    return mockPrisma as any;
  },
}));

import { GET } from '@/app/api/jobs/[id]/route';

describe('GET /api/jobs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes outputs and maps gallery state per output', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      workspaceId: 'ws-1',
      status: 'completed',
      type: 'image',
      modelId: 'flux-dev',
      prompt: 'portrait client a',
      options: JSON.stringify({ images: ['/one.png', '/two.png'] }),
      resultUrl: '/one.png',
      thumbnailUrl: '/thumb.png',
      createdAt: new Date('2026-04-08T10:00:00Z'),
      completedAt: new Date('2026-04-08T10:01:00Z'),
    });

    mockPrisma.galleryAsset.findMany.mockResolvedValue([
      { id: 'asset-2', sourceOutputId: 'output-2' },
    ]);

    const response = await GET(new Request('http://localhost/api/jobs/job-1') as any, {
      params: Promise.resolve({ id: 'job-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.job.outputs).toHaveLength(2);
    expect(json.job.outputs[0]).toMatchObject({
      outputId: 'output-1',
      alreadyInGallery: false,
      galleryAssetId: null,
    });
    expect(json.job.outputs[1]).toMatchObject({
      outputId: 'output-2',
      alreadyInGallery: true,
      galleryAssetId: 'asset-2',
    });
  });
});
