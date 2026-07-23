/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockLightboxProps = {
  open?: boolean;
  render?: {
    controls?: () => React.ReactNode;
    slideContainer?: (args: { children: React.ReactNode }) => React.ReactElement;
  };
};

vi.mock('yet-another-react-lightbox', async () => {
  const ReactModule = await vi.importActual<typeof import('react')>('react');
  const ReactActual = ReactModule.default;

  return {
    default: (props: MockLightboxProps) => {
      if (!props.open) return null;

      const slide = ReactActual.createElement('div', null, 'slide');
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

import { GalleryFullscreenViewer } from '@/components/workspace/GalleryFullscreenViewer';

const items = [
  { id: 'asset-1', url: '/asset-1.jpg', type: 'image' as const },
  { id: 'asset-2', url: '/asset-2.jpg', type: 'image' as const },
  { id: 'asset-3', url: '/asset-3.jpg', type: 'image' as const },
];

describe('GalleryFullscreenViewer touch swipe navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    window.localStorage.clear();
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
});
