import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, queueGalleryEnrichmentMock, queueGalleryDerivativesMock } = vi.hoisted(() => ({
  mockPrisma: {
    job: { findUnique: vi.fn() },
    galleryAsset: { findUnique: vi.fn(), create: vi.fn() },
  },
  queueGalleryEnrichmentMock: vi.fn(),
  queueGalleryDerivativesMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/galleryEnrichment', () => ({ queueGalleryEnrichment: queueGalleryEnrichmentMock }));
vi.mock('@/lib/galleryDerivatives', () => ({ queueGalleryDerivatives: queueGalleryDerivativesMock }));
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    readFileSync: vi.fn(() => Buffer.from('image-bytes')),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import { POST } from '@/app/api/gallery/assets/from-job-output/route';

describe('POST /api/gallery/assets/from-job-output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns existing asset for duplicate workspace content hash', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1', workspaceId: 'ws-1', type: 'image', resultUrl: '/generations/test.png', options: null, thumbnailUrl: null,
    });
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({ id: 'asset-existing', workspaceId: 'ws-1' });

    const response = await POST(new Request('http://localhost/api/gallery/assets/from-job-output', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'job-1', outputId: 'output-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, alreadyInGallery: true });
    expect(mockPrisma.galleryAsset.create).not.toHaveBeenCalled();
  });

  it('creates a new asset and queues async enrichment/derivatives when duplicate is absent', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1', workspaceId: 'ws-1', type: 'image', resultUrl: '/generations/test.png', options: JSON.stringify({ stylePreset: 'studio' }), thumbnailUrl: '/thumb.png',
      prompt: 'portrait client-a', modelId: 'flux-dev', endpointId: 'endpoint-1',
    });
    mockPrisma.galleryAsset.findUnique.mockResolvedValue(null);
    mockPrisma.galleryAsset.create.mockResolvedValue({ id: 'asset-new', enrichmentStatus: 'pending' });

    const response = await POST(new Request('http://localhost/api/gallery/assets/from-job-output', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'job-1', outputId: 'output-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, alreadyInGallery: false, autoTags: [] });
    expect(mockPrisma.galleryAsset.create).toHaveBeenCalledTimes(1);
    expect(queueGalleryDerivativesMock).toHaveBeenCalledWith('asset-new');
    expect(queueGalleryEnrichmentMock).toHaveBeenCalledWith('asset-new');
  });
});
