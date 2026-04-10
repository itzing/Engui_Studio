
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseJson(value: unknown): any {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return typeof value === 'object' ? value : null;
}

export async function POST(request: Request) {
  try {
    const { jobId, resultUrl } = await request.json();

    if (!jobId || !resultUrl) {
      return NextResponse.json({ error: 'Missing jobId or resultUrl' }, { status: 400 });
    }

    const existingJob = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!existingJob) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const secureState = parseJson((existingJob as any).secureState);
    const secureFinalized = secureState?.activeAttempt?.finalization?.status === 'completed';
    const secureInFlight = !!secureState?.activeAttempt?.attemptId;

    if (secureFinalized && existingJob.resultUrl) {
      return NextResponse.json({
        message: 'Webhook ignored, secure finalization already completed',
        mode: 'ignored-secure-finalized',
        job: existingJob,
      });
    }

    if (secureInFlight) {
      const updatedJob = await prisma.job.update({
        where: { id: jobId },
        data: {
          options: JSON.stringify({
            ...(parseJson(existingJob.options) || {}),
            legacyWebhookResultUrl: resultUrl,
          }),
        },
      });

      return NextResponse.json({
        message: 'Webhook accepted as legacy fallback hint, supervisor path remains primary',
        mode: 'legacy-fallback-hint',
        job: updatedJob,
      });
    }

    const updatedJob = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        resultUrl,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Webhook received and job updated',
      mode: 'legacy-complete',
      job: updatedJob,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
