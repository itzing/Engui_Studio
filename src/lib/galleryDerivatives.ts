import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { ffmpegService } from '@/lib/ffmpegService';

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url || !url.startsWith('/')) return null;
  const normalized = url.split('?')[0].replace(/^\//, '');
  return path.join(process.cwd(), 'public', normalized);
}

function ensurePublicDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildDerivativeFileName(assetId: string, originalUrl: string, suffix: string, ext: string) {
  return `${assetId}-${suffix}-${crypto.createHash('md5').update(originalUrl).digest('hex').slice(0, 8)}.${ext}`;
}

async function buildImageDerivatives(asset: { id: string; workspaceId: string; originalUrl: string }) {
  const inputPath = resolveLocalPathFromUrl(asset.originalUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    return {
      previewUrl: asset.originalUrl,
      thumbnailUrl: asset.originalUrl,
    };
  }

  const derivativesDir = path.join(process.cwd(), 'public', 'generations', 'gallery', asset.workspaceId, 'derived');
  ensurePublicDir(derivativesDir);

  const previewName = buildDerivativeFileName(asset.id, asset.originalUrl, 'preview', 'webp');
  const thumbnailName = buildDerivativeFileName(asset.id, asset.originalUrl, 'thumb', 'webp');
  const previewPath = path.join(derivativesDir, previewName);
  const thumbnailPath = path.join(derivativesDir, thumbnailName);

  await sharp(inputPath)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(previewPath);

  await sharp(inputPath)
    .rotate()
    .resize(480, 480, { fit: 'cover', position: 'centre' })
    .webp({ quality: 76 })
    .toFile(thumbnailPath);

  return {
    previewUrl: `/generations/gallery/${asset.workspaceId}/derived/${previewName}`,
    thumbnailUrl: `/generations/gallery/${asset.workspaceId}/derived/${thumbnailName}`,
  };
}

async function buildVideoThumbnail(asset: { id: string; workspaceId: string; originalUrl: string }) {
  const inputPath = resolveLocalPathFromUrl(asset.originalUrl);
  if (!inputPath || !fs.existsSync(inputPath)) {
    return null;
  }

  const ffmpegAvailable = await ffmpegService.isFFmpegAvailable();
  if (!ffmpegAvailable) {
    return null;
  }

  const derivativesDir = path.join(process.cwd(), 'public', 'generations', 'gallery', asset.workspaceId, 'derived');
  ensurePublicDir(derivativesDir);

  const fileName = buildDerivativeFileName(asset.id, asset.originalUrl, 'thumb', 'jpg');
  const outputPath = path.join(derivativesDir, fileName);

  await ffmpegService.extractThumbnail(inputPath, outputPath, {
    width: 480,
    height: 480,
    quality: 4,
    format: 'jpg',
  });

  return `/generations/gallery/${asset.workspaceId}/derived/${fileName}`;
}

function needsGeneratedImageDerivatives(asset: { originalUrl: string; previewUrl: string | null; thumbnailUrl: string | null }) {
  return !asset.previewUrl || !asset.thumbnailUrl || asset.previewUrl === asset.originalUrl || asset.thumbnailUrl === asset.originalUrl;
}

export async function generateGalleryDerivatives(assetId: string) {
  const asset = await prisma.galleryAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      workspaceId: true,
      type: true,
      originalUrl: true,
      previewUrl: true,
      thumbnailUrl: true,
      derivativeStatus: true,
    },
  });

  if (!asset) {
    throw new Error('Gallery asset not found');
  }

  await prisma.galleryAsset.update({
    where: { id: assetId },
    data: { derivativeStatus: 'processing' },
  });

  try {
    let previewUrl = asset.previewUrl || asset.originalUrl;
    let thumbnailUrl = asset.thumbnailUrl || null;

    if (asset.type === 'image') {
      const generated = await buildImageDerivatives(asset);
      previewUrl = generated.previewUrl;
      thumbnailUrl = generated.thumbnailUrl;
    }

    if (asset.type === 'video') {
      previewUrl = previewUrl || asset.originalUrl;
      thumbnailUrl = thumbnailUrl || await buildVideoThumbnail(asset);
    }

    if (asset.type === 'audio') {
      previewUrl = previewUrl || asset.originalUrl;
    }

    const updated = await prisma.galleryAsset.update({
      where: { id: assetId },
      data: {
        previewUrl,
        thumbnailUrl,
        derivativeStatus: 'completed',
      },
    });

    return updated;
  } catch (error) {
    await prisma.galleryAsset.update({
      where: { id: assetId },
      data: { derivativeStatus: 'failed' },
    });
    throw error;
  }
}

export function queueGalleryDerivatives(assetId: string) {
  setTimeout(() => {
    void generateGalleryDerivatives(assetId).catch((error) => {
      console.error('Failed to generate gallery derivatives:', error);
    });
  }, 0);
}

export async function backfillGalleryDerivatives(workspaceId: string, limit = 50) {
  const assets = await prisma.galleryAsset.findMany({
    where: {
      workspaceId,
      OR: [
        { derivativeStatus: 'pending' },
        { derivativeStatus: 'failed' },
        { previewUrl: null },
        { thumbnailUrl: null },
      ],
    },
    orderBy: { addedToGalleryAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      originalUrl: true,
      previewUrl: true,
      thumbnailUrl: true,
    },
  });

  const staleImageAssets = await prisma.galleryAsset.findMany({
    where: {
      workspaceId,
      type: 'image',
      derivativeStatus: 'completed',
    },
    orderBy: { addedToGalleryAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      originalUrl: true,
      previewUrl: true,
      thumbnailUrl: true,
    },
  });

  const candidates = new Map();
  for (const asset of [...assets, ...staleImageAssets.filter(needsGeneratedImageDerivatives)]) {
    candidates.set(asset.id, asset);
  }

  const results = [] as Array<{ id: string; derivativeStatus: string; thumbnailUrl: string | null; previewUrl: string | null }>;

  for (const asset of Array.from(candidates.values()).slice(0, limit)) {
    try {
      const updated = await generateGalleryDerivatives(asset.id);
      results.push({
        id: updated.id,
        derivativeStatus: updated.derivativeStatus,
        thumbnailUrl: updated.thumbnailUrl,
        previewUrl: updated.previewUrl,
      });
    } catch {
      const failed = await prisma.galleryAsset.findUnique({
        where: { id: asset.id },
        select: { id: true, derivativeStatus: true, thumbnailUrl: true, previewUrl: true },
      });
      if (failed) {
        results.push(failed);
      }
    }
  }

  return {
    processed: results.length,
    results,
  };
}
