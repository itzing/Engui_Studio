import { describe, expect, it, vi, beforeEach } from 'vitest';

const { backfillGalleryEnrichment } = vi.hoisted(() => ({
  backfillGalleryEnrichment: vi.fn(),
}));

vi.mock('@/lib/galleryEnrichment', () => ({
  backfillGalleryEnrichment,
}));

import { POST } from '@/app/api/gallery/assets/backfill/route';

describe('POST /api/gallery/assets/backfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires workspaceId', async () => {
    const response = await POST(new Request('http://localhost/api/gallery/assets/backfill', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    }) as any);

    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it('delegates to enrichment backfill with workspace scope', async () => {
    backfillGalleryEnrichment.mockResolvedValue({ processed: 2, results: [{ id: 'a1', autoTags: ['portrait'] }] });

    const response = await POST(new Request('http://localhost/api/gallery/assets/backfill', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'ws-1', limit: 25 }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(backfillGalleryEnrichment).toHaveBeenCalledWith('ws-1', 25);
    expect(json).toMatchObject({ success: true, processed: 2 });
  });
});
