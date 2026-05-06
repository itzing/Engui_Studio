import { describe, expect, it } from 'vitest';
import { deriveStudioSessionResolution, deriveStudioSessionRunStatus, pickUniqueStudioSessionPose } from '@/lib/studio-sessions/utils';
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
});
