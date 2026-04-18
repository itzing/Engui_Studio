import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { buildReadOnlyStatusPayload } from '@/lib/runpodSupervisor';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Missing jobId parameter' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(buildReadOnlyStatusPayload(job));
  } catch (error: any) {
    console.error('Status Check Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error',
    }, { status: 500 });
  }
}
