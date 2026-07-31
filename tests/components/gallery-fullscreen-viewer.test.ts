/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockShareGalleryAsset = vi.hoisted(() => vi.fn().mockResolvedValue('file'));

type MockLightboxProps = {
  open?: boolean;
  index?: number;
  slides?: Array<unknown>;
  render?: {
    controls?: () => React.ReactNode;
    slide?: (args: { slide: unknown }) => React.ReactNode;
    slideContainer?: (args: { children: React.ReactNode }) => React.ReactElement;
  };
};

vi.mock('yet-another-react-lightbox', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const ReactActual = ReactModule.default;

  return {
    default: (props: MockLightboxProps) => {
      if (!props.open) return null;

      const currentSlide = props.slides?.[props.index ?? 0] || {};
      const slide = props.render?.slide?.({ slide: currentSlide }) || ReactActual.createElement('div', null, 'slide');
      const wrappedSlide = props.render?.slideContainer?.({ children: slide }) || slide;
      const swipeSurface = ReactActual.isValidElement(wrappedSlide)
        ? ReactActual.cloneElement(wrappedSlide as React.ReactElement<Record<string, unknown>>, { 'data-testid': 'swipe-surface' })
        : wrappedSlide;

      return ReactActual.createElement(
        'div',
        { 'data-testid': 'mock-lightbox' },
        swipeSurface,
        props.render?.controls?.(),
      );
    },
  };
});

vi.mock('yet-another-react-lightbox/plugins/zoom', () => ({
  default: vi.fn(),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/lib/galleryShare', () => ({
  shareGalleryAsset: mockShareGalleryAsset,
}));

import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';

const items = [
  { id: 'asset-1', url: '/asset-1.jpg', type: 'image' as const },
  { id: 'asset-2', url: '/asset-2.jpg', type: 'image' as const },
  { id: 'asset-3', url: '/asset-3.jpg', type: 'image' as const },
];

describe('GalleryFullscreenViewer touch swipe navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShareGalleryAsset.mockResolvedValue('file');
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    window.localStorage.clear();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: vi.fn().mockResolvedValue(undefined) });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
  });

  it('keeps desktop-width touch swipes disabled by default', async () => {
    const onIndexChange = vi.fn();

    render(React.createElement(GalleryFullscreenViewer, {
      open: true,
      items,
      currentIndex: 1,
      onIndexChange,
      onClose: vi.fn(),
    }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous image' })).toBeTruthy());

    const swipeSurface = screen.getByTestId('swipe-surface');
    fireEvent.touchStart(swipeSurface, { touches: [{ clientX: 500, clientY: 200 }] });
    fireEvent.touchEnd(swipeSurface, { changedTouches: [{ clientX: 420, clientY: 202 }] });

    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('uses the iPad opt-in to navigate desktop-width viewers with left and right swipes', async () => {
    const onIndexChange = vi.fn();

    render(React.createElement(GalleryFullscreenViewer, {
      open: true,
      items,
      currentIndex: 1,
      onIndexChange,
      onClose: vi.fn(),
      enableTouchSwipeNavigation: true,
    }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Next image' })).toBeTruthy());

    const swipeSurface = screen.getByTestId('swipe-surface');
    fireEvent.touchStart(swipeSurface, { touches: [{ clientX: 500, clientY: 200 }] });
    fireEvent.touchEnd(swipeSurface, { changedTouches: [{ clientX: 420, clientY: 202 }] });
    fireEvent.touchStart(swipeSurface, { touches: [{ clientX: 500, clientY: 200 }] });
    fireEvent.touchEnd(swipeSurface, { changedTouches: [{ clientX: 560, clientY: 198 }] });

    expect(onIndexChange).toHaveBeenNthCalledWith(1, 2);
    expect(onIndexChange).toHaveBeenNthCalledWith(2, 0);
  });

  it('autoplays looped active videos without native controls until the video is tapped', async () => {
    const videoItems = [
      { id: 'asset-1', url: '/asset-1.jpg', type: 'image' as const },
      { id: 'asset-2', url: '/asset-2.mp4', posterUrl: '/asset-2.jpg', type: 'video' as const },
    ];

    render(React.createElement(GalleryFullscreenViewer, {
      open: true,
      items: videoItems,
      currentIndex: 1,
      onIndexChange: vi.fn(),
      onClose: vi.fn(),
    }));

    const video = await screen.findByTestId('gallery-fullscreen-video');

    expect(video.getAttribute('src')).toBe('/asset-2.mp4');
    expect(video.getAttribute('poster')).toBe('/asset-2.jpg');
    expect(video.hasAttribute('autoplay')).toBe(true);
    expect(video.hasAttribute('loop')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video.hasAttribute('controls')).toBe(false);

    fireEvent.click(video.parentElement as HTMLElement);

    await waitFor(() => expect(video.hasAttribute('controls')).toBe(true));
  });

  it('shows Share for image and video slides and shares the current item URL', async () => {
    render(React.createElement(GalleryFullscreenViewer, {
      open: true,
      items,
      currentIndex: 1,
      onIndexChange: vi.fn(),
      onClose: vi.fn(),
      onToggleFavorite: vi.fn(),
    }));

    const shareButton = await screen.findByRole('button', { name: 'Share gallery item' });
    fireEvent.click(shareButton);

    await waitFor(() => expect(mockShareGalleryAsset).toHaveBeenCalledWith({
      id: 'asset-2',
      type: 'image',
      originalUrl: '/asset-2.jpg',
      title: 'Gallery Asset',
    }));
  });

  it('does not show Share for audio slides', async () => {
    render(React.createElement(GalleryFullscreenViewer, {
      open: true,
      items: [{ id: 'audio-1', url: '/audio.mp3', type: 'audio' as const }],
      currentIndex: 0,
      onIndexChange: vi.fn(),
      onClose: vi.fn(),
      onToggleFavorite: vi.fn(),
    }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Share gallery item' })).toBeNull());
  });
});
