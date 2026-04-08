import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import RunPodService from '@/lib/runpodService';
import SettingsService from '@/lib/settingsService';
import { getModelById } from '@/lib/models/modelConfig';
import crypto from 'crypto';

const prisma = new PrismaClient();
const settingsService = new SettingsService();

function getResultEncryptionKey(settings: any): Buffer | null {
    const keyBase64 = settings?.runpod?.zImageFieldEncKeyB64 || process.env.ZIMAGE_FIELD_ENC_KEY_B64 || process.env.FIELD_ENC_KEY_B64;
    if (!keyBase64 || typeof keyBase64 !== 'string' || keyBase64.trim() === '') {
        return null;
    }

    const key = Buffer.from(keyBase64, 'base64');
    if (key.length !== 32) {
        throw new Error(`Invalid result encryption key length: expected 32 bytes, got ${key.length}`);
    }

    return key;
}

function decryptEncryptedImageBlock(block: any, key: Buffer): string {
    if (!block || typeof block !== 'object') {
        throw new Error('Encrypted image block is missing');
    }

    const nonceB64 = block.nonce;
    const ciphertextB64 = block.ciphertext;
    if (!nonceB64 || !ciphertextB64) {
        throw new Error('Encrypted image block is malformed');
    }

    const nonce = Buffer.from(nonceB64, 'base64');
    const payload = Buffer.from(ciphertextB64, 'base64');
    if (payload.length <= 16) {
        throw new Error('Encrypted image payload is too short');
    }

    const ciphertext = payload.subarray(0, payload.length - 16);
    const tag = payload.subarray(payload.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(Buffer.from('engui:zimage:result:v1', 'utf-8'));
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
                        job.status === 'processing' ? 'IN_PROGRESS' : job.status.toUpperCase(),
                output: job.resultUrl ? { audioUrl: job.resultUrl, ...jobOptions } : undefined,
                error: job.status === 'failed' ? (jobOptions.error || 'Job failed') : undefined
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

        if (model.id === 'z-image' && normalizedOutput && typeof normalizedOutput === 'object' && normalizedOutput.image_encrypted) {
            const key = getResultEncryptionKey(settings);
            if (!key) {
                return NextResponse.json({
                    success: true,
                    status: 'FAILED',
                    error: 'Missing result decryption key (zImageFieldEncKeyB64)',
                });
            }

            try {
                const decryptedBase64 = decryptEncryptedImageBlock(normalizedOutput.image_encrypted, key);
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
