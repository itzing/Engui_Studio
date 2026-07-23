/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';

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
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as any;
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('restores persisted carousel settings for the workspace device', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: false,
      imagesEnabled: true,
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
      expect(search.get('type')).toBe('image');
      return {
        ok: true,
        json: async () => ({
          success: true,
          assets: imageAssets,
          pagination: { page: 1, limit: 100, totalCount: imageAssets.length, hasNextPage: false },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('5 images')).toBeTruthy());
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
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

  it('fills the fullscreen viewport and lets users hide and reveal carousel controls', async () => {
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
    const controls = screen.getByTestId('gallery-carousel-controls');
    expect(stage.className).toContain('h-full');
    expect(stage.className).toContain('min-h-[100dvh]');
    await waitFor(() => expect(stage.querySelector('video')?.parentElement?.style.transform).toContain('translate3d'));

    fireEvent.click(screen.getByRole('button', { name: 'Hide carousel controls' }));
    expect(controls.className).toContain('opacity-0');
    expect(screen.queryByText('1 videos')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(stage));

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 200 });
    await waitFor(() => expect(controls.className).toContain('opacity-100'));
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide carousel controls' }));
    await waitFor(() => expect(document.activeElement).toBe(stage));
    const slot = stage.querySelector('video')?.parentElement as HTMLElement;
    const pausedTransform = slot.style.transform;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(slot.style.transform).not.toBe(pausedTransform));
    fireEvent.keyUp(window, { key: 'ArrowRight' });

    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 200 });
    await waitFor(() => expect(controls.className).toContain('opacity-100'));

    fireEvent.keyDown(window, { key: 'h' });
    expect(controls.className).toContain('opacity-0');

    fireEvent.keyDown(window, { key: 'H' });
    expect(controls.className).toContain('opacity-100');
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
