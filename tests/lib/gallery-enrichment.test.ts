import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { enrichGalleryAsset, queueGalleryEnrichment } from '@/lib/galleryEnrichment';

describe('galleryEnrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks enrichment as completed with derived auto tags', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'a1',
      type: 'image',
      generationSnapshot: JSON.stringify({ prompt: 'portrait studio client-a', modelId: 'flux-dev', aspectRatio: '1:1' }),
    });
    mockPrisma.galleryAsset.update
      .mockResolvedValueOnce({ id: 'a1', enrichmentStatus: 'processing' })
      .mockResolvedValueOnce({ id: 'a1', enrichmentStatus: 'completed', autoTags: JSON.stringify(['image', 'portrait']) });

    const result = await enrichGalleryAsset('a1');

    expect(mockPrisma.galleryAsset.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'a1' },
      data: { enrichmentStatus: 'processing' },
    });
    expect(result.autoTags).toContain('portrait');
    expect(result.autoTags).toContain('flux-dev');
  });

  it('queues enrichment asynchronously', async () => {
    const timeoutSpy = vi.spyOn(global, 'setTimeout');

    queueGalleryEnrichment('a1');

    expect(timeoutSpy).toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });
});
