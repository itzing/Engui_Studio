import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelJobExecution } from '@/lib/jobManagement';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const cancelledJob = await cancelJobExecution(job);

    return NextResponse.json({
      success: true,
      job: cancelledJob,
      message: 'Job cancelled',
    });
  } catch (error: any) {
    console.error('Error cancelling job:', error);
    const message = error?.message || 'Failed to cancel job';
    const status = message.includes('Only active jobs') ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
