import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from '@/app/api/gallery/assets/[id]/reuse/route';

describe('gallery reuse route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns compatible actions for image assets', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      type: 'image',
      originKind: 'job_output',
    });

    const response = await GET(new Request('http://localhost/api/gallery/assets/asset-1/reuse') as any, {
      params: Promise.resolve({ id: 'asset-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actions).toEqual(['txt2img', 'img2img', 'img2vid']);
  });

  it('builds img2img payload from gallery asset data', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      type: 'image',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/file.png',
      generationSnapshot: JSON.stringify({ prompt: 'forest temple', modelId: 'z-image', width: 1024 }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'img2img' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'img2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'forest temple',
      imageInputPath: '/generations/gallery/ws-1/file.png',
    });
    expect(json.payload.options.image_path).toBe('/generations/gallery/ws-1/file.png');
  });
});
