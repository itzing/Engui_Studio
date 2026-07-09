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
      updateMany: vi.fn(),
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
    galleryAsset: {
      findFirst: vi.fn(),
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
    concatenateVideos: vi.fn(),
    getVideoInfo: vi.fn(),
  },
}));

vi.mock('@/lib/ffmpegService', () => ({
  ffmpegService: mockFfmpegService,
}));

import { POST as createSequence } from '@/app/api/video-sequences/route';
import { DELETE as deleteSequence } from '@/app/api/video-sequences/[id]/route';
import { POST as generateFromSegment } from '@/app/api/video-sequences/[id]/generate-from/route';
import { POST as renderSequence } from '@/app/api/video-sequences/[id]/render/route';
import { POST as createSegment } from '@/app/api/video-sequences/[id]/segments/route';
import { PATCH as updateSegment } from '@/app/api/video-sequences/[id]/segments/[segmentId]/route';
import { POST as applyGalleryAsset } from '@/app/api/video-sequences/[id]/segments/[segmentId]/gallery-asset/route';
import { POST as insertFromTemplate } from '@/app/api/video-sequences/[id]/segments/from-template/route';
import { POST as saveSegmentTemplate } from '@/app/api/video-sequences/[id]/segments/[segmentId]/save-template/route';
import { POST as extractSegmentFrames } from '@/app/api/video-sequences/[id]/segments/[segmentId]/extract-frames/route';
import { POST as pickManualFrame } from '@/app/api/video-sequences/[id]/segments/[segmentId]/pick-frame/route';
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
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    mockFfmpegService.isFFmpegAvailable.mockResolvedValue(true);
    mockFfmpegService.extractVideoFrame.mockResolvedValue('/tmp/frame.jpg');
    mockFfmpegService.concatenateVideos.mockResolvedValue('/tmp/final.mp4');
    mockFfmpegService.getVideoInfo.mockResolvedValue({ duration: 4, width: 832, height: 1216, fps: 24, format: '.mp4' });
    mockPrisma.videoSequenceSegment.findMany.mockResolvedValue([]);
    mockPrisma.videoSequenceSegment.updateMany.mockResolvedValue({ count: 0 });
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

  it('deletes a video sequence', async () => {
    mockPrisma.videoSequence.delete.mockResolvedValue({ id: 'seq-1' });

    const response = await deleteSequence(new NextRequest('http://localhost/api/video-sequences/seq-1', {
      method: 'DELETE',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.videoSequence.delete).toHaveBeenCalledWith({ where: { id: 'seq-1' } });
    expect(json).toEqual({ success: true, deleted: true });
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
        seed: 40,
        randomizeSeed: false,
        durationSeconds: 5,
      }),
    });
    expect(json.segment).toMatchObject({
      id: 'seg-1',
      orderIndex: 0,
      sourceMode: 'initial',
      durationSeconds: 5,
      loraConfig: {},
      generationOptions: {},
    });
  });

  it('applies a Gallery image as the selected segment source frame', async () => {
    const existingSegment = {
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: 'draft',
      sourceMode: 'initial',
      sourceImageUrl: null,
      sourceImageAssetId: null,
      sourceJobId: null,
      sourceSegmentId: null,
      sourceFrameRole: 'last',
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
      generationJobId: null,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: null,
      error: null,
      sequence: { workspaceId: 'ws-1' },
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    };
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue(existingSegment);
    mockPrisma.galleryAsset.findFirst.mockResolvedValue({
      id: 'asset-image-1',
      type: 'image',
      originalUrl: '/generations/gallery/ws-1/image.png',
      previewUrl: '/generations/gallery/ws-1/image.webp',
      thumbnailUrl: '/generations/gallery/ws-1/thumb.webp',
      sourceJobId: 'job-image-1',
    });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: 'draft',
      sourceFrameRole: 'last',
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
      generationJobId: null,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: null,
      error: null,
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
      ...data,
    }));

    const response = await applyGalleryAsset(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/gallery-asset', {
      assetId: 'asset-image-1',
      mode: 'initial_image',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.galleryAsset.findFirst).toHaveBeenCalledWith({
      where: { id: 'asset-image-1', workspaceId: 'ws-1', trashed: false },
      select: expect.any(Object),
    });
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith({
      where: { id: 'seg-1' },
      data: expect.objectContaining({
        sourceMode: 'gallery_asset',
        sourceImageAssetId: 'asset-image-1',
        sourceImageUrl: '/generations/gallery/ws-1/image.png',
        sourceJobId: 'job-image-1',
      }),
    });
    expect(json.segment).toMatchObject({
      sourceImageAssetId: 'asset-image-1',
      sourceImageUrl: '/generations/gallery/ws-1/image.png',
    });
  });

  it('applies a Gallery video as the first completed segment output', async () => {
    const videoPath = path.join(process.cwd(), 'public', 'generations', 'gallery', 'ws-1', 'video.mp4');
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, 'not a real mp4, ffmpeg is mocked');
    createdFiles.add(videoPath);
    const existingSegment = {
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: 'completed',
      sourceMode: 'initial',
      sourceImageUrl: '/generations/old-source.png',
      sourceImageAssetId: null,
      sourceJobId: null,
      sourceSegmentId: null,
      sourceFrameRole: 'last',
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
      generationJobId: 'job-old',
      outputVideoUrl: '/generations/old-video.mp4',
      firstFrameUrl: '/generations/old-first.jpg',
      lastFrameUrl: '/generations/old-last.jpg',
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: null,
      error: null,
      sequence: { workspaceId: 'ws-1' },
      createdAt: new Date('2026-07-08T22:00:00Z'),
      updatedAt: new Date('2026-07-08T22:00:00Z'),
    };
    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce(existingSegment)
      .mockResolvedValueOnce({
        ...existingSegment,
        status: 'completed',
        sourceMode: 'gallery_asset',
        sourceImageAssetId: 'asset-video-1',
        sourceImageUrl: '/generations/gallery/ws-1/video-thumb.jpg',
        sourceFrozen: true,
        outputVideoUrl: '/generations/gallery/ws-1/video.mp4',
        firstFrameUrl: null,
        lastFrameUrl: null,
        generationJobId: null,
        generationSnapshotJson: '{"source":"gallery_asset","assetId":"asset-video-1","originalUrl":"/generations/gallery/ws-1/video.mp4"}',
      });
    mockPrisma.galleryAsset.findFirst.mockResolvedValue({
      id: 'asset-video-1',
      type: 'video',
      originalUrl: '/generations/gallery/ws-1/video.mp4',
      previewUrl: '/generations/gallery/ws-1/video.mp4',
      thumbnailUrl: '/generations/gallery/ws-1/video-thumb.jpg',
      sourceJobId: 'job-video-1',
    });
    mockPrisma.videoSequenceSegment.findMany.mockResolvedValueOnce([
      {
        id: 'seg-2',
        status: 'completed',
        sourceMode: 'previous_last_frame',
        sourceFrozen: false,
        outputVideoUrl: '/generations/seg-2.mp4',
        firstFrameUrl: null,
        lastFrameUrl: '/generations/seg-2-last.jpg',
        generationJobId: 'job-2',
      },
    ]);
    let currentSegment = { ...existingSegment };
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => {
      currentSegment = { ...currentSegment, ...data };
      return currentSegment;
    });

    const response = await applyGalleryAsset(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/gallery-asset', {
      assetId: 'asset-video-1',
      mode: 'completed_video',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith({
      where: { id: 'seg-1' },
      data: expect.objectContaining({
        status: 'completed',
        sourceMode: 'gallery_asset',
        sourceImageAssetId: 'asset-video-1',
        sourceImageUrl: '/generations/gallery/ws-1/video-thumb.jpg',
        sourceFrozen: true,
        outputVideoUrl: '/generations/gallery/ws-1/video.mp4',
        firstFrameUrl: null,
        lastFrameUrl: null,
        generationJobId: null,
      }),
    });
    expect(mockFfmpegService.getVideoInfo).toHaveBeenCalledWith(videoPath);
    expect(mockPrisma.videoSequence.update).toHaveBeenCalledWith({
      where: { id: 'seq-1' },
      data: {
        width: 832,
        height: 1216,
        aspectRatio: '13:19',
      },
    });
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenCalledTimes(2);
    expect(mockPrisma.videoSequenceSegment.updateMany).toHaveBeenCalled();
    expect(json.segment).toMatchObject({
      status: 'completed',
      outputVideoUrl: '/generations/gallery/ws-1/video.mp4',
    });
    expect(json.segment.firstFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/first-[a-f0-9]{8}\.jpg$/);
    expect(json.segment.lastFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/last-[a-f0-9]{8}\.jpg$/);
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
        seed: 40,
        randomizeSeed: false,
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
        width: 1280,
        height: 720,
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
    expect(formData.get('width')).toBe('1280');
    expect(formData.get('height')).toBe('720');
    expect(formData.get('steps')).toBe('8');
    expect(formData.get('seed')).toBe('123');
    expect(formData.get('lora_high_1')).toBe('high.safetensors');
    expect(formData.get('lora_low_1_weight')).toBe('0.8');
    expect(snapshot.sourceFrameUrl).toBe('/generations/source.png');
  });

  it('uses sequence dimensions when segment generation options do not override them', () => {
    const { formData, snapshot } = buildVideoSegmentGenerationFormData({
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        width: 832,
        height: 1216,
        targetFps: 24,
        defaultGenerationOptionsJson: '{"steps":4}',
      },
      segment: {
        id: 'seg-2',
        modelId: 'wan22',
        prompt: 'portrait follow-up',
        negativePrompt: '',
        motionPrompt: '',
        continuityPrompt: '',
        generationOptionsJson: '{}',
        loraConfigJson: '{}',
        seed: null,
        randomizeSeed: true,
        durationSeconds: 6,
      },
      sourceFrameUrl: '/generations/manual.jpg',
      sourceImage: { blob: new Blob(['image'], { type: 'image/jpeg' }), filename: 'manual.jpg' },
    });

    expect(formData.get('width')).toBe('832');
    expect(formData.get('height')).toBe('1216');
    expect(formData.get('steps')).toBe('4');
    expect(snapshot.generationOptions).toMatchObject({ width: 832, height: 1216, steps: 4 });
  });

  it('ignores source frame dimensions and keeps the sequence resolution', () => {
    const { formData, snapshot } = buildVideoSegmentGenerationFormData({
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        width: 1280,
        height: 720,
        targetFps: 24,
        defaultGenerationOptionsJson: '{"steps":4}',
      },
      segment: {
        id: 'seg-2',
        modelId: 'wan22',
        prompt: 'portrait follow-up',
        negativePrompt: '',
        motionPrompt: '',
        continuityPrompt: '',
        generationOptionsJson: '{}',
        loraConfigJson: '{}',
        seed: null,
        randomizeSeed: true,
        durationSeconds: 6,
      },
      sourceFrameUrl: '/generations/manual.jpg',
      sourceImage: { blob: new Blob(['image'], { type: 'image/jpeg' }), filename: 'manual.jpg', width: 832, height: 1216 },
    });

    expect(formData.get('width')).toBe('1280');
    expect(formData.get('height')).toBe('720');
    expect(snapshot.generationOptions).toMatchObject({ width: 1280, height: 720, steps: 4 });
  });

  it('ignores generation option resolution overrides and keeps the sequence resolution', () => {
    const { formData, snapshot } = buildVideoSegmentGenerationFormData({
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        width: 1280,
        height: 720,
        targetFps: 24,
        defaultGenerationOptionsJson: '{"width":1024,"height":576,"steps":4}',
      },
      segment: {
        id: 'seg-2',
        modelId: 'wan22',
        prompt: 'landscape override',
        negativePrompt: '',
        motionPrompt: '',
        continuityPrompt: '',
        generationOptionsJson: '{}',
        loraConfigJson: '{}',
        seed: null,
        randomizeSeed: true,
        durationSeconds: 6,
      },
      sourceFrameUrl: '/generations/manual.jpg',
      sourceImage: { blob: new Blob(['image'], { type: 'image/jpeg' }), filename: 'manual.jpg', width: 832, height: 1216 },
    });

    expect(formData.get('width')).toBe('1280');
    expect(formData.get('height')).toBe('720');
    expect(snapshot.generationOptions).toMatchObject({ width: 1280, height: 720, steps: 4 });
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

  it('queues manual frame generation with the picked frame and sequence portrait size', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-2',
      sequenceId: 'seq-1',
      orderIndex: 1,
      title: 'Segment 2',
      sourceMode: 'manual_frame',
      sourceImageUrl: 'https://example.com/manual-picked.jpg',
      sourceImageAssetId: null,
      sourceSegmentId: 'seg-1',
      sourceJobId: null,
      sourceFrameRole: 'custom',
      sourceFrozen: false,
      prompt: 'continue from picked portrait frame',
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
      generationJobId: null,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: null,
      error: null,
      sequence: {
        id: 'seq-1',
        workspaceId: 'ws-1',
        defaultModelId: 'wan22',
        width: 832,
        height: 1216,
        targetFps: 24,
        defaultGenerationOptionsJson: '{"steps":4}',
      },
    });
    (globalThis.fetch as any).mockResolvedValue(new Response(new Blob(['manual-image'], { type: 'image/jpeg' }), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    }));
    mockSubmitGenerationFormData.mockResolvedValue(Response.json({
      success: true,
      jobId: 'job-2',
      runpodJobId: 'rp-2',
      status: 'IN_QUEUE',
    }));
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-2',
      sequenceId: 'seq-1',
      orderIndex: 1,
      title: 'Segment 2',
      status: data.status,
      sourceMode: 'manual_frame',
      sourceImageUrl: 'https://example.com/manual-picked.jpg',
      sourceImageAssetId: null,
      sourceSegmentId: 'seg-1',
      sourceJobId: null,
      sourceFrameRole: 'custom',
      sourceFrozen: false,
      prompt: 'continue from picked portrait frame',
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

    const response = await generateSegment(request('http://localhost/api/video-sequences/seq-1/segments/seg-2/generate', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-2' }),
    });
    const json = await response.json();
    const submittedFormData = mockSubmitGenerationFormData.mock.calls[0][0] as FormData;
    const generationSnapshotJson = mockPrisma.videoSequenceSegment.update.mock.calls[0][0].data.generationSnapshotJson;
    const generationSnapshot = JSON.parse(generationSnapshotJson);

    expect(response.status).toBe(202);
    expect(json.jobId).toBe('job-2');
    expect(globalThis.fetch).toHaveBeenCalledWith('https://example.com/manual-picked.jpg');
    expect(submittedFormData.get('width')).toBe('832');
    expect(submittedFormData.get('height')).toBe('1216');
    expect(submittedFormData.get('steps')).toBe('4');
    expect(generationSnapshot.sourceFrameUrl).toBe('https://example.com/manual-picked.jpg');
    expect(generationSnapshot.generationOptions).toMatchObject({ width: 832, height: 1216, steps: 4 });
    expect(mockPrisma.videoSequenceSegment.findFirst).toHaveBeenCalledTimes(1);
  });

  it('syncs a completed generation job back onto the segment without submitting a new job', async () => {
    const sourceVideoPath = path.join(process.cwd(), 'public', 'generations', 'video.mp4');
    fs.mkdirSync(path.dirname(sourceVideoPath), { recursive: true });
    fs.writeFileSync(sourceVideoPath, 'sequence job output');
    createdFiles.add(sourceVideoPath);

    let copiedOutputVideoUrl = '/generations/video.mp4';
    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce({
      id: 'seg-1',
      sequenceId: 'seq-1',
      status: 'queued',
      generationJobId: 'job-1',
      outputVideoUrl: '/generations/video.mp4',
      generationSnapshotJson: '{"jobId":"job-1"}',
      loraConfigJson: '{}',
      generationOptionsJson: '{}',
      templateSnapshotJson: null,
      sequence: { workspaceId: 'ws-1' },
    })
      .mockImplementation(async () => ({
        id: 'seg-1',
        sequenceId: 'seq-1',
        status: 'completed',
        generationJobId: 'job-1',
        outputVideoUrl: copiedOutputVideoUrl,
        generationSnapshotJson: '{"jobId":"job-1"}',
        loraConfigJson: '{}',
        generationOptionsJson: '{}',
        templateSnapshotJson: null,
        lastFrameUrl: null,
        sequence: { workspaceId: 'ws-1' },
      }));
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'completed',
      type: 'video',
      modelId: 'wan22',
      prompt: 'segment prompt',
      runpodJobId: 'rp-1',
      endpointId: 'wan22',
      resultUrl: '/generations/video.mp4',
      thumbnailUrl: '/generations/video-poster.jpg',
      options: '{"runpodJobId":"rp-1"}',
      executionMs: 1234,
      error: null,
    });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      ...(data.outputVideoUrl ? { outputVideoUrl: (copiedOutputVideoUrl = data.outputVideoUrl) } : {}),
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      title: 'Segment 1',
      status: data.status || 'completed',
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
      outputVideoUrl: data.outputVideoUrl || copiedOutputVideoUrl,
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
      outputVideoUrl: expect.stringMatching(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/output\/job-job-1-/),
    });
    const copiedPath = path.join(process.cwd(), 'public', json.segment.outputVideoUrl.replace(/^\/+/, ''));
    createdFiles.add(copiedPath);
    expect(fs.existsSync(copiedPath)).toBe(true);
    const snapshot = JSON.parse(mockPrisma.videoSequenceSegment.update.mock.calls[0][0].data.generationSnapshotJson);
    expect(snapshot).toMatchObject({
      resultUrl: json.segment.outputVideoUrl,
      sourceResultUrl: '/generations/video.mp4',
      jobMetadata: {
        id: 'job-1',
        prompt: 'segment prompt',
        options: { runpodJobId: 'rp-1' },
      },
      outputMaterialization: {
        copied: true,
        sourceOutputVideoUrl: '/generations/video.mp4',
        sourceJobId: 'job-1',
      },
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

  it('picks a manual source frame from the previous segment output video', async () => {
    const videoPath = path.join(process.cwd(), 'public', 'generations', 'video-sequence-picker-test.mp4');
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, 'not a real mp4, ffmpeg is mocked');
    createdFiles.add(videoPath);

    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce({
        id: 'seg-2',
        sequenceId: 'seq-1',
        orderIndex: 1,
        status: 'draft',
        outputVideoUrl: null,
        firstFrameUrl: null,
        lastFrameUrl: null,
        generationJobId: null,
        generationSnapshotJson: '{"draft":true}',
        loraConfigJson: '{}',
        generationOptionsJson: '{}',
        templateSnapshotJson: null,
        sequence: { workspaceId: 'ws-1' },
      })
      .mockResolvedValueOnce({
        id: 'seg-1',
        outputVideoUrl: '/generations/video-sequence-picker-test.mp4',
      });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-2',
      sequenceId: 'seq-1',
      orderIndex: 1,
      title: 'Segment 2',
      status: data.status ?? 'draft',
      sourceMode: data.sourceMode,
      sourceImageUrl: data.sourceImageUrl,
      sourceImageAssetId: data.sourceImageAssetId,
      sourceJobId: data.sourceJobId,
      sourceSegmentId: data.sourceSegmentId,
      sourceFrameRole: data.sourceFrameRole,
      sourceFrozen: data.sourceFrozen,
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
      generationJobId: null,
      outputVideoUrl: null,
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));

    const response = await pickManualFrame(request('http://localhost/api/video-sequences/seq-1/segments/seg-2/pick-frame', {
      timeSeconds: 1.25,
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-2' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenCalledWith(
      videoPath,
      expect.stringContaining('/manual-'),
      expect.objectContaining({ time: '1.250', format: 'jpg', quality: 3 }),
    );
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith({
      where: { id: 'seg-2' },
      data: expect.objectContaining({
        sourceMode: 'manual_frame',
        sourceImageUrl: expect.stringMatching(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-2\/frames\/manual-[a-f0-9]{10}\.jpg$/),
        sourceSegmentId: 'seg-1',
        sourceFrameRole: 'custom',
      }),
    });
    expect(json.segment.sourceMode).toBe('manual_frame');
    expect(json.segment.sourceImageUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-2\/frames\/manual-[a-f0-9]{10}\.jpg$/);
  });

  it('generate-from queues the first eligible segment after a completed previous segment', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      workspaceId: 'ws-1',
      defaultModelId: 'wan22',
      targetFps: 24,
      defaultGenerationOptionsJson: '{}',
      segments: [
        {
          id: 'seg-1',
          sequenceId: 'seq-1',
          orderIndex: 0,
          title: 'Segment 1',
          status: 'completed',
          sourceMode: 'initial',
          generationJobId: 'job-1',
          outputVideoUrl: '/generations/seg-1.mp4',
          firstFrameUrl: '/generations/first.jpg',
          lastFrameUrl: 'https://example.com/last.png',
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: null,
        },
        {
          id: 'seg-2',
          sequenceId: 'seq-1',
          orderIndex: 1,
          title: 'Segment 2',
          status: 'draft',
          sourceMode: 'previous_last_frame',
          generationJobId: null,
          outputVideoUrl: null,
          firstFrameUrl: null,
          lastFrameUrl: null,
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: null,
        },
      ],
    });
    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce({
        id: 'seg-1',
        title: 'Segment 1',
        status: 'completed',
        generationJobId: 'job-1',
        outputVideoUrl: '/generations/seg-1.mp4',
        lastFrameUrl: 'https://example.com/last.png',
      })
      .mockResolvedValueOnce({
        id: 'seg-2',
        sequenceId: 'seq-1',
        orderIndex: 1,
        title: 'Segment 2',
        status: 'draft',
        sourceMode: 'previous_last_frame',
        sourceImageUrl: null,
        sourceSegmentId: null,
        sourceJobId: null,
        prompt: 'continue motion',
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
      })
      .mockResolvedValueOnce({
        id: 'seg-1',
        lastFrameUrl: 'https://example.com/last.png',
        outputVideoUrl: '/generations/seg-1.mp4',
      });
    (globalThis.fetch as any).mockResolvedValue(new Response(new Blob(['image'], { type: 'image/png' }), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    }));
    mockSubmitGenerationFormData.mockResolvedValue(Response.json({
      success: true,
      jobId: 'job-2',
      runpodJobId: 'rp-2',
      status: 'IN_QUEUE',
    }));
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      id: 'seg-2',
      sequenceId: 'seq-1',
      orderIndex: 1,
      title: 'Segment 2',
      status: data.status,
      sourceMode: 'previous_last_frame',
      sourceImageUrl: null,
      sourceFrozen: false,
      prompt: 'continue motion',
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

    const response = await generateFromSegment(request('http://localhost/api/video-sequences/seq-1/generate-from', {
      segmentId: 'seg-2',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(202);
    expect(json).toMatchObject({ success: true, action: 'queued', jobId: 'job-2' });
    expect(mockSubmitGenerationFormData).toHaveBeenCalledTimes(1);
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'seg-2' },
      data: expect.objectContaining({ status: 'queued', generationJobId: 'job-2' }),
    }));
  });

  it('generate-from syncs an in-flight selected segment instead of submitting a duplicate job', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      segments: [
        {
          id: 'seg-1',
          sequenceId: 'seq-1',
          orderIndex: 0,
          title: 'Segment 1',
          status: 'queued',
          sourceMode: 'initial',
          generationJobId: 'job-1',
          outputVideoUrl: null,
          firstFrameUrl: null,
          lastFrameUrl: null,
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: '{"jobId":"job-1"}',
        },
      ],
    });
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
      status: 'processing',
      runpodJobId: 'rp-1',
      endpointId: 'wan22',
      resultUrl: null,
      thumbnailUrl: null,
      options: '{"runpodJobId":"rp-1"}',
      executionMs: null,
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
      firstFrameUrl: null,
      lastFrameUrl: null,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));

    const response = await generateFromSegment(request('http://localhost/api/video-sequences/seq-1/generate-from', {
      segmentId: 'seg-1',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({ success: true, action: 'waiting', jobId: 'job-1' });
    expect(mockSubmitGenerationFormData).not.toHaveBeenCalled();
  });

  it('generate-from waits when a previous_last_frame segment has no previous last frame yet', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      segments: [
        {
          id: 'seg-2',
          sequenceId: 'seq-1',
          orderIndex: 1,
          title: 'Segment 2',
          status: 'draft',
          sourceMode: 'previous_last_frame',
          generationJobId: null,
          outputVideoUrl: null,
          firstFrameUrl: null,
          lastFrameUrl: null,
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: null,
        },
      ],
    });
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      title: 'Segment 1',
      status: 'completed',
      generationJobId: 'job-1',
      outputVideoUrl: null,
      lastFrameUrl: null,
    });

    const response = await generateFromSegment(request('http://localhost/api/video-sequences/seq-1/generate-from', {
      segmentId: 'seg-2',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      action: 'waiting',
      message: 'Generation is waiting for the previous segment last frame',
    });
    expect(mockSubmitGenerationFormData).not.toHaveBeenCalled();
  });

  it('marks a generated segment stale when generation options change without deleting output media', async () => {
    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      status: 'completed',
      sourceMode: 'initial',
      sourceImageUrl: '/generations/source.png',
      sourceImageAssetId: null,
      sourceJobId: null,
      sourceSegmentId: null,
      sourceFrameRole: 'last',
      prompt: 'slow push in',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: null,
      loraConfigJson: '{}',
      generationOptionsJson: '{"steps":8}',
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      generationJobId: 'job-1',
      outputVideoUrl: '/generations/seg-1.mp4',
      firstFrameUrl: '/generations/first.jpg',
      lastFrameUrl: '/generations/last.jpg',
      templateSnapshotJson: null,
      generationSnapshotJson: '{"jobId":"job-1"}',
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
      prompt: 'slow push in',
      negativePrompt: '',
      motionPrompt: '',
      continuityPrompt: '',
      modelId: 'wan22',
      endpointId: null,
      loraConfigJson: '{}',
      generationOptionsJson: data.generationOptionsJson,
      seed: null,
      randomizeSeed: true,
      durationSeconds: 6,
      generationJobId: 'job-1',
      outputVideoUrl: '/generations/seg-1.mp4',
      firstFrameUrl: '/generations/first.jpg',
      lastFrameUrl: '/generations/last.jpg',
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: '{"jobId":"job-1"}',
      error: null,
    }));

    const response = await updateSegment(patchRequest('http://localhost/api/video-sequences/seq-1/segments/seg-1', {
      generationOptionsJson: '{"steps":12}',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'seg-1' },
      data: expect.objectContaining({
        status: 'stale',
        generationOptionsJson: '{"steps":12}',
      }),
    }));
    expect(json.segment).toMatchObject({
      status: 'stale',
      outputVideoUrl: '/generations/seg-1.mp4',
      lastFrameUrl: '/generations/last.jpg',
    });
  });

  it('auto-extracts first and last frames when segment output changes', async () => {
    const videoPath = path.join(process.cwd(), 'public', 'generations', 'video-sequence-new-output.mp4');
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, 'not a real mp4, ffmpeg is mocked');
    createdFiles.add(videoPath);

    const existingSegment = {
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
      outputVideoUrl: '/generations/old-output.mp4',
      firstFrameUrl: '/generations/old-first.jpg',
      lastFrameUrl: '/generations/old-last.jpg',
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: '{"jobId":"job-1"}',
      error: null,
      sequence: { workspaceId: 'ws-1' },
    };
    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce(existingSegment)
      .mockResolvedValueOnce({
        ...existingSegment,
        outputVideoUrl: '/generations/video-sequence-new-output.mp4',
        firstFrameUrl: null,
        lastFrameUrl: null,
      });
    mockPrisma.videoSequenceSegment.update.mockImplementation(async ({ data }: any) => ({
      ...existingSegment,
      ...data,
    }));

    const response = await updateSegment(patchRequest('http://localhost/api/video-sequences/seq-1/segments/seg-1', {
      outputVideoUrl: '/generations/video-sequence-new-output.mp4',
    }) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.videoSequenceSegment.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'seg-1' },
      data: expect.objectContaining({
        outputVideoUrl: '/generations/video-sequence-new-output.mp4',
        firstFrameUrl: null,
        lastFrameUrl: null,
      }),
    });
    expect(mockFfmpegService.extractVideoFrame).toHaveBeenCalledTimes(2);
    expect(json.segment.firstFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/first-[a-f0-9]{8}\.jpg$/);
    expect(json.segment.lastFrameUrl).toMatch(/^\/generations\/video-sequences\/ws-1\/seq-1\/seg-1\/frames\/last-[a-f0-9]{8}\.jpg$/);
  });

  it('marks downstream previous-last-frame outputs stale when extracted last frame changes', async () => {
    const videoPath = path.join(process.cwd(), 'public', 'generations', 'video-sequence-stale-test.mp4');
    fs.mkdirSync(path.dirname(videoPath), { recursive: true });
    fs.writeFileSync(videoPath, 'not a real mp4, ffmpeg is mocked');
    createdFiles.add(videoPath);

    mockPrisma.videoSequenceSegment.findFirst.mockResolvedValue({
      id: 'seg-1',
      sequenceId: 'seq-1',
      orderIndex: 0,
      status: 'completed',
      outputVideoUrl: '/generations/video-sequence-stale-test.mp4',
      firstFrameUrl: '/generations/old-first.jpg',
      lastFrameUrl: '/generations/old-last.jpg',
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
      outputVideoUrl: '/generations/video-sequence-stale-test.mp4',
      firstFrameUrl: data.firstFrameUrl,
      lastFrameUrl: data.lastFrameUrl,
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));
    mockPrisma.videoSequenceSegment.findMany.mockResolvedValue([
      {
        id: 'seg-2',
        status: 'completed',
        sourceMode: 'previous_last_frame',
        sourceFrozen: false,
        outputVideoUrl: '/generations/seg-2.mp4',
        firstFrameUrl: '/generations/seg-2-first.jpg',
        lastFrameUrl: '/generations/seg-2-last.jpg',
        generationJobId: 'job-2',
      },
      {
        id: 'seg-3',
        status: 'completed',
        sourceMode: 'previous_last_frame',
        sourceFrozen: true,
        outputVideoUrl: '/generations/seg-3.mp4',
        firstFrameUrl: '/generations/seg-3-first.jpg',
        lastFrameUrl: '/generations/seg-3-last.jpg',
        generationJobId: 'job-3',
      },
    ]);

    const response = await extractSegmentFrames(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/extract-frames', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockPrisma.videoSequenceSegment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['seg-2'] } },
      data: { status: 'stale' },
    });
  });

  it('marks downstream previous-last-frame outputs stale when a generated upstream segment is queued again', async () => {
    mockPrisma.videoSequenceSegment.findFirst
      .mockResolvedValueOnce({
        id: 'seg-1',
        sequenceId: 'seq-1',
        orderIndex: 0,
        title: 'Segment 1',
        status: 'completed',
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
        generationJobId: 'job-old',
        outputVideoUrl: '/generations/seg-1-old.mp4',
        firstFrameUrl: '/generations/seg-1-first.jpg',
        lastFrameUrl: '/generations/seg-1-last.jpg',
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
      jobId: 'job-new',
      runpodJobId: 'rp-new',
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
      outputVideoUrl: '/generations/seg-1-old.mp4',
      firstFrameUrl: '/generations/seg-1-first.jpg',
      lastFrameUrl: '/generations/seg-1-last.jpg',
      templateId: null,
      templateSnapshotJson: null,
      generationSnapshotJson: data.generationSnapshotJson,
      error: data.error,
    }));
    mockPrisma.videoSequenceSegment.findMany.mockResolvedValue([
      {
        id: 'seg-2',
        status: 'completed',
        sourceMode: 'previous_last_frame',
        sourceFrozen: false,
        outputVideoUrl: '/generations/seg-2.mp4',
        firstFrameUrl: '/generations/seg-2-first.jpg',
        lastFrameUrl: '/generations/seg-2-last.jpg',
        generationJobId: 'job-2',
      },
    ]);

    const response = await generateSegment(request('http://localhost/api/video-sequences/seq-1/segments/seg-1/generate', {}) as any, {
      params: Promise.resolve({ id: 'seq-1', segmentId: 'seg-1' }),
    });

    expect(response.status).toBe(202);
    expect(mockPrisma.videoSequenceSegment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['seg-2'] } },
      data: { status: 'stale' },
    });
  });

  it('renders a completed sequence into one final local video', async () => {
    const firstVideoPath = path.join(process.cwd(), 'public', 'generations', 'sequence-render-seg-1.mp4');
    const secondVideoPath = path.join(process.cwd(), 'public', 'results', 'sequence-render-seg-2.mp4');
    fs.mkdirSync(path.dirname(firstVideoPath), { recursive: true });
    fs.mkdirSync(path.dirname(secondVideoPath), { recursive: true });
    fs.writeFileSync(firstVideoPath, 'segment 1');
    fs.writeFileSync(secondVideoPath, 'segment 2');
    createdFiles.add(firstVideoPath);
    createdFiles.add(secondVideoPath);

    mockPrisma.videoSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      workspaceId: 'ws-1',
      title: 'Long take',
      description: '',
      status: 'draft',
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      targetFps: 24,
      defaultModelId: 'wan22',
      defaultGenerationOptionsJson: '{}',
      finalVideoUrl: null,
      finalRenderJobId: null,
      segments: [
        {
          id: 'seg-1',
          sequenceId: 'seq-1',
          orderIndex: 0,
          title: 'Segment 1',
          status: 'completed',
          outputVideoUrl: '/generations/sequence-render-seg-1.mp4',
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: null,
        },
        {
          id: 'seg-2',
          sequenceId: 'seq-1',
          orderIndex: 1,
          title: 'Segment 2',
          status: 'completed',
          outputVideoUrl: '/results/sequence-render-seg-2.mp4',
          loraConfigJson: '{}',
          generationOptionsJson: '{}',
          templateSnapshotJson: null,
          generationSnapshotJson: null,
        },
      ],
    });
    mockPrisma.videoSequence.update.mockImplementation(async ({ data, include }: any) => ({
      id: 'seq-1',
      workspaceId: 'ws-1',
      title: 'Long take',
      description: '',
      status: data.status,
      aspectRatio: '16:9',
      width: 1280,
      height: 720,
      targetFps: 24,
      defaultModelId: 'wan22',
      defaultGenerationOptionsJson: '{}',
      finalVideoUrl: data.finalVideoUrl,
      finalRenderJobId: data.finalRenderJobId,
      createdAt: new Date('2026-07-09T06:30:00Z'),
      updatedAt: new Date('2026-07-09T06:30:00Z'),
      segments: include.segments ? [] : undefined,
    }));

    const response = await renderSequence(request('http://localhost/api/video-sequences/seq-1/render', {}) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockFfmpegService.concatenateVideos).toHaveBeenCalledWith(
      [firstVideoPath, secondVideoPath],
      expect.stringMatching(/\/public\/generations\/video-sequences\/ws-1\/seq-1\/final\/final-[a-f0-9]{10}\.mp4$/),
    );
    expect(mockPrisma.videoSequence.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'seq-1' },
      data: expect.objectContaining({
        status: 'rendered',
        finalVideoUrl: expect.stringMatching(/^\/generations\/video-sequences\/ws-1\/seq-1\/final\/final-[a-f0-9]{10}\.mp4$/),
      }),
    }));
    expect(json.sequence).toMatchObject({
      id: 'seq-1',
      status: 'rendered',
      finalVideoUrl: expect.stringMatching(/^\/generations\/video-sequences\/ws-1\/seq-1\/final\/final-[a-f0-9]{10}\.mp4$/),
    });
  });

  it('rejects final render when any segment is not completed', async () => {
    mockPrisma.videoSequence.findUnique.mockResolvedValue({
      id: 'seq-1',
      workspaceId: 'ws-1',
      segments: [
        {
          id: 'seg-1',
          sequenceId: 'seq-1',
          orderIndex: 0,
          title: 'Segment 1',
          status: 'completed',
          outputVideoUrl: '/generations/seg-1.mp4',
        },
        {
          id: 'seg-2',
          sequenceId: 'seq-1',
          orderIndex: 1,
          title: 'Segment 2',
          status: 'stale',
          outputVideoUrl: '/generations/seg-2.mp4',
        },
      ],
    });

    const response = await renderSequence(request('http://localhost/api/video-sequences/seq-1/render', {}) as any, {
      params: Promise.resolve({ id: 'seq-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Segment 2 is stale; render requires every segment to be completed');
    expect(mockFfmpegService.concatenateVideos).not.toHaveBeenCalled();
  });
});
