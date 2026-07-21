export type GalleryCarouselDimensions = {
  mediaWidth: number | null;
  mediaHeight: number | null;
  aspectRatio: string | null;
};

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
