/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';

function makeCarouselWindowResponse(assets: any[], currentIndex: number) {
  const toFeedItem = (asset: any) => asset.type === 'image'
    ? { kind: 'images', id: asset.id, images: [asset], aspectRatio: asset.mediaWidth / asset.mediaHeight }
    : { kind: 'video', id: asset.id, asset };
  return {
    success: true,
    previous: assets.slice(0, currentIndex).map(toFeedItem),
    current: assets[currentIndex] ? toFeedItem(assets[currentIndex]) : null,
    next: assets.slice(currentIndex + 1).map(toFeedItem),
    pagination: {
      totalCount: assets.length,
      anchorIndex: currentIndex,
      hasBefore: false,
      hasAfter: false,
      beforeCursor: null,
      afterCursor: null,
    },
    counts: {
      videos: assets.filter((asset) => asset.type === 'video').length,
      images: assets.filter((asset) => asset.type === 'image').length,
      total: assets.length,
    },
  };
}

describe('GalleryVideoCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as unknown as typeof HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('restores persisted carousel settings for the workspace device', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: false,
      imagesEnabled: true,
      galleryViewEnabled: true,
      onlyFavorites: true,
      includeLandscape: false,
      includePortrait: true,
      speed: 1.8,
      scrubSpeedMultiplier: 8,
    }));
    const imageAssets = Array.from({ length: 5 }, (_, index) => ({
      id: `image-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: `/image-${index + 1}.png`,
      previewUrl: `/image-${index + 1}.png`,
      thumbnailUrl: null,
      prompt: `Image ${index + 1}`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(url).toContain('/api/carousel/feed-window');
      expect(search.get('source')).toBe('galleryOrder');
      expect(search.get('includeVideos')).toBe('false');
      expect(search.get('includeImages')).toBe('true');
      expect(search.get('favoritesOnly')).toBe('true');
      return {
        ok: true,
        json: async () => ({
          ...makeCarouselWindowResponse(imageAssets, 0),
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Movement paused')).toBeTruthy());
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Gallery View') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Only favorites') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include landscape assets') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include portrait assets') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('1.8x')).toBeTruthy();
    expect(screen.getByText('8x')).toBeTruthy();
  });

  it('loads all videos and pauses carousel movement without pausing visible videos', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    fireEvent.click(screen.getByTestId('gallery-video-carousel'));

    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
    expect(screen.getByText('Movement paused')).toBeTruthy();
    expect(within(screen.getByTestId('gallery-video-carousel')).queryByText('Paused')).toBeNull();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    await waitFor(() => expect(screen.queryByTestId('gallery-carousel-pause-indicator')).toBeNull());
  });

  it('starts gallery order playback paused from the selected gallery asset and mounts both adjacent sides', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(url).toContain('/api/carousel/feed-window');
      expect(search.get('source')).toBe('galleryOrder');
      expect(search.get('anchorAssetId')).toBe('video-2');
      return {
        ok: true,
        json: async () => ({
          ...makeCarouselWindowResponse([1, 2, 3].map((index) => ({
            id: `video-${index}`,
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: `/video-${index}.mp4`,
            previewUrl: `/video-${index}.mp4`,
            thumbnailUrl: `/video-${index}.png`,
            mediaWidth: 1280,
            mediaHeight: 720,
            addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
          })), 1),
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialGalleryViewEnabled: true,
        currentGalleryAssetId: 'video-2',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
        initialSpeed: 0,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());
      expect(screen.getByText('Movement paused')).toBeTruthy();
      expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
      expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy();
      expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeTruthy();

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: -1400 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: -1400 });

      await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('warm seeds multiple gallery order neighbors on both sides of the selected asset', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ...makeCarouselWindowResponse(Array.from({ length: 9 }, (_, index) => ({
          id: `video-${index + 1}`,
          workspaceId: 'ws-1',
          type: 'video',
          originalUrl: `/video-${index + 1}.mp4`,
          previewUrl: `/video-${index + 1}.mp4`,
          thumbnailUrl: `/video-${index + 1}.png`,
          mediaWidth: 1280,
          mediaHeight: 720,
          addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
        })), 4),
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialGalleryViewEnabled: true,
        currentGalleryAssetId: 'video-5',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-5.mp4"]')).toBeTruthy());
      [2, 3, 4, 5, 6, 7, 8].forEach((index) => {
        expect(stage.querySelector(`video[src="/video-${index}.mp4"]`)).toBeTruthy();
      });
      expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-9.mp4"]')).toBeNull();
      expect(screen.getByText('Movement paused')).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('starts gallery order playback from the nearest matching asset when the selected asset is filtered out', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const assets = [
      { id: 'video-1', width: 1280, height: 720 },
      { id: 'video-2', width: 720, height: 1280 },
      { id: 'video-3', width: 1280, height: 720 },
      { id: 'video-4', width: 720, height: 1280 },
      { id: 'video-5', width: 1280, height: 720 },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(url).toContain('/api/carousel/feed-window');
      expect(search.get('anchorAssetId')).toBe('video-4');
      return {
        ok: true,
        json: async () => ({
          ...makeCarouselWindowResponse(assets
            .map((asset, index) => ({
            id: asset.id,
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: `/${asset.id}.mp4`,
            previewUrl: `/${asset.id}.mp4`,
            thumbnailUrl: `/${asset.id}.png`,
            mediaWidth: asset.width,
            mediaHeight: asset.height,
            addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
          }))
            .filter((asset) => asset.mediaWidth > asset.mediaHeight), 2),
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialGalleryViewEnabled: true,
        currentGalleryAssetId: 'video-4',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
        initialSpeed: 0,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-5.mp4"]')).toBeTruthy());
      expect((stage.querySelector('video[src="/video-5.mp4"]')?.parentElement as HTMLElement).style.transform).toContain('translate3d(0px');
      expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeTruthy();
      expect(screen.getByText('Movement paused')).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('uses one image per slot in gallery view instead of grouped image slots', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(url).toContain('/api/carousel/feed-window');
      expect(search.get('anchorAssetId')).toBe('image-2');
      return {
        ok: true,
        json: async () => ({
          ...makeCarouselWindowResponse([1, 2, 3].map((index) => ({
            id: `image-${index}`,
            workspaceId: 'ws-1',
            type: 'image',
            originalUrl: `/image-${index}.png`,
            previewUrl: `/image-${index}.png`,
            thumbnailUrl: null,
            mediaWidth: 1280,
            mediaHeight: 720,
            addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
          })), 1),
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialVideosEnabled: false,
        initialImagesEnabled: true,
        initialGalleryViewEnabled: true,
        currentGalleryAssetId: 'image-2',
        initialSpeed: 0,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('img[src="/image-2.png"]')).toBeTruthy());
      expect(stage.querySelector('img[src="/image-1.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/image-3.png"]')).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('prefetches the next carousel window while scrubbing gallery view', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const firstWindowAssets = [1, 2].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      mediaWidth: 2880,
      mediaHeight: 720,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const nextWindowAssets = [3, 4].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      mediaWidth: 2880,
      mediaHeight: 720,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(url).toContain('/api/carousel/feed-window');
      if (search.get('direction') === 'after') {
        return {
          ok: true,
          json: async () => ({
            ...makeCarouselWindowResponse(nextWindowAssets, 0),
            pagination: {
              totalCount: 4,
              anchorIndex: 2,
              hasBefore: true,
              hasAfter: false,
              beforeCursor: 2,
              afterCursor: null,
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          ...makeCarouselWindowResponse(firstWindowAssets, 0),
          pagination: {
            totalCount: 4,
            anchorIndex: 0,
            hasBefore: false,
            hasAfter: true,
            beforeCursor: null,
            afterCursor: 1,
          },
          counts: { videos: 4, images: 0, total: 4 },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialGalleryViewEnabled: true,
        currentGalleryAssetId: 'video-1',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 3200 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 3200 });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(String(fetchMock.mock.calls[1][0])).toContain('direction=after');
      fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 0 });
      fireEvent.pointerMove(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 3200 });
      fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 3200 });

      await waitFor(() => expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeTruthy());
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('does not repeat playback requests for mounted videos on every frame', async () => {
    const playMock = HTMLMediaElement.prototype.play as unknown as ReturnType<typeof vi.fn>;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      showControls: false,
      enableKeyboardControls: false,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    });

    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it('retries playback for video slots that mount after user interaction', async () => {
    let userInteracted = false;
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const playCalls: string[] = [];
    const playMock = vi.fn(function (this: HTMLMediaElement) {
      const src = this.getAttribute('src') || '';
      playCalls.push(src);
      return userInteracted ? Promise.resolve() : Promise.reject(new Error('Autoplay blocked'));
    }) as unknown as typeof HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = playMock;
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 1280,
      height: 720,
      top: 0,
      right: 1280,
      bottom: 720,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [1, 2, 3].map((index) => ({
          id: `video-${index}`,
          workspaceId: 'ws-1',
          type: 'video',
          originalUrl: `/video-${index}.mp4`,
          previewUrl: `/video-${index}.mp4`,
          thumbnailUrl: `/video-${index}.png`,
          mediaWidth: 2880,
          mediaHeight: 720,
          addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
        })),
        pagination: { page: 1, limit: 100, totalCount: 3, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
        initialSpeed: 0,
        showControls: false,
        enableKeyboardControls: false,
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());
      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());
      expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeNull();

      userInteracted = true;
      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 3200 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 3200 });

      await waitFor(() => expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeTruthy());
      await waitFor(() => expect(playCalls.filter((src) => src === '/video-3.mp4').length).toBeGreaterThan(0));
    } finally {
      randomSpy.mockRestore();
      rectSpy.mockRestore();
    }
  });

  it('pauses movement and keeps it paused after dragging the tape', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
          {
            id: 'video-2',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-2.mp4',
            previewUrl: '/video-2.mp4',
            thumbnailUrl: '/video-2.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:01:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 2, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 120 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 172 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', clientX: 172 });

    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
    expect(screen.getByText('Movement paused')).toBeTruthy();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  });

  it('scrubs with held physical arrow keys and ignores keyboard shortcuts from form controls', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    expect(screen.queryByRole('button', { name: 'Move carousel tape right' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move carousel tape left' })).toBeNull();
    expect(screen.getByText('Scrub')).toBeTruthy();
    expect(screen.getByText('4x')).toBeTruthy();

    const stage = screen.getByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video')?.parentElement?.style.transform).toContain('translate3d'));
    fireEvent.click(stage);
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    const slot = stage.querySelector('video')?.parentElement as HTMLElement;
    const pausedTransform = slot.style.transform;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(slot.style.transform).not.toBe(pausedTransform));
    const scrubbedTransform = slot.style.transform;
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    expect(slot.style.transform).toBe(scrubbedTransform);

    fireEvent.keyDown(screen.getByLabelText('Include image slots'), { key: 'ArrowLeft' });
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    expect(slot.style.transform).toBe(scrubbedTransform);

    fireEvent.keyDown(screen.getByLabelText('Include image slots'), { code: 'Space', key: ' ' });
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    await waitFor(() => expect(screen.queryByTestId('gallery-carousel-pause-indicator')).toBeNull());
  });

  it('moves the tape upward in vertical movement mode', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-landscape',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-landscape.mp4',
            previewUrl: '/video-landscape.mp4',
            thumbnailUrl: '/video-landscape.png',
            mediaWidth: 1280,
            mediaHeight: 720,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialIncludeLandscape: true,
      initialIncludePortrait: false,
      showControls: false,
      enableKeyboardControls: false,
      movementAxis: 'vertical',
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const stage = screen.getByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video[src="/video-landscape.mp4"]')).toBeTruthy());
    const slot = stage.querySelector('video')?.parentElement as HTMLElement;

    await waitFor(() => expect(slot.style.transform).toMatch(/translate3d\(0px, -\d+(?:\.\d+)?px, 0\)/));
  });

  it('trims vertical movement slots to a small nearby buffer after scrubbing', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      width: 390,
      height: 844,
      top: 0,
      right: 390,
      bottom: 844,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect);
    const videoAssets = Array.from({ length: 32 }, (_, index) => ({
      id: `video-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index + 1}.mp4`,
      previewUrl: `/video-${index + 1}.mp4`,
      thumbnailUrl: `/video-${index + 1}.png`,
      mediaWidth: 1280,
      mediaHeight: 720,
      addedToGalleryAt: `2026-07-21T06:${String(index).padStart(2, '0')}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: videoAssets,
        pagination: { page: 1, limit: 100, totalCount: videoAssets.length, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialIncludeLandscape: true,
        initialIncludePortrait: false,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video')).toBeTruthy());

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientY: 800 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'touch', clientY: -5000 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientY: -5000 });

      await waitFor(() => {
        const activeVideoCount = stage.querySelectorAll('video').length;
        expect(activeVideoCount).toBeGreaterThan(0);
        expect(activeVideoCount).toBeLessThanOrEqual(8);
      });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('fills the fullscreen viewport and reveals desktop carousel controls only in the top hover area', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    const controlsHoverArea = screen.getByTestId('gallery-carousel-controls-hover-area');
    const controls = screen.getByTestId('gallery-carousel-controls');
    expect(stage.className).toContain('h-full');
    expect(stage.className).toContain('min-h-[100dvh]');
    await waitFor(() => expect(stage.querySelector('video')?.parentElement?.style.transform).toContain('translate3d'));

    expect(controls.className).toContain('opacity-0');

    fireEvent.pointerEnter(controlsHoverArea, { pointerId: 1, pointerType: 'mouse' });
    await waitFor(() => expect(controls.className).toContain('opacity-100'));

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    fireEvent.pointerLeave(controlsHoverArea, { pointerId: 1, pointerType: 'mouse' });
    expect(controls.className).toContain('opacity-0');

    const slot = stage.querySelector('video')?.parentElement as HTMLElement;
    const pausedTransform = slot.style.transform;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(slot.style.transform).not.toBe(pausedTransform));
    fireEvent.keyUp(window, { key: 'ArrowRight' });

    fireEvent.pointerEnter(controlsHoverArea, { pointerId: 2, pointerType: 'mouse' });
    await waitFor(() => expect(controls.className).toContain('opacity-100'));

    fireEvent.pointerLeave(controlsHoverArea, { pointerId: 2, pointerType: 'mouse' });
    expect(controls.className).toContain('opacity-0');

    fireEvent.pointerMove(stage, { pointerId: 3, pointerType: 'mouse', clientX: 640, clientY: 360 });
    expect(controls.className).toContain('opacity-0');
  });

  it('restores played clips when scrubbing backward after they leave the forward edge', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [1, 2, 3].map((index) => ({
          id: `video-${index}`,
          workspaceId: 'ws-1',
          type: 'video',
          originalUrl: `/video-${index}.mp4`,
          previewUrl: `/video-${index}.mp4`,
          thumbnailUrl: `/video-${index}.png`,
          mediaWidth: 720,
          mediaHeight: 1280,
          addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
        })),
        pagination: { page: 1, limit: 100, totalCount: 3, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('3 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());

    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 5000 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', clientX: 5000 });

    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeNull());

    fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 5000 });
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: 'mouse', clientX: 1000 });
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'mouse', clientX: 1000 });

    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());
    expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy();
    randomSpy.mockRestore();
  });

  it('loads images and rebuilds the feed when Images is toggled', async () => {
    const videoAssets = [
      {
        id: 'video-1',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-1.mp4',
        previewUrl: '/video-1.mp4',
        thumbnailUrl: '/video-1.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
      {
        id: 'video-2',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-2.mp4',
        previewUrl: '/video-2.mp4',
        thumbnailUrl: '/video-2.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:01:00Z',
      },
    ];
    const imageAssets = Array.from({ length: 5 }, (_, index) => ({
      id: `image-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: `/image-${index + 1}.png`,
      previewUrl: `/image-${index + 1}.png`,
      thumbnailUrl: null,
      prompt: `Image ${index + 1}`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      const type = search.get('type');
      const assets = type === 'image' ? imageAssets : videoAssets;
      return {
        ok: true,
        json: async () => ({
          success: true,
          assets,
          pagination: { page: 1, limit: 100, totalCount: assets.length, hasNextPage: false },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain('type=video');
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('type=image'))).toBe(true);
    await waitFor(() => expect(screen.getByText('2 videos · 5 images')).toBeTruthy());
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      videosEnabled: true,
      imagesEnabled: true,
    });

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      videosEnabled: true,
      imagesEnabled: false,
    });
  });

  it('reloads the feed with favorite-only gallery requests when Only favorites is toggled', async () => {
    const videoAssets = [{
      id: 'video-1',
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: '/video-1.mp4',
      previewUrl: '/video-1.mp4',
      thumbnailUrl: '/video-1.png',
      mediaWidth: 720,
      mediaHeight: 1280,
      favorited: true,
      addedToGalleryAt: '2026-07-21T06:00:00Z',
    }];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: videoAssets,
        pagination: { page: 1, limit: 100, totalCount: videoAssets.length, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('favoritesOnly=true');
    expect((screen.getByLabelText('Only favorites') as HTMLInputElement).checked).toBe(false);

    fireEvent.click(screen.getByLabelText('Only favorites'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain('favoritesOnly=true');
    expect((screen.getByLabelText('Only favorites') as HTMLInputElement).checked).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      onlyFavorites: true,
    });
  });

  it('keeps at least one media type enabled and supports images-only playback', async () => {
    const videoAssets = [{
      id: 'video-1',
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: '/video-1.mp4',
      previewUrl: '/video-1.mp4',
      thumbnailUrl: '/video-1.png',
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: '2026-07-21T06:00:00Z',
    }];
    const imageAssets = Array.from({ length: 5 }, (_, index) => ({
      id: `image-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: `/image-${index + 1}.png`,
      previewUrl: `/image-${index + 1}.png`,
      thumbnailUrl: null,
      prompt: `Image ${index + 1}`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      const type = search.get('type');
      const assets = type === 'image' ? imageAssets : videoAssets;
      return {
        ok: true,
        json: async () => ({
          success: true,
          assets,
          pagination: { page: 1, limit: 100, totalCount: assets.length, hasNextPage: false },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialVideosEnabled: false,
      initialImagesEnabled: true,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain('type=image');
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText('5 images')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('gallery-video-carousel').querySelector('img')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Include videos'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).disabled).toBe(false);
    await waitFor(() => expect(screen.getByText('1 videos · 5 images')).toBeTruthy());
  });

  it('filters carousel videos and images by selected ratio settings', async () => {
    const videoAssets = [
      {
        id: 'video-landscape',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-landscape.mp4',
        previewUrl: '/video-landscape.mp4',
        thumbnailUrl: '/video-landscape.png',
        mediaWidth: 1280,
        mediaHeight: 720,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
      {
        id: 'video-portrait',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-portrait.mp4',
        previewUrl: '/video-portrait.mp4',
        thumbnailUrl: '/video-portrait.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:01:00Z',
      },
    ];
    const imageAssets = [
      {
        id: 'image-landscape',
        workspaceId: 'ws-1',
        type: 'image',
        originalUrl: '/image-landscape.png',
        previewUrl: '/image-landscape.png',
        thumbnailUrl: null,
        prompt: 'Landscape image',
        mediaWidth: 1280,
        mediaHeight: 720,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
      {
        id: 'image-portrait',
        workspaceId: 'ws-1',
        type: 'image',
        originalUrl: '/image-portrait.png',
        previewUrl: '/image-portrait.png',
        thumbnailUrl: null,
        prompt: 'Portrait image',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:01:00Z',
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      const type = search.get('type');
      const assets = type === 'image' ? imageAssets : videoAssets;
      return {
        ok: true,
        json: async () => ({
          success: true,
          assets,
          pagination: { page: 1, limit: 100, totalCount: assets.length, hasNextPage: false },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialImagesEnabled: true,
      initialIncludeLandscape: true,
      initialIncludePortrait: false,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('1 videos · 1 images')).toBeTruthy());
    expect((screen.getByLabelText('Include landscape assets') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include portrait assets') as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(screen.getByTestId('gallery-video-carousel').querySelector('video[src="/video-landscape.mp4"]')).toBeTruthy());
    expect(screen.getByTestId('gallery-video-carousel').querySelector('video[src="/video-portrait.mp4"]')).toBeNull();

    fireEvent.click(screen.getByLabelText('Include landscape assets'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.getByText('No selected gallery media in this workspace.')).toBeTruthy());
  });
});
