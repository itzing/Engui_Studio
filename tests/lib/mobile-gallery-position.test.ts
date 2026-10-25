/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureGalleryPosition, galleryPositionScrollOffset, readGalleryPosition, visibleGalleryTiles, writeGalleryPosition, type GalleryPositionFilters } from '@/lib/mobile/galleryPosition';

const filters: GalleryPositionFilters = { query: 'portrait', selectedFilters: ['image'], semanticFilter: 'common', showTrashed: false, favoritesOnly: true };
function rect(top: number, height: number) {
  return { top, bottom: top + height, left: 0, right: 300, width: 300, height } as DOMRect;
}
function grid() {
  const container = document.createElement('div');
  container.getBoundingClientRect = () => rect(100, 300);
  for (const [id, top] of [['overscan-before', -100], ['partial', 50], ['first-full', 150], ['next', 250], ['overscan-after', 400]] as const) {
    const tile = document.createElement('button');
    tile.dataset.galleryAssetId = id;
    tile.getBoundingClientRect = () => rect(top, 100);
    container.append(tile);
  }
  return container;
}
beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe('gallery return position', () => {
  it('counts partial visibility, excludes overscan and the exact outer boundary', () => {
    expect(visibleGalleryTiles(grid()).map((tile) => tile.assetId)).toEqual(['partial', 'first-full', 'next']);
  });
  it('anchors a visible selection, otherwise the first fully visible tile', () => {
    expect(captureGalleryPosition(grid(), 'ws-1', 'partial', filters)).toMatchObject({ assetId: 'partial', viewportOffset: -50 });
    expect(captureGalleryPosition(grid(), 'ws-1', 'overscan-before', filters)).toMatchObject({ assetId: 'first-full', viewportOffset: 50 });
    expect(captureGalleryPosition(null, 'ws-1', null, filters)).toBeNull();
  });
  it('round-trips one point per workspace and clears only that workspace', () => {
    const point = captureGalleryPosition(grid(), 'ws-1', 'next', filters)!;
    writeGalleryPosition('ws-1', point);
    expect(readGalleryPosition('ws-1')).toEqual(point);
    expect(readGalleryPosition('ws-2')).toBeNull();
    writeGalleryPosition('ws-2', { ...point, workspaceId: 'ws-2' });
    writeGalleryPosition('ws-1', null);
    expect(readGalleryPosition('ws-1')).toBeNull();
    expect(readGalleryPosition('ws-2')?.assetId).toBe('next');
  });
  it('ignores corrupt data and tolerates unavailable storage', () => {
    const point = captureGalleryPosition(grid(), 'ws-1', 'next', filters)!;
    writeGalleryPosition('ws-1', { ...point, viewportOffset: Number.NaN });
    expect(readGalleryPosition('ws-1')).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(() => writeGalleryPosition('ws-1', point)).not.toThrow();
  });
  it('restores an updated asset index and keeps the anchor visible in a smaller viewport', () => {
    expect(galleryPositionScrollOffset(90, 3, 100, 600, 50)).toBe(2950);
    expect(galleryPositionScrollOffset(93, 3, 100, 600, 50)).toBe(3050);
    expect(galleryPositionScrollOffset(90, 3, 100, 200, 500)).toBe(2801);
    expect(galleryPositionScrollOffset(0, 3, 100, 200, 50)).toBe(0);
  });
});
