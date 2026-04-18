import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import RunPodService from '@/lib/runpodService';
import SettingsService from '@/lib/settingsService';

export const RUNNING_JOB_STATUSES = new Set(['processing', 'queued', 'in_queue', 'in_progress']);
export const FINISHED_JOB_STATUSES = new Set(['completed', 'failed']);

function parseJobOptions(rawOptions: unknown): Record<string, unknown> {
  if (!rawOptions) return {};
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === 'object' ? (rawOptions as Record<string, unknown>) : {};
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function collectJobArtifactUrls(job: any): string[] {
  const options = parseJobOptions(job.options);
  const directCandidates = [
    normalizeUrlCandidate(job.resultUrl),
    normalizeUrlCandidate(job.thumbnailUrl),
    normalizeUrlCandidate(options.url),
    normalizeUrlCandidate(options.resultUrl),
    normalizeUrlCandidate(options.image),
    normalizeUrlCandidate(options.image_url),
    normalizeUrlCandidate(options.image_path),
    normalizeUrlCandidate(options.video),
    normalizeUrlCandidate(options.video_url),
    normalizeUrlCandidate(options.video_path),
    normalizeUrlCandidate(options.audioUrl),
    normalizeUrlCandidate(options.output_path),
    normalizeUrlCandidate(options.s3_path),
    normalizeUrlCandidate(options.thumbnailUrl),
  ].filter(Boolean) as string[];

  const listCandidates: string[] = [];
  for (const key of ['images', 'videos', 'outputs', 'resultUrls'] as const) {
    const value = options[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeUrlCandidate(item);
        if (normalized) listCandidates.push(normalized);
      }
    }
  }

  return Array.from(new Set([...directCandidates, ...listCandidates]));
}

function urlToLocalPublicPath(url: string): string | null {
  try {
    const pathname = url.startsWith('http://') || url.startsWith('https://')
      ? new URL(url).pathname
      : url;

    if (!pathname.startsWith('/')) return null;
    if (!pathname.startsWith('/generations/') && !pathname.startsWith('/thumbnails/')) return null;

    const relativePath = pathname.replace(/^\/+/, '');
    const absolutePath = path.resolve(process.cwd(), 'public', relativePath);
    const publicRoot = path.resolve(process.cwd(), 'public');
    if (!absolutePath.startsWith(publicRoot + path.sep) && absolutePath !== publicRoot) {
      return null;
    }

    return absolutePath;
  } catch {
    return null;
  }
}

async function isUrlReferencedByGallery(url: string): Promise<boolean> {
  const count = await prisma.galleryAsset.count({
    where: {
      OR: [
        { originalUrl: url },
        { previewUrl: url },
        { thumbnailUrl: url },
      ],
    },
  });

  return count > 0;
}

export async function cleanupJobArtifacts(job: any): Promise<{ deletedFiles: string[]; keptFiles: string[] }> {
  const urls = collectJobArtifactUrls(job);
  const deletedFiles: string[] = [];
  const keptFiles: string[] = [];

  for (const url of urls) {
    const localPath = urlToLocalPublicPath(url);
    if (!localPath) {
      keptFiles.push(url);
      continue;
    }

    if (await isUrlReferencedByGallery(url)) {
      keptFiles.push(url);
      continue;
    }

    try {
      await fs.unlink(localPath);
      deletedFiles.push(url);
    } catch (error: any) {
      if (error?.code === 'ENOENT') continue;
      keptFiles.push(url);
    }
  }

  return { deletedFiles, keptFiles };
}

async function resolveRunPodDeletionContext(job: any) {
  const settingsService = new SettingsService();
  const { settings } = await settingsService.getSettings('user-with-settings');

  const runpodApiKey = settings.runpod?.apiKey || undefined;
  const endpointFromModelMap = settings.runpod?.endpoints?.[job.modelId || ''];
  const endpointId = job.endpointId || endpointFromModelMap;
  const runpodJobId = job.runpodJobId || (() => {
    try {
      if (!job.options) return undefined;
      const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
      return options?.runpodJobId;
    } catch {
      return undefined;
    }
  })();

  return { runpodApiKey, endpointId, runpodJobId };
}

export async function cancelJobExecution(job: any) {
  const status = String(job.status || '').toLowerCase();
  if (!RUNNING_JOB_STATUSES.has(status)) {
    throw new Error('Only active jobs can be cancelled');
  }

  const markCancelledLocally = async () => prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'failed',
      error: 'cancelled',
      completedAt: new Date(),
    },
  });

  const { runpodApiKey, endpointId, runpodJobId } = await resolveRunPodDeletionContext(job);
  if (!runpodApiKey || !endpointId || !runpodJobId) {
    console.warn('Cancel fallback: missing RunPod cancellation metadata, marking job cancelled locally', {
      jobId: job.id,
      endpointId,
      hasRunpodApiKey: !!runpodApiKey,
      hasRunpodJobId: !!runpodJobId,
    });
    return markCancelledLocally();
  }

  const runpodService = new RunPodService(runpodApiKey, endpointId);

  try {
    await runpodService.cancelJob(runpodJobId);
  } catch (error: any) {
    const message = String(error?.message || '');
    const isRecoverableMissingUpstream = /404|not found|job not found|unknown job|does not exist/i.test(message);

    if (!isRecoverableMissingUpstream) {
      throw error;
    }

    console.warn('Cancel fallback: RunPod job already missing upstream, marking job cancelled locally', {
      jobId: job.id,
      runpodJobId,
      message,
    });
  }

  return markCancelledLocally();
}

export async function deleteFinishedJob(job: any) {
  const status = String(job.status || '').toLowerCase();
  if (!FINISHED_JOB_STATUSES.has(status)) {
    throw new Error('Cannot delete active job, cancel it first');
  }

  const cleanup = await cleanupJobArtifacts(job);
  await prisma.job.delete({ where: { id: job.id } });

  return {
    deletedJobId: job.id,
    deletedFiles: cleanup.deletedFiles,
    keptFiles: cleanup.keptFiles,
  };
}
