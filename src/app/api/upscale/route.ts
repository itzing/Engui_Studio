import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import SettingsService from '@/lib/settingsService';

const settingsService = new SettingsService();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { jobId, galleryAssetId, type } = body; // type: 'image' | 'video' | 'video-interpolation'

        let sourceUserId = '';
        let sourceWorkspaceId: string | null = null;
        let sourceResultUrl = '';
        let sourcePrompt = '';

        if (galleryAssetId) {
            const galleryAsset = await prisma.galleryAsset.findUnique({
                where: { id: galleryAssetId },
                include: { workspace: true }
            });

            if (!galleryAsset) {
                return NextResponse.json({
                    success: false,
                    error: 'Gallery asset not found'
                }, { status: 404 });
            }

            if (!galleryAsset.originalUrl) {
                return NextResponse.json({
                    success: false,
                    error: 'Gallery asset has no source media'
                }, { status: 400 });
            }

            sourceUserId = galleryAsset.workspace.userId;
            sourceWorkspaceId = galleryAsset.workspaceId;
            sourceResultUrl = galleryAsset.originalUrl;
            sourcePrompt = `Gallery upscale of asset ${galleryAsset.id}`;
        } else {
            const originalJob = await prisma.job.findUnique({
                where: { id: jobId }
            });

            if (!originalJob) {
                return NextResponse.json({
                    success: false,
                    error: 'Original job not found'
                }, { status: 404 });
            }

            if (!originalJob.resultUrl) {
                return NextResponse.json({
                    success: false,
                    error: 'Original job has no result'
                }, { status: 400 });
            }

            sourceUserId = originalJob.userId;
            sourceWorkspaceId = originalJob.workspaceId;
            sourceResultUrl = originalJob.resultUrl;
            sourcePrompt = originalJob.prompt || `Upscale of job ${originalJob.id}`;
        }

        const { settings } = await settingsService.getSettings(sourceUserId);

        if (!settings?.runpod?.apiKey) {
            return NextResponse.json({
                success: false,
                error: 'RunPod API key not configured'
            }, { status: 400 });
        }

        const { getModelById } = await import('@/lib/models/modelConfig');
        const modelId = type === 'image' ? 'upscale' : 'video-upscale';
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

        const jobType = (type === 'image') ? 'image' : 'video';

        const newJob = await prisma.job.create({
            data: {
                userId: sourceUserId,
                workspaceId: sourceWorkspaceId,
                modelId: 'upscale',
                type: jobType as any,
                status: 'queued',
                prompt: `Upscale of: ${sourcePrompt}`,
                options: JSON.stringify({
                    sourceUrl: sourceResultUrl,
                    upscaleType: type,
                    media_type: type === 'image' ? 'image' : 'video',
                    frame_interpolation: type === 'video-interpolation',
                    sourceKind: galleryAssetId ? 'gallery_asset' : 'job',
                    sourceJobId: jobId || null,
                    galleryAssetId: galleryAssetId || null
                })
            }
        });

        const mediaType = (type === 'image') ? 'image' : 'video';
        const withInterpolation = (type === 'video-interpolation');

        let s3Url = sourceResultUrl;
        let volumePath = '';

        if (sourceResultUrl.startsWith('/') && !sourceResultUrl.startsWith('/runpod-volume/') && !sourceResultUrl.startsWith('http')) {
            console.log('📁 Local file detected, uploading to S3:', sourceResultUrl);

            try {
                const S3Service = (await import('@/lib/s3Service')).default;
                const fs = await import('fs');
                const path = await import('path');

                const localFilePath = path.join(process.cwd(), 'public', sourceResultUrl);
                console.log('📂 Reading local file:', localFilePath);

                if (!fs.existsSync(localFilePath)) {
                    throw new Error(`Local file not found: ${localFilePath}`);
                }

                const fileBuffer = fs.readFileSync(localFilePath);
                const fileName = path.basename(sourceResultUrl);

                if (!settings.s3?.endpointUrl || !settings.s3?.accessKeyId || !settings.s3?.secretAccessKey) {
                    throw new Error('S3 settings not configured');
                }

                const s3Service = new S3Service({
                    endpointUrl: settings.s3.endpointUrl,
                    accessKeyId: settings.s3.accessKeyId,
                    secretAccessKey: settings.s3.secretAccessKey,
                    bucketName: settings.s3.bucketName || 'my-bucket',
                    region: settings.s3.region || 'us-east-1',
                });

                const mimeType = mediaType === 'image' ? 'image/png' : 'video/mp4';
                const uploadResult = await s3Service.uploadFile(fileBuffer, fileName, mimeType, 'upscale-inputs');

                console.log('✅ Uploaded to S3:', uploadResult.s3Url);
                s3Url = uploadResult.s3Url;
                volumePath = `/runpod-volume/upscale-inputs/${fileName}`;
            } catch (uploadError: any) {
                console.error('❌ Failed to upload to S3:', uploadError);
                throw new Error(`Failed to upload file to S3: ${uploadError.message}`);
            }
        } else if (sourceResultUrl.startsWith('/runpod-volume/')) {
            volumePath = sourceResultUrl;
            console.log('📁 Already a RunPod volume path:', volumePath);
        } else {
            try {
                const url = new URL(sourceResultUrl);
                const pathParts = url.pathname.split('/').filter(p => p);
                if (pathParts.length > 0) {
                    const filePathInBucket = pathParts.slice(1).join('/');
                    volumePath = `/runpod-volume/${filePathInBucket}`;
                }
            } catch (e) {
                throw new Error(`Invalid resultUrl format: ${sourceResultUrl}`);
            }
            console.log('📁 Converted S3 URL to RunPod volume path:', volumePath);
        }

        try {
            const RunPodService = (await import('@/lib/runpodService')).default;
            const runpodService = new RunPodService(settings.runpod?.apiKey, endpointId);

            const runpodJobId = await runpodService.submitUpscaleJob(
                volumePath,
                mediaType,
                withInterpolation
            );

            console.log('🔍 RunPod returned job ID:', runpodJobId);
            console.log('🔍 Job ID type:', typeof runpodJobId);
            console.log('🔍 Job ID length:', runpodJobId?.length);

            const updatedOptions = JSON.stringify({
                sourceUrl: sourceResultUrl,
                upscaleType: type,
                media_type: type === 'image' ? 'image' : 'video',
                frame_interpolation: type === 'video-interpolation',
                sourceKind: galleryAssetId ? 'gallery_asset' : 'job',
                sourceJobId: jobId || null,
                galleryAssetId: galleryAssetId || null,
                runpodJobId
            });

            await prisma.job.update({
                where: { id: newJob.id },
                data: {
                    options: updatedOptions,
                    status: 'processing'
                }
            });

            console.log('✅ Upscale job submitted to RunPod:', runpodJobId);

            return NextResponse.json({
                success: true,
                job: {
                    ...newJob,
                    status: 'processing',
                    options: updatedOptions
                },
                runpodJobId
            });
        } catch (runpodError: any) {
            console.error('Failed to submit to RunPod:', runpodError);

            await prisma.job.update({
                where: { id: newJob.id },
                data: {
                    status: 'failed',
                    options: JSON.stringify({
                        sourceUrl: sourceResultUrl,
                        upscaleType: type,
                        media_type: type === 'image' ? 'image' : 'video',
                        frame_interpolation: type === 'video-interpolation',
                        sourceKind: galleryAssetId ? 'gallery_asset' : 'job',
                        sourceJobId: jobId || null,
                        galleryAssetId: galleryAssetId || null,
                        error: runpodError.message
                    })
                }
            });

            return NextResponse.json({
                success: false,
                error: `Failed to submit to RunPod: ${runpodError.message}`,
                job: newJob
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Error creating upscale job:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Internal server error'
        }, { status: 500 });
    }
}
