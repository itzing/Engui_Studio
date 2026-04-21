import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type ReuseAction = 'txt2img' | 'img2img' | 'img2vid';

type NormalizedJobOutput = {
  outputId: string;
  type: 'image' | 'video' | 'audio';
  url: string;
};

function parseJobOptions(rawOptions: unknown): Record<string, any> {
  if (!rawOptions) return {};
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === 'object' ? (rawOptions as Record<string, any>) : {};
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function buildNormalizedOutputs(job: any): NormalizedJobOutput[] {
  const options = parseJobOptions(job.options);
  const mediaType = job.type === 'video' ? 'video' : (job.type === 'audio' || job.type === 'tts' || job.type === 'music') ? 'audio' : 'image';
  const secureMode = options.secureMode === true;

  const directCandidates = secureMode
    ? [normalizeUrlCandidate(job.resultUrl)].filter(Boolean) as string[]
    : [
        normalizeUrlCandidate(job.resultUrl),
        normalizeUrlCandidate(options.url),
        normalizeUrlCandidate(options.resultUrl),
        normalizeUrlCandidate(options.image),
        normalizeUrlCandidate(options.image_url),
        normalizeUrlCandidate(options.image_path),
        normalizeUrlCandidate(options.video),
        normalizeUrlCandidate(options.video_url),
        normalizeUrlCandidate(options.video_path),
        normalizeUrlCandidate(options.audioUrl),
        normalizeUrlCandidate(options.output_path),
        normalizeUrlCandidate(options.s3_path),
      ].filter(Boolean) as string[];

  const listCandidates: string[] = [];
  for (const key of ['images', 'videos', 'outputs', 'resultUrls'] as const) {
    const value = options[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        const normalized = normalizeUrlCandidate(item);
        if (normalized) listCandidates.push(normalized);
      }
    }
  }

  const uniqueUrls = Array.from(new Set([...directCandidates, ...listCandidates]));
  return uniqueUrls.map((url, index) => ({
    outputId: `output-${index + 1}`,
    type: mediaType,
    url,
  }));
}

function buildReusePayload(action: ReuseAction, outputUrl: string, snapshot: Record<string, any>) {
  const prompt = typeof snapshot.prompt === 'string' ? snapshot.prompt : '';
  const modelId = typeof snapshot.modelId === 'string' ? snapshot.modelId : undefined;
  const baseOptions = { ...snapshot };
  delete baseOptions.prompt;
  delete baseOptions.modelId;
  delete baseOptions.endpointId;

  if (action === 'txt2img') {
    const txt2imgOptions = { ...baseOptions };
    delete txt2imgOptions.image_path;
    delete txt2imgOptions.image_path_2;

    if (modelId === 'z-image') {
      txt2imgOptions.use_controlnet = false;
    }

    return {
      action,
      type: 'image',
      modelId,
      prompt,
      options: txt2imgOptions,
    };
  }

  if (action === 'img2img') {
    return {
      action,
      type: 'image',
      modelId,
      prompt,
      imageInputPath: outputUrl,
      options: {
        ...baseOptions,
        ...(modelId === 'z-image' ? { use_controlnet: true } : {}),
        image_path: outputUrl,
      },
    };
  }

  return {
    action,
    type: 'video',
    modelId: 'wan22',
    prompt,
    imageInputPath: outputUrl,
    options: {
      width: typeof snapshot.width === 'number' ? snapshot.width : 768,
      height: typeof snapshot.height === 'number' ? snapshot.height : 512,
      image_path: outputUrl,
    },
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as ReuseAction;
    const outputId = typeof body.outputId === 'string' ? body.outputId : 'output-1';

    if (!action || !['txt2img', 'img2img', 'img2vid'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Valid action is required' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const outputs = buildNormalizedOutputs(job);
    const selectedOutput = outputs.find(output => output.outputId === outputId);
    if (!selectedOutput) {
      return NextResponse.json({ success: false, error: 'Output not found' }, { status: 404 });
    }

    if (selectedOutput.type !== 'image') {
      return NextResponse.json({ success: false, error: 'Reuse actions are only supported for image outputs' }, { status: 400 });
    }

    const snapshot = parseJobOptions(job.options);
    const payload = buildReusePayload(action, selectedOutput.url, {
      ...snapshot,
      prompt: job.prompt || snapshot.prompt || '',
      modelId: (job as any).modelId || snapshot.modelId,
      endpointId: (job as any).endpointId || snapshot.endpointId,
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      outputId,
      payload,
    });
  } catch (error: any) {
    console.error('Failed to build job reuse payload:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
