import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';

const UPSCALE_SHORT_EDGE_THRESHOLD = 1024;
const UPSCALE_LONG_EDGE_THRESHOLD = 1536;

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url || !url.startsWith('/')) return null;
  const normalized = url.split('?')[0].replace(/^\//, '');
  return path.join(process.cwd(), 'public', normalized);
}

async function loadImageMetadata(url: string): Promise<{ width: number | null; height: number | null }> {
  const localPath = resolveLocalPathFromUrl(url);

  if (localPath && fs.existsSync(localPath)) {
    const metadata = await sharp(localPath).metadata();
    return {
      width: typeof metadata.width === 'number' ? metadata.width : null,
      height: typeof metadata.height === 'number' ? metadata.height : null,
    };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image metadata: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer).metadata();
  return {
    width: typeof metadata.width === 'number' ? metadata.width : null,
    height: typeof metadata.height === 'number' ? metadata.height : null,
  };
}

function isUpscaleSized(width: number | null, height: number | null) {
  if (!width || !height) return false;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return shortEdge > UPSCALE_SHORT_EDGE_THRESHOLD || longEdge > UPSCALE_LONG_EDGE_THRESHOLD;
}

export async function backfillGalleryUpscaleBucket(workspaceId: string, limit = 100) {
  const assets = await prisma.galleryAsset.findMany({
    where: {
      workspaceId,
      trashed: false,
      type: 'image',
      bucket: { not: 'upscale' },
    },
    orderBy: { addedToGalleryAt: 'desc' },
    take: limit,
    select: {
      id: true,
      originalUrl: true,
      bucket: true,
    },
  });

  const results: Array<{
    id: string;
    width: number | null;
    height: number | null;
    markedUpscale: boolean;
    reason?: string;
  }> = [];

  for (const asset of assets) {
    try {
      const { width, height } = await loadImageMetadata(asset.originalUrl);
      const markedUpscale = isUpscaleSized(width, height);

      if (markedUpscale) {
        await prisma.galleryAsset.update({
          where: { id: asset.id },
          data: { bucket: 'upscale' },
        });
      }

      results.push({
        id: asset.id,
        width,
        height,
        markedUpscale,
      });
    } catch (error: any) {
      results.push({
        id: asset.id,
        width: null,
        height: null,
        markedUpscale: false,
        reason: error?.message || 'metadata read failed',
      });
    }
  }

  const updated = results.filter(result => result.markedUpscale).length;
  return {
    processed: results.length,
    updated,
    hasMore: assets.length === limit,
    results,
  };
}
