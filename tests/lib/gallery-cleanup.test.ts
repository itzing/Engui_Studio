import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, existsSyncMock, unlinkSyncMock } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
  existsSyncMock: vi.fn(() => true),
  unlinkSyncMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    unlinkSync: unlinkSyncMock,
  },
}));

import { emptyGalleryTrash, permanentlyDeleteGalleryAsset } from '@/lib/galleryCleanup';

describe('galleryCleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes asset metadata and local files', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'a1',
      originalUrl: '/generations/gallery/ws-1/file.png',
      previewUrl: '/generations/gallery/ws-1/file.png',
      thumbnailUrl: '/generations/gallery/ws-1/derived/thumb.jpg',
    });
    mockPrisma.galleryAsset.delete.mockResolvedValue({ id: 'a1' });

    const result = await permanentlyDeleteGalleryAsset('a1');

    expect(result).toMatchObject({ id: 'a1' });
    expect(mockPrisma.galleryAsset.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(unlinkSyncMock).toHaveBeenCalledTimes(2);
  });

  it('empties trash by deleting each trashed asset', async () => {
    mockPrisma.galleryAsset.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    mockPrisma.galleryAsset.findUnique
      .mockResolvedValueOnce({ id: 'a1', originalUrl: '/a1.png', previewUrl: '/a1.png', thumbnailUrl: null })
      .mockResolvedValueOnce({ id: 'a2', originalUrl: '/a2.png', previewUrl: '/a2.png', thumbnailUrl: null });
    mockPrisma.galleryAsset.delete.mockResolvedValue({});

    const result = await emptyGalleryTrash('ws-1');

    expect(result.deletedCount).toBe(2);
    expect(mockPrisma.galleryAsset.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', trashed: true },
      select: { id: true },
    });
  });
});
