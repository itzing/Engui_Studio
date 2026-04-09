import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

function resolveLocalPublicPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/')) return null;
  return path.join(process.cwd(), 'public', url.replace(/^\//, ''));
}

function safeUnlink(filePath: string | null) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn('Failed to delete gallery file:', filePath, error);
  }
}

export async function permanentlyDeleteGalleryAsset(assetId: string) {
  const asset = await prisma.galleryAsset.findUnique({
    where: { id: assetId },
    select: {
      id: true,
      originalUrl: true,
      previewUrl: true,
      thumbnailUrl: true,
    },
  });

  if (!asset) {
    throw new Error('Gallery asset not found');
  }

  const originalPath = resolveLocalPublicPath(asset.originalUrl);
  const previewPath = resolveLocalPublicPath(asset.previewUrl);
  const thumbnailPath = resolveLocalPublicPath(asset.thumbnailUrl);

  await prisma.galleryAsset.delete({ where: { id: assetId } });

  safeUnlink(thumbnailPath);
  if (previewPath && previewPath !== originalPath) safeUnlink(previewPath);
  safeUnlink(originalPath);

  return { id: asset.id };
}

export async function emptyGalleryTrash(workspaceId: string) {
  const assets = await prisma.galleryAsset.findMany({
    where: { workspaceId, trashed: true },
    select: { id: true },
  });

  const deletedIds: string[] = [];
  for (const asset of assets) {
    await permanentlyDeleteGalleryAsset(asset.id);
    deletedIds.push(asset.id);
  }

  return {
    deletedCount: deletedIds.length,
    deletedIds,
  };
}
