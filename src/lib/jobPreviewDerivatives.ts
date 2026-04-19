import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { ffmpegService } from '@/lib/ffmpegService';

type JobPreviewTarget = {
  id: string;
  modelId?: string | null;
  type?: string | null;
  resultUrl?: string | null;
  thumbnailUrl?: string | null;
};

const JOB_PREVIEWS_DIR = path.join(process.cwd(), 'public', 'generations', 'job-previews');
const DEFAULT_THUMBNAIL_SIZE = 480;
const DEFAULT_THUMBNAIL_QUALITY = 76;
const DEFAULT_VIDEO_POSTER_QUALITY = 4;

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function resolveLocalPublicPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/')) return null;

  const normalized = url.split('?')[0].split('#')[0].replace(/^\/+/, '');
  const publicRoot = path.resolve(process.cwd(), 'public');
  const absolutePath = path.resolve(publicRoot, normalized);

  if (!absolutePath.startsWith(publicRoot + path.sep) && absolutePath !== publicRoot) {
    return null;
  }

  return absolutePath;
}

function buildThumbnailName(job: JobPreviewTarget, resultUrl: string) {
  const safeModelId = String(job.modelId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
  const hash = crypto.createHash('md5').update(resultUrl).digest('hex').slice(0, 8);
  return `${safeModelId}-${job.id}-thumb-${hash}.webp`;
}

function buildVideoPosterName(job: JobPreviewTarget, resultUrl: string) {
  const safeModelId = String(job.modelId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
  const hash = crypto.createHash('md5').update(resultUrl).digest('hex').slice(0, 8);
  return `${safeModelId}-${job.id}-poster-${hash}.jpg`;
}

export async function generateJobImageThumbnail(params: {
  job: JobPreviewTarget;
  resultUrl: string;
  size?: number;
  quality?: number;
}): Promise<string | null> {
  const { job, resultUrl, size = DEFAULT_THUMBNAIL_SIZE, quality = DEFAULT_THUMBNAIL_QUALITY } = params;

  if (job.type !== 'image') {
    return null;
  }

  const inputPath = resolveLocalPublicPath(resultUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    return null;
  }

  ensureDir(JOB_PREVIEWS_DIR);

  const fileName = buildThumbnailName(job, resultUrl);
  const outputPath = path.join(JOB_PREVIEWS_DIR, fileName);

  await sharp(inputPath)
    .rotate()
    .resize(size, size, { fit: 'cover', position: 'centre', withoutEnlargement: true })
    .webp({ quality })
    .toFile(outputPath);

  return `/generations/job-previews/${fileName}`;
}

export async function generateJobVideoPoster(params: {
  job: JobPreviewTarget;
  resultUrl: string;
  size?: number;
  quality?: number;
}): Promise<string | null> {
  const { job, resultUrl, size = DEFAULT_THUMBNAIL_SIZE, quality = DEFAULT_VIDEO_POSTER_QUALITY } = params;

  if (job.type !== 'video') {
    return null;
  }

  const inputPath = resolveLocalPublicPath(resultUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    return null;
  }

  const ffmpegAvailable = await ffmpegService.isFFmpegAvailable();
  if (!ffmpegAvailable) {
    return null;
  }

  ensureDir(JOB_PREVIEWS_DIR);

  const fileName = buildVideoPosterName(job, resultUrl);
  const outputPath = path.join(JOB_PREVIEWS_DIR, fileName);

  await ffmpegService.extractThumbnail(inputPath, outputPath, {
    width: size,
    height: size,
    quality,
    format: 'jpg',
  });

  return `/generations/job-previews/${fileName}`;
}

export async function maybeGenerateJobThumbnail(job: JobPreviewTarget): Promise<string | null> {
  if (!job.resultUrl || job.thumbnailUrl) {
    return job.thumbnailUrl || null;
  }

  try {
    if (job.type === 'image') {
      return await generateJobImageThumbnail({
        job,
        resultUrl: job.resultUrl,
      });
    }

    if (job.type === 'video') {
      return await generateJobVideoPoster({
        job,
        resultUrl: job.resultUrl,
      });
    }

    return null;
  } catch (error) {
    console.warn('Failed to generate job thumbnail', {
      jobId: job.id,
      modelId: job.modelId,
      type: job.type,
      resultUrl: job.resultUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function maybeGenerateJobImageThumbnail(job: JobPreviewTarget): Promise<string | null> {
  if (job.type !== 'image') {
    return job.thumbnailUrl || null;
  }

  return maybeGenerateJobThumbnail(job);
}
