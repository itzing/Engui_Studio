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
});
