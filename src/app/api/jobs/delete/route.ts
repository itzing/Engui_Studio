import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import RunPodService from '@/lib/runpodService';
import SettingsService from '@/lib/settingsService';
import { FINISHED_JOB_STATUSES, deleteFinishedJob } from '@/lib/jobManagement';

const prisma = new PrismaClient();

const RUNNING_STATUSES = new Set(['queueing_up', 'processing', 'queued', 'in_queue', 'in_progress']);

export async function DELETE(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const status = String(job.status || '').toLowerCase();
    const shouldCancelRemote = RUNNING_STATUSES.has(status);

    if (FINISHED_JOB_STATUSES.has(status)) {
      const result = await deleteFinishedJob(job);
      return NextResponse.json({
        success: true,
        message: 'Job deleted locally',
        ...result,
      });
    }

    if (shouldCancelRemote) {
      const settingsService = new SettingsService();
      const { settings } = await settingsService.getSettings('user-with-settings');

      const runpodApiKey = settings.runpod?.apiKey || request.headers.get('x-runpod-key') || undefined;
      const endpointFromModelMap = settings.runpod?.endpoints?.[job.modelId || ''];
      const endpointId = job.endpointId || endpointFromModelMap;
      const runpodJobId = job.runpodJobId || (() => {
        try {
          if (!job.options) return undefined;
          const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options as any);
          return options?.runpodJobId;
        } catch {
          return undefined;
        }
      })();

      if (runpodApiKey && endpointId && runpodJobId) {
        const runpodService = new RunPodService(runpodApiKey, endpointId);
        await runpodService.cancelJob(runpodJobId);
      } else {
        return NextResponse.json({
          error: 'Cannot cancel remote RunPod job before delete',
          details: {
            hasRunPodApiKey: !!runpodApiKey,
            hasEndpointId: !!endpointId,
            hasRunpodJobId: !!runpodJobId,
          }
        }, { status: 400 });
      }
    }

    const deletedJob = await prisma.job.delete({ where: { id: jobId } });

    return NextResponse.json({
      success: true,
      message: shouldCancelRemote ? 'Job canceled on RunPod and deleted locally' : 'Job deleted locally',
      deletedJob,
    });

  } catch (error) {
    console.error('Error deleting job:', error);

    if (error instanceof Error) {
      const status = error.message.includes('materialization finishes') ? 409 : 500;
      return NextResponse.json({
        error: 'Failed to delete job',
        details: error.message,
      }, { status });
    }

    return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 });
  }
}
