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

import { processRunPodJob } from '@/lib/runpodSupervisor';

describe('runpod supervisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.job.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
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
    expect(secureState.cleanup.warning).toContain('cannot delete input');
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
    expect(secureState.cleanup.warning).toContain('cleanup blocked');
  });
});
