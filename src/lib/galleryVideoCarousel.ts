export type GalleryCarouselDimensions = {
  mediaWidth: number | null;
  mediaHeight: number | null;
  aspectRatio: string | null;
};

export type GalleryCarouselMediaLike = {
  id: string;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  aspectRatio?: string | null;
  galleryOrderIndex?: number | null;
};

export type GalleryCarouselVideoFeedItem<TVideo> = {
  kind: 'video';
  id: string;
  asset: TVideo;
};

export type GalleryCarouselImageFeedItem<TImage> = {
  kind: 'images';
  id: string;
  images: TImage[];
  aspectRatio: number;
};

export type GalleryCarouselFeedItem<TVideo, TImage> =
  | GalleryCarouselVideoFeedItem<TVideo>
  | GalleryCarouselImageFeedItem<TImage>;

export type GalleryCarouselRatioFilter = {
  includeLandscape: boolean;
  includePortrait: boolean;
};

export const GALLERY_CAROUSEL_IMAGES_PER_SLOT = 5;
export const GALLERY_CAROUSEL_VIDEOS_PER_IMAGE_SLOT = 2;

const DEFAULT_EDGE_OVERLAP_PX = 2;
const MIN_SPREAD_BUCKETS = 4;
const MAX_SPREAD_BUCKETS = 24;
const MAX_REPAIR_PASSES = 2;

function readPositiveInteger(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function aspectRatioFromDimensions(width: number, height: number) {
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function ratioFromAspectRatioLabel(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const width = Number.parseFloat(match[1]);
  const height = Number.parseFloat(match[2]);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : null;
}

function readDimensionsFromRecord(record: Record<string, unknown> | null | undefined): { width: number; height: number } | null {
  if (!record) return null;
  const width = readPositiveInteger(record.width);
  const height = readPositiveInteger(record.height);
  return width && height ? { width, height } : null;
}

export function resolveGalleryCarouselDimensions(snapshot: Record<string, unknown>): GalleryCarouselDimensions {
  const nestedCandidates = [
    snapshot.outputVideoMetadata,
    snapshot.generationOptions,
    snapshot.defaultGenerationOptions,
    snapshot.options,
  ];

  const direct = readDimensionsFromRecord(snapshot);
  const nested = nestedCandidates
    .map((candidate) => (candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? readDimensionsFromRecord(candidate as Record<string, unknown>) : null))
    .find(Boolean) || null;
  const resolved = direct || nested;

  return {
    mediaWidth: resolved?.width ?? null,
    mediaHeight: resolved?.height ?? null,
    aspectRatio: resolved ? aspectRatioFromDimensions(resolved.width, resolved.height) : null,
  };
}

export function shuffleGalleryVideoFeed<T extends { id: string }>(assets: T[], random: () => number = Math.random) {
  const next = assets.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function readGalleryOrderIndex(asset: { galleryOrderIndex?: number | null }, fallback: number) {
  return Number.isFinite(asset.galleryOrderIndex) ? Number(asset.galleryOrderIndex) : fallback;
}

function galleryOrderDistance(a: { galleryOrderIndex?: number | null }, b: { galleryOrderIndex?: number | null }) {
  const left = readGalleryOrderIndex(a, 0);
  const right = readGalleryOrderIndex(b, 0);
  return Math.abs(left - right);
}

function getSpreadBucketCount(totalCount: number) {
  if (totalCount <= 1) return totalCount;
  return Math.min(totalCount, Math.max(MIN_SPREAD_BUCKETS, Math.min(MAX_SPREAD_BUCKETS, Math.ceil(Math.sqrt(totalCount)))));
}

function getMinimumGalleryOrderDistance(totalCount: number) {
  if (totalCount < 8) return 1;
  return Math.min(48, Math.max(3, Math.floor(totalCount / 18)));
}

function improvesLocalSpread<T extends { galleryOrderIndex?: number | null }>(items: T[], leftIndex: number, rightIndex: number) {
  const before = Math.min(
    leftIndex > 0 ? galleryOrderDistance(items[leftIndex - 1], items[leftIndex]) : Number.POSITIVE_INFINITY,
    rightIndex < items.length - 1 ? galleryOrderDistance(items[rightIndex], items[rightIndex + 1]) : Number.POSITIVE_INFINITY,
  );
  const after = Math.min(
    leftIndex > 0 ? galleryOrderDistance(items[leftIndex - 1], items[rightIndex]) : Number.POSITIVE_INFINITY,
    rightIndex < items.length - 1 ? galleryOrderDistance(items[leftIndex], items[rightIndex + 1]) : Number.POSITIVE_INFINITY,
  );
  return after > before;
}

function repairGalleryOrderNeighbors<T extends { galleryOrderIndex?: number | null }>(
  items: T[],
  minimumDistance: number,
  random: () => number,
) {
  if (items.length < 3 || minimumDistance <= 1) return items;
  const repaired = items.slice();

  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass += 1) {
    let changed = false;
    for (let index = 1; index < repaired.length; index += 1) {
      if (galleryOrderDistance(repaired[index - 1], repaired[index]) >= minimumDistance) continue;

      const candidates = shuffleGalleryVideoFeed(
        Array.from({ length: repaired.length - index - 1 }, (_, offset) => index + 1 + offset),
        random,
      );
      const swapIndex = candidates.find(candidateIndex => (
        galleryOrderDistance(repaired[index - 1], repaired[candidateIndex]) >= minimumDistance
        && improvesLocalSpread(repaired, index, candidateIndex)
      ));

      if (swapIndex !== undefined) {
        [repaired[index], repaired[swapIndex]] = [repaired[swapIndex], repaired[index]];
        changed = true;
      }
    }
    if (!changed) break;
  }

  return repaired;
}

export function spreadShuffleGalleryVideoFeed<T extends { id: string; galleryOrderIndex?: number | null }>(
  assets: T[],
  random: () => number = Math.random,
) {
  if (assets.length <= 2) return shuffleGalleryVideoFeed(assets, random);

  const sorted = assets
    .map((asset, index) => ({ asset, orderIndex: readGalleryOrderIndex(asset, index) }))
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const bucketCount = getSpreadBucketCount(sorted.length);
  const buckets: T[][] = Array.from({ length: bucketCount }, () => []);

  sorted.forEach(({ asset }, index) => {
    const bucketIndex = Math.min(bucketCount - 1, Math.floor((index * bucketCount) / sorted.length));
    buckets[bucketIndex].push(asset);
  });

  const shuffledBuckets = buckets.map(bucket => shuffleGalleryVideoFeed(bucket, random));
  const result: T[] = [];

  while (result.length < sorted.length) {
    const activeBucketIndexes = shuffledBuckets
      .map((bucket, index) => ({ bucket, index }))
      .filter(({ bucket }) => bucket.length > 0)
      .map(({ index }) => index);
    const cycle = shuffleGalleryVideoFeed(activeBucketIndexes, random);

    cycle.forEach((bucketIndex) => {
      const next = shuffledBuckets[bucketIndex].shift();
      if (next) result.push(next);
    });
  }

  return repairGalleryOrderNeighbors(result, getMinimumGalleryOrderDistance(sorted.length), random);
}

function readKnownGalleryCarouselAssetRatio(asset: GalleryCarouselMediaLike): number | null {
  if (asset.mediaWidth && asset.mediaHeight && asset.mediaWidth > 0 && asset.mediaHeight > 0) {
    return asset.mediaWidth / asset.mediaHeight;
  }
  return ratioFromAspectRatioLabel(asset.aspectRatio);
}

export function readGalleryCarouselAssetRatio(asset: GalleryCarouselMediaLike, fallbackRatio = 9 / 16) {
  const ratio = readKnownGalleryCarouselAssetRatio(asset);
  return ratio && Number.isFinite(ratio) && ratio > 0 ? ratio : fallbackRatio;
}

export function getGalleryCarouselAssetOrientation(asset: GalleryCarouselMediaLike, fallbackRatio = 9 / 16): 'landscape' | 'portrait' {
  return readGalleryCarouselAssetRatio(asset, fallbackRatio) >= 1 ? 'landscape' : 'portrait';
}

export function matchesGalleryCarouselRatioFilter(
  asset: GalleryCarouselMediaLike,
  filter: GalleryCarouselRatioFilter,
  fallbackRatio = 9 / 16,
) {
  if (!filter.includeLandscape && !filter.includePortrait) return false;
  if (filter.includeLandscape && filter.includePortrait) return true;
  const orientation = getGalleryCarouselAssetOrientation(asset, fallbackRatio);
  return orientation === 'landscape' ? filter.includeLandscape : filter.includePortrait;
}

function readMediaArea(asset: GalleryCarouselMediaLike): number | null {
  if (!asset.mediaWidth || !asset.mediaHeight || asset.mediaWidth <= 0 || asset.mediaHeight <= 0) return null;
  return asset.mediaWidth * asset.mediaHeight;
}

function shapeDistance(anchor: GalleryCarouselMediaLike, candidate: GalleryCarouselMediaLike) {
  const anchorRatio = readGalleryCarouselAssetRatio(anchor, 1);
  const candidateRatio = readGalleryCarouselAssetRatio(candidate, 1);
  const ratioDistance = Math.abs(Math.log(candidateRatio / anchorRatio));
  const anchorArea = readMediaArea(anchor);
  const candidateArea = readMediaArea(candidate);
  const areaDistance = anchorArea && candidateArea ? Math.abs(Math.log(candidateArea / anchorArea)) * 0.15 : 0;
  return ratioDistance + areaDistance;
}

function pickClosestImage<TImage extends GalleryCarouselMediaLike>(
  anchor: TImage,
  candidates: TImage[],
  pickedImages: TImage[] = [anchor],
  minimumGalleryOrderDistance = 0,
) {
  if (candidates.length === 0) return null;
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const eligibleCandidates = minimumGalleryOrderDistance > 0
    ? candidates
      .map((candidate, index) => ({ candidate, index }))
      .filter(({ candidate }) => pickedImages.every(picked => galleryOrderDistance(picked, candidate) >= minimumGalleryOrderDistance))
    : candidates.map((candidate, index) => ({ candidate, index }));
  const candidatePool = eligibleCandidates.length > 0
    ? eligibleCandidates
    : candidates.map((candidate, index) => ({ candidate, index }));

  candidatePool.forEach(({ candidate, index }) => {
    const score = shapeDistance(anchor, candidate);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  const [picked] = candidates.splice(bestIndex, 1);
  return picked || null;
}

export function getGalleryCarouselImageSlotRatio<TImage extends GalleryCarouselMediaLike>(images: TImage[], fallbackRatio = 1) {
  const ratios = images
    .map((image) => readKnownGalleryCarouselAssetRatio(image))
    .filter((ratio): ratio is number => Boolean(ratio && Number.isFinite(ratio) && ratio > 0))
    .sort((a, b) => a - b);

  if (ratios.length === 0) return fallbackRatio;
  const middle = Math.floor(ratios.length / 2);
  return ratios.length % 2 === 0 ? (ratios[middle - 1] + ratios[middle]) / 2 : ratios[middle];
}

export function buildGalleryCarouselImageSlots<TImage extends GalleryCarouselMediaLike>(
  images: TImage[],
  slotCount: number,
  random: () => number = Math.random,
  imagesPerSlot = GALLERY_CAROUSEL_IMAGES_PER_SLOT,
  shuffleMode: 'random' | 'spread' = 'random',
): Array<GalleryCarouselImageFeedItem<TImage>> {
  const safeSlotCount = Math.max(0, Math.floor(slotCount));
  const safeImagesPerSlot = Math.max(1, Math.floor(imagesPerSlot));
  if (safeSlotCount === 0 || images.length === 0) return [];

  const shuffledImages = shuffleMode === 'spread'
    ? spreadShuffleGalleryVideoFeed(images, random)
    : shuffleGalleryVideoFeed(images, random);
  const availableImages = shuffledImages.slice();
  const slots: Array<GalleryCarouselImageFeedItem<TImage>> = [];
  const minimumGalleryOrderDistance = shuffleMode === 'spread' ? getMinimumGalleryOrderDistance(images.length) : 0;

  for (let slotIndex = 0; slotIndex < safeSlotCount; slotIndex += 1) {
    const anchor = availableImages.shift() || shuffledImages[slotIndex % shuffledImages.length];
    const pickedImages = [anchor];

    while (pickedImages.length < safeImagesPerSlot && pickedImages.length < images.length) {
      const candidates = availableImages.length > 0
        ? availableImages
        : images.filter((image) => !pickedImages.some((picked) => picked.id === image.id));
      const picked = pickClosestImage(anchor, candidates, pickedImages, minimumGalleryOrderDistance);
      if (!picked) break;
      pickedImages.push(picked);
    }

    slots.push({
      kind: 'images',
      id: `image-slot-${slotIndex + 1}`,
      images: pickedImages,
      aspectRatio: getGalleryCarouselImageSlotRatio(pickedImages),
    });
  }

  return slots;
}

export function buildGalleryCarouselFeed<TVideo extends { id: string }, TImage extends GalleryCarouselMediaLike>(
  videos: TVideo[],
  options: {
    includeVideos?: boolean;
    includeImages?: boolean;
    images?: TImage[];
    random?: () => number;
    videosPerImageSlot?: number;
    imagesPerSlot?: number;
    shuffleMode?: 'random' | 'spread';
  } = {},
): Array<GalleryCarouselFeedItem<TVideo, TImage>> {
  const {
    includeVideos = true,
    includeImages = false,
    images = [],
    random = Math.random,
    videosPerImageSlot = GALLERY_CAROUSEL_VIDEOS_PER_IMAGE_SLOT,
    imagesPerSlot = GALLERY_CAROUSEL_IMAGES_PER_SLOT,
    shuffleMode = 'random',
  } = options;
  const safeVideosPerImageSlot = Math.max(1, Math.floor(videosPerImageSlot));
  const shuffledVideos = includeVideos
    ? shuffleMode === 'spread'
      ? spreadShuffleGalleryVideoFeed(videos, random)
      : shuffleGalleryVideoFeed(videos, random)
    : [];
  if (!includeVideos && includeImages) {
    const imageOnlySlotCount = Math.ceil(images.length / imagesPerSlot);
    return buildGalleryCarouselImageSlots(images, imageOnlySlotCount, random, imagesPerSlot, shuffleMode);
  }
  const imageSlotCount = includeImages && images.length > 0
    ? Math.floor(shuffledVideos.length / safeVideosPerImageSlot)
    : 0;
  const imageSlots = buildGalleryCarouselImageSlots(images, imageSlotCount, random, imagesPerSlot, shuffleMode);
  let nextImageSlotIndex = 0;

  return shuffledVideos.flatMap((asset, index) => {
    const entries: Array<GalleryCarouselFeedItem<TVideo, TImage>> = [{ kind: 'video', id: asset.id, asset }];
    const shouldInsertImageSlot = (index + 1) % safeVideosPerImageSlot === 0 && nextImageSlotIndex < imageSlots.length;
    if (shouldInsertImageSlot) {
      entries.push(imageSlots[nextImageSlotIndex]);
      nextImageSlotIndex += 1;
    }
    return entries;
  });
}

export function shouldSpawnAdjacentGalleryCarouselSlot(trailingSlotX: number, edgeOverlap = DEFAULT_EDGE_OVERLAP_PX) {
  return trailingSlotX >= -Math.max(0, edgeOverlap);
}

export function getAdjacentGalleryCarouselSlotX(trailingSlotX: number | null, nextWidth: number, edgeOverlap = DEFAULT_EDGE_OVERLAP_PX) {
  if (!Number.isFinite(nextWidth) || nextWidth <= 0) return 0;
  if (trailingSlotX === null || !Number.isFinite(trailingSlotX)) return 0;
  return trailingSlotX - nextWidth + Math.max(0, edgeOverlap);
}

export function getFullHeightGalleryCarouselSlotSize(ratio: number, stageHeight: number) {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 9 / 16;
  const height = Math.max(1, stageHeight);
  return {
    width: height * safeRatio,
    height,
    y: 0,
  };
}
