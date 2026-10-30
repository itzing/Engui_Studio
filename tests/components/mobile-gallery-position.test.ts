/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readGalleryPosition } from '@/lib/mobile/galleryPosition';

const mock = vi.hoisted(() => ({ workspaceId: 'ws-1', scroll: 0, selected: 'asset-0', restore: vi.fn(), toast: vi.fn(), result: null as unknown }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: mock.toast }) }));
vi.mock('@/hooks/mobile/useViewportFormFactor', () => ({ useViewportFormFactor: () => 'phone-portrait' }));
vi.mock('@/lib/create/reuseToCreate', () => ({ prepareCreateReuseDraft: vi.fn() }));
vi.mock('@/components/workspace/GalleryFullscreenViewer', () => ({ GalleryFullscreenViewer: () => null }));
vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: () => ({
  getVirtualItems: () => Array.from({ length: 10 }, (_, index) => ({ index, start: index * 100, key: index })),
  getTotalSize: () => 1000, measure: () => {}, scrollToIndex: () => {}, scrollToOffset: () => {},
}) }));
const noop = () => {};
vi.mock('@/hooks/gallery/useMobileGalleryScreen', () => ({ useMobileGalleryScreen: () => ({
  workspaceId: mock.workspaceId, totalCount: 30,
  itemsByAbsoluteIndex: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, { id: `asset-${i}`, type: 'image', originalUrl: '/image.png' }])),
  loadedViewerItems: [], isLoading: false, isLoadingMore: false, error: null,
  query: '', setQuery: noop, selectedFilters: ['image', 'video', 'audio'], semanticFilter: 'common', setSemanticFilter: noop,
  showTrashed: false, favoritesOnly: false, toggleMediaFilter: noop, toggleGalleryFavorites: noop, toggleGalleryTrash: noop,
  refresh: noop, ensureRangeLoaded: noop, selectedAssetId: mock.selected, selectedAbsoluteIndex: 0, handleTilePress: noop,
  viewerOpen: false, viewerIndex: 0, closeViewer: noop, updateViewerIndex: noop, toggleFavorite: noop, updateBucket: noop, toggleTrash: noop,
  restoreTick: 0, restoreAbsoluteIndex: null, restorePosition: mock.restore, positionRestoreResult: mock.result,
}) }));
import MobileGalleryScreen from '@/components/mobile/gallery/MobileGalleryScreen';
function scrollTo(offset: number) {
  mock.scroll = offset;
  const grid = document.querySelector('[data-gallery-asset-id]')!.parentElement!.parentElement!.parentElement!;
  fireEvent.scroll(grid);
}
beforeEach(() => {
  localStorage.clear(); mock.workspaceId = 'ws-1'; mock.scroll = 0; mock.selected = 'asset-0'; mock.result = null;
  mock.restore.mockReset(); mock.toast.mockReset();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const id = this.dataset.galleryAssetId;
    const top = id ? 100 + Math.floor(Number(id.split('-')[1]) / 3) * 100 - mock.scroll : 100;
    const height = id ? 100 : 300;
    return { top, bottom: top + height, left: 0, right: 300, width: 300, height } as DOMRect;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('mobile gallery single position control', () => {
  it('saves, returns after leaving the viewport, keeps the point, then clears with the same button', () => {
    const view = render(React.createElement(MobileGalleryScreen));
    const button = screen.getByRole('button', { name: 'Save position' });
    expect(button.parentElement?.querySelector('input')).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Clear position' })).toBe(button);
    scrollTo(100);
    expect(screen.getByRole('button', { name: 'Return to position' })).toBe(button);
    expect(screen.queryByRole('button', { name: 'Clear position' })).toBeNull();
    fireEvent.click(button);
    expect(mock.restore).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'asset-0', viewportOffset: 0 }));
    scrollTo(0);
    view.rerender(React.createElement(MobileGalleryScreen));
    expect(readGalleryPosition('ws-1')?.assetId).toBe('asset-0');
    expect(screen.getByRole('button', { name: 'Clear position' })).toBe(button);
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Save position' })).toBe(button);
    expect(readGalleryPosition('ws-1')).toBeNull();
  });
  it('changes back to clear on manual return and keeps partial visibility in clear state', () => {
    render(React.createElement(MobileGalleryScreen));
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
    scrollTo(99);
    expect(screen.getByRole('button', { name: 'Clear position' })).toBeTruthy();
    scrollTo(100);
    expect(screen.getByRole('button', { name: 'Return to position' })).toBeTruthy();
    scrollTo(99);
    expect(screen.getByRole('button', { name: 'Clear position' })).toBeTruthy();
    expect(mock.restore).not.toHaveBeenCalled();
  });
  it('anchors the visible grid rather than an old offscreen selection and survives remount', () => {
    const view = render(React.createElement(MobileGalleryScreen));
    scrollTo(450);
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
    expect(readGalleryPosition('ws-1')).toMatchObject({ assetId: 'asset-15', viewportOffset: 50 });
    view.unmount(); mock.scroll = 0;
    render(React.createElement(MobileGalleryScreen));
    expect(screen.getByRole('button', { name: 'Return to position' })).toBeTruthy();
  });
  it('does not offer another workspace point', () => {
    const view = render(React.createElement(MobileGalleryScreen));
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
    mock.workspaceId = 'ws-2'; view.rerender(React.createElement(MobileGalleryScreen));
    expect(screen.getByRole('button', { name: 'Save position' })).toBeTruthy();
    expect(readGalleryPosition('ws-1')).not.toBeNull();
  });
  it('clears a missing point once and allows saving again without stale feedback', () => {
    const view = render(React.createElement(MobileGalleryScreen));
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
    mock.result = { workspaceId: 'ws-1', assetId: 'asset-0', status: 'missing' };
    view.rerender(React.createElement(MobileGalleryScreen));
    expect(screen.getByRole('button', { name: 'Save position' })).toBeTruthy();
    expect(mock.toast).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
    expect(screen.getByRole('button', { name: 'Clear position' })).toBeTruthy();
    expect(mock.toast).toHaveBeenCalledTimes(1);
  });
});


const touch = { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 100, clientY: 100 };
function savedOffscreen() {
  const view = render(React.createElement(MobileGalleryScreen));
  fireEvent.click(screen.getByRole('button', { name: 'Save position' }));
  scrollTo(100);
  return { view, button: screen.getByRole('button', { name: 'Return to position' }) };
}
describe('mobile gallery hold-to-clear', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('clears on hold without returning, consumes the trailing click, and accepts a new tap', () => {
    const { button } = savedOffscreen();
    fireEvent.pointerDown(button, touch);
    act(() => vi.advanceTimersByTime(600));
    expect(readGalleryPosition('ws-1')).toBeNull();
    expect(mock.restore).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save position' })).toBe(button);
    fireEvent.pointerUp(button, touch); fireEvent.click(button);
    expect(readGalleryPosition('ws-1')).toBeNull();
    fireEvent.pointerDown(button, touch); fireEvent.pointerUp(button, touch); fireEvent.click(button);
    expect(readGalleryPosition('ws-1')?.assetId).toBe('asset-3');
  });
  it('keeps short tap as return', () => {
    const { button } = savedOffscreen();
    fireEvent.pointerDown(button, touch); act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerUp(button, touch); fireEvent.click(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(readGalleryPosition('ws-1')?.assetId).toBe('asset-0');
    expect(mock.restore).toHaveBeenCalledTimes(1);
  });
  it('cancels movement so scrolling does not clear or return', () => {
    const { button } = savedOffscreen();
    fireEvent.pointerDown(button, touch);
    fireEvent.pointerMove(button, { ...touch, clientY: 120 });
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerUp(button, touch); fireEvent.click(button);
    expect(readGalleryPosition('ws-1')).not.toBeNull(); expect(mock.restore).not.toHaveBeenCalled();
  });
  it.each(['pointerCancel', 'pointerLeave'] as const)('cancels on %s', event => {
    const { button } = savedOffscreen();
    fireEvent.pointerDown(button, touch); fireEvent[event](button, touch);
    act(() => vi.advanceTimersByTime(1000)); fireEvent.click(button);
    expect(readGalleryPosition('ws-1')).not.toBeNull(); expect(mock.restore).not.toHaveBeenCalled();
  });
  it('does not clear a different workspace after a workspace change during hold', () => {
    const { button, view } = savedOffscreen(); fireEvent.pointerDown(button, touch);
    mock.workspaceId = 'ws-2'; view.rerender(React.createElement(MobileGalleryScreen));
    act(() => vi.advanceTimersByTime(1000));
    expect(readGalleryPosition('ws-1')).not.toBeNull(); expect(readGalleryPosition('ws-2')).toBeNull();
  });
  it('cancels a pending hold on unmount', () => {
    const { button, view } = savedOffscreen(); fireEvent.pointerDown(button, touch); view.unmount();
    act(() => vi.advanceTimersByTime(1000)); expect(readGalleryPosition('ws-1')).not.toBeNull();
  });
  it('rechecks actual item visibility even before a scroll event updates the icon', () => {
    const { button } = savedOffscreen(); fireEvent.pointerDown(button, touch);
    mock.scroll = 0;
    act(() => vi.advanceTimersByTime(600)); fireEvent.pointerUp(button, touch); fireEvent.click(button);
    expect(readGalleryPosition('ws-1')).not.toBeNull(); expect(mock.restore).not.toHaveBeenCalled();
  });
  it('keeps keyboard activation as the normal return action', () => {
    const { button } = savedOffscreen();
    fireEvent.keyDown(button, { key: 'Enter' }); fireEvent.click(button);
    expect(mock.restore).toHaveBeenCalledTimes(1); expect(readGalleryPosition('ws-1')).not.toBeNull();
  });
});
