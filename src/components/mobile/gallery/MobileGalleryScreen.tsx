'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Info, Loader2, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import MobileHeader from '@/components/mobile/MobileHeader';
import MobileScreen from '@/components/mobile/MobileScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';
import { useMobileGalleryScreen, type MobileGalleryAsset } from '@/hooks/gallery/useMobileGalleryScreen';

function TileOverlayActions({
  asset,
  onOpenInfo,
  onToggleFavorite,
  onToggleTrash,
}: {
  asset: MobileGalleryAsset;
  onOpenInfo: (asset: MobileGalleryAsset) => void;
  onToggleFavorite: (asset: MobileGalleryAsset) => void;
  onToggleTrash: (asset: MobileGalleryAsset) => void;
}) {
  return (
    <div className="absolute inset-x-1 top-1 z-20 flex items-center justify-between gap-1">
      <button
        type="button"
        data-gallery-overlay-action="true"
        onClick={(event) => {
          event.stopPropagation();
          onOpenInfo(asset);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
        aria-label="Open asset details"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-gallery-overlay-action="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(asset);
          }}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm ${asset.favorited ? 'border-pink-400/40 bg-pink-500/25 text-pink-200' : 'border-white/15 bg-black/45 text-white/85'}`}
          aria-label={asset.favorited ? 'Unfavorite asset' : 'Favorite asset'}
        >
          <Heart className={`h-3.5 w-3.5 ${asset.favorited ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          data-gallery-overlay-action="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggleTrash(asset);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Move asset to trash"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function MobileGalleryScreen() {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement | null>(null);
  const lastViewerOpenRef = useRef(false);
  const prevTopRowRequestRef = useRef<number | null>(null);
  const prevBottomRowRequestRef = useRef<number | null>(null);
  const {
    assets,
    isLoading,
    isLoadingMore,
    error,
    query,
    setQuery,
    refresh,
    hasNextPage,
    hasPrevPage,
    loadNextPage,
    loadPreviousPage,
    selectedAssetId,
    handleTilePress,
    viewerOpen,
    viewerIndex,
    closeViewer,
    updateViewerIndex,
    toggleFavorite,
    toggleTrash,
    restoreTick,
    restoreIndex,
  } = useMobileGalleryScreen();

  const selectedIndex = useMemo(
    () => (selectedAssetId ? assets.findIndex((asset) => asset.id === selectedAssetId) : -1),
    [assets, selectedAssetId],
  );

  const rowCount = Math.ceil(assets.length / 3);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    rowVirtualizer.measure();
  }, [assets.length, rowVirtualizer]);

  useEffect(() => {
    const nextIndex = typeof restoreIndex === 'number' && restoreIndex >= 0 ? restoreIndex : selectedIndex;
    if (nextIndex < 0) return;
    if (!viewerOpen && restoreTick > 0) {
      rowVirtualizer.scrollToIndex(Math.floor(nextIndex / 3), { align: 'center' });
    }
  }, [restoreIndex, restoreTick, rowVirtualizer, selectedIndex, viewerOpen]);

  useEffect(() => {
    if (viewerOpen) {
      lastViewerOpenRef.current = true;
      return;
    }

    if (lastViewerOpenRef.current && selectedIndex >= 0) {
      rowVirtualizer.scrollToIndex(Math.floor(selectedIndex / 3), { align: 'center' });
    }
    lastViewerOpenRef.current = false;
  }, [rowVirtualizer, selectedIndex, viewerOpen]);

  useEffect(() => {
    if (virtualRows.length === 0) return;
    const firstRow = virtualRows[0]?.index ?? 0;
    const lastRow = virtualRows[virtualRows.length - 1]?.index ?? 0;

    if (hasPrevPage && firstRow <= 2 && prevTopRowRequestRef.current !== firstRow) {
      prevTopRowRequestRef.current = firstRow;
      void loadPreviousPage();
    }

    if (!hasPrevPage) {
      prevTopRowRequestRef.current = null;
    }

    if (hasNextPage && rowCount > 0 && lastRow >= rowCount - 3 && prevBottomRowRequestRef.current !== lastRow) {
      prevBottomRowRequestRef.current = lastRow;
      void loadNextPage();
    }

    if (!hasNextPage) {
      prevBottomRowRequestRef.current = null;
    }
  }, [hasNextPage, hasPrevPage, loadNextPage, loadPreviousPage, rowCount, virtualRows]);

  const openAssetInfo = (asset: MobileGalleryAsset) => {
    router.push(`/m/gallery/${asset.id}`);
  };

  return (
    <MobileScreen>
      <MobileHeader
        title="Gallery"
        subtitle="Dense mobile gallery with selection memory and fullscreen viewer."
        action={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags or asset id..." className="pl-9 text-base sm:text-sm" />
          </div>
        </div>

        {isLoading ? (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading gallery...
            </div>
          </div>
        ) : null}

        {error ? <div className="mx-4 mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {!isLoading && !error && assets.length === 0 ? (
          <div className="mx-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No gallery assets yet for the current workspace.
          </div>
        ) : null}

        {!isLoading && assets.length > 0 ? (
          <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
            <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                const rowStart = virtualRow.index * 3;
                const rowAssets = assets.slice(rowStart, rowStart + 3);
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 grid w-full grid-cols-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {rowAssets.map((asset) => {
                      const isSelected = selectedAssetId === asset.id;
                      const mediaUrl = asset.thumbnailUrl || asset.previewUrl || asset.originalUrl;
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          data-gallery-asset-id={asset.id}
                          onClick={() => handleTilePress(asset)}
                          className="relative block aspect-square w-full overflow-hidden bg-black"
                        >
                          {asset.type === 'video' ? (
                            <>
                              <img src={mediaUrl} alt={asset.prompt || asset.id} className="h-full w-full object-cover" />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white/85 backdrop-blur-sm">
                                  <Play className="ml-0.5 h-4 w-4 fill-current" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <img src={mediaUrl} alt={asset.prompt || asset.id} className="h-full w-full object-cover" />
                          )}

                          {isSelected ? (
                            <>
                              <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
                              <TileOverlayActions
                                asset={asset}
                                onOpenInfo={openAssetInfo}
                                onToggleFavorite={(entry) => void toggleFavorite(entry.id)}
                                onToggleTrash={(entry) => void toggleTrash(entry.id)}
                              />
                            </>
                          ) : null}
                        </button>
                      );
                    })}
                    {rowAssets.length < 3
                      ? Array.from({ length: 3 - rowAssets.length }).map((_, index) => (
                          <div key={`empty-${virtualRow.index}-${index}`} className="aspect-square bg-black" />
                        ))
                      : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {isLoadingMore ? (
          <div className="pointer-events-none px-4 py-2 text-center text-xs text-muted-foreground">
            Loading more gallery items...
          </div>
        ) : null}
      </div>

      <GalleryFullscreenViewer
        open={viewerOpen}
        items={assets.map((asset) => ({
          id: asset.id,
          url: asset.originalUrl,
          favorited: asset.favorited,
        }))}
        currentIndex={viewerIndex}
        onIndexChange={updateViewerIndex}
        onClose={closeViewer}
        onOpenInfo={(itemId) => {
          const asset = assets.find((entry) => entry.id === itemId);
          if (asset) {
            openAssetInfo(asset);
          }
        }}
        onToggleFavorite={toggleFavorite}
      />
    </MobileScreen>
  );
}
