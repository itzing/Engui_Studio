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

import { GET } from '@/app/api/carousel/feed-window/route';

function makeAsset(id: string, index: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    workspaceId: 'ws-1',
    type: 'video',
    originalUrl: `/${id}.mp4`,
    previewUrl: `/${id}.mp4`,
    thumbnailUrl: `/${id}.png`,
    favorited: false,
    trashed: false,
    userTags: JSON.stringify([]),
    autoTags: JSON.stringify([]),
    sourceJobId: null,
    sourceOutputId: null,
    bucket: 'common',
    derivativeStatus: 'pending',
    enrichmentStatus: 'pending',
    generationSnapshot: JSON.stringify({ width: 1280, height: 720 }),
    addedToGalleryAt: new Date(`2026-07-21T06:${String(index).padStart(2, '0')}:00Z`),
    updatedAt: new Date(`2026-07-21T06:${String(index).padStart(2, '0')}:00Z`),
    ...overrides,
  };
}

describe('GET /api/carousel/feed-window', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a ready carousel window around the nearest matching gallery-order asset', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue([
      makeAsset('video-1', 1),
      makeAsset('video-2', 2, { generationSnapshot: JSON.stringify({ width: 720, height: 1280 }) }),
      makeAsset('video-3', 3),
      makeAsset('video-4', 4, { generationSnapshot: JSON.stringify({ width: 720, height: 1280 }) }),
      makeAsset('video-5', 5),
    ]);

    const response = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=galleryOrder&anchorAssetId=video-4&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=false&before=1&after=1') as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.previous.map((entry: any) => entry.id)).toEqual(['video-3']);
    expect(json.current.id).toBe('video-5');
    expect(json.next).toEqual([]);
    expect(json.pagination).toMatchObject({
      totalCount: 3,
      anchorIndex: 2,
      hasBefore: true,
      hasAfter: false,
      beforeCursor: 1,
      afterCursor: null,
    });
    expect(json.counts).toEqual({ videos: 3, images: 0, total: 3 });
  });

  it('loads additional before and after windows by cursor', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => makeAsset(`video-${index + 1}`, index + 1)),
    );

    const afterResponse = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=galleryOrder&direction=after&cursor=2&includeVideos=true&includeImages=false&before=0&after=2') as any);
    const afterJson = await afterResponse.json();

    expect(afterJson.current.id).toBe('video-4');
    expect(afterJson.next.map((entry: any) => entry.id)).toEqual(['video-5']);
    expect(afterJson.pagination.afterCursor).toBe(4);

    const beforeResponse = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=galleryOrder&direction=before&cursor=3&includeVideos=true&includeImages=false&before=2&after=0') as any);
    const beforeJson = await beforeResponse.json();

    expect(beforeJson.previous.map((entry: any) => entry.id)).toEqual(['video-2']);
    expect(beforeJson.current.id).toBe('video-3');
    expect(beforeJson.pagination.beforeCursor).toBe(1);
  });
});
