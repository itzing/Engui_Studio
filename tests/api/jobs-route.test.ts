import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockMaybeGenerateJobThumbnail } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
  mockMaybeGenerateJobThumbnail: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/defaultWorkspace', () => ({
  resolveJobWorkspaceId: vi.fn(),
}));

vi.mock('@/lib/jobPreviewDerivatives', () => ({
  maybeGenerateJobThumbnail: mockMaybeGenerateJobThumbnail,
}));

import { GET } from '@/app/api/jobs/route';

describe('GET /api/jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeGenerateJobThumbnail.mockResolvedValue(null);
  });

  const makeJob = (id: string, createdAt: string) => ({
    id,
    userId: 'user-with-settings',
    workspaceId: 'workspace-1',
    workspace: { id: 'workspace-1', name: 'Workspace', color: '#fff' },
    modelId: 'flux-dev',
    type: 'image',
    status: 'completed',
    prompt: `prompt ${id}`,
    createdAt: new Date(createdAt),
    executionMs: null,
    options: null,
    secureState: null,
    resultUrl: `/jobs/${id}.png`,
    error: null,
    endpointId: null,
    thumbnailUrl: `/jobs/${id}-thumb.png`,
    cost: null,
  });

  it('returns every matching job when all=true is requested', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      makeJob('job-1', '2026-07-21T10:03:00Z'),
      makeJob('job-2', '2026-07-21T10:02:00Z'),
      makeJob('job-3', '2026-07-21T10:01:00Z'),
    ]);

    const response = await GET(new Request('http://localhost/api/jobs?workspaceId=workspace-1&limit=2&all=true'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.jobs.map((job: { id: string }) => job.id)).toEqual(['job-1', 'job-2', 'job-3']);
    expect(json.pagination).toMatchObject({
      page: 1,
      totalCount: 3,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  it('keeps paged responses for clients that do not request all jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      makeJob('job-1', '2026-07-21T10:03:00Z'),
      makeJob('job-2', '2026-07-21T10:02:00Z'),
      makeJob('job-3', '2026-07-21T10:01:00Z'),
    ]);

    const response = await GET(new Request('http://localhost/api/jobs?workspaceId=workspace-1&limit=2'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.jobs.map((job: { id: string }) => job.id)).toEqual(['job-1', 'job-2']);
    expect(json.pagination).toMatchObject({
      page: 1,
      totalCount: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });
});
