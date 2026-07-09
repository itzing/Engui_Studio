import { describe, expect, it } from 'vitest';

import {
  getHeaderActionTooltip,
  getRenderBlocker,
  getSegmentSourcePreviewUrl,
  getSegmentInspectorActionTooltip,
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
    generationJobId: null,
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
    expect(getSegmentInspectorActionTooltip('frames', { hasOutput: true })).toContain('first and last frames');
    expect(getSegmentInspectorActionTooltip('galleryVideo', { isFirstSegment: false })).toContain('only seed segment 1');
    expect(getSegmentInspectorActionTooltip('manualFramePicker', { hasPreviousOutput: true })).toContain('pick a custom source frame');
  });
});
