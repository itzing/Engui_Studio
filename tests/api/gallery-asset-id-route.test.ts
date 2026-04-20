import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { GET } from '@/app/api/gallery/assets/[id]/route';

describe('GET /api/gallery/assets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns normalized gallery asset details with prompt and modelId from generationSnapshot', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: '/original.png',
      previewUrl: '/preview.png',
      thumbnailUrl: '/thumb.png',
      favorited: true,
      trashed: false,
      userTags: JSON.stringify(['portrait']),
      autoTags: JSON.stringify(['studio']),
      sourceJobId: 'job-1',
      sourceOutputId: 'output-1',
      derivativeStatus: 'completed',
      enrichmentStatus: 'completed',
      generationSnapshot: JSON.stringify({ prompt: 'cinematic portrait', modelId: 'flux-krea' }),
      addedToGalleryAt: new Date('2026-04-20T10:00:00Z'),
      updatedAt: new Date('2026-04-20T10:05:00Z'),
    });

    const response = await GET(new Request('http://localhost/api/gallery/assets/asset-1') as any, {
      params: Promise.resolve({ id: 'asset-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.asset).toMatchObject({
      id: 'asset-1',
      prompt: 'cinematic portrait',
      modelId: 'flux-krea',
      userTags: ['portrait'],
      autoTags: ['studio'],
      sourceJobId: 'job-1',
    });
  });
});
