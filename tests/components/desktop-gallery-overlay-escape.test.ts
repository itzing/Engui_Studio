/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DesktopGalleryOverlay } from '@/components/layout/DesktopGalleryOverlay';

const closeViewerMock = vi.fn();

let viewerOpen = false;

vi.mock('@/hooks/gallery/useMobileGalleryScreen', () => ({
  useMobileGalleryScreen: () => ({
    totalCount: 0,
    itemsByAbsoluteIndex: {},
    loadedViewerItems: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    query: '',
    setQuery: vi.fn(),
    selectedFilters: ['image', 'video', 'audio'],
    semanticFilter: 'all',
    setSemanticFilter: vi.fn(),
    showTrashed: false,
    favoritesOnly: false,
    toggleMediaFilter: vi.fn(),
    toggleGalleryFavorites: vi.fn(),
    toggleGalleryTrash: vi.fn(),
    refresh: vi.fn(),
    ensureRangeLoaded: vi.fn(),
    selectedAssetId: null,
    selectedAbsoluteIndex: null,
    handleTilePress: vi.fn(),
    viewerOpen,
    viewerIndex: 0,
    closeViewer: closeViewerMock,
    updateViewerIndex: vi.fn(),
    toggleFavorite: vi.fn(),
    updateBucket: vi.fn(),
    toggleTrash: vi.fn(),
    restoreTick: 0,
    restoreAbsoluteIndex: null,
  }),
}));

vi.mock('@/components/workspace/GalleryFullscreenViewer', () => ({
  GalleryFullscreenViewer: () => null,
}));

vi.mock('@/components/workspace/GalleryAssetDialog', () => ({
  GalleryAssetDialog: () => null,
}));

vi.mock('@/components/workspace/GalleryVideoCarousel', () => ({
  GalleryVideoCarousel: ({ onClose }: { onClose?: () => void }) => React.createElement(
    'div',
    { 'data-testid': 'mock-gallery-video-carousel' },
    React.createElement('button', { type: 'button', onClick: onClose }, 'Close carousel'),
  ),
}));

describe('DesktopGalleryOverlay Escape handling', () => {
  beforeEach(() => {
    viewerOpen = false;
    closeViewerMock.mockReset();
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it('closes the gallery when no viewer is open', () => {
    const onClose = vi.fn();

    render(React.createElement(DesktopGalleryOverlay, { open: true, onClose }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(closeViewerMock).not.toHaveBeenCalled();
  });

  it('closes only the viewer when a viewer is open', () => {
    viewerOpen = true;
    const onClose = vi.fn();

    render(React.createElement(DesktopGalleryOverlay, { open: true, onClose }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeViewerMock).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('opens the carousel in a fullscreen modal and closes only the modal on Escape', () => {
    const onClose = vi.fn();

    render(React.createElement(DesktopGalleryOverlay, { open: true, onClose }));

    fireEvent.click(screen.getByRole('button', { name: 'Open video carousel' }));
    expect(screen.getByTestId('gallery-video-carousel-modal')).toBeTruthy();
    expect(screen.getByTestId('mock-gallery-video-carousel')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('gallery-video-carousel-modal')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(closeViewerMock).not.toHaveBeenCalled();
  });
});
