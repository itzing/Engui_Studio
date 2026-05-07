import { describe, expect, it } from 'vitest';
import { assembleStudioSessionPrompt, createDefaultStudioSessionTemplateDraftState, deriveStudioSessionResolution, deriveStudioSessionRunStatus, normalizeStudioSessionTemplateDraftState, pickUniqueStudioSessionPose, toStudioCollectionItemSummary, toStudioCollectionSummary, toStudioPhotoSessionSummary, toStudioPortfolioSummary, toStudioSessionRunSummary, toStudioSessionShotVersionSummary } from '@/lib/studio-sessions/utils';
import { listPrimaryStudioSessionVersions, selectPrimaryStudioSessionVersion, sortStudioSessionVersions } from '@/lib/studio-sessions/view';
import { getStudioSessionPosesByCategory } from '@/lib/studio-sessions/poseLibrary';
import { buildStudioRunShotSlotsFromPoseSet, createStudioPoseSetIdFromCategory, getStudioPoseSetById, getStudioPoseSets, getStudioSessionPosesByPoseSetId } from '@/lib/studio-sessions/poseSets';

describe('studio session utils', () => {
  it('derives resolution from orientation policy', () => {
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' }, 'portrait')).toEqual({ width: 832, height: 1216, orientation: 'portrait' });
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' }, 'landscape')).toEqual({ width: 1216, height: 832, orientation: 'landscape' });
    expect(deriveStudioSessionResolution({ shortSidePx: 832, longSidePx: 1216, squareSideSource: 'long' }, 'square')).toEqual({ width: 1216, height: 1216, orientation: 'square' });
  });

  it('uses constrained Studio Session generation defaults', () => {
    const draft = createDefaultStudioSessionTemplateDraftState();
    expect(draft.characterAge).toBe('');
    expect(draft.generationSettings).toMatchObject({ modelId: 'z-image', steps: 9, cfg: 1, seed: -1 });
    expect(draft.resolutionPolicy).toEqual({ shortSidePx: 1024, longSidePx: 1536, squareSideSource: 'short' });

    const normalized = normalizeStudioSessionTemplateDraftState({ characterAge: ' 23 years ', generationSettings: { modelId: '', sampler: 'euler' } });
    expect(normalized.characterAge).toBe('23 years');
    expect(normalized.generationSettings).toMatchObject({ modelId: 'z-image', steps: 9, cfg: 1, seed: -1, sampler: null, cfgScale: null });
  });

  it('renders Studio Session prompts as readable ordered lines', () => {
    const result = assembleStudioSessionPrompt({
      characterPrompt: 'Appearance: athletic woman, sharp jawline',
      characterAge: '23 years old',
      settingText: 'studio background',
      environmentText: 'studio background',
      lightingText: 'soft daylight',
      vibeText: 'calm editorial mood',
      outfitText: 'black bodysuit',
      hairstyleText: 'short silver bob',
      positivePrompt: 'soft light',
      negativePrompt: 'blurry',
      pose: { prompt: 'standing pose' },
    });

    const lines = result.positivePrompt.split('\n');
    expect(lines[0]).toBe('Environment: studio background');
    expect(lines[1]).toBe('Vibe: calm editorial mood');
    expect(lines[2]).toBe('Lighting: soft daylight');
    expect(lines[3]).toBe('Outfit: black bodysuit');
    expect(result.positivePrompt).toContain('Scene: studio photo session');
    expect(result.positivePrompt).toContain('Age: 23yo');
    expect(result.positivePrompt).toContain('Character 1: Appearance: athletic woman, sharp jawline');
    expect(result.positivePrompt).toContain('Hair: short silver bob');
    expect(result.positivePrompt).toContain('Pose: standing pose');
    expect(result.positivePrompt).toContain('Style: soft light');
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

    expect(sortStudioSessionVersions(versions).map((version: any) => version.id)).toEqual(['v3', 'v2', 'v1']);
    expect(listPrimaryStudioSessionVersions(versions).map((version: any) => version.id)).toEqual(['v2', 'v1']);
    expect(selectPrimaryStudioSessionVersion({ shot: { selectionVersionId: 'v1' }, versions })?.id).toBe('v1');
    expect(selectPrimaryStudioSessionVersion({ shot: { selectionVersionId: 'v3' }, versions })?.id).toBe('v2');
  });

  it('serializes portfolio-first Studio records with safe defaults', () => {
    const now = new Date('2026-05-07T17:00:00.000Z');

    expect(toStudioPortfolioSummary({
      id: 'portfolio-1', workspaceId: 'workspace-1', characterId: 'character-1', name: 'Mira', description: '', status: 'active', createdAt: now, updatedAt: now,
      character: { name: 'Mira', previewStateJson: JSON.stringify({ portrait: { thumbnailUrl: '/portrait.jpg' }, full_body: { thumbnailUrl: '/full.jpg' } }) },
      _count: { sessions: 2, collections: 1 },
      selectedImageCount: 7,
    })).toMatchObject({ characterName: 'Mira', characterPreviewUrl: '/portrait.jpg', sessionCount: 2, collectionCount: 1, selectedImageCount: 7 });

    expect(toStudioPhotoSessionSummary({
      id: 'session-1', workspaceId: 'workspace-1', portfolioId: 'portfolio-1', name: 'Morning room', settingText: 'room', lightingText: 'window light', vibeText: 'quiet', outfitText: 'dress', hairstyleText: 'bun', negativePrompt: '', notes: '', status: 'review', createdAt: now, updatedAt: now,
      _count: { runs: 3 },
      reviewCounts: { pick: 4, maybe: 2, reject: 1 },
      heroVersionUrl: '/hero.jpg',
    })).toMatchObject({ status: 'review', runCount: 3, pickCount: 4, maybeCount: 2, rejectCount: 1, heroVersionUrl: '/hero.jpg' });

    expect(toStudioCollectionSummary({
      id: 'collection-1', workspaceId: 'workspace-1', portfolioId: 'portfolio-1', name: 'Finals', description: '', status: 'final', createdAt: now, updatedAt: now,
      _count: { items: 5 },
      coverUrl: '/cover.jpg',
    })).toMatchObject({ status: 'final', itemCount: 5, coverUrl: '/cover.jpg' });

    expect(toStudioCollectionItemSummary({
      id: 'item-1', workspaceId: 'workspace-1', collectionId: 'collection-1', portfolioId: 'portfolio-1', photoSessionId: 'session-1', runId: 'run-1', shotId: 'shot-1', versionId: 'version-1', sortOrder: 1, caption: 'Hero', createdAt: now, updatedAt: now,
      version: { originalUrl: '/original.jpg', previewUrl: '/preview.jpg', thumbnailUrl: '/thumb.jpg' },
    })).toMatchObject({ versionId: 'version-1', sortOrder: 1, thumbnailUrl: '/thumb.jpg' });
  });

  it('serializes portfolio run fields and version review state without breaking legacy snapshots', () => {
    const now = new Date('2026-05-07T17:00:00.000Z');

    expect(toStudioSessionRunSummary({
      id: 'run-1', workspaceId: 'workspace-1', templateId: null, portfolioId: 'portfolio-1', photoSessionId: 'session-1', poseSetId: 'category:sitting', name: 'Sitting 01', runSettingsJson: '{"modelId":"z-image"}', promptOverrideJson: '{"positive":"soft"}', resolutionPolicyJson: '{"shortSidePx":1024}', count: 8, templateNameSnapshot: '', templateSnapshotJson: '{}', poseLibraryVersion: 'v1', poseLibraryHash: 'hash', status: 'draft', createdAt: now, updatedAt: now,
    })).toMatchObject({ portfolioId: 'portfolio-1', photoSessionId: 'session-1', poseSetId: 'category:sitting', name: 'Sitting 01', count: 8, runSettings: { modelId: 'z-image' } });

    expect(toStudioSessionShotVersionSummary({
      id: 'version-1', workspaceId: 'workspace-1', shotId: 'shot-1', revisionId: 'revision-1', sourceJobId: null, versionNumber: 1, status: 'completed', originKind: 'job_output', contentHash: null, originalUrl: null, previewUrl: null, thumbnailUrl: null, generationSnapshotJson: null, hidden: false, rejected: false, reviewState: 'hero', reviewNote: 'best', reviewedAt: now, createdAt: now, updatedAt: now,
    })).toMatchObject({ reviewState: 'hero', reviewNote: 'best', reviewedAt: now.toISOString() });
  });

  it('builds virtual pose sets from current pose categories', () => {
    const poseSets = getStudioPoseSets();
    expect(poseSets.length).toBeGreaterThan(0);

    const sittingId = createStudioPoseSetIdFromCategory('sitting');
    const sittingSet = getStudioPoseSetById(sittingId);
    expect(sittingSet?.category).toBe('sitting');
    expect(sittingSet?.poseIds.length).toBe(getStudioSessionPosesByCategory('sitting').length);
    expect(getStudioSessionPosesByPoseSetId(sittingId).length).toBe(sittingSet?.poseIds.length);

    expect(buildStudioRunShotSlotsFromPoseSet({ poseSetId: sittingId, count: 3 })).toEqual([
      { category: 'sitting', slotIndex: 0, label: 'Sitting 1' },
      { category: 'sitting', slotIndex: 1, label: 'Sitting 2' },
      { category: 'sitting', slotIndex: 2, label: 'Sitting 3' },
    ]);
  });
});
