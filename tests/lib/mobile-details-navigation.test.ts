/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOBILE_JOBS_DETAILS_NAVIGATION_KEY,
  buildMobileDetailsNavigationState,
  getMobileDetailsEntryIdAtIndex,
  readMobileDetailsSnapshot,
  writeMobileDetailsSnapshot,
  type MobileDetailsSnapshot,
} from '@/lib/mobile/detailsNavigation';

describe('mobile details navigation', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('persists and normalizes list snapshots', () => {
    writeMobileDetailsSnapshot('jobs', {
      workspaceId: 'workspace-1',
      entries: [
        { id: 'job-2', absoluteIndex: 2 },
        { id: 'job-0', absoluteIndex: 0 },
        { id: 'duplicate', absoluteIndex: 2 },
      ],
      totalCount: 4,
      pageSize: 24,
    });

    const snapshot = readMobileDetailsSnapshot('jobs');

    expect(snapshot?.workspaceId).toBe('workspace-1');
    expect(snapshot?.entries).toEqual([
      { id: 'job-0', absoluteIndex: 0 },
      { id: 'job-2', absoluteIndex: 2 },
    ]);
  });

  it('builds previous and next state from cached entries', () => {
    const snapshot: MobileDetailsSnapshot = {
      version: 1,
      kind: 'gallery',
      workspaceId: 'workspace-1',
      entries: [
        { id: 'asset-0', absoluteIndex: 0 },
        { id: 'asset-1', absoluteIndex: 1 },
        { id: 'asset-2', absoluteIndex: 2 },
      ],
      totalCount: 3,
      pageSize: 24,
      updatedAt: Date.now(),
    };

    expect(buildMobileDetailsNavigationState(snapshot, 'asset-1')).toMatchObject({
      currentIndex: 1,
      totalCount: 3,
      previousId: 'asset-0',
      nextId: 'asset-2',
      canGoPrevious: true,
      canGoNext: true,
    });
  });

  it('disables navigation at list edges', () => {
    const snapshot: MobileDetailsSnapshot = {
      version: 1,
      kind: 'jobs',
      entries: [
        { id: 'first', absoluteIndex: 0 },
        { id: 'last', absoluteIndex: 1 },
      ],
      totalCount: 2,
      pageSize: 24,
      updatedAt: Date.now(),
    };

    expect(buildMobileDetailsNavigationState(snapshot, 'first')).toMatchObject({
      previousId: null,
      nextId: 'last',
      canGoPrevious: false,
      canGoNext: true,
    });
    expect(buildMobileDetailsNavigationState(snapshot, 'last')).toMatchObject({
      previousId: 'first',
      nextId: null,
      canGoPrevious: true,
      canGoNext: false,
    });
  });

  it('accepts fetched neighbor ids when they are outside the cached snapshot', () => {
    const snapshot: MobileDetailsSnapshot = {
      version: 1,
      kind: 'jobs',
      entries: [{ id: 'job-24', absoluteIndex: 24 }],
      totalCount: 48,
      pageSize: 24,
      updatedAt: Date.now(),
    };

    expect(getMobileDetailsEntryIdAtIndex(snapshot, 23)).toBeNull();
    expect(buildMobileDetailsNavigationState(snapshot, 'job-24', 'job-23', 'job-25')).toMatchObject({
      previousId: 'job-23',
      nextId: 'job-25',
      canGoPrevious: true,
      canGoNext: true,
    });
  });

  it('ignores stale snapshots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-30T11:20:00Z'));
    writeMobileDetailsSnapshot('jobs', {
      entries: [{ id: 'job-1', absoluteIndex: 0 }],
      totalCount: 1,
      pageSize: 24,
    });

    vi.setSystemTime(new Date('2026-07-30T18:21:00Z'));

    expect(window.sessionStorage.getItem(MOBILE_JOBS_DETAILS_NAVIGATION_KEY)).toBeTruthy();
    expect(readMobileDetailsSnapshot('jobs')).toBeNull();
  });
});
