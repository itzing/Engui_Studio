/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';

const pushMock = vi.hoisted(() => vi.fn());
const persistCreateReuseDraftMock = vi.hoisted(() => vi.fn());
const shareGalleryAssetMock = vi.hoisted(() => vi.fn(async () => 'url'));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/create/persistCreateReuseDraft', () => ({
  persistCreateReuseDraft: persistCreateReuseDraftMock,
}));

vi.mock('@/lib/galleryShare', () => ({
  shareGalleryAsset: shareGalleryAssetMock,
}));

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
    HTMLMediaElement.prototype.load = vi.fn();
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

  it('loads the separate Flow feed mode with persisted profile settings', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: true,
      imagesEnabled: true,
      galleryViewEnabled: false,
      onlyFavorites: false,
      flowMode: true,
      includeLandscape: true,
      includePortrait: true,
      speed: 1,
      scrubSpeedMultiplier: 4,
      flow: {
        activeProfileId: 'default',
        profiles: {
          default: {
            id: 'default',
            name: 'Default',
            orderMode: 'random',
            portraitCycles: 2,
            landscapeCycles: 3,
            slotActivationSeconds: 7,
          },
        },
      },
    }));
    const assets = [
      {
        id: 'portrait-video',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/portrait-video.mp4',
        previewUrl: '/portrait-video.mp4',
        thumbnailUrl: '/portrait-video.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
      {
        id: 'landscape-image',
        workspaceId: 'ws-1',
        type: 'image',
        originalUrl: '/landscape-image.png',
        previewUrl: '/landscape-image.png',
        thumbnailUrl: '/landscape-image.png',
        mediaWidth: 1280,
        mediaHeight: 720,
        addedToGalleryAt: '2026-07-21T06:01:00Z',
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(search.get('mode')).toBe('flow');
      expect(search.get('source')).toBe('galleryOrder');
      expect(search.get('includeVideos')).toBe('true');
      expect(search.get('includeImages')).toBe('true');
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(assets, 0),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Flow Carousel')).toBeTruthy());
    expect((screen.getByLabelText('Flow mode') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Flow settings'));
    expect(screen.getByTestId('gallery-flow-settings-panel')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('7s')).toBeTruthy();
  });

  it('uses three equal-width portrait slots while manually advancing the Flow queue', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: true,
      imagesEnabled: false,
      galleryViewEnabled: false,
      onlyFavorites: false,
      flowMode: true,
      includeLandscape: false,
      includePortrait: true,
      speed: 1,
      scrubSpeedMultiplier: 4,
      flow: {
        activeProfileId: 'default',
        profiles: {
          default: {
            id: 'default',
            name: 'Default',
            orderMode: 'order',
            portraitCycles: 1,
            landscapeCycles: 1,
            slotActivationSeconds: 7,
          },
        },
      },
    }));
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
    const assets = Array.from({ length: 3 }, (_, index) => ({
      id: `portrait-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/portrait-${index + 1}.mp4`,
      previewUrl: `/portrait-${index + 1}.mp4`,
      thumbnailUrl: `/portrait-${index + 1}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(assets, 0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      const firstPortraitSlot = await waitFor(() => {
        const video = stage.querySelector('video[src="/portrait-1.mp4"]') as HTMLVideoElement | null;
        expect(video).toBeTruthy();
        expect(video?.className).toContain('object-contain');
        return video?.parentElement as HTMLElement;
      });
      expect(firstPortraitSlot.style.width).toBe(`${1280 / 3}px`);
      expect(firstPortraitSlot.style.height).toBe('720px');
      expect(firstPortraitSlot.style.transform).toBe('translate3d(0px, 0px, 0)');

      fireEvent.click(screen.getByLabelText('Next Flow item'));
      await waitFor(() => expect(stage.querySelector('video[src="/portrait-2.mp4"]')).toBeTruthy());
      expect((stage.querySelector('video[src="/portrait-2.mp4"]')?.parentElement as HTMLElement).style.width).toBe(`${1280 / 3}px`);
      expect((stage.querySelector('video[src="/portrait-2.mp4"]')?.parentElement as HTMLElement).style.transform).toBe(`translate3d(${1280 / 3}px, 0px, 0)`);

      fireEvent.click(screen.getByLabelText('Next Flow item'));
      await waitFor(() => expect(stage.querySelector('video[src="/portrait-3.mp4"]')).toBeTruthy());
      expect((stage.querySelector('video[src="/portrait-3.mp4"]')?.parentElement as HTMLElement).style.width).toBe(`${1280 / 3}px`);
      expect((stage.querySelector('video[src="/portrait-3.mp4"]')?.parentElement as HTMLElement).style.transform).toBe(`translate3d(${(1280 / 3) * 2}px, 0px, 0)`);
      expect(stage.querySelectorAll('video')).toHaveLength(3);
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('auto-advances the Flow queue on the configured slot timer and keeps ended videos replaying', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: true,
      imagesEnabled: false,
      galleryViewEnabled: false,
      onlyFavorites: false,
      flowMode: true,
      includeLandscape: false,
      includePortrait: true,
      speed: 1,
      scrubSpeedMultiplier: 4,
      flow: {
        activeProfileId: 'default',
        profiles: {
          default: {
            id: 'default',
            name: 'Default',
            orderMode: 'order',
            portraitCycles: 1,
            landscapeCycles: 1,
            slotActivationSeconds: 3,
          },
        },
      },
    }));
    const assets = Array.from({ length: 2 }, (_, index) => ({
      id: `portrait-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/portrait-${index + 1}.mp4`,
      previewUrl: `/portrait-${index + 1}.mp4`,
      thumbnailUrl: `/portrait-${index + 1}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(assets, 0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const stage = screen.getByTestId('gallery-video-carousel');
    const playMock = vi.mocked(HTMLMediaElement.prototype.play);
    const firstVideo = await waitFor(() => {
      const video = stage.querySelector('video[src="/portrait-1.mp4"]') as HTMLVideoElement | null;
      expect(video).toBeTruthy();
      return video as HTMLVideoElement;
    });
    expect(firstVideo.loop).toBe(false);
    Object.defineProperty(firstVideo, 'duration', { configurable: true, value: 90 });
    const firstVideoPlayCountBeforeEnded = playMock.mock.contexts.filter((context) => context === firstVideo).length;
    firstVideo.currentTime = 4;

    fireEvent.ended(firstVideo);

    await waitFor(() => {
      expect(playMock.mock.contexts.filter((context) => context === firstVideo).length).toBeGreaterThan(firstVideoPlayCountBeforeEnded);
    });
    expect(firstVideo.currentTime).toBe(0);
    expect(stage.querySelector('video[src="/portrait-2.mp4"]')).toBeNull();

    await waitFor(() => expect(stage.querySelector('video[src="/portrait-2.mp4"]')).toBeTruthy(), { timeout: 4000 });
    expect((stage.querySelector('video[src="/portrait-2.mp4"]')?.parentElement as HTMLElement).style.transform).toBe(`translate3d(${1280 / 3}px, 0px, 0)`);
  });

  it('slides the Flow side panel from the right edge hover area', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: true,
      imagesEnabled: false,
      galleryViewEnabled: false,
      onlyFavorites: false,
      flowMode: true,
      includeLandscape: false,
      includePortrait: true,
      speed: 1,
      scrubSpeedMultiplier: 4,
    }));
    const assets = [
      {
        id: 'portrait-video',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/portrait-video.mp4',
        previewUrl: '/portrait-video.mp4',
        thumbnailUrl: '/portrait-video.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(assets, 0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const controls = screen.getByTestId('gallery-carousel-controls');
    const edgeHoverArea = screen.getByTestId('gallery-flow-settings-edge-hover-area');
    const panel = screen.getByTestId('gallery-flow-settings-panel');

    expect(controls.className).toContain('-translate-y-full');
    expect(panel.className).toContain('translate-x-[calc(100%+1rem)]');

    fireEvent.pointerEnter(edgeHoverArea, { pointerId: 1, pointerType: 'mouse' });
    await waitFor(() => expect(controls.className).toContain('translate-y-0'));
    expect(panel.className).toContain('translate-x-0');

    fireEvent.pointerLeave(edgeHoverArea, { pointerId: 1, pointerType: 'mouse' });
    expect(controls.className).toContain('-translate-y-full');
    expect(panel.className).toContain('translate-x-[calc(100%+1rem)]');
  });

  it('forces portrait-only filtering when launched in TikTok mode', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: true,
      imagesEnabled: false,
      galleryViewEnabled: false,
      onlyFavorites: false,
      tiktokMode: true,
      includeLandscape: true,
      includePortrait: false,
      speed: 1,
      scrubSpeedMultiplier: 4,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      expect(search.get('includeLandscape')).toBe('false');
      expect(search.get('includePortrait')).toBe('true');
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse([], 0),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialTiktokMode: true,
      initialIncludeLandscape: false,
      initialIncludePortrait: true,
      showControls: false,
      enableKeyboardControls: false,
      movementAxis: 'vertical',
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('loads only the current video and animates one item per vertical swipe in TikTok mode', async () => {
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
    const videoAssets = [1, 2, 3].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 1),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());
      expect(stage.querySelectorAll('video')).toHaveLength(1);
      const previousSlot = stage.querySelector('img[src="/video-1.png"]')?.parentElement as HTMLElement;
      const currentSlot = stage.querySelector('video[src="/video-2.mp4"]')?.parentElement as HTMLElement;
      const nextSlot = stage.querySelector('img[src="/video-3.png"]')?.parentElement as HTMLElement;
      expect(stage.querySelector('video[src="/video-2.mp4"]')?.className).toContain('object-contain');
      expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeNull();
      expect(stage.querySelector('img[src="/video-3.png"]')?.className).toContain('object-contain');
      expect(currentSlot.style.width).toBe('390px');
      expect(currentSlot.style.height).toBe('844px');
      expect(previousSlot.style.transform).toBe('translate3d(0px, -844px, 0)');
      expect(currentSlot.style.transform).toBe('translate3d(0px, 0px, 0)');
      expect(nextSlot.style.transform).toBe('translate3d(0px, 844px, 0)');
      expect(stage.querySelector('video[src="/video-2.mp4"]')?.getAttribute('preload')).toBe('auto');
      expect(screen.getAllByTestId('gallery-tiktok-video-loading')).toHaveLength(1);
      expect(screen.getAllByTestId('gallery-tiktok-video-progress')).toHaveLength(1);
      expect(screen.getAllByTestId('gallery-tiktok-video-poster')).toHaveLength(3);
      expect(stage.querySelector('img[src="/video-2.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-3.png"]')).toBeTruthy();

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 700 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });
      expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy();
      expect((stage.querySelector('video[src="/video-2.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, -200px, 0)');
      expect((stage.querySelector('img[src="/video-3.png"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 644px, 0)');
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });

      await waitFor(() => expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeTruthy());
      await waitFor(() => expect((stage.querySelector('video[src="/video-3.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      const targetVideo = stage.querySelector('video[src="/video-3.mp4"]') as HTMLVideoElement;
      Object.defineProperty(targetVideo, 'duration', { configurable: true, value: 10 });
      Object.defineProperty(targetVideo, 'buffered', {
        configurable: true,
        value: {
          length: 1,
          end: () => 5,
        },
      });
      fireEvent.progress(targetVideo);
      await waitFor(() => expect(screen.getAllByTestId('gallery-tiktok-video-progress').some((node) => (node as HTMLElement).dataset.progress === '0.50')).toBe(true));
      fireEvent.loadedData(targetVideo);
      await waitFor(() => expect(stage.querySelector('img[src="/video-3.png"]')).toBeNull());
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      });

      fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 300 });
      fireEvent.pointerMove(stage, { pointerId: 2, pointerType: 'touch', clientX: 202, clientY: 500 });
      fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'touch', clientX: 202, clientY: 500 });

      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());
      await waitFor(() => expect((stage.querySelector('video[src="/video-2.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('toggles TikTok action controls on tap and hides them on swipe', async () => {
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
    const videoAssets = [1, 2, 3].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      modelId: 'wan22',
      favorited: false,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/favorite')) {
        expect(init?.body).toBe(JSON.stringify({ favorited: true }));
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url.includes('/reuse')) {
        expect(init?.body).toBe(JSON.stringify({ action: 'img2vid' }));
        return { ok: true, json: async () => ({ success: true, payload: { action: 'img2vid', type: 'video' } }) };
      }
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(videoAssets, 1),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());

      fireEvent.click(stage);
      expect(screen.getByTestId('gallery-tiktok-action-controls')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Add to favorites' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'To txt2img' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'To img2vid' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'To T2V' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Add to favorites' }));
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/gallery/assets/video-2/favorite', expect.any(Object)));
      expect(screen.getByRole('button', { name: 'Remove from favorites' })).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
      await waitFor(() => expect(shareGalleryAssetMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'video-2', type: 'video' })));

      fireEvent.click(screen.getByRole('button', { name: 'To img2vid' }));
      await waitFor(() => expect(persistCreateReuseDraftMock).toHaveBeenCalledWith({ action: 'img2vid', type: 'video' }));
      expect(pushMock).toHaveBeenCalledWith('/m/create');

      fireEvent.click(stage);
      expect(screen.queryByTestId('gallery-tiktok-action-controls')).toBeNull();

      fireEvent.click(stage);
      expect(screen.getByTestId('gallery-tiktok-action-controls')).toBeTruthy();
      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 700 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });
      expect(screen.queryByTestId('gallery-tiktok-action-controls')).toBeNull();
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('shows T2V-specific TikTok action controls for T2V videos', async () => {
    const videoAssets = [{
      id: 'video-t2v',
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: '/video-t2v.mp4',
      previewUrl: '/video-t2v.mp4',
      thumbnailUrl: '/video-t2v.png',
      modelId: 'wan22-t2v',
      favorited: false,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: '2026-07-21T06:00:00Z',
    }];
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
    })));

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialTiktokMode: true,
      initialVideosEnabled: true,
      initialImagesEnabled: false,
      initialIncludeLandscape: false,
      initialIncludePortrait: true,
      showControls: false,
      enableKeyboardControls: false,
      movementAxis: 'vertical',
    }));

    const stage = await screen.findByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video[src="/video-t2v.mp4"]')).toBeTruthy());
    fireEvent.click(stage);

    expect(screen.getByRole('button', { name: 'To txt2img' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'To img2vid' })).toBeNull();
    expect(screen.getByRole('button', { name: 'To T2V' })).toBeTruthy();
  });

  it('keeps only the current TikTok video mounted and uses poster-only neighbors', async () => {
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
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    const videoAssets = Array.from({ length: 7 }, (_, index) => ({
      id: `video-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index + 1}.mp4`,
      previewUrl: `/video-${index + 1}.mp4`,
      thumbnailUrl: `/video-${index + 1}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 3),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-4.mp4"]')).toBeTruthy());
      expect(stage.querySelectorAll('video')).toHaveLength(1);
      expect(stage.querySelector('video[src="/video-3.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-5.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-6.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-4.mp4"]')?.className).toContain('object-contain');
      expect(stage.querySelector('img[src="/video-3.png"]')?.className).toContain('object-contain');
      expect(stage.querySelector('img[src="/video-5.png"]')?.className).toContain('object-contain');
      expect(stage.querySelector('img[src="/video-1.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-2.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-6.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-7.png"]')).toBeTruthy();
      expect(loadSpy).toHaveBeenCalledTimes(1);

      const initialCurrentVideo = stage.querySelector('video[src="/video-4.mp4"]') as HTMLVideoElement;
      fireEvent.loadedData(initialCurrentVideo);

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 700 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });

      await waitFor(() => expect((stage.querySelector('video[src="/video-5.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      });
      expect(initialCurrentVideo.hasAttribute('src')).toBe(false);
      expect(stage.querySelectorAll('video')).toHaveLength(1);
      expect(stage.querySelector('video[src="/video-5.mp4"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-5.png"]')).toBeTruthy();
      expect(stage.querySelector('video[src="/video-6.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-7.mp4"]')).toBeNull();
      expect(stage.querySelector('img[src="/video-7.png"]')).toBeTruthy();

      const secondCurrentVideo = stage.querySelector('video[src="/video-5.mp4"]') as HTMLVideoElement;
      fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 300 });
      fireEvent.pointerMove(stage, { pointerId: 2, pointerType: 'touch', clientX: 202, clientY: 500 });
      fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'touch', clientX: 202, clientY: 500 });

      await waitFor(() => expect((stage.querySelector('video[src="/video-4.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      });
      expect(secondCurrentVideo.hasAttribute('src')).toBe(false);
      expect(stage.querySelectorAll('video')).toHaveLength(1);
      expect(stage.querySelector('video[src="/video-4.mp4"]')).toBeTruthy();
    } finally {
      loadSpy.mockRestore();
      rectSpy.mockRestore();
    }
  });

  it('keeps pending thumbnail posters visible while triggering targeted TikTok poster backfill', async () => {
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
    const videoAssets = Array.from({ length: 7 }, (_, index) => ({
      id: `video-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index + 1}.mp4`,
      previewUrl: `/video-${index + 1}.mp4`,
      thumbnailUrl: `/gallery-thumb-${index + 1}.webp`,
      derivativeStatus: 'pending',
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/gallery/assets/derivatives/backfill')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            processed: 1,
            results: [{ id: 'video-6', derivativeStatus: 'completed', previewUrl: '/video-6.mp4', thumbnailUrl: '/poster-video-6.jpg' }],
          }),
        };
      }
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(videoAssets, 3),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      const stage = await screen.findByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-4.mp4"]')).toBeTruthy());
      await waitFor(() => expect(
        stage.querySelector('img[src="/gallery-thumb-6.webp"], img[src="/poster-video-6.jpg"]'),
      ).toBeTruthy());
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        '/api/gallery/assets/derivatives/backfill',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"assetIds"'),
        }),
      ));
      await waitFor(() => expect(stage.querySelector('img[src="/poster-video-6.jpg"]')).toBeTruthy());
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('plays a TikTok neighbor only after it becomes current and clears distant slots', async () => {
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
    const playCalls: string[] = [];
    HTMLMediaElement.prototype.play = vi.fn(function (this: HTMLMediaElement) {
      playCalls.push(this.getAttribute('src') || '');
      return Promise.resolve();
    }) as unknown as typeof HTMLMediaElement.prototype.play;
    const videoAssets = Array.from({ length: 12 }, (_, index) => ({
      id: `video-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index + 1}.mp4`,
      previewUrl: `/video-${index + 1}.mp4`,
      thumbnailUrl: `/video-${index + 1}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 5),
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-6.mp4"]')).toBeTruthy());
      await waitFor(() => expect(playCalls).toContain('/video-6.mp4'));
      expect(stage.querySelector('video[src="/video-6.mp4"]')?.className).toContain('object-contain');
      expect(stage.querySelectorAll('video')).toHaveLength(1);
      expect(stage.querySelector('video[src="/video-5.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-7.mp4"]')).toBeNull();
      expect(playCalls).not.toContain('/video-5.mp4');
      expect(playCalls).not.toContain('/video-7.mp4');
      expect(stage.querySelector('video[src="/video-4.mp4"]')).toBeNull();
      expect(stage.querySelector('video[src="/video-8.mp4"]')).toBeNull();
      expect(stage.querySelector('img[src="/video-1.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-2.png"]')?.className).toContain('object-contain');
      expect(stage.querySelector('img[src="/video-8.png"]')?.className).toContain('object-contain');
      expect(stage.querySelector('img[src="/video-11.png"]')).toBeTruthy();
      expect(stage.querySelector('img[src="/video-12.png"]')).toBeNull();

      fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'touch', clientX: 200, clientY: 700 });
      fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });
      fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'touch', clientX: 202, clientY: 500 });

      await waitFor(() => expect((stage.querySelector('video[src="/video-7.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      await waitFor(() => expect(playCalls).toContain('/video-7.mp4'));
      expect(stage.querySelector('img[src="/video-7.png"]')).toBeTruthy();
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      });
      expect(stage.querySelector('img[src="/video-1.png"]')).toBeNull();
      expect(stage.querySelector('img[src="/video-12.png"]')).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('shows the poster again when a cleaned TikTok video remounts after repeated three-step swipes', async () => {
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
    const videoAssets = Array.from({ length: 8 }, (_, index) => ({
      id: `video-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index + 1}.mp4`,
      previewUrl: `/video-${index + 1}.mp4`,
      thumbnailUrl: `/video-${index + 1}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const swipe = async (stage: HTMLElement, direction: 'down' | 'up', pointerId: number) => {
      const startY = direction === 'down' ? 700 : 300;
      const endY = direction === 'down' ? 500 : 500;
      fireEvent.pointerDown(stage, { pointerId, pointerType: 'touch', clientX: 200, clientY: startY });
      fireEvent.pointerMove(stage, { pointerId, pointerType: 'touch', clientX: 202, clientY: endY });
      fireEvent.pointerUp(stage, { pointerId, pointerType: 'touch', clientX: 202, clientY: endY });
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
      });
    };

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const stage = screen.getByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());
      fireEvent.loadedData(stage.querySelector('video[src="/video-1.mp4"]') as HTMLVideoElement);
      await waitFor(() => expect(stage.querySelector('img[src="/video-1.png"]')).toBeNull());

      await swipe(stage, 'down', 1);
      await swipe(stage, 'down', 2);
      await swipe(stage, 'down', 3);
      await waitFor(() => expect((stage.querySelector('video[src="/video-4.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeNull();
      expect(stage.querySelector('img[src="/video-1.png"]')).toBeTruthy();

      await swipe(stage, 'up', 4);
      await swipe(stage, 'up', 5);
      await swipe(stage, 'up', 6);
      await waitFor(() => expect((stage.querySelector('video[src="/video-1.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      expect(stage.querySelector('img[src="/video-1.png"]')).toBeTruthy();

      fireEvent.loadedData(stage.querySelector('video[src="/video-1.mp4"]') as HTMLVideoElement);
      await waitFor(() => expect(stage.querySelector('img[src="/video-1.png"]')).toBeNull());

      await swipe(stage, 'down', 7);
      await swipe(stage, 'down', 8);
      await swipe(stage, 'down', 9);
      await waitFor(() => expect((stage.querySelector('video[src="/video-4.mp4"]')?.parentElement as HTMLElement).style.transform).toBe('translate3d(0px, 0px, 0)'));
      expect(stage.querySelector('img[src="/video-4.png"]')).toBeTruthy();
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('retries only the stuck current TikTok video', async () => {
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
    const retryCallbacks: Array<() => void> = [];
    const realSetTimeout = window.setTimeout.bind(window);
    const timeoutSpy = vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler, timeout?: number) => {
      if (timeout === 9000 && typeof handler === 'function') {
        retryCallbacks.push(() => handler());
        return 10000 + retryCallbacks.length;
      }
      return realSetTimeout(handler, timeout);
    }) as typeof window.setTimeout);
    const loadCalls: string[] = [];
    HTMLMediaElement.prototype.load = vi.fn(function (this: HTMLMediaElement) {
      loadCalls.push(this.getAttribute('src') || '');
    }) as unknown as typeof HTMLMediaElement.prototype.load;
    const videoAssets = [1, 2, 3].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 1),
    })));

    try {
      render(React.createElement(GalleryVideoCarousel, {
        workspaceId: 'ws-1',
        initialTiktokMode: true,
        initialVideosEnabled: true,
        initialImagesEnabled: false,
        initialIncludeLandscape: false,
        initialIncludePortrait: true,
        showControls: false,
        enableKeyboardControls: false,
        movementAxis: 'vertical',
      }));

      const stage = await screen.findByTestId('gallery-video-carousel');
      await waitFor(() => expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy());
      await waitFor(() => expect(retryCallbacks.length).toBeGreaterThan(0));

      const initialCurrentLoads = loadCalls.filter((src) => src === '/video-2.mp4').length;
      const initialPreviousLoads = loadCalls.filter((src) => src === '/video-1.mp4').length;
      const initialNextLoads = loadCalls.filter((src) => src === '/video-3.mp4').length;

      act(() => {
        retryCallbacks[retryCallbacks.length - 1]?.();
      });

      await waitFor(() => expect(loadCalls.filter((src) => src === '/video-2.mp4').length).toBeGreaterThan(initialCurrentLoads));
      expect(loadCalls.filter((src) => src === '/video-1.mp4')).toHaveLength(initialPreviousLoads);
      expect(loadCalls.filter((src) => src === '/video-3.mp4')).toHaveLength(initialNextLoads);
      expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy();
    } finally {
      timeoutSpy.mockRestore();
      rectSpy.mockRestore();
    }
  });

  it('loads all videos and pauses carousel movement without pausing visible videos', async () => {
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
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    fireEvent.click(screen.getByTestId('gallery-video-carousel'));

    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
    expect(screen.getByText('Movement paused')).toBeTruthy();
    expect(within(screen.getByTestId('gallery-video-carousel')).queryByText('Paused')).toBeNull();
    expect(screen.getByTestId('gallery-video-carousel').querySelector('video[src="/video-1.mp4"]')?.className).toContain('object-cover');
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
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    const videoAssets = [1, 2, 3].map((index) => ({
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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    ];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
    const videoAssets = [1, 2, 3].map((index) => ({
      id: `video-${index}`,
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: `/video-${index}.mp4`,
      previewUrl: `/video-${index}.mp4`,
      thumbnailUrl: `/video-${index}.png`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => makeCarouselWindowResponse(videoAssets, 0),
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
      const assets = [
        ...(search.get('includeVideos') === 'true' ? videoAssets : []),
        ...(search.get('includeImages') === 'true' ? imageAssets : []),
      ];
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(assets, 0),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/carousel/feed-window');
    expect(String(fetchMock.mock.calls[0][0])).toContain('source=shuffle');
    expect(String(fetchMock.mock.calls[0][0])).toContain('includeVideos=true');
    expect(String(fetchMock.mock.calls[0][0])).toContain('includeImages=false');
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1][0])).toContain('includeImages=true');
    await waitFor(() => expect(screen.getByText('2 videos · 5 images')).toBeTruthy());
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      videosEnabled: true,
      imagesEnabled: true,
    });

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(videoAssets, 0),
      };
    });
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
      const assets = [
        ...(search.get('includeVideos') === 'true' ? videoAssets : []),
        ...(search.get('includeImages') === 'true' ? imageAssets : []),
      ];
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(assets, 0),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialVideosEnabled: false,
      initialImagesEnabled: true,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain('includeVideos=false');
    expect(String(fetchMock.mock.calls[0][0])).toContain('includeImages=true');
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText('5 images')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('gallery-video-carousel').querySelector('img')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Include videos'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
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
      const includeLandscape = search.get('includeLandscape') === 'true';
      const includePortrait = search.get('includePortrait') === 'true';
      const filterByRatio = (asset: any) => {
        const isLandscape = asset.mediaWidth >= asset.mediaHeight;
        return isLandscape ? includeLandscape : includePortrait;
      };
      const assets = [
        ...(search.get('includeVideos') === 'true' ? videoAssets.filter(filterByRatio) : []),
        ...(search.get('includeImages') === 'true' ? imageAssets.filter(filterByRatio) : []),
      ];
      return {
        ok: true,
        json: async () => makeCarouselWindowResponse(assets, 0),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, {
      workspaceId: 'ws-1',
      initialImagesEnabled: true,
      initialIncludeLandscape: true,
      initialIncludePortrait: false,
    }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos · 1 images')).toBeTruthy());
    expect((screen.getByLabelText('Include landscape assets') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include portrait assets') as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(screen.getByTestId('gallery-video-carousel').querySelector('video[src="/video-landscape.mp4"]')).toBeTruthy());
    expect(screen.getByTestId('gallery-video-carousel').querySelector('video[src="/video-portrait.mp4"]')).toBeNull();

    fireEvent.click(screen.getByLabelText('Include landscape assets'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText('No selected gallery media in this workspace.')).toBeTruthy());
  });
});
