import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: { update: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { POST } from '@/app/api/gallery/assets/[id]/trash/route';

describe('POST /api/gallery/assets/[id]/trash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates trashed boolean', async () => {
    const response = await POST(new Request('http://localhost/api/gallery/assets/a1/trash', {
      method: 'POST',
      body: JSON.stringify({ trashed: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'a1' }) });

    expect(response.status).toBe(400);
  });

  it('updates asset trash state', async () => {
    mockPrisma.galleryAsset.update.mockResolvedValue({ id: 'a1', trashed: true });

    const response = await POST(new Request('http://localhost/api/gallery/assets/a1/trash', {
      method: 'POST',
      body: JSON.stringify({ trashed: true }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'a1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.galleryAsset.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { trashed: true } });
    expect(json.success).toBe(true);
  });
});
