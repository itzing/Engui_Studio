/**
 * @vitest-environment jsdom
 */
import React, { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  normalizeGalleryMediaFilters,
  useMobileGalleryScreen,
  type MobileGalleryAsset,
} from '@/hooks/gallery/useMobileGalleryScreen';

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    activeWorkspaceId: 'ws-1',
    workspaces: [{ id: 'ws-1', name: 'Workspace', isDefault: true, createdAt: '2026-07-22T00:00:00Z' }],
  }),
}));

function makeAsset(id: string, type: MobileGalleryAsset['type']): MobileGalleryAsset {
  return {
    id,
    workspaceId: 'ws-1',
    type,
    originalUrl: `/media/${id}`,
    favorited: false,
    trashed: false,
    bucket: 'common',
    addedToGalleryAt: '2026-07-22T00:00:00Z',
  };
}

function galleryResponse(assets: MobileGalleryAsset[]) {
  return {
    success: true,
    assets,
    pagination: {
      page: 1,
      limit: 24,
      totalCount: assets.length,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };
}

function HookProbe({ surface = 'mobile' }: { surface?: 'mobile' | 'desktop' }) {
  const gallery = useMobileGalleryScreen(surface);

  useEffect(() => {
    window.localStorage.setItem('latest-selected-filters', JSON.stringify(gallery.selectedFilters));
  }, [gallery.selectedFilters]);

  return React.createElement(
    'div',
    null,
    React.createElement('button', { type: 'button', onClick: () => gallery.toggleMediaFilter('video') }, 'toggle video'),
    React.createElement(
      'div',
      { 'data-testid': 'asset-types' },
      gallery.loadedAssets.map(({ asset }) => asset.type).join(','),
    ),
  );
}

describe('useMobileGalleryScreen media filters', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes empty or invalid media filters back to all types', () => {
    expect(normalizeGalleryMediaFilters([])).toEqual(['image', 'video', 'audio']);
    expect(normalizeGalleryMediaFilters(['video', 'unknown'])).toEqual(['video']);
    expect(normalizeGalleryMediaFilters('video')).toEqual(['image', 'video', 'audio']);
  });

  it('hydrates mobile media type filters from per-workspace local storage', async () => {
    window.localStorage.setItem('engui.mobile.gallery.mediaFilters.ws-1', JSON.stringify(['image', 'audio']));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => galleryResponse([makeAsset('image-1', 'image')]),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(HookProbe));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const requestedUrl = new URL(fetchMock.mock.calls[0][0], 'http://localhost');

    expect(requestedUrl.searchParams.get('type')).toBe('image,audio');
    expect(JSON.parse(window.localStorage.getItem('latest-selected-filters') || '[]')).toEqual(['image', 'audio']);
  });

  it('hydrates desktop media type filters from desktop local storage', async () => {
    window.localStorage.setItem('engui.desktop.gallery.mediaFilters.ws-1', JSON.stringify(['video']));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => galleryResponse([makeAsset('video-1', 'video')]),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(HookProbe, { surface: 'desktop' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const requestedUrl = new URL(fetchMock.mock.calls[0][0], 'http://localhost');

    expect(requestedUrl.searchParams.get('type')).toBe('video');
    expect(JSON.parse(window.localStorage.getItem('latest-selected-filters') || '[]')).toEqual(['video']);
  });

  it('ignores stale gallery responses from a previous media type filter', async () => {
    let resolveFirst: ((value: unknown) => void) | null = null;
    let resolveSecond: ((value: unknown) => void) | null = null;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(HookProbe));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'toggle video' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => {
      resolveSecond?.({
        ok: true,
        json: async () => galleryResponse([makeAsset('image-1', 'image')]),
      });
    });

    await waitFor(() => expect(screen.getByTestId('asset-types').textContent).toBe('image'));

    await act(async () => {
      resolveFirst?.({
        ok: true,
        json: async () => galleryResponse([makeAsset('video-1', 'video')]),
      });
    });

    expect(screen.getByTestId('asset-types').textContent).toBe('image');
  });
});
