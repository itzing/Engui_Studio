import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { GET } from '@/app/api/gallery/assets/route';

describe('GET /api/gallery/assets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by all search tokens across manual and auto tags', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue([
      {
        id: 'asset-1', workspaceId: 'ws-1', type: 'image', originalUrl: '/a.png', previewUrl: '/a.png', thumbnailUrl: null,
        favorited: false, trashed: false, userTags: JSON.stringify(['portrait']), autoTags: JSON.stringify(['client-a', 'studio']),
        sourceJobId: 'job-1', sourceOutputId: 'output-1', derivativeStatus: 'pending', enrichmentStatus: 'completed',
        addedToGalleryAt: new Date('2026-04-08T10:00:00Z'), updatedAt: new Date('2026-04-08T10:00:00Z'),
      },
      {
        id: 'asset-2', workspaceId: 'ws-1', type: 'image', originalUrl: '/b.png', previewUrl: '/b.png', thumbnailUrl: null,
        favorited: false, trashed: false, userTags: JSON.stringify(['portrait']), autoTags: JSON.stringify(['nature']),
        sourceJobId: 'job-2', sourceOutputId: 'output-2', derivativeStatus: 'pending', enrichmentStatus: 'completed',
        addedToGalleryAt: new Date('2026-04-08T09:00:00Z'), updatedAt: new Date('2026-04-08T09:00:00Z'),
      },
    ]);

    const request = new Request('http://localhost/api/gallery/assets?workspaceId=ws-1&q=portrait%20client-a') as any;
    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.assets).toHaveLength(1);
    expect(json.assets[0].id).toBe('asset-1');
    expect(json.assets[0].autoTags).toContain('client-a');
  });

  it('returns paginated payload metadata', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `asset-${index + 1}`, workspaceId: 'ws-1', type: 'image', originalUrl: `/${index}.png`, previewUrl: `/${index}.png`, thumbnailUrl: null,
        favorited: false, trashed: false, userTags: JSON.stringify([]), autoTags: JSON.stringify([]),
        sourceJobId: null, sourceOutputId: null, derivativeStatus: 'pending', enrichmentStatus: 'pending',
        addedToGalleryAt: new Date(`2026-04-08T0${index}:00:00Z`), updatedAt: new Date(`2026-04-08T0${index}:00:00Z`),
      }))
    );

    const request = new Request('http://localhost/api/gallery/assets?workspaceId=ws-1&page=1&limit=2') as any;
    const response = await GET(request);
    const json = await response.json();

    expect(json.assets).toHaveLength(2);
    expect(json.pagination).toMatchObject({
      page: 1,
      limit: 2,
      totalCount: 3,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });
});
