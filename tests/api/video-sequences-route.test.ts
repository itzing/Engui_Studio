import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    videoSequence: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    videoSequenceSegment: {
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    videoSegmentTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    job: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

const { mockSubmitGenerationFormData } = vi.hoisted(() => ({
  mockSubmitGenerationFormData: vi.fn(),
}));

vi.mock('@/lib/generation/submitFormData', () => ({
  submitGenerationFormData: mockSubmitGenerationFormData,
}));

const { mockFfmpegService } = vi.hoisted(() => ({
  mockFfmpegService: {
    isFFmpegAvailable: vi.fn(),
    extractVideoFrame: vi.fn(),
  },
}));

vi.mock('@/lib/ffmpegService', () => ({
  ffmpegService: mockFfmpegService,
}));

import { POST as createSequence } from '@/app/api/video-sequences/route';
import { POST as createSegment } from '@/app/api/video-sequences/[id]/segments/route';
import { PATCH as updateSegment } from '@/app/api/video-sequences/[id]/segments/[segmentId]/route';
import { POST as insertFromTemplate } from '@/app/api/video-sequences/[id]/segments/from-template/route';
import { POST as saveSegmentTemplate } from '@/app/api/video-sequences/[id]/segments/[segmentId]/save-template/route';
import { POST as extractSegmentFrames } from '@/app/api/video-sequences/[id]/segments/[segmentId]/extract-frames/route';
import { POST as generateSegment } from '@/app/api/video-sequences/[id]/segments/[segmentId]/generate/route';
import { POST as syncSegmentStatus } from '@/app/api/video-sequences/[id]/segments/[segmentId]/sync-status/route';
import { buildVideoSegmentGenerationFormData } from '@/lib/video-sequences/server';

const createdFiles = new Set<string>();

function request(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function patchRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('video sequence APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockFfmpegService.isFFmpegAvailable.mockResolvedValue(true);
    mockFfmpegService.extractVideoFrame.mockResolvedValue('/tmp/frame.jpg');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const filePath of createdFiles) {
      try {
        fs.unlinkSync(filePath);
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    createdFiles.clear();
  });

  it('creates a persisted video sequence with generation defaults', async () => {
    mockPrisma.videoSequence.create.mockImplementation(async ({ data, include }: any) => ({
      id: 'seq-1',
      ...data,
      finalVideoUrl: null,
      finalRenderJobId: null,
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
      segments: include.segments ? [] : undefined,
    }));

    const response = await createSequence(request('http://localhost/api/video-sequences', {
      workspaceId: 'ws-1',
      title: 'Long take',
      width: 832,
      height: 1216,
      defaultGenerationOptions: { steps: 8, cfg: 1.5 },
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.videoSequence.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        title: 'Long take',
        width: 832,
        height: 1216,
        defaultModelId: 'wan22',
        defaultGenerationOptionsJson: JSON.stringify({ steps: 8, cfg: 1.5 }),
      }),
    }));
    expect(json.sequence).toMatchObject({
      id: 'seq-1',
      title: 'Long take',
      defaultGenerationOptions: { steps: 8, cfg: 1.5 },
      segments: [],
    });
  });

  it('creates the first segment as an initial-source draft', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({ id: 'seq-1' });
    mockPrisma.videoSequenceSegment.count.mockResolvedValue(0);
    mockPrisma.videoSequenceSegment.create.mockImplementation(async ({ data }: any) => ({
      id: 'seg-1',
      ...data,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      templateSnapshotJson: null,
      generationSnapshotJson: null,
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    }));

    const response = await createSegment(request('http://localhost/api/video-sequences/seq-1/segments', {
      prompt: 'slow push in',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.videoSequenceSegment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sequenceId: 'seq-1',
        orderIndex: 0,
        title: 'Segment 1',
        sourceMode: 'initial',
        prompt: 'slow push in',
        status: 'draft',
      }),
    });
    expect(json.segment).toMatchObject({
      id: 'seg-1',
      orderIndex: 0,
      sourceMode: 'initial',
      loraConfig: {},
      generationOptions: {},
    });
  });

  it('inserts a draft segment from a saved template', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({ id: 'seq-1' });
    mockPrisma.videoSegmentTemplate.findUnique.mockResolvedValue({
      id: 'tpl-1',
      workspaceId: 'ws-1',
      name: 'Camera orbit',
      category: 'Camera',
      description: '',
      promptTemplate: 'orbit around the subject',
      negativePromptTemplate: 'jitter',
      motionTemplate: 'smooth orbit',
      continuityTemplate: 'keep clothing stable',
      variablesJson: '[]',
      loraConfigJson: '{"high":0.8}',
      generationOptionsJson: '{"steps":8}',
      defaultDurationSeconds: 6,
      thumbnailUrl: null,
      sourceSegmentId: 'seg-source',
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    });
    mockPrisma.videoSequenceSegment.count.mockResolvedValue(1);
    mockPrisma.videoSequenceSegment.create.mockImplementation(async ({ data }: any) => ({
      id: 'seg-2',
      ...data,
      outputVideoUrl: null,
      firstFrameUrl: '/generations/first.jpg',
      lastFrameUrl: '/generations/last.jpg',
      generationSnapshotJson: null,
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    }));

    const response = await insertFromTemplate(request('http://localhost/api/video-sequences/seq-1/segments/from-template', {
      templateId: 'tpl-1',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.videoSequenceSegment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sequenceId: 'seq-1',
        orderIndex: 1,
        title: 'Camera orbit',
        sourceMode: 'previous_last_frame',
        prompt: 'orbit around the subject',
        templateId: 'tpl-1',
        loraConfigJson: '{"high":0.8}',
      }),
    });
    expect(json.segment).toMatchObject({
      id: 'seg-2',
      title: 'Camera orbit',
      loraConfig: { high: 0.8 },
      generationOptions: { steps: 8 },
    });
  });

  it('saves a selected segment as a reusable template', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      title: 'Slow push',
      prompt: 'slow push in',
      negativePrompt: 'jitter',
      motionPrompt: 'camera push',
      continuityPrompt: 'keep subject stable',
      loraConfigJson: '{"high":0.8}',
      generationOptionsJson: '{"steps":8}',
      durationSeconds: 6,
      firstFrameUrl: '/first.jpg',
      lastFrameUrl: '/last.jpg',
      sequence: { workspaceId: 'ws-1' },
    });
    mockPrisma.videoSegmentTemplate.create.mockImplementation(async ({ data }: any) => ({
      id: 'tpl-1',
      ...data,
      variablesJson: data.variablesJson ?? '[]',
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    }));

    const response = await saveSegmentTemplate(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/save-template', {
      name: 'Slow push template',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.videoSegmentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws-1',
        name: 'Slow push template',
        promptTemplate: 'slow push in',
        thumbnailUrl: '/last.jpg',
        sourceSegmentId: 'seg-1',
      }),
    });
    expect(json.template).toMatchObject({
      id: 'tpl-1',
      name: 'Slow push template',
      loraConfig: { high: 0.8 },
      generationOptions: { steps: 8 },
    });
  });

  it('rejects invalid segment JSON fields before updating', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({ id: 'seg-1' });

    const response = await updateSegment(patchRequest('http://localhost/api/video-sequences/seq-1/segments/seg-1', {
      loraConfigJson: '{broken',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toMatchObject({ success: false, error: 'JSON fields must contain valid JSON' });
    expect(mockPrisma.videoSequenceSegment.update).not.toHaveBeenCalled();
  });

  it('builds a WAN22 segment generation payload from sequence defaults and segment settings', () => {
    const { formData, snapshot } = buildVideoSegmentGenerationFormData({
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        targetFps: 24,
        defaultGenerationOptionsJson: '{"width":832,"height":480,"steps":6}',
      },
      segment: {
        id: 'seg-1',
        modelId: 'wan22',
        prompt: 'slow push in',
        negativePrompt: 'jitter',
        motionPrompt: 'camera glides forward',
        continuityPrompt: 'keep the outfit consistent',
        generationOptionsJson: '{"steps":8}',
        loraConfigJson: '{"lora_high_1":"high.safetensors","lora_low_1_weight":0.8}',
        seed: 123,
        randomizeSeed: false,
        durationSeconds: 6,
      },
      sourceFrameUrl: '/generations/source.png',
      sourceImage: { blob: new Blob(['image'], { type: 'image/png' }), filename: 'source.png' },
    });

    expect(formData.get('modelId')).toBe('wan22');
    expect(formData.get('workspaceId')).toBe('ws-1');
    expect(formData.get('prompt')).toBe('slow push in\n\ncamera glides forward\n\nkeep the outfit consistent');
    expect(formData.get('negativePrompt')).toBe('jitter');
    expect(formData.get('width')).toBe('832');
    expect(formData.get('steps')).toBe('8');
    expect(formData.get('seed')).toBe('123');
    expect(formData.get('lora_high_1')).toBe('high.safetensors');
    expect(formData.get('lora_low_1_weight')).toBe('0.8');
    expect(snapshot.sourceFrameUrl).toBe('/generations/source.png');
  });

  it('rejects segment generation when no source frame can be resolved', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      sourceMode: 'initial',
      sourceImageUrl: null,
      sourceSegmentId: null,
      sourceJobId: null,
      sequence: { id: 'seq-1', workspaceId: 'ws-1' },
    });

    const response = await generateSegment(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/generate', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Source frame is required before generating this segment');
    expect(mockSubmitGenerationFormData).not.toHaveBeenCalled();
  });

  it('queues segment generation and stores the created generation job id', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      sourceMode: 'initial',
      sourceImageUrl: 'https://example.com/source.png',
      sourceSegmentId: null,
      sourceJobId: null,
      prompt: 'slow push in',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        targetFps: 24,
        defaultGenerationOptionsJson: '{}',
      },
    });
    (globalThis.fetch as any).mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }));
    mockSubmitGenerationFormData.mockResolvedValue(Response.json({
      success: true,
      jobId: 'job-1',
      runpodJobId: 'rp-1',
      status: 'IN_QUEUE',
    }));
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: data.status,
      sourceMode: 'initial',
      sourceImageUrl: 'https://example.com/source.png',
      sourceFrozen: false,
      prompt: 'slow push in',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: null,
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      generationJobId: data.generationJobId,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));

    const response = await generateSegment(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/generate', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json.jobId).toBe('job-1');
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'seg-1' },
      data: expect.objectContaining({
        status: 'queued',
        generationJobId: 'job-1',
      }),
    }));
  });

  it('syncs a completed generation job back onto the segment without submitting a new job', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      status: 'queued',
      generationJobId: 'job-1',
      outputVideoUrl: null,
      generationSnapshotJson: '{"jobId":"job-1"}',
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      templateSnapshotJson: null,
    });
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      type: 'video',
      runpodJobId: 'rp-1',
      endpointId: 'wan22',
      resultUrl: '/generations/video.mp4',
      thumbnailUrl: '/generations/video-poster.jpg',
      options: '{"runpodJobId":"rp-1"}',
      executionMs: 1234,
      error: null,
    });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: data.status,
      sourceMode: 'initial',
      sourceImageUrl: '/generations/source.png',
      sourceFrozen: false,
      prompt: '',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: null,
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      generationJobId: 'job-1',
      outputVideoUrl: data.outputVideoUrl,
      firstFrameUrl: '/generations/first.jpg',
      lastFrameUrl: '/generations/last.jpg',
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));

    const response = await syncSegmentStatus(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/sync-status', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.segment).toMatchObject({
      status: 'completed',
      outputVideoUrl: '/generations/video.mp4',
    });
    expect(mockSubmitGenerationFormData).not.toHaveBeenCalled();
  });

  it('extracts first and last frames for a completed local segment video', async () => {
    const videoPath = path.join(process.cwd(), 'public', 'generations', 'video-sequence-test.mp4');
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, 'not a real mp4, ffmpeg is mocked');
    createdFiles.add(videoPath);

    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      status: 'completed',
      outputVideoUrl: '/generations/video-sequence-test.mp4',
      generationSnapshotJson: '{"jobId":"job-1"}',
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      templateSnapshotJson: null,
      sequence: { workspaceId: 'ws-1' },
    });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: 'completed',
      sourceMode: 'initial',
      sourceImageUrl: '/generations/source.png',
      sourceFrozen: false,
      prompt: '',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: null,
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      generationJobId: 'job-1',
      outputVideoUrl: '/generations/video-sequence-test.mp4',
      firstFrameUrl: data.firstFrameUrl,
      lastFrameUrl: data.lastFrameUrl,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));

    const response = await extractSegmentFrames(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/extract-frames', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenCalledTimes(2);
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenNthCalledWith(1, videoPath, expect.stringContaining('/first-'), expect.objectContaining({ position: 'first' }));
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenNthCalledWith(2, videoPath, expect.stringContaining('/last-'), expect.objectContaining({ position: 'last' }));
    expect(json.segment.firstFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/first-[a-f0-9]{8}\.jpg$/);
    expect(json.segment.lastFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/last-[a-f0-9]{8}\.jpg$/);
  });

  it('rejects frame extraction before the segment has an output video', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      outputVideoUrl: null,
      generationSnapshotJson: null,
      sequence: { workspaceId: 'ws-1' },
    });

    const response = await extractSegmentFrames(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/extract-frames', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Segment output video is required before extracting frames');
    expect(mockFfmpegService.extractVideoFrame).not.toHaveBeenCalled();
  });
});
