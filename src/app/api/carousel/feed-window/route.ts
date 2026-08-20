import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPromptVersions, getSourceImagePrompt } from '@/lib/promptVersions';
import {
  buildGalleryCarouselFeed,
  matchesGalleryCarouselRatioFilter,
  readGalleryCarouselAssetRatio,
  resolveGalleryCarouselDimensions,
  type GalleryCarouselFeedItem,
  type GalleryCarouselRatioFilter,
} from '@/lib/galleryVideoCarousel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_BEFORE_LIMIT = 8;
const DEFAULT_AFTER_LIMIT = 8;
const MAX_WINDOW_SIDE_LIMIT = 50;
const DEFAULT_VIDEO_RATIO = 9 / 16;
const DEFAULT_IMAGE_RATIO = 1;

type CarouselWindowDirection = 'around' | 'before' | 'after';
type CarouselFeedSource = 'galleryOrder' | 'shuffle';

type CarouselFeedAsset = {
  id: string;
  workspaceId: string;
  type: 'image' | 'video' | 'audio';
  originalUrl: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  favorited: boolean;
  trashed: boolean;
  userTags: string[];
  autoTags: string[];
  sourceJobId: string | null;
  sourceOutputId: string | null;
  bucket: string;
  derivativeStatus: string | null;
  enrichmentStatus: string | null;
  prompt: string | null;
  promptTemplate: string | null;
  resolvedPrompt: string | null;
  sourceImagePrompt: string | null;
  modelId: string | null;
  mediaWidth: number | null;
  mediaHeight: number | null;
  aspectRatio: string | null;
  addedToGalleryAt: Date;
  updatedAt: Date;
  galleryOrderIndex?: number | null;
};

function parseGenerationSnapshot(raw: string | null): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonArray(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseWindowLimit(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, MAX_WINDOW_SIDE_LIMIT);
}

function parseOptionalIndex(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeSeed(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createSeededRandom(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += 0x6D2B79F5;
    let value = hash;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function parseBoolean(value: string | null, fallback = false) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseRatioFilter(searchParams: URLSearchParams): GalleryCarouselRatioFilter {
  return {
    includeLandscape: parseBoolean(searchParams.get('includeLandscape'), true),
    includePortrait: parseBoolean(searchParams.get('includePortrait'), true),
  };
}

function normalizeAsset(asset: any): CarouselFeedAsset {
  const snapshot = parseGenerationSnapshot(asset.generationSnapshot);
  const promptVersions = getPromptVersions({ prompt: snapshot.prompt, options: snapshot });
  const mediaDimensions = resolveGalleryCarouselDimensions(snapshot);
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    type: asset.type,
    originalUrl: asset.originalUrl,
    previewUrl: asset.previewUrl,
    thumbnailUrl: asset.thumbnailUrl,
    favorited: asset.favorited,
    trashed: asset.trashed,
    userTags: parseJsonArray(asset.userTags),
    autoTags: parseJsonArray(asset.autoTags),
    sourceJobId: asset.sourceJobId,
    sourceOutputId: asset.sourceOutputId,
    bucket: asset.bucket,
    derivativeStatus: asset.derivativeStatus,
    enrichmentStatus: asset.enrichmentStatus,
    prompt: promptVersions.originalPrompt || null,
    promptTemplate: promptVersions.originalPrompt || null,
    resolvedPrompt: promptVersions.resolvedPrompt,
    sourceImagePrompt: asset.type === 'video' ? getSourceImagePrompt(snapshot) || null : null,
    modelId: typeof snapshot.modelId === 'string' && snapshot.modelId.trim().length > 0 ? snapshot.modelId : null,
    ...mediaDimensions,
    addedToGalleryAt: asset.addedToGalleryAt,
    updatedAt: asset.updatedAt,
  };
}

function matchesSearchTokens(asset: CarouselFeedAsset, tokens: string[]) {
  if (tokens.length === 0) return true;
  const haystack = [
    asset.id,
    asset.sourceJobId || '',
    asset.sourceOutputId || '',
    ...asset.userTags,
    ...asset.autoTags,
  ].join(' ').toLowerCase();
  return tokens.every(token => haystack.includes(token));
}

function matchesCarouselMedia(asset: CarouselFeedAsset, options: {
  includeVideos: boolean;
  includeImages: boolean;
  ratioFilter: GalleryCarouselRatioFilter;
}) {
  if (asset.type === 'video' && !options.includeVideos) return false;
  if (asset.type === 'image' && !options.includeImages) return false;
  if (asset.type !== 'video' && asset.type !== 'image') return false;
  return matchesGalleryCarouselRatioFilter(asset, options.ratioFilter, asset.type === 'video' ? DEFAULT_VIDEO_RATIO : DEFAULT_IMAGE_RATIO);
}

function toDisplayAsset(asset: CarouselFeedAsset) {
  return {
    id: asset.id,
    workspaceId: asset.workspaceId,
    type: asset.type,
    originalUrl: asset.originalUrl,
    previewUrl: asset.previewUrl,
    thumbnailUrl: asset.thumbnailUrl,
    derivativeStatus: asset.derivativeStatus,
    prompt: asset.prompt,
    mediaWidth: asset.mediaWidth,
    mediaHeight: asset.mediaHeight,
    aspectRatio: asset.aspectRatio,
    favorited: asset.favorited,
    addedToGalleryAt: asset.addedToGalleryAt,
  };
}

function toFeedItem(asset: CarouselFeedAsset) {
  if (asset.type === 'video') {
    return { kind: 'video' as const, id: asset.id, asset: toDisplayAsset(asset) };
  }
  return {
    kind: 'images' as const,
    id: asset.id,
    images: [toDisplayAsset(asset)],
    aspectRatio: readGalleryCarouselAssetRatio(asset, DEFAULT_IMAGE_RATIO),
  };
}

function toDisplayFeedItem(entry: GalleryCarouselFeedItem<CarouselFeedAsset, CarouselFeedAsset>) {
  if (entry.kind === 'video') {
    return { kind: 'video' as const, id: entry.id, asset: toDisplayAsset(entry.asset) };
  }
  return {
    kind: 'images' as const,
    id: entry.id,
    images: entry.images.map(toDisplayAsset),
    aspectRatio: entry.aspectRatio,
  };
}

function sliceFeedWindow<TFeedItem>(
  feed: TFeedItem[],
  options: {
    direction: CarouselWindowDirection;
    cursorIndex: number | null;
    anchorIndex: number;
    beforeLimit: number;
    afterLimit: number;
  },
) {
  const resolvedAnchorIndex = options.direction === 'before'
    ? Math.max(0, (options.cursorIndex ?? options.anchorIndex) - 1)
    : options.direction === 'after'
      ? Math.min(feed.length - 1, (options.cursorIndex ?? options.anchorIndex) + 1)
      : options.anchorIndex;
  const startIndex = options.direction === 'before'
    ? Math.max(0, resolvedAnchorIndex - options.beforeLimit + 1)
    : Math.max(0, resolvedAnchorIndex - options.beforeLimit);
  const endIndexExclusive = options.direction === 'after'
    ? Math.min(feed.length, resolvedAnchorIndex + options.afterLimit)
    : Math.min(feed.length, resolvedAnchorIndex + options.afterLimit + 1);
  const windowItems = feed.slice(startIndex, endIndexExclusive);
  const windowAnchorOffset = Math.max(0, Math.min(resolvedAnchorIndex - startIndex, windowItems.length - 1));

  return {
    previous: windowItems.slice(0, windowAnchorOffset),
    current: windowItems[windowAnchorOffset] || null,
    next: windowItems.slice(windowAnchorOffset + 1),
    pagination: {
      totalCount: feed.length,
      anchorIndex: resolvedAnchorIndex,
      hasBefore: startIndex > 0,
      hasAfter: endIndexExclusive < feed.length,
      beforeCursor: startIndex > 0 ? startIndex : null,
      afterCursor: endIndexExclusive < feed.length ? endIndexExclusive - 1 : null,
    },
  };
}

function chooseAnchorIndex(sourceAssets: CarouselFeedAsset[], filteredAssets: Array<{ asset: CarouselFeedAsset; sourceIndex: number }>, anchorAssetId: string | null) {
  if (filteredAssets.length === 0) return -1;
  if (!anchorAssetId) return 0;

  const exactIndex = filteredAssets.findIndex(({ asset }) => asset.id === anchorAssetId);
  if (exactIndex >= 0) return exactIndex;

  const sourceAnchorIndex = sourceAssets.findIndex(asset => asset.id === anchorAssetId);
  if (sourceAnchorIndex < 0) return 0;

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestDirection = Number.POSITIVE_INFINITY;
  filteredAssets.forEach(({ sourceIndex }, filteredIndex) => {
    const distance = Math.abs(sourceIndex - sourceAnchorIndex);
    const direction = sourceIndex >= sourceAnchorIndex ? 0 : 1;
    if (distance < nearestDistance || (distance === nearestDistance && direction < nearestDirection)) {
      nearestIndex = filteredIndex;
      nearestDistance = distance;
      nearestDirection = direction;
    }
  });
  return nearestIndex;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const source = (searchParams.get('source') || 'galleryOrder') as CarouselFeedSource;
    const direction = (searchParams.get('direction') || 'around') as CarouselWindowDirection;
    const anchorAssetId = searchParams.get('anchorAssetId')?.trim() || null;
    const cursorIndex = parseOptionalIndex(searchParams.get('cursor'));
    const beforeLimit = parseWindowLimit(searchParams.get('before'), DEFAULT_BEFORE_LIMIT);
    const afterLimit = parseWindowLimit(searchParams.get('after'), DEFAULT_AFTER_LIMIT);
    const includeVideos = parseBoolean(searchParams.get('includeVideos'), true);
    const includeImages = parseBoolean(searchParams.get('includeImages'), false);
    const ratioFilter = parseRatioFilter(searchParams);
    const onlyFavorites = searchParams.get('favoritesOnly') === 'true';
    const includeTrashed = searchParams.get('includeTrashed') === 'true';
    const onlyTrashed = searchParams.get('onlyTrashed') === 'true';
    const bucket = (searchParams.get('bucket') || 'all').trim().toLowerCase();
    const q = (searchParams.get('q') || '').trim().toLowerCase();
    const tokens = Array.from(new Set(q.split(/\s+/).map(token => token.trim()).filter(Boolean)));
    const sort = searchParams.get('sort') || 'newest';
    const seed = normalizeSeed(searchParams.get('seed'));

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: 'workspaceId is required' }, { status: 400 });
    }
    if (source !== 'galleryOrder' && source !== 'shuffle') {
      return NextResponse.json({ success: false, error: 'Unsupported carousel feed source' }, { status: 400 });
    }
    if (!['around', 'before', 'after'].includes(direction)) {
      return NextResponse.json({ success: false, error: 'Unsupported carousel window direction' }, { status: 400 });
    }
    if (!includeVideos && !includeImages) {
      return NextResponse.json({
        success: true,
        source,
        direction,
        previous: [],
        current: null,
        next: [],
        pagination: {
          totalCount: 0,
          anchorIndex: null,
          hasBefore: false,
          hasAfter: false,
          beforeCursor: null,
          afterCursor: null,
        },
        counts: { videos: 0, images: 0, total: 0 },
      });
    }

    const rawAssets = await prisma.galleryAsset.findMany({
      where: {
        workspaceId,
        ...(onlyTrashed ? { trashed: true } : includeTrashed ? {} : { trashed: false }),
        type: { in: ['image', 'video'] },
        ...(bucket && bucket !== 'all' ? { bucket } : {}),
      },
      orderBy: sort === 'oldest'
        ? { addedToGalleryAt: 'asc' }
        : { addedToGalleryAt: 'desc' },
    });

    const sourceAssets = rawAssets
      .map(normalizeAsset)
      .filter(asset => matchesSearchTokens(asset, tokens));

    if (sort === 'favorites') {
      sourceAssets.sort((a, b) => {
        if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
        return new Date(b.addedToGalleryAt).getTime() - new Date(a.addedToGalleryAt).getTime();
      });
    }

    const filteredAssets = sourceAssets
      .map((asset, sourceIndex) => ({ asset, sourceIndex }))
      .filter(({ asset }) => (!onlyFavorites || asset.favorited) && matchesCarouselMedia(asset, { includeVideos, includeImages, ratioFilter }));
    const counts = filteredAssets.reduce((acc, { asset }) => {
      if (asset.type === 'video') acc.videos += 1;
      if (asset.type === 'image') acc.images += 1;
      acc.total += 1;
      return acc;
    }, { videos: 0, images: 0, total: 0 });

    if (source === 'shuffle') {
      const shuffleAssets = filteredAssets.map(({ asset, sourceIndex }) => ({ ...asset, galleryOrderIndex: sourceIndex }));
      const videos = includeVideos ? shuffleAssets.filter(asset => asset.type === 'video') : [];
      const images = includeImages ? shuffleAssets.filter(asset => asset.type === 'image') : [];
      const feed = buildGalleryCarouselFeed(videos, {
        images,
        includeVideos,
        includeImages,
        random: createSeededRandom(seed),
        shuffleMode: 'spread',
      }).map(toDisplayFeedItem);

      if (feed.length === 0) {
        return NextResponse.json({
          success: true,
          source,
          seed,
          direction,
          previous: [],
          current: null,
          next: [],
          pagination: {
            totalCount: 0,
            anchorIndex: null,
            hasBefore: false,
            hasAfter: false,
            beforeCursor: null,
            afterCursor: null,
          },
          counts,
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });
      }

      const windowData = sliceFeedWindow(feed, {
        direction,
        cursorIndex,
        anchorIndex: 0,
        beforeLimit,
        afterLimit,
      });

      return NextResponse.json({
        success: true,
        source,
        seed,
        direction,
        ...windowData,
        counts,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    if (filteredAssets.length === 0) {
      return NextResponse.json({
        success: true,
        source,
        direction,
        previous: [],
        current: null,
        next: [],
        pagination: {
          totalCount: 0,
          anchorIndex: null,
          hasBefore: false,
          hasAfter: false,
          beforeCursor: null,
          afterCursor: null,
        },
        counts,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    }

    const aroundAnchorIndex = chooseAnchorIndex(sourceAssets, filteredAssets, anchorAssetId);
    const feed = filteredAssets.map(({ asset }) => toFeedItem(asset));
    const windowData = sliceFeedWindow(feed, {
      direction,
      cursorIndex,
      anchorIndex: aroundAnchorIndex,
      beforeLimit,
      afterLimit,
    });

    return NextResponse.json({
      success: true,
      source,
      direction,
      ...windowData,
      counts,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch carousel feed window:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
