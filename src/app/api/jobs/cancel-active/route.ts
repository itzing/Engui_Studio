import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelJobExecution, RUNNING_JOB_STATUSES } from '@/lib/jobManagement';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = typeof body?.workspaceId === 'string' && body.workspaceId.trim()
      ? body.workspaceId.trim()
      : null;
    const userId = typeof body?.userId === 'string' && body.userId.trim()
      ? body.userId.trim()
      : 'user-with-settings';

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        workspaceId,
        status: { in: Array.from(RUNNING_JOB_STATUSES) },
      },
      orderBy: { createdAt: 'asc' },
    });

    const cancelled: string[] = [];
    const deleted: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const job of jobs) {
      try {
        const result = await cancelJobExecution(job);
        if (result.outcome === 'deleted') {
          deleted.push(job.id);
        } else {
          cancelled.push(job.id);
        }
      } catch (error: any) {
        failed.push({ id: job.id, error: error?.message || 'Failed to cancel job' });
      }
    }

    return NextResponse.json({
      success: failed.length === 0,
      totalActive: jobs.length,
      cancelled,
      deleted,
      failed,
    }, { status: failed.length === 0 ? 200 : 207 });
  } catch (error: any) {
    console.error('Error cancelling active jobs:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to cancel active jobs' }, { status: 500 });
  }
}
