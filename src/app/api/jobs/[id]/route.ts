import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { deleteFinishedJob } from '@/lib/jobManagement';
import { maybeGenerateJobThumbnail } from '@/lib/jobPreviewDerivatives';
import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';

const prisma = new PrismaClient();

async function maybePopulateJobThumbnail(job: any) {
    const thumbnailUrl = await maybeGenerateJobThumbnail({
        id: job.id,
        modelId: job.modelId,
        type: job.type,
        resultUrl: job.resultUrl,
        thumbnailUrl: job.thumbnailUrl,
    });

    if (!thumbnailUrl || thumbnailUrl === job.thumbnailUrl) {
        return job;
    }

    return prisma.job.update({
        where: { id: job.id },
        data: { thumbnailUrl },
    });
}

type NormalizedJobOutput = {
    outputId: string;
    type: 'image' | 'video' | 'audio';
    url: string;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    alreadyInGallery: boolean;
    galleryAssetId: string | null;
    savedBuckets: Array<'common' | 'draft' | 'upscale'>;
    galleryAssetIdsByBucket: Partial<Record<'common' | 'draft' | 'upscale', string[]>>;
};

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

async function readBytesForUrl(url: string): Promise<Buffer> {
    if (url.startsWith('/')) {
        const localPath = path.join(process.cwd(), 'public', url.replace(/^\/+/, ''));
        return fs.readFile(localPath);
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch asset bytes: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function maybeAutoSaveUpscaleResult(job: any) {
    if (!job.workspaceId || !job.resultUrl) return;
    if (job.status !== 'completed') return;
    if (job.modelId !== 'upscale' && job.modelId !== 'video-upscale') return;

    const existing = await prisma.galleryAsset.findFirst({
        where: {
            workspaceId: job.workspaceId,
            sourceJobId: job.id,
            sourceOutputId: 'output-1',
            bucket: 'upscale',
            trashed: false,
        },
        select: { id: true },
    });

    if (existing) return;

    const bytes = await readBytesForUrl(job.resultUrl);
    const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');

    await prisma.galleryAsset.create({
        data: {
            workspaceId: job.workspaceId,
            type: job.type === 'video' ? 'video' : 'image',
            bucket: 'upscale',
            originKind: 'job_output',
            sourceJobId: job.id,
            sourceOutputId: 'output-1',
            contentHash,
            originalUrl: job.resultUrl,
            previewUrl: job.resultUrl,
            thumbnailUrl: job.thumbnailUrl,
            generationSnapshot: JSON.stringify({
                prompt: job.prompt,
                modelId: job.modelId,
                options: parseJobOptions(job.options),
                source: 'upscale-autosave',
            }),
            userTags: JSON.stringify([]),
            autoTags: JSON.stringify([]),
        },
    });
}

function buildNormalizedOutputs(job: any): NormalizedJobOutput[] {
    const outputs: NormalizedJobOutput[] = [];
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

    uniqueUrls.forEach((url, index) => {
        outputs.push({
            outputId: `output-${index + 1}`,
            type: mediaType,
            url,
            previewUrl: url,
            thumbnailUrl: normalizeUrlCandidate(job.thumbnailUrl),
            alreadyInGallery: false,
            galleryAssetId: null,
            savedBuckets: [],
            galleryAssetIdsByBucket: {},
        });
    });

    return outputs;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: jobId } = await params;

        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return NextResponse.json({
                success: false,
                error: 'Job not found'
            }, { status: 404 });
        }

        const outputs = buildNormalizedOutputs(job);

        if (job.workspaceId && outputs.length > 0) {
            const galleryAssets = await prisma.galleryAsset.findMany({
                where: {
                    workspaceId: job.workspaceId,
                    sourceJobId: job.id,
                    trashed: false,
                },
                select: {
                    id: true,
                    sourceOutputId: true,
                    bucket: true,
                    addedToGalleryAt: true,
                },
                orderBy: {
                    addedToGalleryAt: 'desc',
                },
            });

            const byOutputId = new Map<string, typeof galleryAssets>();
            for (const asset of galleryAssets) {
                if (!asset.sourceOutputId) continue;
                const current = byOutputId.get(asset.sourceOutputId) || [];
                current.push(asset);
                byOutputId.set(asset.sourceOutputId, current);
            }

            for (const output of outputs) {
                const matchedAssets = byOutputId.get(output.outputId) || [];
                const galleryAssetId = matchedAssets[0]?.id || null;
                const savedBuckets = Array.from(new Set(matchedAssets
                    .map(asset => asset.bucket)
                    .filter((bucket): bucket is 'common' | 'draft' | 'upscale' => bucket === 'common' || bucket === 'draft' || bucket === 'upscale')));
                const galleryAssetIdsByBucket = matchedAssets.reduce<Partial<Record<'common' | 'draft' | 'upscale', string[]>>>((acc, asset) => {
                    if (asset.bucket !== 'common' && asset.bucket !== 'draft' && asset.bucket !== 'upscale') return acc;
                    acc[asset.bucket] = [...(acc[asset.bucket] || []), asset.id];
                    return acc;
                }, {});

                output.alreadyInGallery = matchedAssets.length > 0;
                output.galleryAssetId = galleryAssetId;
                output.savedBuckets = savedBuckets;
                output.galleryAssetIdsByBucket = galleryAssetIdsByBucket;
            }
        }

        return NextResponse.json({
            success: true,
            job: {
                id: job.id,
                userId: job.userId,
                workspaceId: job.workspaceId,
                status: job.status,
                type: job.type,
                modelId: (job as any).modelId || 'unknown',
                prompt: job.prompt,
                options: job.options,
                resultUrl: job.resultUrl,
                thumbnailUrl: job.thumbnailUrl,
                error: (job as any).error ?? null,
                outputs,
                secureState: (job as any).secureState,
                imageInputPath: (job as any).imageInputPath,
                videoInputPath: (job as any).videoInputPath,
                audioInputPath: (job as any).audioInputPath,
                createdAt: job.createdAt,
                completedAt: (job as any).completedAt,
                executionMs: (job as any).executionMs ?? null
            }
        });
    } catch (error: any) {
        console.error('Error fetching job:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: jobId } = await params;
        const body = await request.json();

        const updatedJob = await prisma.job.update({
            where: { id: jobId },
            data: body
        });

        const job = await maybePopulateJobThumbnail(updatedJob);
        await maybeAutoSaveUpscaleResult(job);

        return NextResponse.json({
            success: true,
            job
        });
    } catch (error: any) {
        console.error('Error updating job:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: jobId } = await params;

        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return NextResponse.json({
                success: false,
                error: 'Job not found'
            }, { status: 404 });
        }

        const result = await deleteFinishedJob(job);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error: any) {
        console.error('Error deleting job:', error);
        const message = error.message || 'Internal server error';
        const status = message.includes('cancel it first') ? 409 : 500;
        return NextResponse.json({
            success: false,
            error: message
        }, { status });
    }
}
