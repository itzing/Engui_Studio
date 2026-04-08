import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enrichGalleryAsset } = vi.hoisted(() => ({
  enrichGalleryAsset: vi.fn(),
}));

vi.mock('@/lib/galleryEnrichment', () => ({ enrichGalleryAsset }));

import { POST } from '@/app/api/gallery/assets/[id]/enrich/route';

describe('POST /api/gallery/assets/[id]/enrich', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enriched asset payload', async () => {
    enrichGalleryAsset.mockResolvedValue({
      asset: { id: 'a1', enrichmentStatus: 'completed' },
      autoTags: ['portrait', 'studio'],
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/a1/enrich', { method: 'POST' }) as any, {
      params: Promise.resolve({ id: 'a1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(enrichGalleryAsset).toHaveBeenCalledWith('a1');
    expect(json).toMatchObject({ success: true, autoTags: ['portrait', 'studio'] });
  });
});
