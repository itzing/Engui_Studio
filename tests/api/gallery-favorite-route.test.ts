import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: { update: vi.fn() },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

import { POST } from '@/app/api/gallery/assets/[id]/favorite/route';

describe('POST /api/gallery/assets/[id]/favorite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates favorited boolean', async () => {
    const response = await POST(new Request('http://localhost/api/gallery/assets/a1/favorite', {
      method: 'POST',
      body: JSON.stringify({ favorited: 'yes' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'a1' }) });

    expect(response.status).toBe(400);
  });

  it('updates asset favorite state', async () => {
    mockPrisma.galleryAsset.update.mockResolvedValue({ id: 'a1', favorited: true });

    const response = await POST(new Request('http://localhost/api/gallery/assets/a1/favorite', {
      method: 'POST',
      body: JSON.stringify({ favorited: true }),
      headers: { 'Content-Type': 'application/json' },
    }) as any, { params: Promise.resolve({ id: 'a1' }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.galleryAsset.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { favorited: true } });
    expect(json.success).toBe(true);
  });
});
