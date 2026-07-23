/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStudio = vi.hoisted(() => ({
  current: {
    activeWorkspaceId: 'ws-1',
    workspaces: [{ id: 'ws-1' }],
  },
}));

const mockCarousel = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => mockStudio.current,
}));

vi.mock('@/components/workspace/GalleryVideoCarousel', () => ({
  GalleryVideoCarousel: (props: Record<string, unknown>) => {
    mockCarousel.props = props;
    return React.createElement('div', { 'data-testid': 'mock-gallery-video-carousel' }, 'carousel-player');
  },
}));

import MobileGalleryCarouselScreen from '@/components/mobile/gallery/MobileGalleryCarouselScreen';
import { getMobileTabForPathname, mobileNavItems } from '@/components/mobile/mobileNavigation';

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

describe('mobile Gallery carousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    mockCarousel.props = null;
    mockStudio.current = {
      activeWorkspaceId: 'ws-1',
      workspaces: [{ id: 'ws-1' }],
    };
    setViewport(390, 844);
  });

  it('restores carousel settings from local device storage', async () => {
    window.localStorage.setItem('engui.gallery.carousel.settings.ws-1', JSON.stringify({
      videosEnabled: false,
      imagesEnabled: true,
      includeLandscape: true,
      includePortrait: false,
      speed: 1.6,
      scrubSpeedMultiplier: 7,
    }));
    setViewport(844, 390);

    render(React.createElement(MobileGalleryCarouselScreen));

    await waitFor(() => expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false));
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Include landscape assets') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include portrait assets') as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText('1.6x')).toBeTruthy();
    expect(screen.getByText('7x')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByTestId('mock-gallery-video-carousel')).toBeTruthy());
    expect(mockCarousel.props).toMatchObject({
      initialVideosEnabled: false,
      initialImagesEnabled: true,
      initialIncludeLandscape: true,
      initialIncludePortrait: false,
      initialSpeed: 1.6,
      initialScrubSpeedMultiplier: 7,
    });
  });

  it('adds Carousel between Jobs and Gallery in mobile navigation', () => {
    expect(mobileNavItems.map((item) => item.id)).toEqual(['create', 'jobs', 'carousel', 'gallery']);
    expect(getMobileTabForPathname('/m/carousel')).toBe('carousel');
  });

  it('starts with a portrait rotate-phone gate and closes back to settings', () => {
    render(React.createElement(MobileGalleryCarouselScreen));

    expect(screen.getByText('Carousel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(screen.getByTestId('mobile-gallery-carousel-overlay')).toBeTruthy();
    expect(screen.getByText('Поверните телефон')).toBeTruthy();
    expect(screen.queryByTestId('mock-gallery-video-carousel')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByTestId('mobile-gallery-carousel-overlay')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });

  it('renders the fullscreen player in landscape with selected settings', async () => {
    setViewport(844, 390);
    render(React.createElement(MobileGalleryCarouselScreen));

    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('Include image slots'));
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).disabled).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      videosEnabled: true,
      imagesEnabled: true,
    });
    fireEvent.click(screen.getByLabelText('Include videos'));
    expect((screen.getByLabelText('Include videos') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('engui.gallery.carousel.settings.ws-1') || '{}')).toMatchObject({
      videosEnabled: false,
      imagesEnabled: true,
    });
    expect((screen.getByLabelText('Include landscape assets') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Include portrait assets') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText('Include portrait assets'));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(screen.getByTestId('mock-gallery-video-carousel')).toBeTruthy());
    expect(screen.queryByText('Поверните телефон')).toBeNull();
    expect(mockCarousel.props).toMatchObject({
      workspaceId: 'ws-1',
      initialVideosEnabled: false,
      initialImagesEnabled: true,
      initialIncludeLandscape: true,
      initialIncludePortrait: false,
      initialSpeed: 1,
      initialScrubSpeedMultiplier: 4,
      showControls: false,
      enableKeyboardControls: false,
    });
  });

  it('closes the landscape player with a vertical swipe instead of a visible close button', async () => {
    setViewport(844, 390);
    render(React.createElement(MobileGalleryCarouselScreen));

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    await screen.findByTestId('mobile-gallery-carousel-overlay');
    const swipeSurface = screen.getByTestId('mobile-gallery-carousel-swipe-surface');

    expect(screen.queryByRole('button', { name: 'Close carousel' })).toBeNull();

    fireEvent.pointerDown(swipeSurface, {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 400,
      clientY: 220,
    });
    fireEvent.pointerMove(swipeSurface, {
      pointerId: 7,
      pointerType: 'touch',
      clientX: 402,
      clientY: 120,
    });

    await waitFor(() => expect(screen.queryByTestId('mobile-gallery-carousel-overlay')).toBeNull());
    expect(screen.getByRole('button', { name: 'Start' })).toBeTruthy();
  });
});
