import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    galleryAsset: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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
    mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
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

  it('adds source image metadata to gallery image img2vid payloads', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      type: 'image',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/file.png',
      generationSnapshot: JSON.stringify({ prompt: 'forest temple', modelId: 'z-image', width: 1024, seed: 44 }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'img2vid' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'img2vid',
      type: 'video',
      modelId: 'wan22',
      imageInputPath: '/generations/gallery/ws-1/file.png',
      preserveVideoDraftFields: true,
      sourceImageGenerationSnapshot: {
        prompt: 'forest temple',
        modelId: 'z-image',
        width: 1024,
        seed: 44,
      },
    });
  });

  it('returns img2vid for WAN22 I2V video assets', async () => {
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
    expect(json.actions).toEqual(['txt2img', 'img2vid']);
  });

  it('returns txt2img and txt2vid for WAN22 T2V video assets', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-t2v-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/t2v.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/t2v-thumb.jpg',
      generationSnapshot: JSON.stringify({ prompt: 'wide dolly shot', modelId: 'wan22-t2v', width: 832, height: 480 }),
    });

    const response = await GET(new Request('http://localhost/api/gallery/assets/asset-t2v-1/reuse') as any, {
      params: Promise.resolve({ id: 'asset-t2v-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.actions).toEqual(['txt2img', 'txt2vid']);
  });

  it('builds txt2img payload from WAN22 T2V gallery prompt metadata', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-t2v-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/t2v.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/t2v-thumb.jpg',
      generationSnapshot: JSON.stringify({
        prompt: 'wide dolly shot',
        modelId: 'wan22-t2v',
        endpointId: 'wan22-t2v',
        width: 832,
        height: 480,
        seed: 98765,
        video_path: '/generations/gallery/ws-1/t2v.mp4',
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-t2v-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-t2v-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      prompt: 'wide dolly shot',
    });
    expect(json.payload.modelId).toBeUndefined();
    expect(json.payload.options.image_path).toBeUndefined();
  });

  it('builds T2V payload from WAN22 T2V gallery metadata', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-t2v-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/t2v.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/t2v-thumb.jpg',
      generationSnapshot: JSON.stringify({
        prompt: 'wide dolly shot',
        modelId: 'wan22-t2v',
        endpointId: 'wan22-t2v',
        width: 832,
        height: 480,
        seed: 98765,
        randomizeSeed: true,
        cfg: 1,
        steps: 4,
        length: 81,
        video_path: '/generations/gallery/ws-1/t2v.mp4',
        image_path: '/generations/should-not-carry.png',
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-t2v-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2vid' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-t2v-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2vid',
      type: 'video',
      modelId: 'wan22-t2v',
      prompt: 'wide dolly shot',
      options: {
        width: 832,
        height: 480,
        seed: 98765,
        randomizeSeed: true,
        cfg: 1,
        steps: 4,
        length: 81,
      },
    });
    expect(json.payload.options.image_path).toBeUndefined();
    expect(json.payload.options.video_path).toBeUndefined();
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

  it('builds txt2img payload from WAN22 video source image metadata', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
      sourceJobId: 'job-1',
      generationSnapshot: JSON.stringify({
        prompt: 'video prompt',
        modelId: 'wan22',
        sourceImageGenerationSnapshot: {
          prompt: 'forest temple',
          modelId: 'z-image',
          endpointId: 'z-image',
          width: 1024,
          height: 1024,
          seed: 12,
          image_path: '/generations/init.png',
          use_controlnet: true,
          task_type: 'image_to_image',
        },
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'forest temple',
      options: {
        width: 1024,
        height: 1024,
        seed: 12,
        use_controlnet: false,
        task_type: '',
      },
    });
    expect(json.payload.options.image_path).toBeUndefined();
  });

  it('recovers source Gallery randomize seed metadata for WAN22 video txt2img reuse', async () => {
    mockPrisma.galleryAsset.findUnique
      .mockResolvedValueOnce({
        id: 'asset-video-1',
        type: 'video',
        originKind: 'job_output',
        originalUrl: '/generations/gallery/ws-1/video.mp4',
        thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
        sourceJobId: 'job-1',
        generationSnapshot: JSON.stringify({
          prompt: 'video prompt',
          modelId: 'wan22',
          sourceImageGenerationSnapshot: {
            galleryAssetId: 'source-image-1',
            prompt: 'forest temple',
            modelId: 'z-image',
            imageInputPath: '/generations/gallery/ws-1/source.png',
          },
        }),
      })
      .mockResolvedValueOnce({
        id: 'source-image-1',
        generationSnapshot: JSON.stringify({
          prompt: 'forest temple',
          modelId: 'z-image',
          width: 1024,
          height: 1024,
          seed: 12,
          randomizeSeed: true,
          use_controlnet: false,
        }),
      });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'forest temple',
      options: {
        width: 1024,
        height: 1024,
        seed: 12,
        randomizeSeed: true,
        use_controlnet: false,
      },
    });
  });

  it('recovers source Gallery randomize seed metadata by source image URL for WAN22 video txt2img reuse', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
      sourceJobId: 'job-1',
      workspaceId: 'ws-1',
      generationSnapshot: JSON.stringify({
        prompt: 'video prompt',
        modelId: 'wan22',
        sourceImageGenerationSnapshot: {
          prompt: 'forest temple',
          modelId: 'z-image',
          imageInputPath: '/generations/gallery/ws-1/source.png',
        },
      }),
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue({
      generationSnapshot: JSON.stringify({
        prompt: 'forest temple',
        modelId: 'z-image',
        width: 1024,
        height: 1024,
        seed: 12,
        randomizeSeed: true,
        use_controlnet: false,
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.galleryAsset.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: 'ws-1',
        type: 'image',
        originalUrl: { in: ['/generations/gallery/ws-1/source.png'] },
      }),
    }));
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'forest temple',
      options: {
        width: 1024,
        height: 1024,
        seed: 12,
        randomizeSeed: true,
        use_controlnet: false,
      },
    });
  });

  it('ignores prompt overrides for WAN22 video txt2img payloads', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/derived/video-thumb.jpg',
      sourceJobId: 'job-1',
      generationSnapshot: JSON.stringify({
        prompt: 'video prompt',
        modelId: 'wan22',
        sourceImageGenerationSnapshot: {
          prompt: 'forest temple',
          modelId: 'z-image',
          endpointId: 'z-image',
          width: 1024,
          height: 1024,
        },
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-video-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img', promptOverride: 'video prompt should not win' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-video-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload.prompt).toBe('forest temple');
  });

  it('uses selected prompt override for gallery txt2img payloads', async () => {
    mockPrisma.galleryAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      type: 'image',
      originKind: 'job_output',
      originalUrl: '/generations/gallery/ws-1/file.png',
      generationSnapshot: JSON.stringify({
        prompt: 'portrait, {hairColor}',
        resolvedPrompt: 'portrait, blonde hair',
        modelId: 'z-image',
        width: 1024,
      }),
    });

    const response = await POST(new Request('http://localhost/api/gallery/assets/asset-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img', promptOverride: 'portrait, blonde hair' }),
    }) as any, {
      params: Promise.resolve({ id: 'asset-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'portrait, blonde hair',
      options: {
        width: 1024,
        use_controlnet: false,
        task_type: '',
      },
    });
  });
});
