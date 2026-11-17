/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from '@/lib/context/StudioContext';

const fixture = vi.hoisted(() => ({
  jobs: [] as Job[], jobsLoaded: true, jobsSyncVersion: 1, activeWorkspaceId: 'ws-one',
  pathname: '/m/gallery', push: vi.fn(),
}));
vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => fixture }));
vi.mock('next/navigation', () => ({
  usePathname: () => fixture.pathname, useRouter: () => ({ push: fixture.push }),
}));
vi.mock('next/link', () => ({ default: ({ children, href, ...props }: any) => React.createElement('a', { href, ...props }, children) }));
vi.mock('@/components/mobile/MobileRouteEventBridge', () => ({ default: () => null }));
vi.mock('@/lib/mobile/standalonePhoneHeight', () => ({ installStandalonePhoneHeight: () => () => {} }));

import MobileAppProviders from '@/components/mobile/MobileAppProviders';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { QUEUE_SETTLE_MS } from '@/lib/mobile/queueNotifications';

const job = (id: string, status: Job['status'] = 'queued'): Job => ({
  id, status, type: 'image', modelId: 'fixture', prompt: '', createdAt: 1, workspaceId: fixture.activeWorkspaceId,
});
const tree = () => React.createElement(React.StrictMode, null,
  React.createElement(MobileAppProviders, null, React.createElement('input', { 'aria-label': 'Draft' }), React.createElement(MobileBottomNav)));
const advanceTime = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const banner = () => screen.queryByTestId('mobile-queue-notification');
function visible(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value });
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
}
function online(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  act(() => { window.dispatchEvent(new Event(value ? 'online' : 'offline')); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('React', React); sessionStorage.clear();
  fixture.jobs = []; fixture.jobsLoaded = true; fixture.jobsSyncVersion = 1;
  fixture.activeWorkspaceId = 'ws-one'; fixture.pathname = '/m/gallery'; fixture.push.mockClear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('global mobile queue UI', () => {
  it('moves a visible banner inside an opened modal instead of leaving it in inert background', async () => {
    fixture.jobs = [job('a')]; const view = render(tree());
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree());
    const modal = document.createElement('div'); modal.className = 'yarl__root';
    await act(async () => { document.body.appendChild(modal); });
    expect(modal.contains(banner())).toBe(true);
    await act(async () => { modal.remove(); });
    expect(banner()).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss queue notification' }));
    expect(banner()).toBeNull();
  });

  it('shows one accessible portal banner across route changes without stealing focus', () => {
    fixture.jobs = [job('a'), job('b')];
    const view = render(tree());
    screen.getByRole('textbox').focus();
    fixture.jobs = [job('a', 'processing'), job('b')]; view.rerender(tree());
    expect(banner()?.textContent).toContain('Queue started · 2 jobs');
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(view.container.contains(banner())).toBe(false);
    fixture.pathname = '/m/create/prompt'; view.rerender(tree());
    expect(screen.getAllByTestId('mobile-queue-notification')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss queue notification' }));
    fixture.jobs = [job('a', 'processing'), job('b', 'processing')]; view.rerender(tree());
    expect(banner()).toBeNull();
  });
  it('shows an aggregate outcome, auto-dismisses and preserves the unread dot until Jobs', () => {
    fixture.jobs = [job('a'), job('b')]; const view = render(tree());
    fixture.jobs = [job('a', 'completed'), job('b', 'completed')]; view.rerender(tree());
    advanceTime(QUEUE_SETTLE_MS);
    expect(banner()?.textContent).toContain('All 2 jobs completed');
    expect(screen.getByLabelText('New queue outcome')).toBeTruthy();
    advanceTime(7000); expect(banner()).toBeNull();
    expect(screen.getByLabelText('New queue outcome')).toBeTruthy();
    fixture.pathname = '/m/jobs'; view.rerender(tree());
    expect(screen.queryByLabelText('New queue outcome')).toBeNull();
  });
  it('View jobs navigates only when clicked and keeps no unread dot on a Jobs route', () => {
    fixture.pathname = '/m/jobs/a'; fixture.jobs = [job('a')]; const view = render(tree());
    fixture.jobs = [job('a', 'completed')]; view.rerender(tree()); advanceTime(QUEUE_SETTLE_MS);
    expect(fixture.push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('New queue outcome')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View jobs' }));
    expect(fixture.push).toHaveBeenCalledWith('/m/jobs');
    expect(banner()).toBeNull();
  });
  it('restores an active cycle but ignores the empty loading placeholder on reload', () => {
    fixture.jobs = [job('a')]; const view = render(tree());
    view.unmount();
    fixture.jobs = []; fixture.jobsLoaded = false;
    const restored = render(tree()); advanceTime(10000);
    expect(banner()).toBeNull();
    fixture.jobs = [job('a', 'completed')]; fixture.jobsLoaded = true; restored.rerender(tree());
    advanceTime(QUEUE_SETTLE_MS);
    expect(banner()?.textContent).toContain('1 job completed');
  });
  it('does not repeat a consumed start or final outcome after remount/reload', () => {
    fixture.jobs = [job('a')]; let view = render(tree());
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); view.unmount();
    view = render(tree()); expect(banner()).toBeNull();
    fixture.jobs = [job('a', 'completed')]; view.rerender(tree()); advanceTime(QUEUE_SETTLE_MS);
    expect(banner()).toBeTruthy(); view.unmount();
    render(tree()); expect(banner()).toBeNull();
    expect(screen.getByLabelText('New queue outcome')).toBeTruthy();
  });
  it('coalesces background changes into one final outcome on foreground', () => {
    fixture.jobs = [job('a')]; const view = render(tree()); visible('hidden');
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); expect(banner()).toBeNull();
    fixture.jobs = [job('a', 'completed')]; view.rerender(tree()); advanceTime(QUEUE_SETTLE_MS);
    expect(banner()).toBeNull(); visible('visible');
    expect(banner()?.textContent).toContain('1 job completed');
  });
  it('waits for the existing successful poll on resume and never flashes a stale start', () => {
    fixture.jobs = [job('a')]; const view = render(tree()); visible('hidden');
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); visible('visible');
    expect(banner()).toBeNull(); advanceTime(10000); expect(banner()).toBeNull();
    fixture.jobs = [job('a', 'completed')]; fixture.jobsSyncVersion++; view.rerender(tree());
    expect(banner()).toBeNull(); advanceTime(QUEUE_SETTLE_MS);
    expect(banner()?.textContent).toContain('1 job completed');
  });
  it('shows a still-relevant pending start after the existing poll reconciles', () => {
    fixture.jobs = [job('a')]; const view = render(tree()); visible('hidden');
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); visible('visible');
    fixture.jobsSyncVersion++; view.rerender(tree());
    expect(banner()?.textContent).toContain('Queue started');
  });
  it('does not consume notices while offline and reconciles on reconnect', () => {
    fixture.jobs = [job('a')]; const view = render(tree()); online(false);
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); expect(banner()).toBeNull();
    online(true); expect(banner()).toBeNull();
    fixture.jobsSyncVersion++; view.rerender(tree()); expect(banner()?.textContent).toContain('Queue started');
  });
  it('keeps workspace histories isolated and does not complete on workspace reset', () => {
    fixture.jobs = [job('a')]; const view = render(tree());
    fixture.activeWorkspaceId = 'ws-two'; fixture.jobsLoaded = false; fixture.jobs = []; view.rerender(tree());
    advanceTime(10000); expect(banner()).toBeNull();
    fixture.jobsLoaded = true; fixture.jobs = [job('b')]; view.rerender(tree());
    fixture.jobs = [job('b', 'completed')]; view.rerender(tree()); advanceTime(QUEUE_SETTLE_MS);
    expect(banner()?.textContent).toContain('1 job completed');
    fixture.activeWorkspaceId = 'ws-one'; fixture.jobsLoaded = false; fixture.jobs = []; view.rerender(tree());
    expect(banner()).toBeNull();
    fixture.jobsLoaded = true; fixture.jobs = [job('a')]; view.rerender(tree()); advanceTime(10000);
    expect(banner()).toBeNull();
    fixture.jobs = [job('a', 'processing')]; view.rerender(tree()); expect(banner()?.textContent).toContain('Queue started');
  });
  it('does not announce old history when opening the app for the first time', () => {
    fixture.jobs = [job('old', 'completed')]; render(tree()); advanceTime(10000);
    expect(banner()).toBeNull(); expect(screen.queryByLabelText('New queue outcome')).toBeNull();
  });
});
