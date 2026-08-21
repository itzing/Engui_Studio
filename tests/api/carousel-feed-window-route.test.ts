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
    expect(json.previous[0].asset.modelId).toBeNull();
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

  it('returns modelId in display assets for TikTok action controls', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue([
      makeAsset('video-i2v', 1, {
        generationSnapshot: JSON.stringify({ width: 720, height: 1280, modelId: 'wan22' }),
      }),
    ]);

    const response = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=galleryOrder&includeVideos=true&includeImages=false&includeLandscape=false&includePortrait=true&before=0&after=0') as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.current.asset).toMatchObject({
      id: 'video-i2v',
      modelId: 'wan22',
    });
  });

  it('resolves a non-favorite anchor to the nearest favorite without falling back to the first favorite', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue([
      makeAsset('video-1', 1, { favorited: true }),
      makeAsset('video-2', 2, { favorited: false }),
      makeAsset('video-3', 3, { favorited: true }),
      makeAsset('video-4', 4, { favorited: true }),
    ]);

    const response = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=galleryOrder&anchorAssetId=video-2&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=true&favoritesOnly=true&before=1&after=1') as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.galleryAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ favorited: true }),
    }));
    expect(json.current.id).toBe('video-3');
    expect(json.previous.map((entry: any) => entry.id)).toEqual(['video-1']);
    expect(json.next.map((entry: any) => entry.id)).toEqual(['video-4']);
    expect(json.pagination).toMatchObject({
      totalCount: 3,
      anchorIndex: 1,
    });
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

  it('returns stable shuffle windows for the same seed and cursor', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => makeAsset(`video-${index + 1}`, index + 1)),
    );

    const firstResponse = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=shuffle&seed=test-seed&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=true&before=0&after=3') as any);
    const secondResponse = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=shuffle&seed=test-seed&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=true&before=0&after=3') as any);
    const firstJson = await firstResponse.json();
    const secondJson = await secondResponse.json();

    expect(firstJson.seed).toBe('test-seed');
    expect(secondJson.seed).toBe('test-seed');
    expect([
      firstJson.current.id,
      ...firstJson.next.map((entry: any) => entry.id),
    ]).toEqual([
      secondJson.current.id,
      ...secondJson.next.map((entry: any) => entry.id),
    ]);

    const afterResponse = await GET(new Request(`http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=shuffle&seed=test-seed&direction=after&cursor=${firstJson.pagination.afterCursor}&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=true&before=0&after=2`) as any);
    const afterJson = await afterResponse.json();

    expect(afterJson.seed).toBe('test-seed');
    expect(afterJson.current.id).not.toBe(firstJson.current.id);
    expect([
      firstJson.current.id,
      ...firstJson.next.map((entry: any) => entry.id),
    ]).not.toContain(afterJson.current.id);
  });

  it('uses spread shuffle order for source-neighbor-heavy feeds', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => makeAsset(`video-${index + 1}`, index + 1)),
    );

    const response = await GET(new Request('http://localhost/api/carousel/feed-window?workspaceId=ws-1&source=shuffle&seed=spread-seed&includeVideos=true&includeImages=false&includeLandscape=true&includePortrait=true&before=0&after=12') as any);
    const json = await response.json();
    const ids = [
      json.current.id,
      ...json.next.map((entry: any) => entry.id),
    ];
    const sourceIndexes = ids.map((id: string) => Number(id.replace('video-', '')) - 1);

    expect(response.status).toBe(200);
    expect(new Set(ids).size).toBe(ids.length);
    for (let index = 1; index < sourceIndexes.length; index += 1) {
      expect(Math.abs(sourceIndexes[index - 1] - sourceIndexes[index])).toBeGreaterThanOrEqual(3);
    }
  });
});
