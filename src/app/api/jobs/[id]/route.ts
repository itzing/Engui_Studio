import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
                outputs,
                imageInputPath: (job as any).imageInputPath,
                videoInputPath: (job as any).videoInputPath,
                audioInputPath: (job as any).audioInputPath,
                createdAt: job.createdAt,
                completedAt: (job as any).completedAt
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

        const job = await prisma.job.update({
            where: { id: jobId },
            data: body
        });

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

        await prisma.job.delete({
            where: { id: jobId }
        });

        return NextResponse.json({
            success: true
        });
    } catch (error: any) {
        console.error('Error deleting job:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
