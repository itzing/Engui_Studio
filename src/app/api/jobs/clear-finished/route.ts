import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FINISHED_JOB_STATUSES, deleteFinishedJob } from '@/lib/jobManagement';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null;
    const userId = typeof body.userId === 'string' ? body.userId : 'user-with-settings';

    const jobs = await prisma.job.findMany({
      where: {
        userId,
        workspaceId,
        status: { in: Array.from(FINISHED_JOB_STATUSES) },
      },
      orderBy: { createdAt: 'desc' },
    });

    let deleted = 0;
    let deletedFiles = 0;
    const errors: string[] = [];

    for (const job of jobs) {
      try {
        const result = await deleteFinishedJob(job);
        deleted += 1;
        deletedFiles += result.deletedFiles.length;
      } catch (error: any) {
        errors.push(`${job.id}: ${error?.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      deletedFiles,
      totalFinished: jobs.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error clearing finished jobs:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Failed to clear finished jobs' }, { status: 500 });
  }
}
