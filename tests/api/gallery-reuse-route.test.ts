import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
    },
    job: {
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
    expect(json.payload.options.use_controlnet).toBe(true);
  });

  it('returns img2vid for WAN22 video assets', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
      generationSnapshot: JSON.stringify({ prompt: 'camera push in', modelId: 'wan22', width: 768, height: 512 }),
    });

    const response = await GET(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse') as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actions).toEqual(['img2vid']);
  });

  it('builds full WAN22 img2vid payload from video gallery metadata', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
      sourceJobId: 'job-1',
      generationSnapshot: JSON.stringify({
        prompt: 'camera push in',
        modelId: 'wan22',
        endpointId: 'wan22',
        width: 1280,
        height: 720,
        seed: 42,
        cfg: 1.5,
        steps: 8,
        length: 81,
        lora_high_1: '/runpod-volume/loras/high.safetensors',
        lora_low_1: '/runpod-volume/loras/low.safetensors',
      }),
    });
    mockPrisma.job.findUnique.mockResolvedValue({ imageInputPath: null });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'img2vid' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'img2vid',
      type: 'video',
      modelId: 'wan22',
      prompt: 'camera push in',
      imageInputPath: '/generations/gallery/ws-1/derived/video-thumb.jpg',
    });
    expect(json.payload.preserveVideoDraftFields).toBeUndefined();
    expect(json.payload.options).toMatchObject({
      width: 1280,
      height: 720,
      seed: 42,
      cfg: 1.5,
      steps: 8,
      length: 81,
      lora_high_1: '/runpod-volume/loras/high.safetensors',
      lora_low_1: '/runpod-volume/loras/low.safetensors',
      image_path: '/generations/gallery/ws-1/derived/video-thumb.jpg',
    });
  });
});
