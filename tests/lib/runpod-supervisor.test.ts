import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockGetSettings,
  mockGetJobStatus,
  mockDeleteFile,
  mockDownloadAndDecryptResultMedia,
  mockMaybeGenerateJobThumbnail,
  mockMaybeAutoSaveUpscaleResult,
  mockMaterializeStudioSessionCompletedJob,
  mockRecoverStudioSessionMaterializationTasks,
  mockSettleJobMaterializationTasks,
  mockRecoverJobMaterializationTasks,
  mockExistsSync,
  mockMkdirSync,
  mockWriteFileSync,
} = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  mockGetSettings: vi.fn(),
  mockGetJobStatus: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockDownloadAndDecryptResultMedia: vi.fn(),
  mockMaybeGenerateJobThumbnail: vi.fn(),
  mockMaybeAutoSaveUpscaleResult: vi.fn(),
  mockMaterializeStudioSessionCompletedJob: vi.fn(),
  mockRecoverStudioSessionMaterializationTasks: vi.fn(),
  mockSettleJobMaterializationTasks: vi.fn(),
  mockRecoverJobMaterializationTasks: vi.fn(),
  mockExistsSync: vi.fn(() => true),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/settingsService', () => ({
  default: class SettingsService {
    getSettings = mockGetSettings;
  },
}));

vi.mock('@/lib/runpodService', () => ({
  default: class RunPodService {
    getJobStatus = mockGetJobStatus;
  },
}));

vi.mock('@/lib/s3Service', () => ({
  default: class S3Service {
    deleteFile = mockDeleteFile;
  },
}));

vi.mock('@/lib/models/modelConfig', () => ({
  getModelById: vi.fn(() => ({
    id: 'wan22',
    api: {
      type: 'runpod',
      endpoint: 'wan22',
    },
  })),
}));

vi.mock('@/lib/secureTransport', () => ({
  decodeMasterKey: vi.fn(() => Buffer.alloc(32, 7)),
  downloadAndDecryptResultMedia: mockDownloadAndDecryptResultMedia,
  storagePathToS3Key: vi.fn((value: string) => value.replace(/^\/runpod-volume\//, '')),
}));

vi.mock('@/lib/jobPreviewDerivatives', () => ({
  maybeGenerateJobThumbnail: mockMaybeGenerateJobThumbnail,
}));

vi.mock('@/lib/upscaleAutoSave', () => ({
  maybeAutoSaveUpscaleResult: mockMaybeAutoSaveUpscaleResult,
}));

vi.mock('@/lib/studio-sessions/server', () => ({
  materializeStudioSessionCompletedJob: mockMaterializeStudioSessionCompletedJob,
  recoverStudioSessionMaterializationTasks: mockRecoverStudioSessionMaterializationTasks,
}));

vi.mock('@/lib/materialization/server', () => ({
  settleJobMaterializationTasks: mockSettleJobMaterializationTasks,
  recoverJobMaterializationTasks: mockRecoverJobMaterializationTasks,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

import { processRunPodJob, processRunPodJobsOnce } from '@/lib/runpodSupervisor';

describe('runpod supervisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RUNPOD_FINALIZATION_DOWNLOAD_RETRY_BASE_MS = '0';
    process.env.RUNPOD_FINALIZATION_DOWNLOAD_RETRY_MAX_MS = '0';
    delete process.env.RUNPOD_FINALIZATION_DOWNLOAD_RETRY_ATTEMPTS;
    mockPrisma.job.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
    mockPrisma.job.findMany.mockResolvedValue([]);
    mockMaybeGenerateJobThumbnail.mockResolvedValue('/generations/job-previews/wan22-job-thumb.webp');
    mockMaybeAutoSaveUpscaleResult.mockResolvedValue(undefined);
    mockMaterializeStudioSessionCompletedJob.mockResolvedValue(null);
    mockRecoverStudioSessionMaterializationTasks.mockResolvedValue(undefined);
    mockSettleJobMaterializationTasks.mockResolvedValue(undefined);
    mockRecoverJobMaterializationTasks.mockResolvedValue(undefined);
    mockGetSettings.mockResolvedValue({
      settings: {
        runpod: {
          apiKey: 'rp-key',
          fieldEncKeyB64: Buffer.alloc(32, 3).toString('base64'),
          generateTimeout: 3600,
          endpoints: {
            wan22: 'endpoint-1',
          },
        },
        s3: {
          endpointUrl: 'https://s3.local',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          bucketName: 'bucket',
          region: 'us-east-1',
        },
      },
    });
  });

  it('finalizes secure transport results on the server and keeps completed status even with cleanup warning', async () => {
    const job = {
      id: 'job-1',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'processing',
      createdAt: new Date('2026-04-18T21:00:00Z'),
      runpodJobId: 'rp-1',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'runpod_processing',
        activeAttempt: {
          attemptId: 'attempt-1',
          runpodJobId: 'rp-1',
          request: {
            mediaInputs: [
              { storagePath: '/runpod-volume/secure-jobs/job-1/attempt-1/inputs/source_image.bin' },
            ],
          },
        },
        cleanup: {
          transportStatus: 'pending',
          warning: null,
        },
      }),
    };

    mockGetJobStatus.mockResolvedValue({
      status: 'COMPLETED',
      executionTime: 4321,
      output: {
        transport_result: {
          status: 'completed',
          result_media: {
            mime: 'image/png',
            kind: 'image',
            storage_path: '/runpod-volume/secure-jobs/job-1/attempt-1/outputs/result.bin',
            envelope: { v: 1 },
          },
        },
      },
    });
    mockDownloadAndDecryptResultMedia.mockResolvedValue(Buffer.from('png-binary'));
    mockDeleteFile.mockRejectedValueOnce(new Error('cannot delete input')).mockResolvedValueOnce(undefined);

    await processRunPodJob(job);

    expect(mockDownloadAndDecryptResultMedia).toHaveBeenCalledTimes(1);
    expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    expect(mockPrisma.job.update).toHaveBeenCalledTimes(2);

    const finalUpdate = mockPrisma.job.update.mock.calls.at(-1)?.[0];
    expect(finalUpdate.data.status).toBe('completed');
    expect(finalUpdate.data.resultUrl).toBe('/generations/wan22-job-1.png');
    expect(finalUpdate.data.thumbnailUrl).toBe('/generations/job-previews/wan22-job-thumb.webp');
    expect(mockSettleJobMaterializationTasks).toHaveBeenCalledWith('job-1');
    expect(mockMaterializeStudioSessionCompletedJob).toHaveBeenCalledWith('job-1');

    const secureState = JSON.parse(finalUpdate.data.secureState);
    expect(secureState.activeAttempt.finalization.localThumbnailUrl).toBe('/generations/job-previews/wan22-job-thumb.webp');
    expect(secureState.cleanup.transportStatus).toBe('warning');
    expect(secureState.cleanup.warning).toContain('secure-jobs/job-1/attempt-1/inputs/source_image.bin:cannot delete input');
    expect(secureState.cleanup.attemptedKeys).toEqual([
      'secure-jobs/job-1/attempt-1/inputs/source_image.bin',
      'secure-jobs/job-1/attempt-1/outputs/result.bin',
    ]);
    expect(secureState.cleanup.deletedKeys).toEqual([
      'secure-jobs/job-1/attempt-1/outputs/result.bin',
    ]);
    expect(secureState.cleanup.failedKeys).toEqual([
      'secure-jobs/job-1/attempt-1/inputs/source_image.bin',
    ]);
  });

  it('retries transient secure result download failures before failing finalization', async () => {
    const job = {
      id: 'job-download-retry',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'processing',
      createdAt: new Date('2026-06-12T09:00:00Z'),
      runpodJobId: 'rp-download-retry',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'runpod_processing',
        activeAttempt: {
          attemptId: 'attempt-download-retry',
          runpodJobId: 'rp-download-retry',
          request: { mediaInputs: [] },
        },
        cleanup: {
          transportStatus: 'pending',
          warning: null,
        },
      }),
    };

    mockGetJobStatus.mockResolvedValue({
      status: 'COMPLETED',
      executionTime: 2222,
      output: {
        transport_result: {
          status: 'completed',
          result_media: {
            mime: 'image/png',
            kind: 'image',
            storage_path: '/runpod-volume/secure-jobs/job-download-retry__attempt-download-retry__output__result.bin',
            envelope: { v: 1 },
          },
        },
      },
    });
    mockDownloadAndDecryptResultMedia
      .mockRejectedValueOnce(new Error('AWS CLI exited with code 1: An error occurred (403) when calling the HeadObject operation: Forbidden'))
      .mockResolvedValueOnce(Buffer.from('png-binary'));
    mockDeleteFile.mockResolvedValue(undefined);

    await processRunPodJob(job);

    expect(mockDownloadAndDecryptResultMedia).toHaveBeenCalledTimes(2);
    const finalUpdate = mockPrisma.job.update.mock.calls.at(-1)?.[0];
    expect(finalUpdate.data.status).toBe('completed');
    const secureState = JSON.parse(finalUpdate.data.secureState);
    expect(secureState.activeAttempt.response.resultMedia).toMatchObject({
      storage_path: '/runpod-volume/secure-jobs/job-download-retry__attempt-download-retry__output__result.bin',
      mime: 'image/png',
      kind: 'image',
    });
  });

  it('deletes every secure media input and encrypted result after completed finalization', async () => {
    const job = {
      id: 'job-clean',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'processing',
      createdAt: new Date('2026-04-18T21:00:00Z'),
      runpodJobId: 'rp-clean',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'runpod_processing',
        activeAttempt: {
          attemptId: 'attempt-clean',
          runpodJobId: 'rp-clean',
          request: {
            mediaInputs: [
              { storagePath: '/runpod-volume/secure-jobs/job-clean__attempt-clean__input__source_image.bin' },
              { storagePath: '/runpod-volume/secure-jobs/job-clean__attempt-clean__input__secondary_image.bin' },
            ],
          },
        },
        cleanup: {
          transportStatus: 'pending',
          warning: null,
        },
      }),
    };

    mockGetJobStatus.mockResolvedValue({
      status: 'COMPLETED',
      executionTime: 1234,
      output: {
        transport_result: {
          status: 'completed',
          result_media: {
            mime: 'image/png',
            kind: 'image',
            storage_path: '/runpod-volume/secure-jobs/job-clean__attempt-clean__output__result.bin',
            envelope: { v: 1 },
          },
        },
      },
    });
    mockDownloadAndDecryptResultMedia.mockResolvedValue(Buffer.from('png-binary'));
    mockDeleteFile.mockResolvedValue(undefined);

    await processRunPodJob(job);

    expect(mockDeleteFile).toHaveBeenNthCalledWith(1, 'secure-jobs/job-clean__attempt-clean__input__source_image.bin');
    expect(mockDeleteFile).toHaveBeenNthCalledWith(2, 'secure-jobs/job-clean__attempt-clean__input__secondary_image.bin');
    expect(mockDeleteFile).toHaveBeenNthCalledWith(3, 'secure-jobs/job-clean__attempt-clean__output__result.bin');

    const finalUpdate = mockPrisma.job.update.mock.calls.at(-1)?.[0];
    const secureState = JSON.parse(finalUpdate.data.secureState);
    expect(secureState.cleanup.transportStatus).toBe('completed');
    expect(secureState.cleanup.warning).toBeNull();
    expect(secureState.cleanup.attemptedKeys).toEqual([
      'secure-jobs/job-clean__attempt-clean__input__source_image.bin',
      'secure-jobs/job-clean__attempt-clean__input__secondary_image.bin',
      'secure-jobs/job-clean__attempt-clean__output__result.bin',
    ]);
    expect(secureState.cleanup.deletedKeys).toEqual(secureState.cleanup.attemptedKeys);
    expect(secureState.cleanup.failedKeys).toEqual([]);
  });

  it('records normalized failed state and keeps cleanup warning without changing terminal failure', async () => {
    const job = {
      id: 'job-2',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'processing',
      createdAt: new Date('2026-04-18T21:00:00Z'),
      runpodJobId: 'rp-2',
      options: JSON.stringify({ secureMode: true }),
      secureState: JSON.stringify({
        phase: 'runpod_processing',
        activeAttempt: {
          attemptId: 'attempt-2',
          runpodJobId: 'rp-2',
          request: {
            mediaInputs: [
              { storagePath: '/runpod-volume/secure-jobs/job-2/attempt-2/inputs/source_image.bin' },
            ],
          },
        },
      }),
    };

    mockGetJobStatus.mockResolvedValue({
      status: 'FAILED',
      error: 'GPU worker crashed',
      executionTime: 987,
    });
    mockDeleteFile.mockRejectedValueOnce(new Error('cleanup blocked'));

    await processRunPodJob(job);

    expect(mockPrisma.job.update).toHaveBeenCalledTimes(1);
    const finalUpdate = mockPrisma.job.update.mock.calls[0][0];
    expect(finalUpdate.data.status).toBe('failed');
    expect(finalUpdate.data.error).toBe('GPU worker crashed');

    const secureState = JSON.parse(finalUpdate.data.secureState);
    expect(mockSettleJobMaterializationTasks).toHaveBeenCalledWith('job-2');
    expect(secureState.failure.source).toBe('runpod.execution');
    expect(secureState.failure.error.code).toBe('Error');
    expect(secureState.cleanup.transportStatus).toBe('warning');
    expect(secureState.cleanup.warning).toContain('secure-jobs/job-2/attempt-2/inputs/source_image.bin:cleanup blocked');
  });

  it('retries secure cleanup warnings on terminal jobs', async () => {
    const terminalJob = {
      id: 'job-retry',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'completed',
      completedAt: new Date('2026-04-18T21:05:00Z'),
      secureState: JSON.stringify({
        phase: 'completed',
        activeAttempt: {
          attemptId: 'attempt-retry',
          request: {
            mediaInputs: [
              { storagePath: '/runpod-volume/secure-jobs/job-retry__attempt-retry__input__source_image.bin' },
            ],
          },
          response: {
            resultMediaStoragePath: '/runpod-volume/secure-jobs/job-retry__attempt-retry__output__result.bin',
          },
        },
        cleanup: {
          transportStatus: 'warning',
          warning: 'previous cleanup failed',
        },
      }),
    };

    mockPrisma.job.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([terminalJob]);
    mockDeleteFile.mockResolvedValue(undefined);

    await processRunPodJobsOnce();

    expect(mockGetJobStatus).not.toHaveBeenCalled();
    expect(mockDeleteFile).toHaveBeenNthCalledWith(1, 'secure-jobs/job-retry__attempt-retry__input__source_image.bin');
    expect(mockDeleteFile).toHaveBeenNthCalledWith(2, 'secure-jobs/job-retry__attempt-retry__output__result.bin');

    const retryUpdate = mockPrisma.job.update.mock.calls.at(-1)?.[0];
    expect(retryUpdate.where.id).toBe('job-retry');
    const secureState = JSON.parse(retryUpdate.data.secureState);
    expect(secureState.cleanup.transportStatus).toBe('completed');
    expect(secureState.cleanup.deletedKeys).toEqual([
      'secure-jobs/job-retry__attempt-retry__input__source_image.bin',
      'secure-jobs/job-retry__attempt-retry__output__result.bin',
    ]);
  });

  it('recovers failed jobs when secure transport completed but final download failed', async () => {
    const failedJob = {
      id: 'job-finalization-recovery',
      userId: 'user-with-settings',
      modelId: 'wan22',
      type: 'image',
      status: 'failed',
      createdAt: new Date('2026-06-12T09:00:00Z'),
      completedAt: new Date('2026-06-12T09:02:00Z'),
      executionMs: 3333,
      runpodJobId: 'rp-finalization-recovery',
      options: JSON.stringify({
        secureMode: true,
        transportResultStatus: 'completed',
        error: 'HeadObject 403 Forbidden',
      }),
      secureState: JSON.stringify({
        phase: 'failed',
        activeAttempt: {
          attemptId: 'attempt-finalization-recovery',
          runpodJobId: 'rp-finalization-recovery',
          request: { mediaInputs: [] },
          response: {
            transportResultSecureReceived: true,
            transportResultStatus: 'completed',
            resultMediaStoragePath: '/runpod-volume/secure-jobs/job-finalization-recovery__attempt-finalization-recovery__output__result.bin',
            resultMedia: {
              mime: 'image/png',
              kind: 'image',
              storage_path: '/runpod-volume/secure-jobs/job-finalization-recovery__attempt-finalization-recovery__output__result.bin',
              envelope: { v: 1 },
            },
          },
          finalization: {
            status: 'failed',
            failedAt: '2026-06-12T09:02:00.000Z',
            error: { code: 'Error', message: 'HeadObject 403 Forbidden' },
          },
        },
        failure: {
          source: 'engui.finalization',
          error: { code: 'Error', message: 'HeadObject 403 Forbidden' },
          recordedAt: '2026-06-12T09:02:00.000Z',
        },
        cleanup: {
          transportStatus: 'pending',
          warning: null,
        },
      }),
    };

    mockPrisma.job.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([failedJob])
      .mockResolvedValueOnce([]);
    mockDownloadAndDecryptResultMedia.mockResolvedValue(Buffer.from('png-binary'));
    mockDeleteFile.mockResolvedValue(undefined);

    await processRunPodJobsOnce();

    expect(mockGetJobStatus).not.toHaveBeenCalled();
    expect(mockDownloadAndDecryptResultMedia).toHaveBeenCalledTimes(1);

    const recoveryUpdate = mockPrisma.job.update.mock.calls[0][0];
    expect(recoveryUpdate.where.id).toBe('job-finalization-recovery');
    expect(recoveryUpdate.data.status).toBe('finalizing');
    expect(JSON.parse(recoveryUpdate.data.secureState).finalizationRecovery.attempts).toBe(1);

    const finalUpdate = mockPrisma.job.update.mock.calls.at(-1)?.[0];
    expect(finalUpdate.data.status).toBe('completed');
    expect(finalUpdate.data.error).toBeNull();
  });
});
