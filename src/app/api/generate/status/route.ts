import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import RunPodService from '@/lib/runpodService';
import SettingsService from '@/lib/settingsService';
import S3Service from '@/lib/s3Service';
import { getModelById } from '@/lib/models/modelConfig';
import { decodeMasterKey, downloadAndDecryptResultMedia } from '@/lib/secureTransport';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const settingsService = new SettingsService();
const GENERATIONS_DIR = path.join(process.cwd(), 'public', 'generations');

function ensureGenerationsDir() {
    if (!fs.existsSync(GENERATIONS_DIR)) {
        fs.mkdirSync(GENERATIONS_DIR, { recursive: true });
    }
}

function detectResultExtension(mime?: string | null, kind?: string | null): string {
    if (mime === 'video/mp4') return '.mp4';
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/webp') return '.webp';
    if (mime === 'image/gif') return '.gif';
    if (mime === 'audio/mpeg') return '.mp3';
    if (mime === 'audio/wav') return '.wav';
    if (kind === 'video') return '.mp4';
    return '.png';
}

async function cleanupSecureTransportArtifacts(params: {
    s3: S3Service;
    secureState: any;
    resultStoragePath?: string | null;
}) {
    const cleanupWarnings: string[] = [];
    const mediaInputs = params.secureState?.activeAttempt?.request?.mediaInputs || [];

    for (const media of mediaInputs) {
        const storagePath = media?.storagePath;
        if (!storagePath) continue;
        try {
            await params.s3.deleteFile(storagePath.replace(/^\/+/, ''));
        } catch (error: any) {
            cleanupWarnings.push(`input:${storagePath}:${error.message}`);
        }
    }

    if (params.resultStoragePath) {
        try {
            await params.s3.deleteFile(params.resultStoragePath.replace(/^\/+/, ''));
        } catch (error: any) {
            cleanupWarnings.push(`result:${params.resultStoragePath}:${error.message}`);
        }
    }

    return {
        transportStatus: cleanupWarnings.length === 0 ? 'completed' : 'warning',
        warning: cleanupWarnings.length > 0 ? cleanupWarnings.join(' | ') : null,
        completedAt: new Date().toISOString(),
    };
}

function getConfiguredEncryptionKey(keyBase64: string | undefined | null, fallbackEnv?: string): Buffer | null {
    const rawKey = keyBase64 || (fallbackEnv ? process.env[fallbackEnv] : undefined) || process.env.FIELD_ENC_KEY_B64;
    if (!rawKey || typeof rawKey !== 'string' || rawKey.trim() === '') {
        return null;
    }

    const key = Buffer.from(rawKey, 'base64');
    if (key.length !== 32) {
        throw new Error(`Invalid result encryption key length: expected 32 bytes, got ${key.length}`);
    }

    return key;
}

function getZImageResultEncryptionKey(settings: any): Buffer | null {
    return getConfiguredEncryptionKey(settings?.runpod?.fieldEncKeyB64);
}

function getUpscaleResultEncryptionKey(settings: any): Buffer | null {
    return getConfiguredEncryptionKey(settings?.runpod?.fieldEncKeyB64);
}

function decryptEncryptedMediaBlock(block: any, key: Buffer, aad: string): string {
    if (!block || typeof block !== 'object') {
        throw new Error('Encrypted media block is missing');
    }

    const nonceB64 = block.nonce;
    const ciphertextB64 = block.ciphertext;
    if (!nonceB64 || !ciphertextB64) {
        throw new Error('Encrypted media block is malformed');
    }

    const nonce = Buffer.from(nonceB64, 'base64');
    const payload = Buffer.from(ciphertextB64, 'base64');
    if (payload.length <= 16) {
        throw new Error('Encrypted media payload is too short');
    }

    const ciphertext = payload.subarray(0, payload.length - 16);
    const tag = payload.subarray(payload.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.from(aad, 'utf-8'));
    decipher.setAuthTag(tag);

    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('base64');
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');
        const userId = searchParams.get('userId') || 'user-with-settings';

        if (!jobId) {
            return NextResponse.json({ success: false, error: 'Missing jobId parameter' }, { status: 400 });
        }

        // Get job from database to find the model and runpod job ID
        const job = await prisma.job.findUnique({
            where: { id: jobId }
        });

        if (!job) {
            return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
        }

        // Get model config
        const jobData = job as any; // Prisma client type may be out of sync
        const model = getModelById(jobData.modelId || 'unknown');
        if (!model) {
            return NextResponse.json({ success: false, error: 'Unknown model' }, { status: 400 });
        }

        if (model.api.type !== 'runpod') {
            const jobOptions = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
            return NextResponse.json({
                success: true,
                status: job.status === 'completed' ? 'COMPLETED' : 
                        job.status === 'failed' ? 'FAILED' : 
                        job.status === 'processing' || job.status === 'finalizing' ? 'IN_PROGRESS' : job.status.toUpperCase(),
                output: job.resultUrl ? { audioUrl: job.resultUrl, ...jobOptions } : undefined,
                error: job.status === 'failed' ? (jobOptions.error || 'Job failed') : undefined
            });
        }

        const existingSecureState = typeof (job as any).secureState === 'string'
            ? (() => { try { return JSON.parse((job as any).secureState); } catch { return null; } })()
            : ((job as any).secureState || null);

        if (job.status === 'completed' && job.resultUrl && existingSecureState?.activeAttempt?.finalization?.status === 'completed') {
            return NextResponse.json({
                success: true,
                status: 'COMPLETED',
                output: {
                    url: job.resultUrl,
                    image_url: job.type === 'image' ? job.resultUrl : undefined,
                    video_url: job.type === 'video' ? job.resultUrl : undefined,
                    audioUrl: job.type === 'audio' || job.type === 'tts' || job.type === 'music' ? job.resultUrl : undefined,
                },
                meta: {
                    secureFinalized: true,
                    cleanupStatus: existingSecureState?.cleanup?.transportStatus || 'pending',
                    cleanupWarning: existingSecureState?.cleanup?.warning || null,
                },
            });
        }

        // Get settings
        const { settings } = await settingsService.getSettings(userId);
        
        if (!settings.runpod?.apiKey) {
            return NextResponse.json({ success: false, error: 'RunPod API key not configured' }, { status: 400 });
        }

        const endpoints = settings.runpod.endpoints as Record<string, string> | undefined;
        
        // Get endpoint ID from settings using the model's endpoint key
        const endpointKey = model.api.endpoint;
        const endpointId = endpoints?.[endpointKey] || endpoints?.[model.id];
        
        if (!endpointId) {
            return NextResponse.json({ success: false, error: `Endpoint '${endpointKey}' not configured` }, { status: 400 });
        }

        // Create RunPod service and check status
        const runpodService = new RunPodService(settings.runpod.apiKey, endpointId);
        
        // Extract runpod job ID from job options
        const options = typeof job.options === 'string' ? JSON.parse(job.options) : job.options;
        const runpodJobId = options.runpodJobId || jobId;

        const status = await runpodService.getJobStatus(runpodJobId);

        let normalizedOutput: any = status.output;
        let secureState = existingSecureState;

        if (normalizedOutput && typeof normalizedOutput === 'object' && normalizedOutput.transport_result && secureState?.activeAttempt?.attemptId) {
            const transportResult = normalizedOutput.transport_result;
            const attemptId = secureState.activeAttempt.attemptId;
            const masterKey = decodeMasterKey(settings.runpod.fieldEncKeyB64);
            const s3Service = new S3Service({
                endpointUrl: settings.s3?.endpointUrl,
                accessKeyId: settings.s3?.accessKeyId,
                secretAccessKey: settings.s3?.secretAccessKey,
                bucketName: settings.s3?.bucketName,
                region: settings.s3?.region || 'us-east-1',
            });

            secureState = {
                ...secureState,
                phase: transportResult.status === 'completed' ? 'finalizing' : 'failed',
                activeAttempt: {
                    ...secureState.activeAttempt,
                    response: {
                        ...secureState.activeAttempt.response,
                        transportResultSecureReceived: true,
                        transportResultStatus: transportResult.status,
                    },
                },
            };

            if (transportResult.status === 'completed' && transportResult.result_media) {
                ensureGenerationsDir();
                const resultBuffer = await downloadAndDecryptResultMedia({
                    s3: s3Service,
                    masterKey,
                    jobId,
                    modelId: model.id,
                    attemptId,
                    media: transportResult.result_media,
                });

                const ext = detectResultExtension(transportResult.result_media.mime, transportResult.result_media.kind);
                const safeModelId = model.id.replace(/[^a-zA-Z0-9-_]/g, '_');
                const fileName = `${safeModelId}-${jobId}${ext}`;
                const filePath = path.join(GENERATIONS_DIR, fileName);
                const relativePath = `/generations/${fileName}`;
                fs.writeFileSync(filePath, resultBuffer);

                const cleanup = secureState?.cleanup?.transportStatus === 'completed' || secureState?.cleanup?.transportStatus === 'warning'
                    ? secureState.cleanup
                    : await cleanupSecureTransportArtifacts({
                        s3: s3Service,
                        secureState,
                        resultStoragePath: transportResult.result_media.storage_path,
                    });

                secureState = {
                    ...secureState,
                    phase: 'completed',
                    activeAttempt: {
                        ...secureState.activeAttempt,
                        finalization: {
                            status: 'completed',
                            localResultPath: filePath,
                            localResultUrl: relativePath,
                            completedAt: new Date().toISOString(),
                        },
                    },
                    cleanup,
                };

                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        status: 'completed',
                        resultUrl: relativePath,
                        secureState: JSON.stringify(secureState),
                        options: JSON.stringify({
                            ...options,
                            transportResultStatus: transportResult.status,
                        }),
                    },
                });

                return NextResponse.json({
                    success: true,
                    status: 'COMPLETED',
                    output: {
                        url: relativePath,
                        image_url: transportResult.result_media.kind === 'image' ? relativePath : undefined,
                        video_url: transportResult.result_media.kind === 'video' ? relativePath : undefined,
                        transport_result: {
                            status: transportResult.status,
                        },
                    },
                    meta: {
                        secureFinalized: true,
                        cleanupStatus: cleanup?.transportStatus || 'pending',
                        cleanupWarning: cleanup?.warning || null,
                    },
                });
            }

            if (transportResult.status === 'failed') {
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        status: 'failed',
                        secureState: JSON.stringify({
                            ...secureState,
                            failure: transportResult.error || { code: 'TRANSPORT_FAILED', message: 'Secure transport failed' },
                        }),
                        options: JSON.stringify({
                            ...options,
                            error: transportResult.error?.message || 'Secure transport failed',
                        }),
                    },
                });

                return NextResponse.json({
                    success: true,
                    status: 'FAILED',
                    error: transportResult.error?.message || 'Secure transport failed',
                });
            }
        }

        if (model.id === 'z-image' && normalizedOutput && typeof normalizedOutput === 'object' && normalizedOutput.image_encrypted) {
            const key = getZImageResultEncryptionKey(settings);
            if (!key) {
                return NextResponse.json({
                    success: true,
                    status: 'FAILED',
                    error: 'Missing result decryption key (fieldEncKeyB64)',
                });
            }

            try {
                const decryptedBase64 = decryptEncryptedMediaBlock(normalizedOutput.image_encrypted, key, 'engui:zimage:result:v1');
                normalizedOutput = {
                    ...normalizedOutput,
                    image: decryptedBase64,
                };
            } catch (decryptError: any) {
                return NextResponse.json({
                    success: true,
                    status: 'FAILED',
                    error: `Failed to decrypt image output: ${decryptError.message}`,
                });
            }
        }

        if ((model.id === 'upscale' || model.id === 'video-upscale') && normalizedOutput && typeof normalizedOutput === 'object') {
            const key = getUpscaleResultEncryptionKey(settings);

            if (normalizedOutput.image_encrypted) {
                if (!key) {
                    return NextResponse.json({
                        success: true,
                        status: 'FAILED',
                        error: 'Missing result decryption key (fieldEncKeyB64)',
                    });
                }

                try {
                    const decryptedBase64 = decryptEncryptedMediaBlock(normalizedOutput.image_encrypted, key, 'engui:upscale-interpolation:image-result:v1');
                    normalizedOutput = {
                        ...normalizedOutput,
                        image: decryptedBase64,
                    };
                } catch (decryptError: any) {
                    return NextResponse.json({
                        success: true,
                        status: 'FAILED',
                        error: `Failed to decrypt upscale image output: ${decryptError.message}`,
                    });
                }
            }

            if (normalizedOutput.video_encrypted) {
                if (!key) {
                    return NextResponse.json({
                        success: true,
                        status: 'FAILED',
                        error: 'Missing result decryption key (fieldEncKeyB64)',
                    });
                }

                try {
                    const decryptedBase64 = decryptEncryptedMediaBlock(normalizedOutput.video_encrypted, key, 'engui:upscale-interpolation:video-result:v1');
                    normalizedOutput = {
                        ...normalizedOutput,
                        video: decryptedBase64,
                    };
                } catch (decryptError: any) {
                    return NextResponse.json({
                        success: true,
                        status: 'FAILED',
                        error: `Failed to decrypt upscale video output: ${decryptError.message}`,
                    });
                }
            }
        }

        // Job이 실패한 경우에만 DB 업데이트
        // IN_QUEUE는 job이 아직 준비 중일 수 있으므로 failed로 처리하지 않음
        if (status.status === 'FAILED' && status.error && !status.error.includes('initializing')) {
            // Check if job was created recently (within last 30 seconds)
            const jobCreatedAt = new Date(job.createdAt).getTime();
            const now = Date.now();
            const timeSinceCreation = now - jobCreatedAt;
            const thirtySeconds = 30 * 1000;

            // Only mark as failed if job is older than 30 seconds
            // This prevents marking newly created jobs as failed when RunPod hasn't registered them yet
            if (timeSinceCreation > thirtySeconds) {
                await prisma.job.update({
                    where: { id: jobId },
                    data: {
                        status: 'failed',
                        options: JSON.stringify({
                            ...options,
                            error: status.error || 'Job failed or was cancelled'
                        })
                    }
                });
            }
        }

        return NextResponse.json({
            success: true,
            status: status.status,
            output: normalizedOutput,
            error: status.error
        });

    } catch (error: any) {
        console.error('Status Check Error:', error);
        
        // 404 에러가 아닌 경우에만 500 에러 반환
        // 404는 이미 getJobStatus에서 처리됨
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal Server Error' 
        }, { status: 500 });
    }
}
