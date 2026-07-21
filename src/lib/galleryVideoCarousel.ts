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

function pickClosestImage<TImage extends GalleryCarouselMediaLike>(anchor: TImage, candidates: TImage[]) {
  if (candidates.length === 0) return null;
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  candidates.forEach((candidate, index) => {
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
): Array<GalleryCarouselImageFeedItem<TImage>> {
  const safeSlotCount = Math.max(0, Math.floor(slotCount));
  const safeImagesPerSlot = Math.max(1, Math.floor(imagesPerSlot));
  if (safeSlotCount === 0 || images.length === 0) return [];

  const shuffledImages = shuffleGalleryVideoFeed(images, random);
  const availableImages = shuffledImages.slice();
  const slots: Array<GalleryCarouselImageFeedItem<TImage>> = [];

  for (let slotIndex = 0; slotIndex < safeSlotCount; slotIndex += 1) {
    const anchor = availableImages.shift() || shuffledImages[slotIndex % shuffledImages.length];
    const pickedImages = [anchor];

    while (pickedImages.length < safeImagesPerSlot && pickedImages.length < images.length) {
      const candidates = availableImages.length > 0
        ? availableImages
        : images.filter((image) => !pickedImages.some((picked) => picked.id === image.id));
      const picked = pickClosestImage(anchor, candidates);
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
    includeImages?: boolean;
    images?: TImage[];
    random?: () => number;
    videosPerImageSlot?: number;
    imagesPerSlot?: number;
  } = {},
): Array<GalleryCarouselFeedItem<TVideo, TImage>> {
  const {
    includeImages = false,
    images = [],
    random = Math.random,
    videosPerImageSlot = GALLERY_CAROUSEL_VIDEOS_PER_IMAGE_SLOT,
    imagesPerSlot = GALLERY_CAROUSEL_IMAGES_PER_SLOT,
  } = options;
  const safeVideosPerImageSlot = Math.max(1, Math.floor(videosPerImageSlot));
  const shuffledVideos = shuffleGalleryVideoFeed(videos, random);
  const imageSlotCount = includeImages && images.length > 0
    ? Math.floor(shuffledVideos.length / safeVideosPerImageSlot)
    : 0;
  const imageSlots = buildGalleryCarouselImageSlots(images, imageSlotCount, random, imagesPerSlot);
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
