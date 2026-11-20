export type SelectionRange = { anchor: number; end: number; add: boolean; base: Set<string> };

// Recompute from the gesture's original selection, so dragging back contracts the range.
export function resolveGallerySelection(base: Set<string>, range: SelectionRange | null, items: Record<number, { id: string }>) {
  const ids = new Set(range?.base ?? base);
  let missing = 0;
  if (range) {
    for (let i = Math.min(range.anchor, range.end); i <= Math.max(range.anchor, range.end); i++) {
      const asset = items[i];
      if (!asset) { missing++; continue; }
      if (range.add) ids.add(asset.id); else ids.delete(asset.id);
    }
  }
  return { ids, missing };
}

export function galleryIndexAtPoint(x: number, y: number, rect: { left: number; top: number; width: number; height: number }, scrollTop: number, columns: number, rowHeight: number, total: number) {
  if (total <= 0 || rect.width <= 0 || rowHeight <= 0) return null;
  const column = Math.max(0, Math.min(columns - 1, Math.floor((x - rect.left) / (rect.width / columns))));
  const row = Math.max(0, Math.floor((Math.max(0, Math.min(rect.height - 1, y - rect.top)) + scrollTop) / rowHeight));
  return Math.min(total - 1, row * columns + column);
}
