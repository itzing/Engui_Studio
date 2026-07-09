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
    durationSeconds: 6,
    generationJobId: Object.prototype.hasOwnProperty.call(overrides, 'generationJobId') ? overrides.generationJobId : null,
    outputVideoUrl: Object.prototype.hasOwnProperty.call(overrides, 'outputVideoUrl') ? overrides.outputVideoUrl : '/generations/seg.mp4',
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

  it('keeps segment inspector actions discoverable with detailed tooltips', () => {
    expect(getSegmentInspectorActionTooltip('saveSegment')).toContain('source, prompt, model');
    expect(getSegmentInspectorActionTooltip('generate')).toContain('source frame');
    expect(getSegmentInspectorActionTooltip('status', { hasJob: false })).toContain('available after');
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
