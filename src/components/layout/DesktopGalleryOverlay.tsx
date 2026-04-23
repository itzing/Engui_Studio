'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeftToLine, ArrowRightToLine, AudioLines, Heart, Image as ImageIcon, Info, Loader2, PenSquare, Play, RefreshCw, Search, SlidersHorizontal, Sparkles, Trash2, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';
import { GalleryAssetDialog } from '@/components/workspace/GalleryAssetDialog';
import { useMobileGalleryScreen, type MobileGalleryAsset } from '@/hooks/gallery/useMobileGalleryScreen';
import type { GalleryViewerBucket } from '@/components/workspace/GalleryFullscreenViewer';

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
    <div className="absolute inset-x-2 top-2 z-20 flex items-center justify-between gap-1">
      <button
        type="button"
        data-gallery-overlay-action="true"
        onClick={(event) => {
          event.stopPropagation();
          onOpenInfo(asset);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
        aria-label="Open asset details"
      >
        <Info className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-gallery-overlay-action="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(asset);
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-sm ${asset.favorited ? 'border-pink-400/40 bg-pink-500/25 text-pink-200' : 'border-white/15 bg-black/45 text-white/85'}`}
          aria-label={asset.favorited ? 'Unfavorite asset' : 'Favorite asset'}
        >
          <Heart className={`h-4 w-4 ${asset.favorited ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          data-gallery-overlay-action="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggleTrash(asset);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/85 backdrop-blur-sm"
          aria-label="Move asset to trash"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function TileStatusBadges({ favorited, bucket }: { favorited: boolean; bucket?: 'common' | 'draft' | 'upscale' }) {
  const hasBucketBadge = bucket === 'draft' || bucket === 'upscale';
  if (!favorited && !hasBucketBadge) return null;

  return (
    <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-col gap-1">
      {favorited ? (
        <div className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-black/55 text-rose-400">
          <Heart className="h-3 w-3 fill-current" />
        </div>
      ) : null}
      {bucket === 'draft' ? (
        <div className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-black/55 text-amber-400">
          <PenSquare className="h-3 w-3" />
        </div>
      ) : null}
      {bucket === 'upscale' ? (
        <div className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-white/10 bg-black/55 text-violet-400">
          <Sparkles className="h-3 w-3" />
        </div>
      ) : null}
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

export function DesktopGalleryOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const gridWrapRef = useRef<HTMLDivElement | null>(null);
  const restoreHandledTickRef = useRef<number>(0);
  const [columns, setColumns] = useState(6);
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>('right');
  const [gridWidth, setGridWidth] = useState(1200);
  const [detailsAsset, setDetailsAsset] = useState<MobileGalleryAsset | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    semanticFilter,
    setSemanticFilter,
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
    updateBucket,
    toggleTrash,
    restoreTick,
    restoreAbsoluteIndex,
  } = useMobileGalleryScreen();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedColumns = Number.parseInt(window.localStorage.getItem('engui.desktop.gallery.columns') || '', 10);
    if (Number.isFinite(storedColumns) && storedColumns >= 4 && storedColumns <= 10) {
      setColumns(storedColumns);
    }
    const storedSidebarSide = window.localStorage.getItem('engui.desktop.gallery.sidebarSide');
    if (storedSidebarSide === 'left' || storedSidebarSide === 'right') {
      setSidebarSide(storedSidebarSide);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.desktop.gallery.columns', String(columns));
  }, [columns]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('engui.desktop.gallery.sidebarSide', sidebarSide);
  }, [sidebarSide]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !viewerOpen) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open, viewerOpen]);

  useEffect(() => {
    if (!open) return;
    const element = gridWrapRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setGridWidth(width);
    });
    observer.observe(element);
    setGridWidth(element.getBoundingClientRect().width || 1200);
    return () => observer.disconnect();
  }, [open]);

  const gap = 0;
  const rowHeight = Math.max(120, gridWidth / columns);
  const rowCount = Math.ceil(totalCount / columns);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const isAllFilterActive = selectedFilters.length === 3;

  useEffect(() => {
    if (!open || virtualRows.length === 0 || totalCount === 0) return;
    const firstRow = Math.max(0, virtualRows[0]?.index ?? 0);
    const lastRow = Math.max(firstRow, virtualRows[virtualRows.length - 1]?.index ?? 0);
    const startIndex = Math.max(0, firstRow * columns - columns * 6);
    const endIndex = Math.min(totalCount - 1, ((lastRow + 1) * columns) + columns * 6);
    void ensureRangeLoaded(startIndex, endIndex);
  }, [columns, ensureRangeLoaded, open, totalCount, virtualRows]);

  useEffect(() => {
    if (!open) return;
    if (restoreTick <= 0 || restoreHandledTickRef.current === restoreTick) return;
    if (typeof restoreAbsoluteIndex !== 'number' || restoreAbsoluteIndex < 0) return;
    restoreHandledTickRef.current = restoreTick;
    rowVirtualizer.scrollToIndex(Math.floor(restoreAbsoluteIndex / columns), { align: 'center' });
    void ensureRangeLoaded(Math.max(0, restoreAbsoluteIndex - columns * 8), restoreAbsoluteIndex + columns * 8);
  }, [columns, ensureRangeLoaded, open, restoreAbsoluteIndex, restoreTick, rowVirtualizer]);

  const selectedLoadedViewerIndex = useMemo(() => {
    if (!selectedAssetId) return -1;
    return loadedViewerItems.findIndex((entry) => entry.id === selectedAssetId);
  }, [loadedViewerItems, selectedAssetId]);

  const sidebar = (
    <aside className="w-[320px] shrink-0 border-l border-r-0 border-white/10 bg-zinc-950/95 backdrop-blur-sm p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Gallery</div>
          <div className="text-xs text-white/55">{totalCount} items</div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
            onClick={() => setSidebarSide((value) => value === 'right' ? 'left' : 'right')}
            aria-label="Move sidebar"
            title="Move sidebar"
          >
            {sidebarSide === 'right' ? <ArrowLeftToLine className="h-4 w-4" /> : <ArrowRightToLine className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md border border-white/10 text-white/70 hover:text-white hover:bg-white/5"
            onClick={onClose}
            aria-label="Close gallery"
            title="Close gallery"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <SlidersHorizontal className="h-4 w-4" />
          Columns: {columns}
        </div>
        <Slider min={4} max={10} step={1} value={[columns]} onValueChange={(value) => setColumns(value[0] || 6)} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {([
            { key: 'all', label: 'All' },
            { key: 'common', icon: ImageIcon, title: 'Common', activeClass: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
            { key: 'draft', icon: PenSquare, title: 'Drafts', activeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
            { key: 'upscale', icon: Sparkles, title: 'Upscale', activeClass: 'text-violet-400 border-violet-500/40 bg-violet-500/10' },
          ] as const).map((item) => {
            const active = semanticFilter === item.key;
            const Icon = 'icon' in item ? item.icon : null;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSemanticFilter(item.key)}
                title={'title' in item ? item.title : item.label}
                className={`h-8 min-w-8 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${active ? ('activeClass' in item ? item.activeClass : 'text-white border-white/20 bg-white/10') : 'text-white/50 border-white/10 bg-transparent hover:text-white hover:bg-white/5'}`}
              >
                {Icon ? <Icon className="w-3.5 h-3.5" /> : item.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1">
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
                className={`h-8 min-w-8 px-2 rounded border text-[10px] transition-colors inline-flex items-center justify-center gap-1 ${active ? ('activeClass' in item ? item.activeClass : 'text-white border-white/20 bg-white/10') : 'text-white/50 border-white/10 bg-transparent hover:text-white hover:bg-white/5'}`}
              >
                {Icon ? <Icon className="w-3.5 h-3.5" /> : item.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleGalleryFavorites}
            className={`h-8 w-8 rounded border transition-colors inline-flex items-center justify-center shrink-0 ${favoritesOnly ? 'text-pink-400 border-pink-500/40 bg-pink-500/10' : 'text-white/50 border-white/10 bg-transparent hover:text-white hover:bg-white/5'}`}
            aria-label="Toggle favorites"
          >
            <Heart className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleGalleryTrash}
            className={`h-8 w-8 rounded border transition-colors inline-flex items-center justify-center shrink-0 ${showTrashed ? 'text-red-400 border-red-500/40 bg-red-500/10' : 'text-white/50 border-white/10 bg-transparent hover:text-white hover:bg-white/5'}`}
            aria-label="Toggle trash"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-8 w-8 rounded border border-white/10 text-white/70 hover:text-white hover:bg-white/5 shrink-0"
            aria-label="Refresh gallery"
            onClick={() => void refresh()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tags or asset id..." className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder:text-white/35" />
      </div>
    </aside>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div className="flex h-full w-full">
        {sidebarSide === 'left' ? sidebar : null}
        <div ref={gridWrapRef} className="min-w-0 flex-1 flex flex-col">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-6 text-sm text-white/65">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading gallery...
              </div>
            </div>
          ) : error ? (
            <div className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          ) : totalCount === 0 ? (
            <div className="m-6 rounded-lg border border-dashed border-white/10 px-4 py-8 text-sm text-white/50">No gallery assets yet for the current workspace.</div>
          ) : (
            <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
              <div className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                {virtualRows.map((virtualRow) => {
                  const rowStart = virtualRow.index * columns;
                  return (
                    <div
                      key={virtualRow.key}
                      className="absolute left-0 top-0 grid w-full overflow-hidden bg-black"
                      style={{ transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${gap}px`, width: '100%', height: `${rowHeight}px` }}
                    >
                      {Array.from({ length: columns }).map((_, columnIndex) => {
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
                                <img src={mediaUrl} alt={asset.prompt || asset.id} className="block h-full w-full object-cover" />
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white/85 backdrop-blur-sm">
                                    <Play className="ml-0.5 h-4 w-4 fill-current" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img src={mediaUrl} alt={asset.prompt || asset.id} className="block h-full w-full object-cover" />
                            )}

                            <TileStatusBadges favorited={asset.favorited} bucket={asset.bucket} />

                            {isSelected ? (
                              <>
                                <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-primary/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]" />
                                <TileOverlayActions
                                  asset={asset}
                                  onOpenInfo={(entry) => { setDetailsAsset(entry); setDetailsOpen(true); }}
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
          )}

          {isLoadingMore ? (
            <div className="pointer-events-none px-4 py-2 text-center text-xs text-white/45">Loading more gallery items...</div>
          ) : null}
        </div>
        {sidebarSide === 'right' ? sidebar : null}
      </div>

      <GalleryAssetDialog
        asset={detailsAsset}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onToggleFavorite={() => detailsAsset && void toggleFavorite(detailsAsset.id)}
        onTrash={() => detailsAsset && void toggleTrash(detailsAsset.id)}
        onPermanentDelete={() => {}}
        onSaveTags={() => {}}
        onRemoveAutoTag={() => {}}
        onTagClick={(tag) => setQuery(tag)}
      />

      <GalleryFullscreenViewer
        open={viewerOpen}
        items={loadedViewerItems.map((asset) => ({
          id: asset.id,
          url: asset.url,
          favorited: asset.favorited,
          type: Object.values(itemsByAbsoluteIndex).find((entry) => entry.id === asset.id)?.type,
          bucket: Object.values(itemsByAbsoluteIndex).find((entry) => entry.id === asset.id)?.bucket,
        }))}
        currentIndex={selectedLoadedViewerIndex >= 0 ? selectedLoadedViewerIndex : viewerIndex}
        onIndexChange={updateViewerIndex}
        onClose={closeViewer}
        onOpenInfo={(itemId) => {
          const asset = Object.values(itemsByAbsoluteIndex).find((entry) => entry.id === itemId);
          if (asset) {
            setDetailsAsset(asset);
            setDetailsOpen(true);
          }
        }}
        onToggleFavorite={toggleFavorite}
        renderFooterActions={(item, meta) => {
          const asset = Object.values(itemsByAbsoluteIndex).find((entry) => entry.id === item.id);
          if (!asset || asset.type !== 'image') return null;
          return (
            <>
              {asset.bucket !== 'draft' && asset.bucket !== 'upscale' ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                  onClick={() => void updateBucket(asset.id, 'draft' as GalleryViewerBucket)}
                  aria-label="Mark as draft"
                  title="Move to drafts"
                >
                  <PenSquare className="w-5 h-5" />
                </Button>
              ) : null}
              {asset.bucket !== 'upscale' && meta.canMarkUpscale ? (
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-full bg-black/70 hover:bg-black/85 text-white border border-white/10"
                  onClick={() => void updateBucket(asset.id, 'upscale' as GalleryViewerBucket)}
                  aria-label="Mark as upscale"
                  title="Move to upscale"
                >
                  <Sparkles className="w-5 h-5" />
                </Button>
              ) : null}
            </>
          );
        }}
      />
    </div>
  );
}
