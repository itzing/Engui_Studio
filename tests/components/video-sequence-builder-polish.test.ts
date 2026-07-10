import { describe, expect, it } from 'vitest';

import {
  getHeaderActionTooltip,
  getRenderBlocker,
  getSegmentSourcePreviewUrl,
  getSegmentInspectorActionTooltip,
  getNextWanLoraSlotIndex,
  getSelectedWanLoraSlots,
  setWanLoraPairInConfig,
  setWanLoraWeightInConfig,
  buildSegmentGenerationOptionsJson,
  shouldAutoSyncVideoSequenceSegment,
  hasSyncedVideoSequenceSegmentChange,
  buildSequencePreviewTimeline,
  findSequencePreviewTimelineItem,
  formatSegmentOutputMetrics,
  shouldRestartSequencePreview,
  getSequencePreviewRestartTime,
  buildSegmentDraftPatchPayload,
  hasSegmentDraftChanged,
  getGenerateFromPlan,
} from '@/components/video-sequences/VideoSequenceBuilder';

function segment(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'seg-1',
    sequenceId: 'seq-1',
    orderIndex: overrides.orderIndex ?? 0,
    title: overrides.title ?? 'Segment',
    status: overrides.status ?? 'completed',
    sourceMode: overrides.sourceMode ?? 'initial',
    sourceImageUrl: overrides.sourceImageUrl ?? null,
    sourceFrozen: false,
    prompt: '',
    negativePrompt: '',
    motionPrompt: '',
    continuityPrompt: '',
    modelId: 'wan22',
    endpointId: null,
    loraConfig: {},
    generationOptions: {},
    seed: null,
    randomizeSeed: true,
    durationSeconds: overrides.durationSeconds ?? 5,
    generationJobId: Object.prototype.hasOwnProperty.call(overrides, 'generationJobId') ? overrides.generationJobId : null,
    outputVideoUrl: Object.prototype.hasOwnProperty.call(overrides, 'outputVideoUrl') ? overrides.outputVideoUrl : '/generations/seg.mp4',
    outputVideoMetadata: Object.prototype.hasOwnProperty.call(overrides, 'outputVideoMetadata') ? overrides.outputVideoMetadata : null,
    firstFrameUrl: overrides.firstFrameUrl ?? null,
    lastFrameUrl: overrides.lastFrameUrl ?? null,
    templateId: null,
    error: null,
  };
}

function sequence(overrides: Record<string, any> = {}) {
  return {
    id: 'seq-1',
    workspaceId: 'ws-1',
    title: 'Sequence',
    description: '',
    status: 'draft',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    targetFps: 24,
    defaultModelId: 'wan22',
    defaultGenerationOptions: {},
    finalVideoUrl: null,
    segments: overrides.segments ?? [],
  };
}

describe('VideoSequenceBuilder polish helpers', () => {
  it('uses the previous segment last frame as the effective source preview', () => {
    const segments = [
      segment({ id: 'seg-1', orderIndex: 0, lastFrameUrl: '/generations/last.jpg' }),
      segment({ id: 'seg-2', orderIndex: 1, sourceMode: 'previous_last_frame', outputVideoUrl: null }),
    ];

    expect(getSegmentSourcePreviewUrl(segments[1], segments)).toBe('/generations/last.jpg');
  });

  it('reports the first render blocker before final render is allowed', () => {
    expect(getRenderBlocker(sequence({ segments: [] }))).toBe('Add segments before rendering');
    expect(getRenderBlocker(sequence({
      segments: [
        segment({ orderIndex: 0, outputVideoUrl: '/generations/seg-1.mp4' }),
        segment({ orderIndex: 1, status: 'stale', outputVideoUrl: '/generations/seg-2.mp4' }),
      ],
    }))).toBe('Segment 2 is stale');
    expect(getRenderBlocker(sequence({
      segments: [
        segment({ orderIndex: 0, outputVideoUrl: '/generations/seg-1.mp4' }),
        segment({ orderIndex: 1, outputVideoUrl: null }),
      ],
    }))).toBe('Segment 2 is missing output');
    expect(getRenderBlocker(sequence({
      segments: [
        segment({ orderIndex: 0, outputVideoUrl: '/generations/seg-1.mp4' }),
        segment({ orderIndex: 1, outputVideoUrl: '/generations/seg-2.mp4' }),
      ],
    }))).toBeNull();
  });

  it('keeps compact header actions discoverable with detailed tooltips', () => {
    expect(getHeaderActionTooltip('save')).toContain('Save sequence title');
    expect(getHeaderActionTooltip('generateFrom')).toContain('selected segment forward');
    expect(getHeaderActionTooltip('render', 'Segment 2 is stale')).toContain('Segment 2 is stale');
    expect(getHeaderActionTooltip('final')).toContain('new tab');
  });

  it('plans generate-from regeneration across draft failed and stale segments', () => {
    const plan = getGenerateFromPlan(sequence({
      segments: [
        segment({ id: 'seg-1', orderIndex: 0, status: 'completed' }),
        segment({ id: 'seg-2', orderIndex: 1, status: 'draft' }),
        segment({ id: 'seg-3', orderIndex: 2, status: 'queued' }),
        segment({ id: 'seg-4', orderIndex: 3, status: 'stale' }),
        segment({ id: 'seg-5', orderIndex: 4, status: 'failed' }),
      ],
    }), 'seg-2');

    expect(plan.startIndex).toBe(1);
    expect(plan.segments.map((item) => item.id)).toEqual(['seg-2', 'seg-4', 'seg-5']);
  });

  it('plans generate-from regeneration for completed segments when all mode is enabled', () => {
    const plan = getGenerateFromPlan(sequence({
      segments: [
        segment({ id: 'seg-1', orderIndex: 0, status: 'completed' }),
        segment({ id: 'seg-2', orderIndex: 1, status: 'queued' }),
        segment({ id: 'seg-3', orderIndex: 2, status: 'processing' }),
        segment({ id: 'seg-4', orderIndex: 3, status: 'completed' }),
        segment({ id: 'seg-5', orderIndex: 4, status: 'draft' }),
      ],
    }), 'seg-1', true);

    expect(plan.segments.map((item) => item.id)).toEqual(['seg-1', 'seg-4', 'seg-5']);
    expect(plan.activeSegments.map((item) => item.id)).toEqual(['seg-2', 'seg-3']);
  });

  it('keeps segment inspector actions discoverable with detailed tooltips', () => {
    expect(getSegmentInspectorActionTooltip('saveSegment')).toContain('source, prompt, model');
    expect(getSegmentInspectorActionTooltip('generate')).toContain('source frame');
    expect(getSegmentInspectorActionTooltip('status', { hasJob: false })).toContain('available after');
    expect(getSegmentInspectorActionTooltip('clearStale', { hasOutput: true })).toContain('mark this stale segment completed');
    expect(getSegmentInspectorActionTooltip('galleryVideo', { isFirstSegment: false })).toContain('only seed segment 1');
    expect(getSegmentInspectorActionTooltip('manualFramePicker', { hasPreviousOutput: true })).toContain('pick a custom source frame');
  });

  it('auto-syncs only active generated segments', () => {
    expect(shouldAutoSyncVideoSequenceSegment(segment({ status: 'queued', generationJobId: 'job-1' }))).toBe(true);
    expect(shouldAutoSyncVideoSequenceSegment(segment({ status: 'processing', generationJobId: 'job-1' }))).toBe(true);
    expect(shouldAutoSyncVideoSequenceSegment(segment({ status: 'completed', generationJobId: 'job-1' }))).toBe(false);
    expect(shouldAutoSyncVideoSequenceSegment(segment({ status: 'queued', generationJobId: null }))).toBe(false);
  });

  it('ignores no-op auto-sync responses', () => {
    const current = segment({ status: 'queued', generationJobId: 'job-1', outputVideoUrl: null });
    expect(hasSyncedVideoSequenceSegmentChange(current, { ...current })).toBe(false);
    expect(hasSyncedVideoSequenceSegmentChange(current, {
      ...current,
      status: 'completed',
      outputVideoUrl: '/generations/output.mp4',
      firstFrameUrl: '/generations/first.jpg',
      lastFrameUrl: '/generations/last.jpg',
    })).toBe(true);
  });

  it('builds a stitched preview timeline from completed outputs', () => {
    const timeline = buildSequencePreviewTimeline([
      segment({ id: 'seg-2', orderIndex: 1, status: 'completed', outputVideoUrl: '/generations/seg-2.mp4', durationSeconds: 4 }),
      segment({
        id: 'seg-1',
        orderIndex: 0,
        status: 'completed',
        outputVideoUrl: '/generations/seg-1.mp4',
        durationSeconds: 6,
        outputVideoMetadata: { durationSeconds: 5.0625, fps: 16, frameCount: 81 },
      }),
      segment({ id: 'seg-3', orderIndex: 2, status: 'queued', outputVideoUrl: '/generations/seg-3.mp4', durationSeconds: 2 }),
      segment({ id: 'seg-4', orderIndex: 3, status: 'completed', outputVideoUrl: null, durationSeconds: 2 }),
    ]);

    expect(timeline.map((item) => item.segment.id)).toEqual(['seg-1', 'seg-2']);
    expect(timeline.map((item) => [item.start, item.end])).toEqual([[0, 5.0625], [5.0625, 9.0625]]);
    expect(formatSegmentOutputMetrics(timeline[0].segment)).toBe('81f / 16fps / 5.06s');
    expect(findSequencePreviewTimelineItem(timeline, 5.2)?.segment.id).toBe('seg-2');
    expect(findSequencePreviewTimelineItem(timeline, 99)?.segment.id).toBe('seg-2');
  });

  it('restarts stitched preview after it reaches the end', () => {
    const timeline = buildSequencePreviewTimeline([
      segment({ id: 'seg-1', orderIndex: 0, durationSeconds: 5 }),
      segment({ id: 'seg-2', orderIndex: 1, durationSeconds: 4 }),
    ]);

    expect(shouldRestartSequencePreview(true, 9, 9)).toBe(true);
    expect(shouldRestartSequencePreview(false, 9, 9)).toBe(true);
    expect(shouldRestartSequencePreview(false, 3, 9.06)).toBe(false);
    expect(getSequencePreviewRestartTime(timeline)).toBe(0);
  });

  it('detects changed segment drafts for autosave payloads', () => {
    const savedSegment = segment({
      title: 'Opening',
      durationSeconds: 5,
      outputVideoUrl: null,
    });
    const matchingDraft = {
      title: 'Opening',
      sourceMode: 'initial',
      sourceImageUrl: '',
      sourceFrozen: false,
      prompt: '',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: '',
      durationSeconds: '5',
      seed: '',
      randomizeSeed: true,
      generationSteps: '4',
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
    };
    const changedDraft = { ...matchingDraft, prompt: 'camera pushes forward' };

    expect(hasSegmentDraftChanged(savedSegment, matchingDraft)).toBe(false);
    expect(hasSegmentDraftChanged(savedSegment, changedDraft)).toBe(true);
    expect(buildSegmentDraftPatchPayload(changedDraft)).toMatchObject({
      prompt: 'camera pushes forward',
      durationSeconds: 5,
      generationOptionsJson: '{\n  "steps": 4\n}',
    });
  });

  it('builds editable WAN LoRA slots while preserving generation config keys', () => {
    const availableLoras = [
      {
        id: 'high-1',
        name: 'Drama High',
        fileName: 'dramatic_high.safetensors',
        s3Path: '/runpod-volume/loras/dramatic_high.safetensors',
        s3Url: '',
        fileSize: '1024',
        extension: '.safetensors',
        uploadedAt: '2026-07-09T00:00:00Z',
      },
      {
        id: 'low-1',
        name: 'Drama Low',
        fileName: 'dramatic_low.safetensors',
        s3Path: '/runpod-volume/loras/dramatic_low.safetensors',
        s3Url: '',
        fileSize: '1024',
        extension: '.safetensors',
        uploadedAt: '2026-07-09T00:00:00Z',
      },
    ];

    const added = setWanLoraPairInConfig('{}', 1, {
      highPath: '/runpod-volume/loras/dramatic_high.safetensors',
      lowPath: '/runpod-volume/loras/dramatic_low.safetensors',
    });
    const weighted = setWanLoraWeightInConfig(added, 1, 'high', 1.25);
    const parsed = JSON.parse(weighted);

    expect(parsed.lora_high_1).toBe('/runpod-volume/loras/dramatic_high.safetensors');
    expect(parsed.lora_low_1).toBe('/runpod-volume/loras/dramatic_low.safetensors');
    expect(parsed.lora_high_1_weight).toBe(1.25);
    expect(parsed.lora_low_1_weight).toBe(0.8);

    const slots = getSelectedWanLoraSlots(weighted, availableLoras);
    expect(slots).toHaveLength(1);
    expect(slots[0].highLoRA?.fileName).toBe('dramatic_high.safetensors');
    expect(getNextWanLoraSlotIndex(weighted)).toBe(2);

    const cleared = setWanLoraPairInConfig(weighted, 1, null);
    expect(JSON.parse(cleared)).toEqual({});
  });

  it('merges the visible steps control into segment generation options', () => {
    expect(JSON.parse(buildSegmentGenerationOptionsJson('{}', ''))).toEqual({ steps: 4 });
    expect(JSON.parse(buildSegmentGenerationOptionsJson('{"cfg":1.5,"steps":8,"width":1024,"height":576,"aspectRatio":"16:9"}', '12'))).toEqual({
      cfg: 1.5,
      steps: 12,
    });
  });
});
