import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, queueGalleryEnrichmentMock, queueGalleryDerivativesMock } = vi.hoisted(() => ({
  mockPrisma: {
    job: { findFirst: vi.fn(), findUnique: vi.fn() },
    $transaction: vi.fn(),
    galleryAsset: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  },
  queueGalleryEnrichmentMock: vi.fn(),
  queueGalleryDerivativesMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/workspaces/route', async () => {
  const { workspaceContext } = await import('@/lib/workspaces/context');
  return { withWorkspaceRoute: (handler:any) => (request:any, context:any) => workspaceContext.run({kind:'workspace',workspaceId:'ws-1'},()=>handler(request, context)) };
});
vi.mock('@/lib/workspaces/files', () => ({ registerWorkspaceFile: vi.fn() }));
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
    mockPrisma.$transaction.mockImplementation((work:any)=>work(mockPrisma));
  });

  it('returns existing asset for duplicate workspace content hash', async () => {
    mockPrisma.job.findFirst.mockResolvedValue({
      id: 'job-1', workspaceId: 'ws-1', type: 'image', resultUrl: '/generations/test.png', options: null, thumbnailUrl: null,
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue({ id: 'asset-existing', workspaceId: 'ws-1' });

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
    mockPrisma.job.findFirst.mockResolvedValue({
      id: 'job-1', workspaceId: 'ws-1', type: 'image', resultUrl: '/generations/test.png', options: JSON.stringify({ stylePreset: 'studio' }), thumbnailUrl: '/thumb.png',
      prompt: 'portrait client-a', modelId: 'flux-dev', endpointId: 'endpoint-1',
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
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
    const generationSnapshot = JSON.parse(mockPrisma.galleryAsset.create.mock.calls[0][0].data.generationSnapshot);
    expect(generationSnapshot.stylePreset).toBe('studio');
    expect(generationSnapshot.prompt).toBe('portrait client-a');
    expect(queueGalleryDerivativesMock).toHaveBeenCalledWith('asset-new');
    expect(queueGalleryEnrichmentMock).toHaveBeenCalledWith('asset-new');
  });

  it('preserves brace prompt templates in gallery snapshots', async () => {
    mockPrisma.job.findFirst.mockResolvedValue({
      id: 'job-template-1',
      workspaceId: 'ws-1',
      type: 'image',
      resultUrl: '/generations/template.png',
      options: JSON.stringify({
        prompt: 'resolved cinematic pov',
        promptTemplate: '{cinematic|vintage} {pov|side shot}',
        resolvedPrompt: 'cinematic pov',
        resolvedPromptSeed: 123,
      }),
      thumbnailUrl: null,
      prompt: '{cinematic|vintage} {pov|side shot}',
      modelId: 'z-image',
      endpointId: 'z-image',
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
    mockPrisma.galleryAsset.create.mockResolvedValue({ id: 'asset-template', enrichmentStatus: 'pending' });

    const response = await POST(new Request('http://localhost/api/gallery/assets/from-job-output', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'job-template-1', outputId: 'output-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);

    expect(response.status).toBe(200);
    const generationSnapshot = JSON.parse(mockPrisma.galleryAsset.create.mock.calls[0][0].data.generationSnapshot);
    expect(generationSnapshot.prompt).toBe('{cinematic|vintage} {pov|side shot}');
    expect(generationSnapshot.promptTemplate).toBe('{cinematic|vintage} {pov|side shot}');
    expect(generationSnapshot.resolvedPrompt).toBe('cinematic pov');
  });

  it('carries WAN22 source image metadata into gallery video snapshots', async () => {
    mockPrisma.job.findFirst.mockResolvedValue({
      id: 'job-video-1',
      workspaceId: 'ws-1',
      type: 'video',
      resultUrl: '/generations/video.mp4',
      thumbnailUrl: '/thumb.jpg',
      prompt: 'video prompt',
      modelId: 'wan22',
      endpointId: 'wan22',
      options: JSON.stringify({
        sourceImageGenerationSnapshot: {
          prompt: 'original image prompt',
          modelId: 'z-image',
          seed: 77,
        },
      }),
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
    mockPrisma.galleryAsset.create.mockResolvedValue({ id: 'asset-video', enrichmentStatus: 'pending' });

    const response = await POST(new Request('http://localhost/api/gallery/assets/from-job-output', {
      method: 'POST',
      body: JSON.stringify({ jobId: 'job-video-1', outputId: 'output-1' }),
      headers: { 'Content-Type': 'application/json' },
    }) as any);

    expect(response.status).toBe(200);
    const generationSnapshot = JSON.parse(mockPrisma.galleryAsset.create.mock.calls[0][0].data.generationSnapshot);
    expect(generationSnapshot.sourceImageGenerationSnapshot).toEqual({
      prompt: 'original image prompt',
      modelId: 'z-image',
      seed: 77,
    });
  });
});

import { POST as reuseGallery } from '@/app/api/gallery/assets/[id]/reuse/route';
describe('Randomize gallery metadata round trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((work: any) => work(mockPrisma));
  });

  for (const randomizeSeed of [true, false]) {
    for (const bucket of ['common', 'draft']) {
      for (const type of ['image', 'video']) {
        it(`saves and reuses Randomize=${randomizeSeed} with the used seed in ${bucket} for ${type}`, async () => {
          mockPrisma.job.findFirst.mockResolvedValue({
            id: 'audit-job', workspaceId: 'ws-1', type, modelId: type === 'image' ? 'z-image' : 'wan22',
            prompt: 'Audit source', resultUrl: type === 'image' ? '/generations/audit.png' : '/generations/audit.mp4',
            options: JSON.stringify({randomizeSeed, seed: 314159, width: 1024, height: 1024, ...(type === 'video' ? {image_path: '/generations/frame.png'} : {})}),
          });
          mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
          mockPrisma.galleryAsset.create.mockImplementation(async ({data}: any) => ({id: 'audit-asset', ...data}));
          const saved = await POST(new Request('http://localhost/api/gallery/assets/from-job-output', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({jobId: 'audit-job', outputId: 'output-1', bucket}),
          }) as any);
          expect(saved.status).toBe(200);
          const asset = mockPrisma.galleryAsset.create.mock.calls[0][0].data;
          expect(JSON.parse(asset.generationSnapshot)).toMatchObject({randomizeSeed, seed: 314159});
          mockPrisma.galleryAsset.findUnique.mockResolvedValue({id: 'audit-asset', ...asset});
          mockPrisma.job.findFirst.mockRejectedValue(new Error('Source job is no longer available'));
          mockPrisma.job.findUnique.mockResolvedValue(null);
          const reused = await reuseGallery(new Request('http://localhost/api/gallery/assets/audit-asset/reuse', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: type === 'image' ? 'txt2img' : 'img2vid'}),
          }) as any, {params: Promise.resolve({id: 'audit-asset'})});
          expect(reused.status).toBe(200);
          expect((await reused.json()).payload.options).toMatchObject({randomizeSeed, seed: 314159});
        });
      }
    }
  }
});
