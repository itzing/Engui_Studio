import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emptyGalleryTrash } = vi.hoisted(() => ({
  emptyGalleryTrash: vi.fn(),
}));

vi.mock('@/lib/galleryCleanup', () => ({ emptyGalleryTrash }));

import { DELETE } from '@/app/api/gallery/trash/route';

describe('DELETE /api/gallery/trash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires workspaceId', async () => {
    const response = await DELETE(new Request('http://localhost/api/gallery/trash') as any);
    expect(response.status).toBe(400);
  });

  it('empties trash for workspace', async () => {
    emptyGalleryTrash.mockResolvedValue({ deletedCount: 2, deletedIds: ['a1', 'a2'] });

    const response = await DELETE(new Request('http://localhost/api/gallery/trash?workspaceId=ws-1') as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(emptyGalleryTrash).toHaveBeenCalledWith('ws-1');
    expect(json).toMatchObject({ success: true, deletedCount: 2 });
  });
});
