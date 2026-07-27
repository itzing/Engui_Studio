/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TABLET_GALLERY_COLUMN_STORAGE_KEY } from '@/lib/mobile/galleryGrid';

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn(async () => undefined));
const mockSetQuery = vi.hoisted(() => vi.fn());
const mockSetSemanticFilter = vi.hoisted(() => vi.fn());
const mockToggleMediaFilter = vi.hoisted(() => vi.fn());
const mockToggleGalleryFavorites = vi.hoisted(() => vi.fn());
const mockToggleGalleryTrash = vi.hoisted(() => vi.fn());
const mockEnsureRangeLoaded = vi.hoisted(() => vi.fn(async () => undefined));
const mockFormFactor = vi.hoisted(() => ({ current: 'phone-portrait' }));
const mockGalleryFullscreenViewer = vi.hoisted(() => vi.fn(() => null));
const mockGalleryState = vi.hoisted(() => ({
  current: {
    query: '',
    selectedAssetId: null as string | null,
    selectedAsset: null as null | { id: string; type: 'image' | 'video' | 'audio' },
    semanticFilter: 'common' as 'all' | 'common' | 'draft' | 'upscale',
    showTrashed: false,
    favoritesOnly: false,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/hooks/mobile/useViewportFormFactor', () => ({
  useViewportFormFactor: () => mockFormFactor.current,
}));

vi.mock('@/lib/create/reuseToCreate', () => ({
  prepareCreateReuseDraft: vi.fn(),
}));

vi.mock('@/components/workspace/GalleryFullscreenViewer', () => ({
  GalleryFullscreenViewer: mockGalleryFullscreenViewer,
}));

vi.mock('@/hooks/gallery/useMobileGalleryScreen', () => ({
  useMobileGalleryScreen: () => ({
    totalCount: 0,
    itemsByAbsoluteIndex: {},
    loadedViewerItems: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    query: mockGalleryState.current.query,
    setQuery: mockSetQuery,
    selectedFilters: ['image', 'video', 'audio'],
    semanticFilter: mockGalleryState.current.semanticFilter,
    setSemanticFilter: mockSetSemanticFilter,
    showTrashed: mockGalleryState.current.showTrashed,
    favoritesOnly: mockGalleryState.current.favoritesOnly,
    toggleMediaFilter: mockToggleMediaFilter,
    toggleGalleryFavorites: mockToggleGalleryFavorites,
    toggleGalleryTrash: mockToggleGalleryTrash,
    refresh: mockRefresh,
    ensureRangeLoaded: mockEnsureRangeLoaded,
    selectedAssetId: mockGalleryState.current.selectedAssetId,
    selectedAbsoluteIndex: null,
    selectedAsset: mockGalleryState.current.selectedAsset,
    handleTilePress: vi.fn(),
    viewerOpen: false,
    viewerIndex: 0,
    closeViewer: vi.fn(),
    updateViewerIndex: vi.fn(),
    toggleFavorite: vi.fn(),
    updateBucket: vi.fn(),
    toggleTrash: vi.fn(),
    restoreTick: 0,
    restoreAbsoluteIndex: null,
  }),
}));

import MobileGalleryScreen from '@/components/mobile/gallery/MobileGalleryScreen';

describe('MobileGalleryScreen tablet toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockFormFactor.current = 'phone-portrait';
    mockGalleryState.current = {
      query: '',
      selectedAssetId: null,
      selectedAsset: null,
      semanticFilter: 'common',
      showTrashed: false,
      favoritesOnly: false,
    };
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  });

  it('keeps phone portrait on the existing mobile filter rows', () => {
    render(React.createElement(MobileGalleryScreen));

    expect(screen.queryByTestId('tablet-gallery-toolbar')).toBeNull();
    expect(screen.queryByText(/Columns:/)).toBeNull();
    expect(screen.queryAllByTestId('tablet-gallery-divider')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Refresh gallery' })).toBeTruthy();
    const viewerProps = mockGalleryFullscreenViewer.mock.calls[mockGalleryFullscreenViewer.mock.calls.length - 1]?.[0] as { enableTouchSwipeNavigation?: boolean };
    expect(viewerProps.enableTouchSwipeNavigation).toBe(false);
  });

  it('renders iPad filters, columns, and refresh in one tablet-only row', () => {
    mockFormFactor.current = 'tablet-landscape';
    window.localStorage.setItem(TABLET_GALLERY_COLUMN_STORAGE_KEY, '8');

    render(React.createElement(MobileGalleryScreen));

    const toolbar = screen.getByTestId('tablet-gallery-toolbar');
    expect(within(toolbar).getAllByTestId('tablet-gallery-divider')).toHaveLength(2);
    expect(within(toolbar).getByText('Columns: 8')).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: 'Refresh gallery' })).toBeTruthy();
    expect(toolbar.querySelector('[aria-label="Gallery columns"]')).toBeTruthy();
    const viewerProps = mockGalleryFullscreenViewer.mock.calls[mockGalleryFullscreenViewer.mock.calls.length - 1]?.[0] as { enableTouchSwipeNavigation?: boolean };
    expect(viewerProps.enableTouchSwipeNavigation).toBe(true);
  });

  it('opens tablet carousel from the selected Gallery asset with gallery filters', () => {
    mockFormFactor.current = 'tablet-landscape';
    mockGalleryState.current = {
      query: 'face',
      selectedAssetId: 'asset-2',
      selectedAsset: { id: 'asset-2', type: 'video' },
      semanticFilter: 'draft',
      showTrashed: true,
      favoritesOnly: true,
    };

    render(React.createElement(MobileGalleryScreen));

    fireEvent.click(screen.getByRole('button', { name: 'Open carousel' }));
    expect(mockPush).toHaveBeenCalledWith('/m/carousel?mode=galleryOrder&anchorAssetId=asset-2&bucket=draft&q=face&favoritesOnly=true&includeTrashed=true&onlyTrashed=true');
  });
});
