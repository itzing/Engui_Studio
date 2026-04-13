import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import SettingsService from '@/lib/settingsService';
import RunPodService from '@/lib/runpodService';
import S3Service from '@/lib/s3Service';
import { buildAttemptPaths, buildOutputFileName, createSecureStateSkeleton, decodeMasterKey, storagePathToS3Key, uploadEncryptedMediaInput } from '@/lib/secureTransport';
import { getModelById } from '@/lib/models/modelConfig';
import { v4 as uuidv4 } from 'uuid';

const settingsService = new SettingsService();

type UpscaleRequestType = 'image' | 'video' | 'video-interpolation';

type SourceContext = {
    userId: string;
    workspaceId: string | null;
    resultUrl: string;
    prompt: string;
    sourceKind: 'job' | 'gallery_asset';
    sourceJobId: string | null;
    galleryAssetId: string | null;
    inferredType: 'image' | 'video';
};

function createS3Service(settings: any) {
    if (!settings?.s3?.endpointUrl || !settings?.s3?.accessKeyId || !settings?.s3?.secretAccessKey) {
        throw new Error('S3 settings not configured');
    }

    return new S3Service({
        endpointUrl: settings.s3.endpointUrl,
        accessKeyId: settings.s3.accessKeyId,
        secretAccessKey: settings.s3.secretAccessKey,
        bucketName: settings.s3.bucketName || 'my-bucket',
        region: settings.s3.region || 'us-east-1',
    });
}

function detectMediaType(type: UpscaleRequestType): 'image' | 'video' {
    return type === 'image' ? 'image' : 'video';
}

function detectModelId(type: UpscaleRequestType): 'upscale' | 'video-upscale' {
    return type === 'image' ? 'upscale' : 'video-upscale';
}

function detectTaskType(type: UpscaleRequestType): 'upscale' | 'upscale_and_interpolation' {
    return type === 'video-interpolation' ? 'upscale_and_interpolation' : 'upscale';
}

function inferMimeFromSource(url: string, mediaType: 'image' | 'video') {
    const normalized = url.toLowerCase();
    if (mediaType === 'video') return 'video/mp4';
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
    if (normalized.endsWith('.webp')) return 'image/webp';
    if (normalized.endsWith('.gif')) return 'image/gif';
    return 'image/png';
}

function inferFileName(url: string, mediaType: 'image' | 'video') {
    const extension = mediaType === 'video' ? 'mp4' : 'bin';

    try {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const pathname = new URL(url).pathname;
            const candidate = path.basename(pathname);
            if (candidate && candidate !== '/' && candidate !== '.') return candidate;
        } else {
            const candidate = path.basename(url);
            if (candidate && candidate !== '/' && candidate !== '.') return candidate;
        }
    } catch {
        // ignore parsing issues and fall back below
    }

    return mediaType === 'video' ? `source-video.${extension}` : `source-image.${extension}`;
}

function extractS3KeyFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2) return null;
        return pathParts.slice(1).join('/');
    } catch {
        return null;
    }
}

async function loadSourcePlaintext(sourceUrl: string, mediaType: 'image' | 'video', s3: S3Service): Promise<Buffer> {
    if (sourceUrl.startsWith('/') && !sourceUrl.startsWith('/runpod-volume/')) {
        const localFilePath = path.join(process.cwd(), 'public', sourceUrl.replace(/^\/+/, ''));
        return fs.readFile(localFilePath);
    }

    if (sourceUrl.startsWith('/runpod-volume/')) {
        return s3.downloadFile(storagePathToS3Key(sourceUrl));
    }

    const s3Key = extractS3KeyFromUrl(sourceUrl);
    if (s3Key) {
        try {
            return await s3.downloadFile(s3Key);
        } catch {
            // fall through to generic fetch below
        }
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch source media: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

function buildOptions(params: {
    source: SourceContext;
    type: UpscaleRequestType;
    runpodJobId?: string;
    attemptId?: string;
    secureMode?: boolean;
    secureInputMode?: 'media_inputs_encrypted';
    error?: string;
}) {
    return {
        sourceUrl: params.source.resultUrl,
        upscaleType: params.type,
        media_type: params.type === 'image' ? 'image' : 'video',
        frame_interpolation: params.type === 'video-interpolation',
        sourceKind: params.source.sourceKind,
        sourceJobId: params.source.sourceJobId,
        galleryAssetId: params.source.galleryAssetId,
        runpodJobId: params.runpodJobId,
        attemptId: params.attemptId,
        secureMode: params.secureMode,
        secureInputMode: params.secureInputMode,
        error: params.error,
    };
}

function inferUpscaleTypeFromUrl(url: string): 'image' | 'video' {
    const normalized = url.toLowerCase();
    if (normalized.endsWith('.mp4') || normalized.includes('/video/') || normalized.includes('/videos/')) {
        return 'video';
    }
    return 'image';
}

function normalizeRequestedUpscaleType(type: unknown): UpscaleRequestType | null {
    return type === 'image' || type === 'video' || type === 'video-interpolation' ? type : null;
}

async function resolveSourceContext(body: { jobId?: string; galleryAssetId?: string; type?: UpscaleRequestType | null }): Promise<SourceContext> {
    if (body.galleryAssetId) {
        const galleryAsset = await prisma.galleryAsset.findUnique({
            where: { id: body.galleryAssetId },
            include: { workspace: true }
        });

        if (!galleryAsset) {
            throw new Error('Gallery asset not found');
        }

        if (!galleryAsset.originalUrl) {
            throw new Error('Gallery asset has no source media');
        }

        return {
            userId: galleryAsset.workspace.userId,
            workspaceId: galleryAsset.workspaceId,
            resultUrl: galleryAsset.originalUrl,
            prompt: `Gallery upscale of asset ${galleryAsset.id}`,
            sourceKind: 'gallery_asset',
            sourceJobId: null,
            galleryAssetId: galleryAsset.id,
            inferredType: inferUpscaleTypeFromUrl(galleryAsset.originalUrl),
        };
    }

    if (!body.jobId) {
        throw new Error('jobId or galleryAssetId is required');
    }

    const originalJob = await prisma.job.findUnique({
        where: { id: body.jobId }
    });

    if (!originalJob) {
        throw new Error('Original job not found');
    }

    if (!originalJob.resultUrl) {
        throw new Error('Original job has no result');
    }

    return {
        userId: originalJob.userId,
        workspaceId: originalJob.workspaceId,
        resultUrl: originalJob.resultUrl,
        prompt: originalJob.prompt || `Upscale of job ${originalJob.id}`,
        sourceKind: 'job',
        sourceJobId: originalJob.id,
        galleryAssetId: null,
        inferredType: originalJob.type === 'video' ? 'video' : 'image',
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { jobId?: string; galleryAssetId?: string; type?: UpscaleRequestType };
        const requestedType = normalizeRequestedUpscaleType(body.type);
        const source = await resolveSourceContext({ ...body, type: requestedType });
        const type: UpscaleRequestType = requestedType === 'video-interpolation'
            ? 'video-interpolation'
            : source.inferredType;
        const { settings } = await settingsService.getSettings(source.userId);

        if (!settings?.runpod?.apiKey) {
            return NextResponse.json({
                success: false,
                error: 'RunPod API key not configured'
            }, { status: 400 });
        }

        const masterKey = decodeMasterKey(settings?.runpod?.fieldEncKeyB64);
        if (!masterKey) {
            return NextResponse.json({
                success: false,
                error: 'Secure upscale mode requires runpod.fieldEncKeyB64'
            }, { status: 400 });
        }

        const mediaType = detectMediaType(type);
        const modelId = detectModelId(type);
        const taskType = detectTaskType(type);
        const upscaleModel = getModelById(modelId);

        if (!upscaleModel) {
            return NextResponse.json({
                success: false,
                error: `Upscale model '${modelId}' not found in configuration`
            }, { status: 400 });
        }

        const endpointKey = upscaleModel.api.endpoint;
        const endpointId = settings.runpod.endpoints?.[endpointKey as keyof typeof settings.runpod.endpoints];

        if (!endpointId) {
            return NextResponse.json({
                success: false,
                error: `Upscale endpoint '${endpointKey}' not configured in RunPod settings`
            }, { status: 400 });
        }

        const newJob = await prisma.job.create({
            data: {
                userId: source.userId,
                workspaceId: source.workspaceId,
                modelId,
                type: mediaType as any,
                status: 'queued',
                prompt: `Upscale of: ${source.prompt}`,
                options: JSON.stringify(buildOptions({
                    source,
                    type,
                    secureMode: true,
                    secureInputMode: 'media_inputs_encrypted',
                }))
            }
        });

        const attemptId = uuidv4();
        const s3 = createS3Service(settings);
        const plaintext = await loadSourcePlaintext(source.resultUrl, mediaType, s3);
        const mime = inferMimeFromSource(source.resultUrl, mediaType);
        const inputFileName = `${newJob.id}__${attemptId}__input.bin`;
        const inputDescriptor = await uploadEncryptedMediaInput({
            s3,
            masterKey,
            jobId: newJob.id,
            modelId,
            attemptId,
            role: mediaType === 'image' ? 'source_image' : 'source_video',
            kind: mediaType,
            mime,
            plaintext,
            fileName: inputFileName,
            storagePath: `/runpod-volume/upscale-inputs/${inputFileName}`,
        });

        const runpodInput: Record<string, any> = {
            __encryptSensitiveUpscale: true,
            media_inputs: [inputDescriptor],
            transport_request: {
                output_dir: `${buildAttemptPaths(newJob.id, attemptId).outputsDir}/`,
                output_file_name: buildOutputFileName(newJob.id, attemptId, 'result.bin')
            },
            job_id: newJob.id,
            attempt_id: attemptId,
            model_id: modelId,
            task_type: taskType,
            media_type: mediaType,
            frame_interpolation: type === 'video-interpolation',
            output: 'base64',
        };

        const secureState = createSecureStateSkeleton({
            attemptId,
            outputDir: `${buildAttemptPaths(newJob.id, attemptId).outputsDir}/`,
            secureBlockPresent: false,
            mediaInputs: [inputDescriptor],
        });

        const runpodService = new RunPodService(
            settings.runpod.apiKey,
            endpointId,
            settings.runpod.generateTimeout,
            settings.runpod.fieldEncKeyB64,
        );

        try {
            const runpodJobId = await runpodService.submitJob(runpodInput, modelId);
            const updatedOptions = JSON.stringify(buildOptions({
                source,
                type,
                runpodJobId,
                attemptId,
                secureMode: true,
                secureInputMode: 'media_inputs_encrypted',
            }));

            await prisma.job.update({
                where: { id: newJob.id },
                data: {
                    status: 'processing',
                    options: updatedOptions,
                    secureState: JSON.stringify({
                        ...secureState,
                        phase: 'runpod_queued',
                        activeAttempt: {
                            ...secureState.activeAttempt,
                            runpodJobId,
                        },
                    })
                }
            });

            return NextResponse.json({
                success: true,
                job: {
                    ...newJob,
                    status: 'processing',
                    options: updatedOptions,
                    secureState: JSON.stringify({
                        ...secureState,
                        phase: 'runpod_queued',
                        activeAttempt: {
                            ...secureState.activeAttempt,
                            runpodJobId,
                        },
                    })
                },
                runpodJobId,
            });
        } catch (runpodError: any) {
            const failedOptions = JSON.stringify(buildOptions({
                source,
                type,
                attemptId,
                secureMode: true,
                secureInputMode: 'media_inputs_encrypted',
                error: runpodError.message,
            }));

            await prisma.job.update({
                where: { id: newJob.id },
                data: {
                    status: 'failed',
                    options: failedOptions,
                    secureState: JSON.stringify({
                        ...secureState,
                        phase: 'failed',
                        failure: {
                            source: 'engui.upscale.submit',
                            error: {
                                code: 'UPSCALE_SUBMIT_FAILED',
                                message: runpodError.message,
                            },
                            recordedAt: new Date().toISOString(),
                        }
                    })
                }
            });

            return NextResponse.json({
                success: false,
                error: `Failed to submit to RunPod: ${runpodError.message}`,
                job: {
                    ...newJob,
                    status: 'failed',
                    options: failedOptions,
                }
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Error creating upscale job:', error);
        const status = /not found/i.test(error?.message || '') ? 404 : 500;
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status });
    }
}
