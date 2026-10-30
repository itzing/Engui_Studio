'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  captureGalleryPosition,
  readGalleryPosition,
  visibleGalleryTiles,
  writeGalleryPosition,
  type GalleryPosition,
  type GalleryPositionFilters,
  type GalleryPositionRestoreResult,
} from '@/lib/mobile/galleryPosition';

export function useMobileGalleryPosition({
  workspaceId, containerRef, selectedAssetId, filters, restorePosition, restoreResult, onMissing,
}: {
  workspaceId: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  selectedAssetId: string | null;
  filters: GalleryPositionFilters;
  restorePosition: (position: GalleryPosition) => void;
  restoreResult: GalleryPositionRestoreResult | null;
  onMissing: () => void;
}) {
  const [storedPosition, setStoredPosition] = useState(() => readGalleryPosition(workspaceId));
  const handledResultRef = useRef<GalleryPositionRestoreResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [canSave, setCanSave] = useState(false);
  const position = storedPosition?.workspaceId === workspaceId ? storedPosition : null;

  useEffect(() => {
    setStoredPosition(readGalleryPosition(workspaceId));
  }, [workspaceId]);

  const updateViewport = useCallback(() => {
    const tiles = visibleGalleryTiles(containerRef.current);
    setCanSave(tiles.length > 0);
    setVisible(!!position && tiles.some((tile) => tile.assetId === position.assetId));
  }, [containerRef, position]);

  // Virtualized tiles may be mounted but outside the actual viewport.
  useLayoutEffect(() => { updateViewport(); });

  useEffect(() => {
    if (!restoreResult || handledResultRef.current === restoreResult || restoreResult.status !== 'missing'
      || restoreResult.workspaceId !== workspaceId) return;
    handledResultRef.current = restoreResult;
    if (storedPosition?.workspaceId !== workspaceId || storedPosition?.assetId !== restoreResult.assetId) return;
    setStoredPosition(null);
    writeGalleryPosition(restoreResult.workspaceId, null);
    onMissing();
  }, [restoreResult, workspaceId, storedPosition, onMissing]);

  const clearAway = () => {
    if (!workspaceId || !position) return;
    // A hold may span a viewport change; do not clear a point that is now visible.
    if (visibleGalleryTiles(containerRef.current).some(tile => tile.assetId === position.assetId)) return;
    writeGalleryPosition(workspaceId, null);
    setStoredPosition(null);
  };

  const activate = () => {
    if (!workspaceId) return;
    // Measure again at tap time, including scroll events between React commits.
    const savedVisible = position && visibleGalleryTiles(containerRef.current).some((tile) => tile.assetId === position.assetId);
    if (position) {
      if (savedVisible) {
        writeGalleryPosition(workspaceId, null);
        setStoredPosition(null);
      } else {
        restorePosition(position);
      }
      return;
    }
    const captured = captureGalleryPosition(containerRef.current, workspaceId, selectedAssetId, filters);
    if (captured) {
      writeGalleryPosition(workspaceId, captured);
      setStoredPosition(captured);
    }
  };

  return { action: !position ? 'save' as const : visible ? 'clear' as const : 'return' as const, canSave, activate, clearAway, updateViewport };
}
