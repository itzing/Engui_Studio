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

import { GET } from '@/app/api/generate/status/route';

describe('GET /api/generate/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns read-only local completed state with finalized local URL', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      type: 'image',
      resultUrl: '/generations/wan22-job-1.png',
      thumbnailUrl: '/generations/job-previews/wan22-job-1-thumb.webp',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'completed',
        activeAttempt: {
          finalization: {
            status: 'completed',
          },
        },
        cleanup: {
          transportStatus: 'warning',
          warning: 'input:/runpod-volume/foo.bin:no access',
        },
      }),
      executionMs: 12345,
    });

    const response = await GET(new Request('http://localhost/api/generate/status?jobId=job-1'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      status: 'COMPLETED',
      executionTime: 12345,
      output: {
        url: '/generations/wan22-job-1.png',
        image_url: '/generations/wan22-job-1.png',
        thumbnail_url: '/generations/job-previews/wan22-job-1-thumb.webp',
        preview_url: '/generations/job-previews/wan22-job-1-thumb.webp',
      },
      meta: {
        localPhase: 'completed',
        secureFinalized: true,
        cleanupStatus: 'warning',
        cleanupWarning: 'input:/runpod-volume/foo.bin:no access',
      },
    });
  });

  it('returns read-only local completed video state with poster metadata', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-video',
      status: 'completed',
      type: 'video',
      resultUrl: '/generations/wan22-job-video.mp4',
      thumbnailUrl: '/generations/job-previews/wan22-job-video-poster.jpg',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'completed',
        activeAttempt: {
          finalization: {
            status: 'completed',
          },
        },
      }),
      executionMs: 6789,
    });

    const response = await GET(new Request('http://localhost/api/generate/status?jobId=job-video'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      status: 'COMPLETED',
      executionTime: 6789,
      output: {
        url: '/generations/wan22-job-video.mp4',
        video_url: '/generations/wan22-job-video.mp4',
        thumbnail_url: '/generations/job-previews/wan22-job-video-poster.jpg',
        preview_url: '/generations/job-previews/wan22-job-video-poster.jpg',
      },
      meta: {
        localPhase: 'completed',
        secureFinalized: true,
      },
    });
  });

  it('returns read-only local failure without polling RunPod', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-2',
      status: 'failed',
      type: 'video',
      resultUrl: null,
      options: JSON.stringify({ error: 'RunPod job failed' }),
      secureState: null,
      executionMs: null,
      error: null,
    });

    const response = await GET(new Request('http://localhost/api/generate/status?jobId=job-2'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      status: 'FAILED',
      error: 'RunPod job failed',
    });
  });
});
