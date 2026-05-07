import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import RunPodService from '@/lib/runpodService';
import SettingsService from '@/lib/settingsService';
import S3Service from '@/lib/s3Service';
import { prisma } from '@/lib/prisma';
import { getModelById } from '@/lib/models/modelConfig';
import { decodeMasterKey, downloadAndDecryptResultMedia, storagePathToS3Key } from '@/lib/secureTransport';
import { maybeGenerateJobThumbnail } from '@/lib/jobPreviewDerivatives';
import { settleJobMaterializationTasks, recoverJobMaterializationTasks } from '@/lib/materialization/server';
import { maybeAutoSaveUpscaleResult } from '@/lib/upscaleAutoSave';
import { materializeStudioSessionCompletedJob, recoverStudioSessionMaterializationTasks } from '@/lib/studio-sessions/server';

const settingsService = new SettingsService();
const GENERATIONS_DIR = path.join(process.cwd(), 'public', 'generations');
const STALE_NOT_FOUND_THRESHOLD_MS = 5 * 60 * 1000;
const QUEUEING_UP_GRACE_MS = 30 * 1000;
const DEFAULT_SUPERVISOR_INTERVAL_MS = 5000;
const ACTIVE_JOB_STATUSES = ['queueing_up', 'queued', 'processing', 'finalizing'] as const;

type LocalStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

type JsonObject = Record<string, any>;

type SupervisorHandle = {
  started: boolean;
  timer: NodeJS.Timeout | null;
  tickInFlight: boolean;
};

const globalSupervisor = globalThis as typeof globalThis & {
  __enguiRunpodSupervisor?: SupervisorHandle;
};

function parseJson(value: unknown): JsonObject {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? (value as JsonObject) : {};
}

function parseSecureState(value: unknown): JsonObject | null {
  const parsed = parseJson(value);
  return Object.keys(parsed).length > 0 ? parsed : null;
}

function ensureGenerationsDir() {
  if (!fs.existsSync(GENERATIONS_DIR)) {
    fs.mkdirSync(GENERATIONS_DIR, { recursive: true });
  }
}

function mapJobStatus(status: string): LocalStatus {
  if (status === 'completed') return 'COMPLETED';
  if (status === 'failed') return 'FAILED';
  if (status === 'processing' || status === 'finalizing') return 'IN_PROGRESS';
  return 'IN_QUEUE';
}

function buildCompletedOutput(job: any) {
  if (!job.resultUrl) return undefined;

  return {
    url: job.resultUrl,
    image_url: job.type === 'image' ? job.resultUrl : undefined,
    video_url: job.type === 'video' ? job.resultUrl : undefined,
    audioUrl: job.type === 'audio' || job.type === 'tts' || job.type === 'music' ? job.resultUrl : undefined,
    thumbnail_url: (job.type === 'image' || job.type === 'video') ? job.thumbnailUrl || undefined : undefined,
    preview_url: job.type === 'image'
      ? job.thumbnailUrl || job.resultUrl
      : job.type === 'video'
        ? job.thumbnailUrl || undefined
        : undefined,
  };
}

function extractJobError(job: any, options: JsonObject, secureState: JsonObject | null): string | undefined {
  return job.error
    || options.error
    || secureState?.failure?.error?.message
    || undefined;
}

export function buildReadOnlyStatusPayload(job: any) {
  const options = parseJson(job.options);
  const secureState = parseSecureState(job.secureState);
  const localStatus = mapJobStatus(job.status);
  const payload: JsonObject = {
    success: true,
    status: localStatus,
  };

  if (typeof job.executionMs === 'number' && Number.isFinite(job.executionMs)) {
    payload.executionTime = job.executionMs;
  }

  if (localStatus === 'COMPLETED') {
    payload.output = buildCompletedOutput(job);
  }

  if (localStatus === 'FAILED') {
    payload.error = extractJobError(job, options, secureState) || 'Job failed';
  }

  if (secureState) {
    payload.meta = {
      localPhase: secureState.phase || null,
      secureFinalized: secureState?.activeAttempt?.finalization?.status === 'completed',
      cleanupStatus: secureState?.cleanup?.transportStatus || 'pending',
      cleanupWarning: secureState?.cleanup?.warning || null,
      secureFailure: secureState?.failure || null,
    };
  }

  return payload;
}

function normalizeS3KeyOrPrefix(value: string): string {
  return storagePathToS3Key(value).replace(/\/+$/, '');
}

async function cleanupSecureTransportArtifacts(params: {
  s3: S3Service;
  secureState: JsonObject | null;
  resultStoragePath?: string | null;
}) {
  const cleanupWarnings: string[] = [];
  const mediaInputs = params.secureState?.activeAttempt?.request?.mediaInputs || [];

  for (const media of mediaInputs) {
    const storagePath = media?.storagePath;
    if (!storagePath) continue;

    try {
      await params.s3.deleteFile(normalizeS3KeyOrPrefix(storagePath));
    } catch (error: any) {
      cleanupWarnings.push(`input:${storagePath}:${error.message}`);
    }
  }

  if (params.resultStoragePath) {
    try {
      await params.s3.deleteFile(normalizeS3KeyOrPrefix(params.resultStoragePath));
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

function normalizeFailure(source: string, error: any, fallbackCode: string, fallbackMessage: string) {
  const rawCode = error?.code || error?.error?.code || error?.name;
  const rawMessage = error?.message || error?.error?.message || fallbackMessage;

  return {
    source,
    error: {
      code: typeof rawCode === 'string' && rawCode.trim() !== '' ? rawCode : fallbackCode,
      message: typeof rawMessage === 'string' && rawMessage.trim() !== '' ? rawMessage : fallbackMessage,
    },
    recordedAt: new Date().toISOString(),
  };
}

function parseRunPodExecutionMs(status: any): number | null {
  const raw = status?.executionTime ?? status?.execution_time ?? status?.metrics?.executionTime;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
    return Math.max(0, Math.round(Number(raw)));
  }
  return null;
}

function inferKindFromJobType(type: string): 'image' | 'video' | 'audio' {
  if (type === 'video') return 'video';
  if (type === 'audio' || type === 'tts' || type === 'music') return 'audio';
  return 'image';
}

function inferMimeFromDataUri(value: string): string | null {
  const match = value.match(/^data:([^;,]+)[;,]/i);
  return match?.[1] || null;
}

function detectResultExtension(params: {
  mime?: string | null;
  kind?: string | null;
  candidate?: string | null;
}) {
  const mime = params.mime?.toLowerCase() || null;
  const kind = params.kind || null;
  const candidate = params.candidate || null;

  if (mime === 'video/mp4') return '.mp4';
  if (mime === 'video/webm') return '.webm';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/gif') return '.gif';
  if (mime === 'audio/mpeg') return '.mp3';
  if (mime === 'audio/wav') return '.wav';
  if (mime === 'audio/x-wav') return '.wav';
  if (mime === 'audio/ogg') return '.ogg';
  if (mime === 'audio/flac') return '.flac';
  if (mime === 'image/png') return '.png';

  if (candidate) {
    try {
      const withoutQuery = candidate.split('?')[0].split('#')[0];
      const ext = path.extname(withoutQuery);
      if (ext && ext.length <= 8) {
        return ext;
      }
    } catch {
      // Ignore extension inference failure.
    }
  }

  if (kind === 'video') return '.mp4';
  if (kind === 'audio') return '.mp3';
  return '.png';
}

function buildLocalResultPath(job: any, extension: string) {
  const safeModelId = String(job.modelId || 'unknown').replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `${safeModelId}-${job.id}${extension}`;
  const filePath = path.join(GENERATIONS_DIR, fileName);
  const relativePath = `/generations/${fileName}`;
  return { filePath, relativePath };
}

async function writeLocalResultBuffer(job: any, buffer: Buffer, params: {
  mime?: string | null;
  kind?: string | null;
  candidate?: string | null;
}) {
  ensureGenerationsDir();
  const ext = detectResultExtension(params);
  const { filePath, relativePath } = buildLocalResultPath(job, ext);
  fs.writeFileSync(filePath, buffer);
  return { filePath, relativePath };
}

function isProbablyBase64Payload(value: string) {
  if (!value || value.length < 128) return false;
  if (value.includes('/') || value.includes(':') || value.includes('?')) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value);
}

function extractLegacyOutputCandidate(output: any, job: any): {
  value: string;
  mime?: string | null;
  kind: 'image' | 'video' | 'audio';
} | null {
  const kind = inferKindFromJobType(job.type);

  if (!output) return null;
  if (typeof output === 'string') {
    return { value: output, kind };
  }

  if (typeof output !== 'object') return null;

  const candidates = [
    { value: output.url, kind, mime: output.mimeType || output.mime },
    { value: output.audioUrl, kind: 'audio' as const, mime: output.mimeType || output.mime },
    { value: output.s3_path, kind, mime: output.mimeType || output.mime },
    { value: output.output_path, kind, mime: output.mimeType || output.mime },
    { value: output.image_path, kind: 'image' as const, mime: output.mimeType || output.mime },
    { value: output.video_path, kind: 'video' as const, mime: output.mimeType || output.mime },
    { value: output.image_url, kind: 'image' as const, mime: output.mimeType || output.mime },
    { value: output.video_url, kind: 'video' as const, mime: output.mimeType || output.mime },
    { value: output.image, kind: 'image' as const, mime: output.mimeType || output.mime },
    { value: output.video, kind: 'video' as const, mime: output.mimeType || output.mime },
  ];

  for (const candidate of candidates) {
    if (typeof candidate.value === 'string' && candidate.value.trim() !== '') {
      return {
        value: candidate.value.trim(),
        kind: candidate.kind,
        mime: candidate.mime || null,
      };
    }
  }

  if (Array.isArray(output.images) && typeof output.images[0] === 'string') {
    return { value: output.images[0], kind: 'image', mime: output.mimeType || output.mime || null };
  }

  if (Array.isArray(output.videos) && typeof output.videos[0] === 'string') {
    return { value: output.videos[0], kind: 'video', mime: output.mimeType || output.mime || null };
  }

  return null;
}

function createS3Service(settings: any) {
  return new S3Service({
    endpointUrl: settings.s3?.endpointUrl,
    accessKeyId: settings.s3?.accessKeyId,
    secretAccessKey: settings.s3?.secretAccessKey,
    bucketName: settings.s3?.bucketName,
    region: settings.s3?.region || 'us-east-1',
  });
}

async function materializeLegacyResult(job: any, output: any, settings: any) {
  const candidate = extractLegacyOutputCandidate(output, job);
  if (!candidate) {
    throw new Error('Legacy RunPod result is missing a supported output field');
  }

  if (candidate.value.startsWith('/generations/') || candidate.value.startsWith('/results/')) {
    const absolutePath = path.join(process.cwd(), 'public', candidate.value.replace(/^\//, ''));
    return { filePath: absolutePath, relativePath: candidate.value };
  }

  if (candidate.value.startsWith('data:')) {
    const commaIndex = candidate.value.indexOf(',');
    if (commaIndex === -1) {
      throw new Error('Malformed data URI result');
    }

    const mime = inferMimeFromDataUri(candidate.value) || candidate.mime || null;
    const buffer = Buffer.from(candidate.value.slice(commaIndex + 1), 'base64');
    return writeLocalResultBuffer(job, buffer, {
      mime,
      kind: candidate.kind,
      candidate: candidate.value,
    });
  }

  if (candidate.value.startsWith('/runpod-volume/')) {
    const s3 = createS3Service(settings);
    const buffer = await s3.downloadFile(storagePathToS3Key(candidate.value));
    return writeLocalResultBuffer(job, buffer, {
      mime: candidate.mime || null,
      kind: candidate.kind,
      candidate: candidate.value,
    });
  }

  if (isProbablyBase64Payload(candidate.value)) {
    const buffer = Buffer.from(candidate.value, 'base64');
    return writeLocalResultBuffer(job, buffer, {
      mime: candidate.mime || null,
      kind: candidate.kind,
      candidate: candidate.value,
    });
  }

  if (/^https?:\/\//i.test(candidate.value)) {
    const response = await fetch(candidate.value);
    if (!response.ok) {
      throw new Error(`Failed to fetch result media: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return writeLocalResultBuffer(job, buffer, {
      mime: response.headers.get('content-type') || candidate.mime || null,
      kind: candidate.kind,
      candidate: candidate.value,
    });
  }

  throw new Error(`Unsupported legacy result location: ${candidate.value}`);
}

async function materializeEncryptedResult(job: any, output: any, settings: any) {
  if (job.modelId === 'z-image' && output?.image_encrypted) {
    const key = getZImageResultEncryptionKey(settings);
    if (!key) {
      throw new Error('Missing result decryption key (fieldEncKeyB64)');
    }

    const decryptedBase64 = decryptEncryptedMediaBlock(output.image_encrypted, key, 'engui:zimage:result:v1');
    return writeLocalResultBuffer(job, Buffer.from(decryptedBase64, 'base64'), {
      mime: 'image/png',
      kind: 'image',
    });
  }

  if ((job.modelId === 'upscale' || job.modelId === 'video-upscale') && output) {
    const key = getUpscaleResultEncryptionKey(settings);
    if (!key) {
      throw new Error('Missing result decryption key (fieldEncKeyB64)');
    }

    if (output.image_encrypted) {
      const decryptedBase64 = decryptEncryptedMediaBlock(output.image_encrypted, key, 'engui:upscale-interpolation:image-result:v1');
      return writeLocalResultBuffer(job, Buffer.from(decryptedBase64, 'base64'), {
        mime: 'image/png',
        kind: 'image',
      });
    }

    if (output.video_encrypted) {
      const decryptedBase64 = decryptEncryptedMediaBlock(output.video_encrypted, key, 'engui:upscale-interpolation:video-result:v1');
      return writeLocalResultBuffer(job, Buffer.from(decryptedBase64, 'base64'), {
        mime: 'video/mp4',
        kind: 'video',
      });
    }
  }

  return null;
}

async function persistJobUpdate(jobId: string, data: JsonObject) {
  return prisma.job.update({
    where: { id: jobId },
    data,
  });
}

async function markJobProcessing(job: any, options: JsonObject, secureState: JsonObject | null, executionMs: number | null, runpodPhase: string) {
  const nextOptions = { ...options };
  if (!nextOptions.runStartedAt) {
    nextOptions.runStartedAt = Date.now();
  }

  const nextSecureState = secureState
    ? {
        ...secureState,
        phase: runpodPhase,
      }
    : null;

  await persistJobUpdate(job.id, {
    status: 'processing',
    options: JSON.stringify(nextOptions),
    secureState: nextSecureState ? JSON.stringify(nextSecureState) : job.secureState,
    executionMs: executionMs ?? undefined,
    error: null,
  });
}

async function markJobQueued(job: any, options: JsonObject, secureState: JsonObject | null, executionMs: number | null) {
  const nextSecureState = secureState
    ? {
        ...secureState,
        phase: 'runpod_queued',
      }
    : null;

  await persistJobUpdate(job.id, {
    status: 'queued',
    options: JSON.stringify(options),
    secureState: nextSecureState ? JSON.stringify(nextSecureState) : job.secureState,
    executionMs: executionMs ?? undefined,
    error: null,
  });
}

async function markJobQueueingUp(job: any, options: JsonObject, secureState: JsonObject | null) {
  const nextSecureState = secureState
    ? {
        ...secureState,
        phase: secureState.phase || 'submitting',
      }
    : null;

  await persistJobUpdate(job.id, {
    status: 'queueing_up',
    options: JSON.stringify(options),
    secureState: nextSecureState ? JSON.stringify(nextSecureState) : job.secureState,
    error: null,
  });
}

async function markJobFailed(params: {
  job: any;
  options: JsonObject;
  secureState: JsonObject | null;
  failure: JsonObject;
  executionMs: number | null;
  cleanup?: JsonObject | null;
}) {
  const { job, options, secureState, failure, executionMs, cleanup } = params;
  const nextOptions = {
    ...options,
    error: failure.error.message,
  };

  const nextSecureState = secureState
    ? {
        ...secureState,
        phase: 'failed',
        failure,
        ...(cleanup ? { cleanup } : {}),
      }
    : null;

  const failedJob = await persistJobUpdate(job.id, {
    status: 'failed',
    error: failure.error.message,
    completedAt: new Date(),
    executionMs: executionMs ?? undefined,
    options: JSON.stringify(nextOptions),
    secureState: nextSecureState ? JSON.stringify(nextSecureState) : job.secureState,
  });

  try {
    await settleJobMaterializationTasks(failedJob.id);
  } catch (error: any) {
    console.error('Job materialization failed after job failure:', error);
  }
}

async function markJobCompleted(params: {
  job: any;
  options: JsonObject;
  secureState: JsonObject | null;
  resultUrl: string;
  resultPath: string;
  executionMs: number | null;
  cleanup?: JsonObject | null;
}) {
  const { job, options, secureState, resultUrl, resultPath, executionMs, cleanup } = params;
  const thumbnailUrl = await maybeGenerateJobThumbnail({
    id: job.id,
    modelId: job.modelId,
    type: job.type,
    resultUrl,
    thumbnailUrl: job.thumbnailUrl,
  });

  const nextSecureState = secureState
    ? {
        ...secureState,
        phase: 'completed',
        activeAttempt: {
          ...secureState.activeAttempt,
          finalization: {
            status: 'completed',
            localResultPath: resultPath,
            localResultUrl: resultUrl,
            localThumbnailUrl: thumbnailUrl || secureState?.activeAttempt?.finalization?.localThumbnailUrl || null,
            completedAt: new Date().toISOString(),
          },
        },
        cleanup: cleanup || secureState.cleanup,
      }
    : null;

  const completedJob = await persistJobUpdate(job.id, {
    status: 'completed',
    resultUrl,
    thumbnailUrl: thumbnailUrl ?? job.thumbnailUrl ?? undefined,
    error: null,
    completedAt: new Date(),
    executionMs: executionMs ?? undefined,
    options: JSON.stringify(options),
    secureState: nextSecureState ? JSON.stringify(nextSecureState) : job.secureState,
  });

  try {
    await maybeAutoSaveUpscaleResult(completedJob);
  } catch (error: any) {
    console.error('Upscale autosave failed after job completion:', error);
  }

  try {
    await settleJobMaterializationTasks(completedJob.id);
  } catch (error: any) {
    console.error('Job materialization failed after job completion:', error);
  }

  try {
    await materializeStudioSessionCompletedJob(completedJob.id);
  } catch (error: any) {
    console.error('Studio Session materialization failed after job completion:', error);
  }
}

async function maybeCleanupSecureArtifacts(secureState: JsonObject | null, settings: any, resultStoragePath?: string | null) {
  if (!secureState) {
    return null;
  }

  if (secureState?.cleanup?.transportStatus === 'completed' || secureState?.cleanup?.transportStatus === 'warning') {
    return secureState.cleanup;
  }

  try {
    const s3 = createS3Service(settings);
    return await cleanupSecureTransportArtifacts({
      s3,
      secureState,
      resultStoragePath,
    });
  } catch (error: any) {
    return {
      transportStatus: 'warning',
      warning: `cleanup_unavailable:${error.message}`,
      completedAt: new Date().toISOString(),
    };
  }
}

function reconstructSecureStateFromTransportResult(job: any, transportResult: any, existingSecureState: JsonObject | null): JsonObject | null {
  if (existingSecureState?.activeAttempt?.attemptId) {
    return existingSecureState;
  }

  const binding = transportResult?.result_media?.envelope?.binding;
  const attemptId = binding?.attempt_id;
  if (!attemptId) {
    return existingSecureState;
  }

  return {
    v: 1,
    phase: 'finalizing',
    activeAttempt: {
      attemptId,
      runpodJobId: job.runpodJobId || null,
      outputDir: null,
      request: {
        secureBlockPresent: true,
        mediaInputs: [],
        submittedAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : new Date(job.createdAt || Date.now()).toISOString(),
      },
      response: {
        transportResultSecureReceived: true,
        transportResultStatus: transportResult?.status || null,
      },
      finalization: {
        status: 'pending',
        localResultPath: null,
        localResultUrl: null,
        completedAt: null,
      },
    },
    attemptHistory: [],
    failure: null,
    cleanup: {
      transportStatus: 'pending',
      warning: null,
    },
  };
}

async function finalizeSecureTransportResult(params: {
  job: any;
  output: any;
  options: JsonObject;
  secureState: JsonObject | null;
  settings: any;
  executionMs: number | null;
}) {
  const { job, output, options, secureState, settings, executionMs } = params;
  const transportResult = output.transport_result;
  const normalizedSecureState = reconstructSecureStateFromTransportResult(job, transportResult, secureState);
  const attemptId = normalizedSecureState?.activeAttempt?.attemptId;
  if (!attemptId) {
    throw new Error('Secure attempt id is missing');
  }

  const s3 = createS3Service(settings);
  const secureStateWithResponse = {
    ...normalizedSecureState,
    phase: transportResult.status === 'completed' ? 'finalizing' : 'failed',
    activeAttempt: {
      ...normalizedSecureState.activeAttempt,
      response: {
        ...normalizedSecureState.activeAttempt?.response,
        transportResultSecureReceived: true,
        transportResultStatus: transportResult.status,
      },
    },
  };

  if (transportResult.status === 'failed') {
    const failure = normalizeFailure(
      'endpoint.transport_result',
      transportResult.error,
      'TRANSPORT_FAILED',
      'Secure transport failed',
    );

    await markJobFailed({
      job,
      options,
      secureState: secureStateWithResponse,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureStateWithResponse, settings),
    });
    return;
  }

  if (transportResult.status !== 'completed' || !transportResult.result_media) {
    const failure = normalizeFailure(
      'endpoint.transport_result',
      new Error('Secure transport result is missing result media'),
      'TRANSPORT_RESULT_INVALID',
      'Secure transport result is missing result media',
    );

    await markJobFailed({
      job,
      options,
      secureState: secureStateWithResponse,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureStateWithResponse, settings),
    });
    return;
  }

  await persistJobUpdate(job.id, {
    status: 'finalizing',
    executionMs: executionMs ?? undefined,
    secureState: JSON.stringify(secureStateWithResponse),
  });

  try {
    const masterKey = decodeMasterKey(settings.runpod.fieldEncKeyB64);
    const resultBuffer = await downloadAndDecryptResultMedia({
      s3,
      masterKey,
      jobId: job.id,
      modelId: job.modelId,
      attemptId,
      media: transportResult.result_media,
    });

    const { filePath, relativePath } = await writeLocalResultBuffer(job, resultBuffer, {
      mime: transportResult.result_media.mime,
      kind: transportResult.result_media.kind,
      candidate: transportResult.result_media.storage_path,
    });

    const cleanup = await maybeCleanupSecureArtifacts(
      secureStateWithResponse,
      settings,
      transportResult.result_media.storage_path,
    );

    await markJobCompleted({
      job,
      options: {
        ...options,
        transportResultStatus: transportResult.status,
      },
      secureState: secureStateWithResponse,
      resultUrl: relativePath,
      resultPath: filePath,
      executionMs,
      cleanup,
    });
  } catch (error: any) {
    const failure = normalizeFailure(
      'engui.finalization',
      error,
      'FINALIZATION_FAILED',
      'Secure finalization failed',
    );

    const failedSecureState = {
      ...secureStateWithResponse,
      activeAttempt: {
        ...secureStateWithResponse.activeAttempt,
        finalization: {
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: failure.error,
        },
      },
    };

    await markJobFailed({
      job,
      options: {
        ...options,
        transportResultStatus: transportResult.status,
      },
      secureState: failedSecureState,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(failedSecureState, settings),
    });
  }
}

async function finalizeLegacyResult(params: {
  job: any;
  output: any;
  options: JsonObject;
  secureState: JsonObject | null;
  settings: any;
  executionMs: number | null;
}) {
  const { job, output, options, secureState, settings, executionMs } = params;

  await persistJobUpdate(job.id, {
    status: 'finalizing',
    executionMs: executionMs ?? undefined,
    ...(secureState ? { secureState: JSON.stringify({ ...secureState, phase: 'finalizing' }) } : {}),
  });

  try {
    const encryptedResult = await materializeEncryptedResult(job, output, settings);
    const materialized = encryptedResult || await materializeLegacyResult(job, output, settings);

    await markJobCompleted({
      job,
      options,
      secureState,
      resultUrl: materialized.relativePath,
      resultPath: materialized.filePath,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureState, settings),
    });
  } catch (error: any) {
    const failure = normalizeFailure(
      'engui.finalization',
      error,
      'FINALIZATION_FAILED',
      'Legacy finalization failed',
    );

    await markJobFailed({
      job,
      options,
      secureState,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureState, settings),
    });
  }
}

export async function processRunPodJob(job: any) {
  const model = getModelById(job.modelId || 'unknown');
  if (!model || model.api.type !== 'runpod') {
    return;
  }

  const options = parseJson(job.options);
  const secureState = parseSecureState(job.secureState);
  const runpodJobId = job.runpodJobId
    || options.runpodJobId
    || secureState?.activeAttempt?.runpodJobId
    || null;

  if (!runpodJobId) {
    const jobAgeMs = Date.now() - new Date(job.createdAt).getTime();

    if (job.status === 'queueing_up' && jobAgeMs <= QUEUEING_UP_GRACE_MS) {
      await markJobQueueingUp(job, options, secureState);
      return;
    }

    const failure = normalizeFailure(
      'engui.job',
      new Error('RunPod job id was not attached within the queueing window'),
      'RUNPOD_JOB_ID_MISSING',
      'RunPod job id was not attached within the queueing window',
    );

    await markJobFailed({
      job,
      options,
      secureState,
      failure,
      executionMs: null,
    });
    return;
  }

  const { settings } = await settingsService.getSettings(job.userId || 'user-with-settings');
  if (!settings.runpod?.apiKey) {
    console.warn('RunPod supervisor skipped job because API key is not configured', { jobId: job.id });
    return;
  }

  const endpoints = settings.runpod.endpoints as Record<string, string> | undefined;
  const endpointKey = model.api.endpoint;
  const endpointId = job.endpointId || endpoints?.[endpointKey] || endpoints?.[model.id];
  if (!endpointId) {
    console.warn('RunPod supervisor skipped job because endpoint is not configured', {
      jobId: job.id,
      modelId: model.id,
      endpointKey,
    });
    return;
  }

  const runpodService = new RunPodService(
    settings.runpod.apiKey,
    endpointId,
    settings.runpod.generateTimeout,
    settings.runpod.fieldEncKeyB64,
  );

  const status = await runpodService.getJobStatus(runpodJobId);
  const executionMs = parseRunPodExecutionMs(status);
  const jobAgeMs = Date.now() - new Date(job.createdAt).getTime();

  if (status.upstreamNotFound && jobAgeMs > STALE_NOT_FOUND_THRESHOLD_MS) {
    const failure = normalizeFailure(
      'runpod.status',
      new Error('RunPod job not found on the original endpoint'),
      'RUNPOD_JOB_NOT_FOUND',
      'RunPod job not found on the original endpoint',
    );

    await markJobFailed({
      job,
      options: {
        ...options,
        upstreamNotFound: true,
      },
      secureState,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureState, settings),
    });
    return;
  }

  if (status.status === 'IN_QUEUE') {
    if (job.status !== 'queued') {
      await markJobQueued(job, options, secureState, executionMs);
    }
    return;
  }

  if (status.status === 'IN_PROGRESS') {
    if (job.status !== 'processing') {
      await markJobProcessing(job, options, secureState, executionMs, 'runpod_processing');
    }
    return;
  }

  if (status.status === 'FAILED') {
    const failure = normalizeFailure(
      'runpod.execution',
      new Error(status.error || 'RunPod job failed'),
      'RUNPOD_JOB_FAILED',
      'RunPod job failed',
    );

    await markJobFailed({
      job,
      options,
      secureState,
      failure,
      executionMs,
      cleanup: await maybeCleanupSecureArtifacts(secureState, settings),
    });
    return;
  }

  if (status.status !== 'COMPLETED') {
    return;
  }

  const output = status.output;

  if (output && typeof output === 'object' && output.transport_result) {
    await finalizeSecureTransportResult({
      job,
      output,
      options,
      secureState,
      settings,
      executionMs,
    });
    return;
  }

  await finalizeLegacyResult({
    job,
    output,
    options,
    secureState,
    settings,
    executionMs,
  });
}

export async function processRunPodJobsOnce() {
  const jobs = await prisma.job.findMany({
    where: {
      status: { in: [...ACTIVE_JOB_STATUSES] },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const job of jobs) {
    try {
      await processRunPodJob(job);
    } catch (error) {
      console.error('RunPod supervisor failed to process job', {
        jobId: job.id,
        error,
      });
    }
  }

  try {
    await recoverJobMaterializationTasks({ limit: 200 });
  } catch (error) {
    console.error('RunPod supervisor failed job materialization recovery sweep', error);
  }

  try {
    await recoverStudioSessionMaterializationTasks({ limit: 200 });
  } catch (error) {
    console.error('RunPod supervisor failed Studio Session materialization recovery sweep', error);
  }
}

function getSupervisorIntervalMs() {
  const raw = process.env.RUNPOD_SUPERVISOR_INTERVAL_MS;
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 1000) {
    return Math.round(parsed);
  }
  return DEFAULT_SUPERVISOR_INTERVAL_MS;
}

export function startRunPodSupervisor() {
  const existing = globalSupervisor.__enguiRunpodSupervisor;
  if (existing?.started) {
    return;
  }

  const state: SupervisorHandle = {
    started: true,
    timer: null,
    tickInFlight: false,
  };
  globalSupervisor.__enguiRunpodSupervisor = state;

  const scheduleNext = () => {
    state.timer = setTimeout(() => {
      void tick();
    }, getSupervisorIntervalMs());
    state.timer.unref?.();
  };

  const tick = async () => {
    if (state.tickInFlight) {
      scheduleNext();
      return;
    }

    state.tickInFlight = true;
    try {
      await processRunPodJobsOnce();
    } catch (error) {
      console.error('RunPod supervisor tick failed', error);
    } finally {
      state.tickInFlight = false;
      scheduleNext();
    }
  };

  console.log('RunPod supervisor started', {
    intervalMs: getSupervisorIntervalMs(),
  });

  void tick();
}
