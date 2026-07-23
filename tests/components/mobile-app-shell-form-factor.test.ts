/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/mobile/MobileBottomNav', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'mobile-bottom-nav' }, 'bottom-nav'),
}));

import MobileAppShell from '@/components/mobile/MobileAppShell';

function setViewport(width: number, height: number, touch = true) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touch ? 5 : 0 });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: touch && query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('MobileAppShell form-factor gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps phone portrait on the normal mobile shell', () => {
    setViewport(390, 844);

    render(React.createElement(MobileAppShell, null, React.createElement('main', null, 'phone-ui')));

    expect(screen.getByText('phone-ui')).toBeTruthy();
    expect(screen.getByTestId('mobile-bottom-nav')).toBeTruthy();
    expect(screen.queryByText('Rotate your phone')).toBeNull();
  });

  it('blocks phone landscape with a rotate-phone panel', () => {
    setViewport(844, 390);

    render(React.createElement(MobileAppShell, null, React.createElement('main', null, 'phone-ui')));

    expect(screen.getByText('Rotate your phone')).toBeTruthy();
    expect(screen.queryByText('phone-ui')).toBeNull();
    expect(screen.queryByTestId('mobile-bottom-nav')).toBeNull();
  });

  it('blocks tablet portrait with a rotate-to-landscape panel', () => {
    setViewport(768, 1024);

    render(React.createElement(MobileAppShell, null, React.createElement('main', null, 'tablet-ui')));

    expect(screen.getByText('Rotate to landscape')).toBeTruthy();
    expect(screen.queryByText('tablet-ui')).toBeNull();
  });

  it('lets tablet landscape render without the phone bottom navigation', () => {
    setViewport(1024, 768);

    render(React.createElement(MobileAppShell, null, React.createElement('main', null, 'tablet-ui')));

    expect(screen.getByText('tablet-ui')).toBeTruthy();
    expect(screen.queryByTestId('mobile-bottom-nav')).toBeNull();
    expect(screen.queryByText('Rotate to landscape')).toBeNull();
  });
});
