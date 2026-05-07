import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockCancelJobExecution, mockRunningStatuses } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findMany: vi.fn(),
    },
  },
  mockCancelJobExecution: vi.fn(),
  mockRunningStatuses: new Set(['queueing_up', 'processing', 'queued', 'in_queue', 'in_progress']),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/jobManagement', () => ({
  cancelJobExecution: mockCancelJobExecution,
  RUNNING_JOB_STATUSES: mockRunningStatuses,
}));

import { POST } from '@/app/api/jobs/cancel-active/route';

describe('POST /api/jobs/cancel-active', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels all active jobs in the workspace', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      { id: 'job-1', status: 'processing' },
      { id: 'job-2', status: 'queued' },
    ]);
    mockCancelJobExecution
      .mockResolvedValueOnce({ outcome: 'cancelled', job: { id: 'job-1', status: 'failed', error: 'cancelled' } })
      .mockResolvedValueOnce({ outcome: 'deleted', deletedJobId: 'job-2' });

    const response = await POST(new Request('http://localhost/api/jobs/cancel-active', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'workspace-1', userId: 'user-with-settings' }),
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-with-settings',
        workspaceId: 'workspace-1',
        status: { in: Array.from(mockRunningStatuses) },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(mockCancelJobExecution).toHaveBeenCalledTimes(2);
    expect(json).toMatchObject({
      success: true,
      totalActive: 2,
      cancelled: ['job-1'],
      deleted: ['job-2'],
      failed: [],
    });
  });

  it('returns partial failure details when one active job cannot be cancelled', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      { id: 'job-1', status: 'processing' },
      { id: 'job-2', status: 'queued' },
    ]);
    mockCancelJobExecution
      .mockResolvedValueOnce({ outcome: 'cancelled', job: { id: 'job-1', status: 'failed', error: 'cancelled' } })
      .mockRejectedValueOnce(new Error('RunPod unavailable'));

    const response = await POST(new Request('http://localhost/api/jobs/cancel-active', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: 'workspace-1' }),
    }));
    const json = await response.json();

    expect(response.status).toBe(207);
    expect(json).toMatchObject({
      success: false,
      totalActive: 2,
      cancelled: ['job-1'],
      deleted: [],
      failed: [{ id: 'job-2', error: 'RunPod unavailable' }],
    });
  });
});
