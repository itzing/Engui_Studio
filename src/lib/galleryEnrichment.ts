import { prisma } from '@/lib/prisma';

function safeJsonParse(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw as Record<string, unknown> : {};
}

function normalizeToken(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/[\s,/_-]+/)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 3);
}

function extractAutoTagsFromSnapshot(snapshot: Record<string, unknown>, assetType: string): string[] {
  const tags = new Set<string>([assetType]);

  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const promptTokens = normalizeToken(prompt).slice(0, 12);
  for (const token of promptTokens) {
    if (!['with', 'this', 'that', 'from', 'have', 'your', 'about'].includes(token)) {
      tags.add(token);
    }
  }

  const model = typeof snapshot.model === 'string' ? snapshot.model : typeof snapshot.modelId === 'string' ? snapshot.modelId : '';
  if (model) tags.add(model.toLowerCase());

  const stylePreset = typeof snapshot.stylePreset === 'string' ? snapshot.stylePreset : '';
  if (stylePreset) tags.add(stylePreset.toLowerCase());

  const aspectRatio = typeof snapshot.aspectRatio === 'string' ? snapshot.aspectRatio : '';
  if (aspectRatio) tags.add(aspectRatio.toLowerCase());

  const width = typeof snapshot.width === 'number' ? snapshot.width : null;
  const height = typeof snapshot.height === 'number' ? snapshot.height : null;
  if (width && height) {
    tags.add(width >= height ? 'landscape' : 'portrait');
  }

  if ((snapshot.seed ?? null) !== null) {
    tags.add('seeded');
  }

  return Array.from(tags).slice(0, 16);
}

export async function enrichGalleryAsset(assetId: string) {
  const asset = await prisma.galleryAsset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new Error('Gallery asset not found');
  }

  const snapshot = safeJsonParse(asset.generationSnapshot);
  const autoTags = extractAutoTagsFromSnapshot(snapshot, asset.type);

  const updated = await prisma.galleryAsset.update({
    where: { id: assetId },
    data: {
      autoTags: JSON.stringify(autoTags),
      enrichmentStatus: 'completed',
    },
  });

  return {
    asset: updated,
    autoTags,
  };
}
