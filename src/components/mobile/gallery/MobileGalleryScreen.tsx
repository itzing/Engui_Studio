'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AudioLines, Heart, Image as ImageIcon, Info, Loader2, Play, RefreshCw, Search, Trash2, Video } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

function PlaceholderTile() {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent" />
    </div>
  );
}

export default function MobileGalleryScreen() {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement | null>(null);
  const restoreHandledTickRef = useRef<number>(0);
  const {
    totalCount,
    itemsByAbsoluteIndex,
    loadedViewerItems,
    isLoading,
    isLoadingMore,
    error,
    query,
    setQuery,
    selectedFilters,
    showTrashed,
    favoritesOnly,
    toggleMediaFilter,
    toggleGalleryFavorites,
    toggleGalleryTrash,
    refresh,
    ensureRangeLoaded,
    selectedAssetId,
    selectedAbsoluteIndex,
    handleTilePress,
    viewerOpen,
    viewerIndex,
    closeViewer,
    updateViewerIndex,
    toggleFavorite,
    toggleTrash,
    restoreTick,
    restoreAbsoluteIndex,
  } = useMobileGalleryScreen();

  const rowCount = Math.ceil(totalCount / 3);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (virtualRows.length === 0 || totalCount === 0) return;
    const firstRow = Math.max(0, virtualRows[0]?.index ?? 0);
    const lastRow = Math.max(firstRow, virtualRows[virtualRows.length - 1]?.index ?? 0);
    const startIndex = Math.max(0, firstRow * 3 - 18);
    const endIndex = Math.min(totalCount - 1, ((lastRow + 1) * 3) + 18);
    void ensureRangeLoaded(startIndex, endIndex);
  }, [ensureRangeLoaded, totalCount, virtualRows]);

  useEffect(() => {
    if (restoreTick <= 0 || restoreHandledTickRef.current === restoreTick) return;
    if (typeof restoreAbsoluteIndex !== 'number' || restoreAbsoluteIndex < 0) return;
    restoreHandledTickRef.current = restoreTick;
    rowVirtualizer.scrollToIndex(Math.floor(restoreAbsoluteIndex / 3), { align: 'center' });
    void ensureRangeLoaded(Math.max(0, restoreAbsoluteIndex - 24), restoreAbsoluteIndex + 24);
  }, [ensureRangeLoaded, restoreAbsoluteIndex, restoreTick, rowVirtualizer]);

  const openAssetInfo = (asset: MobileGalleryAsset) => {
    router.push(`/m/gallery/${asset.id}`);
  };

  const selectedLoadedViewerIndex = useMemo(() => {
    if (!selectedAssetId) return -1;
    return loadedViewerItems.findIndex((entry) => entry.id === selectedAssetId);
  }, [loadedViewerItems, selectedAssetId]);

  const isAllFilterActive = selectedFilters.length === 3;

  return (
    <MobileScreen>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {([
              { key: 'all', label: 'All' },
              { key: 'image', icon: ImageIcon, activeClass: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
              { key: 'video', icon: Video, activeClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10' },
              { key: 'audio', icon: AudioLines, activeClass: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
            ] as const).map((item) => {
              const active = item.key === 'all' ? isAllFilterActive : selectedFilters.includes(item.key);
              const Icon = 'icon' in item ? item.icon : null;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleMediaFilter(item.key)}
                  className={`h-8 min-w-8 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 shrink-0 ${active
                    ? ('activeClass' in item ? item.activeClass : 'text-foreground border-border bg-background shadow-sm font-medium')
                    : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
                >
                  {Icon ? <Icon className="w-3.5 h-3.5" /> : item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={toggleGalleryFavorites}
              className={`h-8 w-8 rounded border transition-colors inline-flex items-center justify-center shrink-0 ${favoritesOnly ? 'text-pink-400 border-pink-500/40 bg-pink-500/10' : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
              aria-label="Toggle favorites"
            >
              <Heart className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleGalleryTrash}
              className={`h-8 w-8 rounded border transition-colors inline-flex items-center justify-center shrink-0 ${showTrashed ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-muted-foreground border-border/40 bg-transparent grayscale opacity-40 hover:opacity-70 hover:border-border/70 hover:bg-muted/20'}`}
              aria-label="Toggle trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 rounded border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/20 shrink-0"
              aria-label="Refresh gallery"
              onClick={() => void refresh()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
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

        {!isLoading && !error && totalCount === 0 ? (
          <div className="mx-4 rounded-lg border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            No gallery assets yet for the current workspace.
          </div>
        ) : null}

        {!isLoading && totalCount > 0 ? (
          <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
            <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
              {virtualRows.map((virtualRow) => {
                const rowStart = virtualRow.index * 3;
                return (
                  <div
                    key={virtualRow.key}
                    className="absolute left-0 top-0 grid w-full grid-cols-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {Array.from({ length: 3 }).map((_, columnIndex) => {
                      const absoluteIndex = rowStart + columnIndex;
                      if (absoluteIndex >= totalCount) {
                        return <div key={`empty-${absoluteIndex}`} className="aspect-square bg-black" />;
                      }

                      const asset = itemsByAbsoluteIndex[absoluteIndex];
                      if (!asset) {
                        return <PlaceholderTile key={`placeholder-${absoluteIndex}`} />;
                      }

                      const isSelected = selectedAbsoluteIndex === absoluteIndex || selectedAssetId === asset.id;
                      const mediaUrl = asset.thumbnailUrl || asset.previewUrl || asset.originalUrl;

                      return (
                        <button
                          key={asset.id}
                          type="button"
                          data-gallery-asset-id={asset.id}
                          onClick={() => handleTilePress(asset, absoluteIndex)}
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
        items={loadedViewerItems.map((asset) => ({
          id: asset.id,
          url: asset.url,
          favorited: asset.favorited,
        }))}
        currentIndex={selectedLoadedViewerIndex >= 0 ? selectedLoadedViewerIndex : viewerIndex}
        onIndexChange={updateViewerIndex}
        onClose={closeViewer}
        onOpenInfo={(itemId) => {
          const asset = loadedViewerItems.find((entry) => entry.id === itemId);
          if (asset) {
            const resolvedAsset = Object.values(itemsByAbsoluteIndex).find((entry) => entry.id === asset.id);
            if (resolvedAsset) {
              openAssetInfo(resolvedAsset);
            }
          }
        }}
        onToggleFavorite={toggleFavorite}
      />
    </MobileScreen>
  );
}
