import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { enrichGalleryAsset } from '@/lib/galleryEnrichment';
import { queueGalleryDerivatives } from '@/lib/galleryDerivatives';

function parseJobOptions(rawOptions: unknown): Record<string, unknown> {
  if (!rawOptions) return {};
  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof rawOptions === 'object' ? (rawOptions as Record<string, unknown>) : {};
}

function normalizeUrlCandidate(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function buildNormalizedOutputs(job: any) {
  const options = parseJobOptions(job.options);
  const mediaType = job.type === 'video' ? 'video' : (job.type === 'audio' || job.type === 'tts' || job.type === 'music') ? 'audio' : 'image';

  const directCandidates = [
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
    previewUrl: url,
    thumbnailUrl: normalizeUrlCandidate(job.thumbnailUrl),
  }));
}

function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0];
  if (normalized.startsWith('/generations/')) {
    return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  }
  if (normalized.startsWith('/results/')) {
    return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  }
  return null;
}

async function readBytesForUrl(url: string): Promise<Buffer> {
  if (url.startsWith('data:')) {
    return Buffer.from(url.split(',')[1] || '', 'base64');
  }

  const localPath = resolveLocalPathFromUrl(url);
  if (localPath && fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch output: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function getExtensionFromUrl(url: string, type: string): string {
  const pathname = url.split('?')[0];
  const ext = path.extname(pathname);
  if (ext) return ext;
  if (type === 'video') return '.mp4';
  if (type === 'audio') return '.mp3';
  return '.png';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, outputId } = body;

    if (!jobId || !outputId) {
      return NextResponse.json({ success: false, error: 'jobId and outputId are required' }, { status: 400 });
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    if (!job.workspaceId) {
      return NextResponse.json({ success: false, error: 'Job has no workspaceId' }, { status: 400 });
    }

    const outputs = buildNormalizedOutputs(job);
    const selectedOutput = outputs.find(output => output.outputId === outputId);
    if (!selectedOutput) {
      return NextResponse.json({ success: false, error: 'Output not found' }, { status: 404 });
    }

    const fileBytes = await readBytesForUrl(selectedOutput.url);
    const contentHash = crypto.createHash('sha256').update(fileBytes).digest('hex');

    const existing = await prisma.galleryAsset.findUnique({
      where: {
        workspaceId_contentHash: {
          workspaceId: job.workspaceId,
          contentHash,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyInGallery: true,
        asset: existing,
      });
    }

    const ext = getExtensionFromUrl(selectedOutput.url, selectedOutput.type);
    const fileName = `${contentHash}${ext}`;
    const galleryDir = path.join(process.cwd(), 'public', 'generations', 'gallery', job.workspaceId);
    fs.mkdirSync(galleryDir, { recursive: true });

    const outputPath = path.join(galleryDir, fileName);
    fs.writeFileSync(outputPath, fileBytes);

    const originalUrl = `/generations/gallery/${job.workspaceId}/${fileName}`;

    const asset = await prisma.galleryAsset.create({
      data: {
        workspaceId: job.workspaceId,
        type: selectedOutput.type,
        originKind: 'job_output',
        sourceJobId: job.id,
        sourceOutputId: selectedOutput.outputId,
        contentHash,
        originalUrl,
        previewUrl: originalUrl,
        thumbnailUrl: selectedOutput.thumbnailUrl,
        generationSnapshot: JSON.stringify({
          ...parseJobOptions(job.options),
          prompt: job.prompt || null,
          modelId: job.modelId || null,
          endpointId: job.endpointId || null,
        }),
        derivativeStatus: 'pending',
        enrichmentStatus: 'pending',
      },
    });

    queueGalleryDerivatives(asset.id);
    const enriched = await enrichGalleryAsset(asset.id);

    return NextResponse.json({
      success: true,
      alreadyInGallery: false,
      asset: enriched.asset,
      autoTags: enriched.autoTags,
    });
  } catch (error: any) {
    console.error('Failed to add output to gallery:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
