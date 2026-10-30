/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  pathname: '/m/create', mode: 'image', navigations: [] as string[], save: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => fixture.pathname }));
vi.mock('next/link', () => ({
  default: ({ href, onClick, children, ...props }: any) => React.createElement('a', {
    ...props, href, onClick: (event: React.MouseEvent) => {
      onClick?.(event);
      if (!event.defaultPrevented) fixture.navigations.push(href);
      event.preventDefault();
    },
  }, children),
}));
vi.mock('@/hooks/mobile/useViewportFormFactor', () => ({ useViewportFormFactor: () => 'phone-portrait' }));
vi.mock('@/lib/createDrafts', () => ({
  getActiveMode: () => fixture.mode,
  setActiveMode: (mode: string) => { fixture.mode = mode; fixture.save(mode); },
}));
vi.mock('@/components/mobile/create/MobileCreateHome', () => ({
  default: ({ onModeChange }: any) => React.createElement('section', null,
    'Image form', React.createElement('button', { onClick: () => onModeChange('video') }, 'Top Video')),
}));
vi.mock('@/components/mobile/create/MobileCreateModeBar', () => ({
  default: ({ onModeChange }: any) => React.createElement('button', { onClick: () => onModeChange('image') }, 'Top Image'),
}));
vi.mock('@/components/mobile/tablet/TabletCreateWorkspace', () => ({ default: () => null }));
vi.mock('@/components/forms/VideoGenerationForm', () => ({ default: () => React.createElement('section', null, 'Video form') }));
vi.mock('@/components/forms/AudioGenerationForm', () => ({ default: () => React.createElement('section', null, 'Audio form') }));
vi.mock('@/components/forms/MusicGenerationForm', () => ({ default: () => React.createElement('section', null, 'Music form') }));

import MobileCreatePage from '@/app/m/create/page';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

beforeEach(() => { vi.stubGlobal('React', React); fixture.pathname = '/m/create'; fixture.mode = 'image'; fixture.navigations = []; vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Mobile Create tab reselect', () => {
  it('toggles both ways through the real page, shell and navigation without navigating', () => {
    render(React.createElement(MobileCreatePage));
    const create = screen.getByRole('link', { name: 'Create', exact: true });
    expect(screen.getByText('Image form')).toBeTruthy();
    fireEvent.click(create);
    expect(screen.getByText('Video form')).toBeTruthy();
    expect(fixture.mode).toBe('video');
    fireEvent.click(create);
    expect(screen.getByText('Image form')).toBeTruthy();
    expect(fixture.save.mock.calls).toEqual([['video'], ['image']]);
    expect(fixture.navigations).toEqual([]);
    expect(create.getAttribute('aria-current')).toBe('page');
  });

  it('uses the persisted mode and stays in sync with the top mode controls', () => {
    fixture.mode = 'video';
    render(React.createElement(MobileCreatePage));
    expect(screen.getByText('Video form')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Top Image' }));
    fireEvent.click(screen.getByRole('link', { name: 'Create', exact: true }));
    expect(screen.getByText('Video form')).toBeTruthy();
    expect(fixture.mode).toBe('video');
  });

  it.each(['tts', 'music'])('returns %s to Image on reselect', (mode) => {
    fixture.mode = mode;
    render(React.createElement(MobileCreatePage));
    fireEvent.click(screen.getByRole('link', { name: 'Create', exact: true }));
    expect(screen.getByText('Image form')).toBeTruthy();
    expect(fixture.mode).toBe('image');
  });

  it.each(['/m/jobs', '/m/gallery', '/m/carousel', '/m/create/prompt', '/m/create/advanced'])('keeps normal Create navigation from %s', (pathname) => {
    fixture.pathname = pathname;
    const onCreateReselect = vi.fn();
    render(React.createElement(MobileBottomNav, { onCreateReselect }));
    fireEvent.click(screen.getByRole('link', { name: 'Create', exact: true }));
    expect(onCreateReselect).not.toHaveBeenCalled();
    expect(fixture.navigations).toEqual(['/m/create']);
  });

  it.each(['metaKey', 'ctrlKey', 'shiftKey', 'altKey'])('preserves modified link behavior with %s', (key) => {
    render(React.createElement(MobileCreatePage));
    fireEvent.click(screen.getByRole('link', { name: 'Create', exact: true }), { [key]: true });
    expect(fixture.save).not.toHaveBeenCalled();
    expect(fixture.navigations).toEqual(['/m/create']);
  });

  it('keeps other tabs navigable and leaves mode unchanged', () => {
    render(React.createElement(MobileCreatePage));
    fireEvent.click(screen.getByRole('link', { name: 'Jobs', exact: true }));
    expect(fixture.save).not.toHaveBeenCalled();
    expect(fixture.navigations).toEqual(['/m/jobs']);
  });

  it('keeps the default Create link when no reselect handler is supplied', () => {
    render(React.createElement(MobileBottomNav));
    fireEvent.click(screen.getByRole('link', { name: 'Create', exact: true }));
    expect(fixture.navigations).toEqual(['/m/create']);
  });
});
