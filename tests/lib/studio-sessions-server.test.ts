import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockQueueGalleryDerivatives,
  mockQueueGalleryEnrichment,
  mockExistsSync,
  mockMkdirSync,
  mockReadFileSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockPrisma: {
    $transaction: vi.fn(),
    studioSessionTemplate: { findUnique: vi.fn() },
    studioSessionRun: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    studioSessionShot: { createMany: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    studioSessionShotRevision: { findMany: vi.fn(), findUnique: vi.fn() },
    studioSessionShotVersion: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    studioSessionJobMaterialization: { upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    studioPoseLibrarySettings: { upsert: vi.fn() },
    studioPoseCategory: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    studioPose: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    galleryAsset: { findFirst: vi.fn(), create: vi.fn() },
    job: { findUnique: vi.fn(), findMany: vi.fn() },
  },
  mockQueueGalleryDerivatives: vi.fn(),
  mockQueueGalleryEnrichment: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockMkdirSync: vi.fn(),
  mockReadFileSync: vi.fn(() => Buffer.from('image-binary')),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/galleryDerivatives', () => ({ queueGalleryDerivatives: mockQueueGalleryDerivatives }));
vi.mock('@/lib/galleryEnrichment', () => ({ queueGalleryEnrichment: mockQueueGalleryEnrichment }));
vi.mock('@/lib/models/modelConfig', () => ({ getModelById: vi.fn(() => null) }));
vi.mock('@/lib/jobManagement', () => ({ RUNNING_JOB_STATUSES: new Set(['queued', 'processing']) }));
vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

import {
  addStudioSessionShotVersionToGallery,
  createStudioSessionRun,
  deleteStudioSessionRun,
  getStudioSessionRun,
  listStudioSessionShotPoses,
  materializeStudioSessionCompletedJob,
  recoverStudioSessionMaterializationTasks,
  updateStudioSessionShotSkipState,
} from '@/lib/studio-sessions/server';
import { studioPoseOpenPoseMaterializationHandler } from '@/lib/studio-sessions/poseLibraryServer';

describe('studio session server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.studioSessionRun.update.mockImplementation(async ({ data }: any) => ({
      id: 'run-1',
      workspaceId: 'workspace-1',
      templateId: 'template-1',
      templateNameSnapshot: 'Template',
      templateSnapshotJson: '{}',
      poseLibraryVersion: 'v1',
      poseLibraryHash: 'hash',
      status: data?.status ?? 'needs_review',
      createdAt: new Date(),
      updatedAt: new Date(),
      shots: [
        { skipped: false, status: 'completed', selectionVersionId: 'version-1', category: 'standing', slotIndex: 0 },
      ],
    }));
    mockPrisma.studioSessionJobMaterialization.upsert.mockResolvedValue({ id: 'task-1', jobId: 'job-1', status: 'pending' });
    mockPrisma.studioSessionJobMaterialization.update.mockResolvedValue({ id: 'task-1', jobId: 'job-1', status: 'materialized' });
    mockPrisma.studioSessionJobMaterialization.findMany.mockResolvedValue([]);
    mockPrisma.studioPoseLibrarySettings.upsert.mockResolvedValue({
      id: 'pose-settings-1', workspaceId: 'workspace-1', subjectDescription: '', clothingDescription: '', backgroundDescription: '', stylePreset: '', defaultVariantCount: 3, createdAt: new Date(), updatedAt: new Date(),
    });
    mockPrisma.studioPoseCategory.count.mockResolvedValue(1);
    mockPrisma.studioPose.findMany.mockResolvedValue([
      { id: 'standing_001', workspaceId: 'workspace-1', categoryId: 'standing', category: { id: 'standing', name: 'Standing', slug: 'standing' }, slug: 'standing-001', title: 'Standing 001', tagsJson: '["standing"]', posePrompt: 'Standing pose 1', orientation: 'portrait', framing: 'full_body', cameraAngle: 'front', shotDistance: 'wide', negativePrompt: null, primaryPreviewUrl: null, primaryPreviewId: null, notes: null, sortOrder: 0, openPoseImageUrl: null, poseKeypointEncryptedJson: null, openPoseSourceImageUrl: null, openPoseSourceJobId: null, openPoseExtractedAt: null, createdAt: new Date(), updatedAt: new Date(), previewCandidates: [] },
      { id: 'standing_002', workspaceId: 'workspace-1', categoryId: 'standing', category: { id: 'standing', name: 'Standing', slug: 'standing' }, slug: 'standing-002', title: 'Standing 002', tagsJson: '["standing"]', posePrompt: 'Standing pose 2', orientation: 'portrait', framing: 'full_body', cameraAngle: 'front', shotDistance: 'wide', negativePrompt: null, primaryPreviewUrl: null, primaryPreviewId: null, notes: null, sortOrder: 1, openPoseImageUrl: null, poseKeypointEncryptedJson: null, openPoseSourceImageUrl: null, openPoseSourceJobId: null, openPoseExtractedAt: null, createdAt: new Date(), updatedAt: new Date(), previewCandidates: [] },
      { id: 'standing_003', workspaceId: 'workspace-1', categoryId: 'standing', category: { id: 'standing', name: 'Standing', slug: 'standing' }, slug: 'standing-003', title: 'Standing 003', tagsJson: '["standing"]', posePrompt: 'Standing pose 3', orientation: 'portrait', framing: 'full_body', cameraAngle: 'front', shotDistance: 'wide', negativePrompt: null, primaryPreviewUrl: null, primaryPreviewId: null, notes: null, sortOrder: 2, openPoseImageUrl: null, poseKeypointEncryptedJson: null, openPoseSourceImageUrl: null, openPoseSourceJobId: null, openPoseExtractedAt: null, createdAt: new Date(), updatedAt: new Date(), previewCandidates: [] },
    ]);
    mockPrisma.studioSessionShot.findMany.mockResolvedValue([]);
    mockPrisma.studioSessionShotRevision.findMany.mockResolvedValue([]);
    mockPrisma.studioSessionShotVersion.findMany.mockResolvedValue([]);
  });

  it('creates runs from a template snapshot without depending on future template edits', async () => {
    const template = {
      id: 'template-1',
      workspaceId: 'workspace-1',
      name: 'Studio Template',
      canonicalStateJson: JSON.stringify({
        name: 'Studio Template',
        characterId: null,
        environmentText: 'studio backdrop',
        outfitText: 'black suit',
        hairstyleText: 'slick back',
        positivePrompt: 'editorial light',
        negativePrompt: 'blurry',
        generationSettings: {},
        resolutionPolicy: { shortSidePx: 832, longSidePx: 1216, squareSideSource: 'short' },
        categoryRules: [
          { category: 'standing', count: 1, includedPoseIds: [], excludedPoseIds: [], preferredOrientation: null, preferredFraming: null, fixedPoseIds: [], weighting: null, futureOverrideConfig: null },
        ],
        poseLibraryVersion: 'v1',
        poseLibraryHash: 'hash-1',
      }),
      categoryRules: [],
    };
    const runRecord = {
      id: 'run-1',
      workspaceId: 'workspace-1',
      templateId: 'template-1',
      templateNameSnapshot: 'Studio Template',
      templateSnapshotJson: JSON.stringify({
        name: 'Studio Template',
        templateId: 'template-1',
        templateName: 'Studio Template',
        categoryRules: [{ category: 'standing', count: 1 }],
        poseLibraryVersion: 'v1',
        poseLibraryHash: 'hash-1',
      }),
      poseLibraryVersion: 'v1',
      poseLibraryHash: 'hash-1',
      status: 'draft',
      createdAt: new Date('2026-05-06T21:00:00Z'),
      updatedAt: new Date('2026-05-06T21:00:00Z'),
      shots: [
        {
          id: 'shot-1',
          workspaceId: 'workspace-1',
          runId: 'run-1',
          category: 'standing',
          slotIndex: 0,
          label: 'Standing 1',
          status: 'unassigned',
          skipped: false,
          selectionVersionId: null,
          autoAssignmentHistoryJson: '[]',
        },
      ],
    };

    mockPrisma.studioSessionTemplate.findUnique.mockResolvedValue(template);
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      studioSessionRun: { create: vi.fn().mockResolvedValue({ id: 'run-1' }) },
      studioSessionShot: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }));
    mockPrisma.studioSessionRun.findUnique.mockResolvedValue(runRecord);

    const result = await createStudioSessionRun({ workspaceId: 'workspace-1', templateId: 'template-1' });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const tx = await mockPrisma.$transaction.mock.calls[0][0]({
      studioSessionRun: { create: vi.fn().mockResolvedValue({ id: 'run-1' }) },
      studioSessionShot: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    });
    expect(tx.id).toBe('run-1');
    expect(result?.templateNameSnapshot).toBe('Studio Template');
    expect(result?.templateSnapshot.templateName).toBe('Studio Template');
    expect(result?.templateSnapshot.templateId).toBe('template-1');
  });

  it('materializes the first completed job into a selected shot version', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      resultUrl: '/generations/output.png',
      thumbnailUrl: '/generations/thumb.webp',
      prompt: 'prompt',
      modelId: 'z-image',
      endpointId: 'endpoint-1',
      options: JSON.stringify({ studioSessionContext: { workspaceId: 'workspace-1', runId: 'run-1', shotId: 'shot-1', revisionId: 'revision-1' } }),
    });
    mockPrisma.studioSessionShot.findUnique.mockResolvedValue({ id: 'shot-1', runId: 'run-1', selectionVersionId: null });
    mockPrisma.studioSessionShotVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.studioSessionShotVersion.create.mockResolvedValue({ id: 'version-1' });
    mockPrisma.studioSessionShot.update.mockResolvedValue({});
    mockPrisma.studioSessionRun.findUnique.mockResolvedValue({
      id: 'run-1', workspaceId: 'workspace-1', templateId: 'template-1', templateNameSnapshot: 'Template', templateSnapshotJson: '{}', poseLibraryVersion: 'v1', poseLibraryHash: 'hash', status: 'needs_review', createdAt: new Date(), updatedAt: new Date(), shots: [
        { skipped: false, status: 'completed', selectionVersionId: 'version-1', category: 'standing', slotIndex: 0 },
      ],
    });
    mockExistsSync.mockReturnValue(true);

    const result = await materializeStudioSessionCompletedJob('job-1');

    expect(mockPrisma.studioSessionJobMaterialization.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studioSessionShotVersion.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studioSessionShot.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'shot-1' },
      data: expect.objectContaining({ selectionVersionId: 'version-1', status: 'completed' }),
    }));
    expect(result).toEqual({ id: 'version-1' });
  });

  it('backfills missing materialization tasks and retries completed Studio Session jobs', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'completed',
        resultUrl: '/generations/output.png',
        thumbnailUrl: '/generations/thumb.webp',
        prompt: 'prompt',
        modelId: 'z-image',
        endpointId: 'endpoint-1',
        createdAt: new Date('2026-05-07T08:00:00Z'),
        options: JSON.stringify({ studioSessionContext: { workspaceId: 'workspace-1', runId: 'run-1', shotId: 'shot-1', revisionId: 'revision-1' } }),
      },
    ]);
    mockPrisma.studioSessionJobMaterialization.findMany.mockResolvedValue([
      { id: 'task-1', jobId: 'job-1', shotId: 'shot-1', status: 'pending', updatedAt: new Date('2026-05-07T08:01:00Z') },
    ]);
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      resultUrl: '/generations/output.png',
      thumbnailUrl: '/generations/thumb.webp',
      prompt: 'prompt',
      modelId: 'z-image',
      endpointId: 'endpoint-1',
      options: JSON.stringify({ studioSessionContext: { workspaceId: 'workspace-1', runId: 'run-1', shotId: 'shot-1', revisionId: 'revision-1' } }),
    });
    mockPrisma.studioSessionShot.findUnique.mockResolvedValue({ id: 'shot-1', runId: 'run-1', selectionVersionId: null });
    mockPrisma.studioSessionShotVersion.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockPrisma.studioSessionShotVersion.create.mockResolvedValue({ id: 'version-1' });
    mockExistsSync.mockReturnValue(true);

    await recoverStudioSessionMaterializationTasks({ runId: 'run-1', limit: 10 });

    expect(mockPrisma.studioSessionJobMaterialization.upsert).toHaveBeenCalled();
    expect(mockPrisma.studioSessionShotVersion.create).toHaveBeenCalledTimes(1);
  });

  it('lists only free poses for manual replacement inside the same run category', async () => {
    mockPrisma.studioSessionShot.findUnique.mockResolvedValue({
      id: 'shot-1',
      runId: 'run-1',
      workspaceId: 'workspace-1',
      category: 'standing',
      slotIndex: 0,
      label: 'Standing 1',
      status: 'assigned',
      skipped: false,
      selectionVersionId: null,
      currentRevisionId: 'revision-1',
      autoAssignmentHistoryJson: '[]',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.studioSessionShot.findMany.mockResolvedValue([
      { currentRevisionId: 'revision-1' },
      { currentRevisionId: 'revision-2' },
    ]);
    mockPrisma.studioSessionShotRevision.findMany.mockResolvedValue([
      { poseId: 'standing_001' },
      { poseId: 'standing_002' },
    ]);

    const result = await listStudioSessionShotPoses('shot-1');

    expect(result?.poses.length).toBeGreaterThan(0);
    expect(result?.poses.some((pose) => pose.id === 'standing_001')).toBe(false);
    expect(result?.poses.some((pose) => pose.id === 'standing_002')).toBe(false);
    expect(result?.poses.some((pose) => pose.id === 'standing_003')).toBe(true);
  });

  it('loads run detail when a shot has a reshuffled latest revision and no active job', async () => {
    mockPrisma.studioSessionRun.findUnique.mockResolvedValue({
      id: 'run-1', workspaceId: 'workspace-1', templateId: 'template-1', templateNameSnapshot: 'Template', templateSnapshotJson: '{}', poseLibraryVersion: 'v1', poseLibraryHash: 'hash', status: 'needs_review', createdAt: new Date(), updatedAt: new Date(), shots: [
        { skipped: false, status: 'needs_review', selectionVersionId: null, category: 'standing', slotIndex: 0 },
      ],
    });
    mockPrisma.studioSessionShot.findMany.mockResolvedValue([
      {
        id: 'shot-1',
        runId: 'run-1',
        workspaceId: 'workspace-1',
        category: 'standing',
        slotIndex: 0,
        label: 'Standing 1',
        status: 'needs_review',
        skipped: false,
        selectionVersionId: null,
        currentRevisionId: 'revision-2',
        autoAssignmentHistoryJson: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrisma.studioSessionShotVersion.findMany.mockResolvedValue([]);
    mockPrisma.studioSessionShotRevision.findMany.mockResolvedValue([
      {
        id: 'revision-2',
        workspaceId: 'workspace-1',
        shotId: 'shot-1',
        revisionNumber: 2,
        poseId: 'pose-2',
        poseSnapshotJson: JSON.stringify({ id: 'pose-2', category: 'standing', name: 'Pose 2', prompt: 'pose prompt', orientation: 'portrait', framing: 'portrait' }),
        derivedOrientation: 'portrait',
        derivedFraming: 'portrait',
        assembledPromptSnapshotJson: JSON.stringify({ positivePrompt: 'prompt', negativePrompt: '', pieces: { character: '', characterAge: '', environment: '', outfit: '', hairstyle: '', masterPositive: '', pose: 'pose prompt' } }),
        overrideFieldsJson: null,
        sourceKind: 'reshuffle',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'completed',
        executionMs: 1000,
        createdAt: new Date(),
        completedAt: new Date(),
        options: JSON.stringify({ studioSessionContext: { runId: 'run-1', shotId: 'shot-1' } }),
      },
    ]);

    const result = await getStudioSessionRun('run-1');

    expect(result?.run.id).toBe('run-1');
    expect(result?.shots[0]?.latestJobId).toBe('job-1');
  });

  it('blocks run deletion while the latest shot job is still active', async () => {
    mockPrisma.studioSessionRun.findUnique.mockResolvedValue({ id: 'run-1' });
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        status: 'processing',
        executionMs: null,
        createdAt: new Date('2026-05-07T09:00:00Z'),
        completedAt: null,
        options: JSON.stringify({ studioSessionContext: { runId: 'run-1', shotId: 'shot-1' } }),
      },
    ]);

    await expect(deleteStudioSessionRun('run-1')).rejects.toThrow('Cannot delete a run while shot jobs are still active');
    expect(mockPrisma.studioSessionRun.delete).not.toHaveBeenCalled();
  });

  it('restores skipped shots back into ordinary review logic without losing history', async () => {
    mockPrisma.studioSessionShot.findUnique.mockResolvedValue({ id: 'shot-1', runId: 'run-1', selectionVersionId: null, currentRevisionId: 'revision-1' });
    mockPrisma.studioSessionShot.update.mockResolvedValue({ id: 'shot-1', skipped: false, status: 'needs_review' });
    mockPrisma.studioSessionRun.findUnique.mockResolvedValue({
      id: 'run-1', workspaceId: 'workspace-1', templateId: 'template-1', templateNameSnapshot: 'Template', templateSnapshotJson: '{}', poseLibraryVersion: 'v1', poseLibraryHash: 'hash', status: 'needs_review', createdAt: new Date(), updatedAt: new Date(), shots: [
        { skipped: false, status: 'needs_review', selectionVersionId: null, category: 'standing', slotIndex: 0 },
      ],
    });

    await updateStudioSessionShotSkipState({ shotId: 'shot-1', skipped: false });

    expect(mockPrisma.studioSessionShot.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'shot-1' },
      data: expect.objectContaining({ skipped: false, status: 'needs_review' }),
    }));
  });

  it('materializes Studio pose OpenPose output without persisting plaintext keypoints', async () => {
    mockPrisma.studioPose.findUnique.mockResolvedValue({ id: 'pose-1', category: { id: 'standing', name: 'Standing', slug: 'standing' }, previewCandidates: [] });
    mockPrisma.studioPose.update.mockResolvedValue({});

    await studioPoseOpenPoseMaterializationHandler.materialize({
      job: {
        id: 'job-openpose-1',
        resultUrl: '/generations/openpose-job.png',
        thumbnailUrl: null,
        options: JSON.stringify({ openPoseExtraction: { pose_keypoint_encrypted: { nonce: 'n', ciphertext: 'c' } } }),
      },
      task: { targetId: 'pose-1' },
      payload: { sourceImageUrl: '/generations/source.png' },
    });

    expect(mockPrisma.studioPose.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pose-1' },
      data: expect.objectContaining({
        openPoseImageUrl: expect.stringContaining('/generations/studio-pose-library/pose-1/'),
        poseKeypointEncryptedJson: JSON.stringify({ nonce: 'n', ciphertext: 'c' }),
        openPoseSourceImageUrl: '/generations/source.png',
        openPoseSourceJobId: 'job-openpose-1',
      }),
    }));
    expect(JSON.stringify(mockPrisma.studioPose.update.mock.calls[0][0].data)).not.toContain('people');
  });

  it('adds studio session versions to Gallery explicitly and reuses gallery queues', async () => {
    mockPrisma.studioSessionShotVersion.findFirst.mockResolvedValue({
      id: 'version-1',
      workspaceId: 'workspace-1',
      shotId: 'shot-1',
      revisionId: 'revision-1',
      sourceJobId: 'job-1',
      contentHash: 'hash-asset',
      originalUrl: '/generations/studio-sessions/workspace-1/run-1/shot-1/hash-asset.png',
      previewUrl: '/generations/studio-sessions/workspace-1/run-1/shot-1/hash-asset.png',
      thumbnailUrl: '/generations/thumb.webp',
      generationSnapshotJson: JSON.stringify({ modelId: 'z-image' }),
      status: 'completed',
    });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue(null);
    mockPrisma.galleryAsset.create.mockResolvedValue({ id: 'asset-1', workspaceId: 'workspace-1' });

    const result = await addStudioSessionShotVersionToGallery({ shotId: 'shot-1', versionId: 'version-1' });

    expect(mockPrisma.galleryAsset.create).toHaveBeenCalledTimes(1);
    expect(mockQueueGalleryDerivatives).toHaveBeenCalledWith('asset-1');
    expect(mockQueueGalleryEnrichment).toHaveBeenCalledWith('asset-1');
    expect(result).toEqual({ alreadyInGallery: false, asset: { id: 'asset-1', workspaceId: 'workspace-1' } });
  });
});
