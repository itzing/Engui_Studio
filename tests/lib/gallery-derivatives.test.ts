import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, sharpMock, sharpChain, ffmpegServiceMock, existsSyncMock, mkdirSyncMock } = vi.hoisted(() => {
  const chain = {
    rotate: vi.fn(() => chain),
    resize: vi.fn(() => chain),
    webp: vi.fn(() => chain),
    toFile: vi.fn(async () => undefined),
  };

  return {
    mockPrisma: {
      galleryAsset: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
    },
    sharpMock: vi.fn(() => chain),
    sharpChain: chain,
    ffmpegServiceMock: {
      isFFmpegAvailable: vi.fn(async () => true),
      extractThumbnail: vi.fn(async () => undefined),
    },
    existsSyncMock: vi.fn(() => true),
    mkdirSyncMock: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('sharp', () => ({ default: sharpMock }));
vi.mock('@/lib/ffmpegService', () => ({ ffmpegService: ffmpegServiceMock }));
vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    mkdirSync: mkdirSyncMock,
  },
}));

import { backfillGalleryDerivatives, generateGalleryDerivatives } from '@/lib/galleryDerivatives';

describe('galleryDerivatives', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates preview and thumbnail files for image assets', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'a1',
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: '/generations/gallery/ws-1/original.png',
      previewUrl: '/generations/gallery/ws-1/original.png',
      thumbnailUrl: '/generations/gallery/ws-1/original.png',
      derivativeStatus: 'pending',
    });
    mockPrisma.galleryAsset.update
      .mockResolvedValueOnce({ id: 'a1', derivativeStatus: 'processing' })
      .mockResolvedValueOnce({ id: 'a1', derivativeStatus: 'completed', previewUrl: '/derived/preview.webp', thumbnailUrl: '/derived/thumb.webp' });

    const result = await generateGalleryDerivatives('a1');

    expect(sharpMock).toHaveBeenCalled();
    expect(sharpChain.toFile).toHaveBeenCalledTimes(2);
    expect(result.derivativeStatus).toBe('completed');
  });

  it('backfills stale image assets whose preview and thumbnail still equal original', async () => {
    mockPrisma.galleryAsset.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'a1',
          type: 'image',
          originalUrl: '/generations/gallery/ws-1/original.png',
          previewUrl: '/generations/gallery/ws-1/original.png',
          thumbnailUrl: '/generations/gallery/ws-1/original.png',
        },
      ]);
    mockPrisma.galleryAsset.findMany.mockResolvedValueOnce([]);
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'a1',
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: '/generations/gallery/ws-1/original.png',
      previewUrl: '/generations/gallery/ws-1/original.png',
      thumbnailUrl: '/generations/gallery/ws-1/original.png',
      derivativeStatus: 'completed',
    });
    mockPrisma.galleryAsset.update
      .mockResolvedValueOnce({ id: 'a1', derivativeStatus: 'processing' })
      .mockResolvedValueOnce({ id: 'a1', derivativeStatus: 'completed', previewUrl: '/derived/preview.webp', thumbnailUrl: '/derived/thumb.webp' });

    const result = await backfillGalleryDerivatives('ws-1', 50);

    expect(result.processed).toBe(1);
    expect(sharpChain.toFile).toHaveBeenCalledTimes(2);
  });

  it('backfills targeted video assets by id', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValueOnce([
      {
        id: 'video-1',
        type: 'video',
        originalUrl: '/generations/gallery/ws-1/video.mp4',
        previewUrl: '/generations/gallery/ws-1/video.mp4',
        thumbnailUrl: '/generations/gallery/ws-1/gallery-thumb.webp',
      },
    ]);
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'video-1',
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      previewUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/gallery-thumb.webp',
      derivativeStatus: 'pending',
    });
    mockPrisma.galleryAsset.update
      .mockResolvedValueOnce({ id: 'video-1', derivativeStatus: 'processing' })
      .mockResolvedValueOnce({ id: 'video-1', derivativeStatus: 'completed', previewUrl: '/generations/gallery/ws-1/video.mp4', thumbnailUrl: '/derived/video-1-thumb.jpg' });

    const result = await backfillGalleryDerivatives('ws-1', 5, ['video-1']);

    expect(mockPrisma.galleryAsset.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: 'ws-1',
        id: { in: ['video-1'] },
      }),
      take: 5,
    }));
    expect(ffmpegServiceMock.extractThumbnail).toHaveBeenCalled();
    expect(result.results[0]).toMatchObject({ id: 'video-1', derivativeStatus: 'completed', thumbnailUrl: '/derived/video-1-thumb.jpg' });
  });
});
