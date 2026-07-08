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
      preserveVideoDraftFields: true,
      options: {
        image_path: '/generations/job-output.png',
      },
    });
  });
});
