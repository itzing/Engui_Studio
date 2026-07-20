import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/jobs/[id]/reuse/route';

describe('job reuse route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds image-only WAN22 img2vid payloads for job image outputs', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      type: 'image',
      prompt: 'source image prompt should not replace video prompt',
      resultUrl: '/generations/job-output.png',
      modelId: 'z-image',
      endpointId: 'z-image',
      options: JSON.stringify({
        prompt: 'snapshot prompt should not replace video prompt',
        modelId: 'z-image',
        width: 1536,
        height: 1024,
        seed: 1234,
        image_path: '/generations/source-input.png',
      }),
    });

    const response = await POST(new Request('http://localhost/api/jobs/job-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'img2vid', outputId: 'output-1' }),
    }) as any, {
      params: Promise.resolve({ id: 'job-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toEqual({
      action: 'img2vid',
      type: 'video',
      modelId: 'wan22',
      prompt: '',
      imageInputPath: '/generations/job-output.png',
      sourceImageGenerationSnapshot: {
        prompt: 'source image prompt should not replace video prompt',
        modelId: 'z-image',
        endpointId: 'z-image',
        width: 1536,
        height: 1024,
        seed: 1234,
        image_path: '/generations/source-input.png',
      },
      preserveVideoDraftFields: true,
      options: {
        image_path: '/generations/job-output.png',
      },
    });
  });

  it('builds txt2img payloads for video jobs from source image metadata', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'video-job-1',
      type: 'video',
      prompt: 'video prompt',
      resultUrl: '/generations/video-output.mp4',
      modelId: 'wan22',
      endpointId: 'wan22',
      options: JSON.stringify({
        sourceImageGenerationSnapshot: {
          prompt: 'original image prompt',
          modelId: 'z-image',
          endpointId: 'z-image',
          width: 1024,
          height: 1024,
          seed: 99,
          image_path: '/generations/init.png',
          use_controlnet: true,
          task_type: 'image_to_image',
        },
      }),
    });

    const response = await POST(new Request('http://localhost/api/jobs/video-job-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img', outputId: 'output-1' }),
    }) as any, {
      params: Promise.resolve({ id: 'video-job-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.payload).toMatchObject({
      action: 'txt2img',
      type: 'image',
      modelId: 'z-image',
      prompt: 'original image prompt',
      options: {
        width: 1024,
        height: 1024,
        seed: 99,
        use_controlnet: false,
        task_type: '',
      },
    });
    expect(json.payload.options.image_path).toBeUndefined();
  });

  it('uses selected prompt override for job txt2img payloads', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      type: 'image',
      prompt: 'portrait, {hairColor}',
      resultUrl: '/generations/job-output.png',
      modelId: 'z-image',
      endpointId: 'z-image',
      options: JSON.stringify({
        prompt: 'portrait, {hairColor}',
        promptTemplate: 'portrait, {hairColor}',
        resolvedPrompt: 'portrait, blonde hair',
        modelId: 'z-image',
        width: 1024,
      }),
    });

    const response = await POST(new Request('http://localhost/api/jobs/job-1/reuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'txt2img', outputId: 'output-1', promptOverride: 'portrait, blonde hair' }),
    }) as any, {
      params: Promise.resolve({ id: 'job-1' }),
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
