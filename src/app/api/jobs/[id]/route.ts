import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { deleteFinishedJob } from '@/lib/jobManagement';
import { maybeGenerateJobThumbnail } from '@/lib/jobPreviewDerivatives';

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
                },
            });

            const byOutputId = new Map(galleryAssets.map(asset => [asset.sourceOutputId, asset.id]));
            for (const output of outputs) {
                const galleryAssetId = byOutputId.get(output.outputId) || null;
                output.alreadyInGallery = !!galleryAssetId;
                output.galleryAssetId = galleryAssetId;
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
