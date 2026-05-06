import { describe, expect, it } from 'vitest';
import { deriveStudioSessionResolution, deriveStudioSessionRunStatus, pickUniqueStudioSessionPose } from '@/lib/studio-sessions/utils';
import { listPrimaryStudioSessionVersions, selectPrimaryStudioSessionVersion, sortStudioSessionVersions } from '@/lib/studio-sessions/view';
import { getStudioSessionPosesByCategory } from '@/lib/studio-sessions/poseLibrary';

describe('studio session utils', () => {
  it('derives resolution from orientation policy', () => {
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' }, 'portrait')).toEqual({ width: 832, height: 1216, orientation: 'portrait' });
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' }, 'landscape')).toEqual({ width: 1216, height: 832, orientation: 'landscape' });
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'long' }, 'square')).toEqual({ width: 1216, height: 1216, orientation: 'square' });
  });

  it('treats skipped shots as non-blocking for completed status', () => {
    expect(deriveStudioSessionRunStatus({
      shots: [
        { skipped: true, status: 'unassigned', selectionVersionId: null },
        { skipped: false, status: 'completed', selectionVersionId: 'version-1' },
      ],
    })).toBe('completed');
  });

  it('exhausts auto-pick when a category history already used all poses', () => {
    const poses = getStudioSessionPosesByCategory('standing');
    expect(poses.length).toBeGreaterThan(0);

    const result = pickUniqueStudioSessionPose({
      category: 'standing',
      autoAssignmentHistory: poses.map((pose) => pose.id),
    });

    expect(result.pose).toBeNull();
    expect(result.exhausted).toBe(true);
    expect(result.exhaustedCategories).toEqual(['standing']);
  });

  it('respects include/exclude filters when choosing a unique pose', () => {
    const poses = getStudioSessionPosesByCategory('standing');
    expect(poses.length).toBeGreaterThan(1);
    const target = poses[0];
    const blocked = poses[1];

    const result = pickUniqueStudioSessionPose({
      category: 'standing',
      autoAssignmentHistory: [],
      includedPoseIds: [target.id, blocked.id],
      excludedPoseIds: [blocked.id],
    });

    expect(result.pose?.id).toBe(target.id);
    expect(result.exhausted).toBe(false);
  });

  it('sorts and selects primary versions from reviewable history only', () => {
    const versions = [
      { id: 'v1', shotId: 'shot-1', versionNumber: 1, createdAt: '2026-05-06T20:00:00.000Z', hidden: false, rejected: false },
      { id: 'v3', shotId: 'shot-1', versionNumber: 3, createdAt: '2026-05-06T22:00:00.000Z', hidden: true, rejected: false },
      { id: 'v2', shotId: 'shot-1', versionNumber: 2, createdAt: '2026-05-06T21:00:00.000Z', hidden: false, rejected: false },
    ] as any;

    expect(sortStudioSessionVersions(versions).map((version) => version.id)).toEqual(['v3', 'v2', 'v1']);
    expect(listPrimaryStudioSessionVersions(versions).map((version) => version.id)).toEqual(['v2', 'v1']);
    expect(selectPrimaryStudioSessionVersion({ shot: { selectionVersionId: 'v1' }, versions })?.id).toBe('v1');
    expect(selectPrimaryStudioSessionVersion({ shot: { selectionVersionId: 'v3' }, versions })?.id).toBe('v2');
  });
});
