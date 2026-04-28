import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockCancelJobExecution } = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      findUnique: vi.fn(),
    },
  },
  mockCancelJobExecution: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/jobManagement', () => ({
  cancelJobExecution: mockCancelJobExecution,
}));

import { POST } from '@/app/api/jobs/[id]/cancel/route';

describe('POST /api/jobs/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cancelled outcome with updated job payload', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-1', status: 'processing' });
    mockCancelJobExecution.mockResolvedValue({
      outcome: 'cancelled',
      job: { id: 'job-1', status: 'failed', error: 'cancelled' },
    });

    const response = await POST(new Request('http://localhost/api/jobs/job-1/cancel') as any, {
      params: Promise.resolve({ id: 'job-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      outcome: 'cancelled',
      deletedJobId: null,
      job: { id: 'job-1', status: 'failed', error: 'cancelled' },
      message: 'Job cancelled',
    });
  });

  it('returns deleted outcome when the upstream job is already missing', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-2', status: 'processing' });
    mockCancelJobExecution.mockResolvedValue({
      outcome: 'deleted',
      deletedJobId: 'job-2',
    });

    const response = await POST(new Request('http://localhost/api/jobs/job-2/cancel') as any, {
      params: Promise.resolve({ id: 'job-2' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      outcome: 'deleted',
      deletedJobId: 'job-2',
      job: null,
    });
    expect(json.message).toContain('deleted locally');
  });
});
