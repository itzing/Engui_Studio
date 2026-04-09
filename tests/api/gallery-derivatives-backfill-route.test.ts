import { beforeEach, describe, expect, it, vi } from 'vitest';

const { backfillGalleryDerivatives } = vi.hoisted(() => ({
  backfillGalleryDerivatives: vi.fn(),
}));

vi.mock('@/lib/galleryDerivatives', () => ({ backfillGalleryDerivatives }));

import { POST } from '@/app/api/gallery/assets/derivatives/backfill/route';

describe('POST /api/gallery/assets/derivatives/backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires workspaceId', async () => {
    const response = await POST(new Request('http://localhost/api/gallery/assets/derivatives/backfill', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }) as any);

    expect(response.status).toBe(400);
  });

  it('delegates derivative backfill with workspace scope', async () => {
    backfillGalleryDerivatives.mockResolvedValue({ processed: 3, results: [{ id: 'a1', previewUrl: '/derived/a1.webp', thumbnailUrl: '/derived/a1-thumb.webp' }] });

    const response = await POST(new Request('http://localhost/api/gallery/assets/derivatives/backfill', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1', limit: 25 }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(backfillGalleryDerivatives).toHaveBeenCalledWith('ws-1', 25);
    expect(json).toMatchObject({ success: true, processed: 3 });
  });
});
