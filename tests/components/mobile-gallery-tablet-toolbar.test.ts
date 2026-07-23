/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
  GalleryFullscreenViewer: () => null,
}));

vi.mock('@/hooks/gallery/useMobileGalleryScreen', () => ({
  useMobileGalleryScreen: () => ({
    totalCount: 0,
    itemsByAbsoluteIndex: {},
    loadedViewerItems: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    query: '',
    setQuery: mockSetQuery,
    selectedFilters: ['image', 'video', 'audio'],
    semanticFilter: 'common',
    setSemanticFilter: mockSetSemanticFilter,
    showTrashed: false,
    favoritesOnly: false,
    toggleMediaFilter: mockToggleMediaFilter,
    toggleGalleryFavorites: mockToggleGalleryFavorites,
    toggleGalleryTrash: mockToggleGalleryTrash,
    refresh: mockRefresh,
    ensureRangeLoaded: mockEnsureRangeLoaded,
    selectedAssetId: null,
    selectedAbsoluteIndex: null,
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
  });
});
