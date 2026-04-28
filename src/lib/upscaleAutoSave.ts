import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { prisma } from '@/lib/prisma';
import { queueGalleryDerivatives } from '@/lib/galleryDerivatives';
import { queueGalleryEnrichment } from '@/lib/galleryEnrichment';

function parseJobOptions(rawOptions: unknown): Record<string, unknown> {
  if (!rawOptions) return {};
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === 'object' ? rawOptions as Record<string, unknown> : {};
}

async function readBytesForUrl(url: string): Promise<Buffer> {
  if (url.startsWith('/')) {
    const localPath = path.join(process.cwd(), 'public', url.replace(/^\/+/, ''));
    return fs.readFile(localPath);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch asset bytes: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function maybeAutoSaveUpscaleResult(job: any) {
  if (!job.workspaceId || !job.resultUrl) return null;
  if (job.status !== 'completed') return null;
  if (job.modelId !== 'upscale' && job.modelId !== 'video-upscale') return null;

  const existing = await prisma.galleryAsset.findFirst({
    where: {
      workspaceId: job.workspaceId,
      sourceJobId: job.id,
      sourceOutputId: 'output-1',
      bucket: 'upscale',
      trashed: false,
    },
    select: { id: true },
  });

  if (existing) return existing;

  const bytes = await readBytesForUrl(job.resultUrl);
  const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');

  const asset = await prisma.galleryAsset.create({
    data: {
      workspaceId: job.workspaceId,
      type: job.type === 'video' ? 'video' : 'image',
      bucket: 'upscale',
      originKind: 'job_output',
      sourceJobId: job.id,
      sourceOutputId: 'output-1',
      contentHash,
      originalUrl: job.resultUrl,
      previewUrl: job.resultUrl,
      thumbnailUrl: job.thumbnailUrl,
      generationSnapshot: JSON.stringify({
        prompt: job.prompt,
        modelId: job.modelId,
        options: parseJobOptions(job.options),
        source: 'upscale-autosave',
      }),
      userTags: JSON.stringify([]),
      autoTags: JSON.stringify([]),
      derivativeStatus: 'pending',
      enrichmentStatus: 'pending',
    },
  });

  queueGalleryDerivatives(asset.id);
  queueGalleryEnrichment(asset.id);
  return asset;
}
