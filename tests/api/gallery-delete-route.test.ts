import { beforeEach, describe, expect, it, vi } from 'vitest';

const { permanentlyDeleteGalleryAsset } = vi.hoisted(() => ({
  permanentlyDeleteGalleryAsset: vi.fn(),
}));

vi.mock('@/lib/galleryCleanup', () => ({ permanentlyDeleteGalleryAsset }));

import { DELETE } from '@/app/api/gallery/assets/[id]/route';

describe('DELETE /api/gallery/assets/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires permanent=true', async () => {
    const response = await DELETE(new Request('http://localhost/api/gallery/assets/a1') as any, {
      params: Promise.resolve({ id: 'a1' }),
    });

    expect(response.status).toBe(400);
  });

  it('permanently deletes asset when confirmed by query', async () => {
    permanentlyDeleteGalleryAsset.mockResolvedValue({ id: 'a1' });

    const response = await DELETE(new Request('http://localhost/api/gallery/assets/a1?permanent=true') as any, {
      params: Promise.resolve({ id: 'a1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(permanentlyDeleteGalleryAsset).toHaveBeenCalledWith('a1');
    expect(json).toMatchObject({ success: true, deletedAssetId: 'a1' });
  });
});
