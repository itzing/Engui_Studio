import { workspaceStorage } from '@/lib/workspaces/client';

export type GalleryPositionFilters = {
  query: string;
  selectedFilters: ('image' | 'video' | 'audio')[];
  semanticFilter: 'all' | 'common' | 'draft' | 'upscale';
  showTrashed: boolean;
  favoritesOnly: boolean;
};

export type GalleryPosition = {
  version: 1;
  workspaceId: string;
  assetId: string;
  viewportOffset: number;
  filters: GalleryPositionFilters;
};

export type GalleryPositionRestoreResult = {
  workspaceId: string;
  assetId: string;
  status: 'restored' | 'missing';
};

const STORAGE_KEY = 'mobile.gallery.returnPosition.v1';

export function readGalleryPosition(workspaceId: string | null): GalleryPosition | null {
  if (!workspaceId) return null;
  try {
    const value = JSON.parse(workspaceStorage(workspaceId)?.getItem(STORAGE_KEY) || 'null');
    if (!value || value.version !== 1 || value.workspaceId !== workspaceId
      || typeof value.assetId !== 'string' || !value.assetId
      || !Number.isFinite(value.viewportOffset)) return null;
    const filters = value.filters;
    if (!filters || typeof filters.query !== 'string'
      || !Array.isArray(filters.selectedFilters) || !filters.selectedFilters.length
      || !filters.selectedFilters.every((type: unknown) => ['image', 'video', 'audio'].includes(String(type)))
      || !['all', 'common', 'draft', 'upscale'].includes(filters.semanticFilter)
      || typeof filters.showTrashed !== 'boolean' || typeof filters.favoritesOnly !== 'boolean') return null;
    return value as GalleryPosition;
  } catch {
    return null;
  }
}

export function writeGalleryPosition(workspaceId: string, position: GalleryPosition | null) {
  try {
    const storage = workspaceStorage(workspaceId);
    if (position) storage?.setItem(STORAGE_KEY, JSON.stringify(position));
    else storage?.removeItem(STORAGE_KEY);
  } catch {
    // Keep the in-memory point usable when browser storage is unavailable.
  }
}

export function visibleGalleryTiles(container: HTMLElement | null) {
  if (!container) return [];
  const viewport = container.getBoundingClientRect();
  if (viewport.height <= 0 || viewport.width <= 0) return [];
  return Array.from(container.querySelectorAll<HTMLElement>('[data-gallery-asset-id]')).flatMap((tile) => {
    const rect = tile.getBoundingClientRect();
    const assetId = tile.dataset.galleryAssetId;
    if (!assetId || rect.bottom <= viewport.top || rect.top >= viewport.bottom
      || rect.right <= viewport.left || rect.left >= viewport.right) return [];
    return [{
      assetId,
      viewportOffset: rect.top - viewport.top,
      fullyVisible: rect.top >= viewport.top && rect.bottom <= viewport.bottom,
    }];
  });
}

export function captureGalleryPosition(
  container: HTMLElement | null,
  workspaceId: string,
  selectedAssetId: string | null,
  filters: GalleryPositionFilters,
): GalleryPosition | null {
  const tiles = visibleGalleryTiles(container);
  const anchor = tiles.find((tile) => tile.assetId === selectedAssetId)
    || tiles.find((tile) => tile.fullyVisible) || tiles[0];
  if (!anchor) return null;
  return { version: 1, workspaceId, assetId: anchor.assetId, viewportOffset: anchor.viewportOffset, filters };
}

export function galleryPositionScrollOffset(index: number, columns: number, rowSize: number, viewportHeight: number, savedOffset: number) {
  const offset = Math.max(1 - rowSize, Math.min(savedOffset, Math.max(0, viewportHeight - 1)));
  return Math.max(0, Math.floor(index / columns) * rowSize - offset);
}
