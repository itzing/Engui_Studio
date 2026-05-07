import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockSubmitJob,
  mockGetSettings,
  mockProcessFileUpload,
  mockCreateSecureStateSkeleton,
  mockCreateStructuredEnvelope,
  mockDecodeMasterKey,
  mockUploadEncryptedMediaInput,
  mockBuildAttemptPaths,
  mockBuildOutputFileName,
  mockStartRunPodSupervisor,
  mockEnsureStudioSessionMaterializationTaskForJob,
  mockUuid,
  mockGetModelById,
} = vi.hoisted(() => ({
  mockPrisma: {
    job: {
      create: vi.fn(),
      update: vi.fn(),
    },
    workspace: {
      findFirst: vi.fn(),
    },
  },
  mockSubmitJob: vi.fn(),
  mockGetSettings: vi.fn(),
  mockProcessFileUpload: vi.fn(),
  mockCreateSecureStateSkeleton: vi.fn(),
  mockCreateStructuredEnvelope: vi.fn(),
  mockDecodeMasterKey: vi.fn(),
  mockUploadEncryptedMediaInput: vi.fn(),
  mockBuildAttemptPaths: vi.fn(),
  mockBuildOutputFileName: vi.fn(),
  mockStartRunPodSupervisor: vi.fn(),
  mockEnsureStudioSessionMaterializationTaskForJob: vi.fn(),
  mockUuid: vi.fn(),
  mockGetModelById: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: function PrismaClient() {
    return mockPrisma as any;
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/runpodService', () => ({
  default: class RunPodService {
    submitJob = mockSubmitJob;
  },
}));

vi.mock('@/lib/settingsService', () => ({
  default: class SettingsService {
    getSettings = mockGetSettings;
  },
}));

vi.mock('@/lib/elevenlabsService', () => ({
  default: class ElevenLabsService {},
}));

vi.mock('@/lib/s3Service', () => ({
  default: class S3Service {},
}));

vi.mock('@/lib/serverFileUtils', () => ({
  processFileUpload: mockProcessFileUpload,
}));

vi.mock('@/lib/secureTransport', () => ({
  createSecureStateSkeleton: mockCreateSecureStateSkeleton,
  createStructuredEnvelope: mockCreateStructuredEnvelope,
  decodeMasterKey: mockDecodeMasterKey,
  uploadEncryptedMediaInput: mockUploadEncryptedMediaInput,
  buildAttemptPaths: mockBuildAttemptPaths,
  buildOutputFileName: mockBuildOutputFileName,
}));

vi.mock('@/lib/runpodSupervisor', () => ({
  startRunPodSupervisor: mockStartRunPodSupervisor,
}));

vi.mock('@/lib/studio-sessions/server', () => ({
  ensureStudioSessionMaterializationTaskForJob: mockEnsureStudioSessionMaterializationTaskForJob,
}));

vi.mock('@/lib/apiMessages', () => ({
  getApiMessage: vi.fn((group: string, code: string) => `${group}:${code}`),
}));

vi.mock('@/lib/models/modelConfig', () => ({
  getModelById: mockGetModelById,
}));

vi.mock('uuid', () => ({
  v4: mockUuid,
}));

import { POST } from '@/app/api/generate/route';

function buildRequest(formData: FormData) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/generate secure RunPod flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetModelById.mockReturnValue({
      id: 'wan22',
      name: 'WAN 2.2',
      type: 'video',
      api: {
        type: 'runpod',
        endpoint: 'wan22',
      },
      inputs: ['text', 'image'],
      imageInputKey: 'image_path',
      parameters: [
        { name: 'negative_prompt', type: 'string' },
      ],
    });

    mockPrisma.workspace.findFirst.mockResolvedValue({ id: 'workspace-default' });

    mockEnsureStudioSessionMaterializationTaskForJob.mockResolvedValue(null);

    mockPrisma.job.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      ...data,
    }));
    mockPrisma.job.update.mockResolvedValue(undefined);
    mockProcessFileUpload.mockResolvedValue({
      s3Path: 's3://bucket/input.png',
      webPath: '/results/input.png',
    });
    mockCreateSecureStateSkeleton.mockReturnValue({
      activeAttempt: {
        request: {
          mediaInputs: [],
        },
      },
      cleanup: {
        transportStatus: 'pending',
      },
    });
    mockCreateStructuredEnvelope.mockReturnValue({ encrypted: true });
    mockDecodeMasterKey.mockReturnValue(Buffer.alloc(32, 1));
    mockUploadEncryptedMediaInput.mockResolvedValue({
      role: 'source_image',
      kind: 'image',
      mime: 'image/png',
      storage_path: '/runpod-volume/wan22-inputs/job-1__attempt-1__input.bin',
      envelope: { v: 1 },
    });
    mockBuildAttemptPaths.mockImplementation((jobId: string, attemptId: string) => ({
      outputsDir: `/runpod-volume/secure-jobs/${jobId}/${attemptId}/outputs`,
    }));
    mockBuildOutputFileName.mockReturnValue('result.bin');
    mockSubmitJob.mockResolvedValue('rp-job-1');
    mockUuid.mockReset();
    mockUuid
      .mockReturnValueOnce('file-uuid')
      .mockReturnValueOnce('job-1')
      .mockReturnValueOnce('attempt-1');
  });

  it('rejects secure submit when the global key is missing', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        runpod: {
          apiKey: 'rp-key',
          endpoints: { wan22: 'endpoint-1' },
          fieldEncKeyB64: '',
        },
      },
    });

    const formData = new FormData();
    formData.set('modelId', 'wan22');
    formData.set('prompt', 'test prompt');
    formData.set('image', new File([Buffer.from('image-bytes')], 'frame.png', { type: 'image/png' }));

    const response = await POST(buildRequest(formData) as any);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('RunPod field encryption key is not configured');
    expect(mockSubmitJob).not.toHaveBeenCalled();
  });

  it('rejects secure submit when the configured key is invalid', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        runpod: {
          apiKey: 'rp-key',
          endpoints: { wan22: 'endpoint-1' },
          fieldEncKeyB64: 'not-base64',
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
    mockDecodeMasterKey.mockImplementation(() => {
      throw new Error('Invalid field encryption key');
    });

    const formData = new FormData();
    formData.set('modelId', 'wan22');
    formData.set('prompt', 'test prompt');
    formData.set('image', new File([Buffer.from('image-bytes')], 'frame.png', { type: 'image/png' }));

    const response = await POST(buildRequest(formData) as any);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Invalid field encryption key');
    expect(mockSubmitJob).not.toHaveBeenCalled();
  });

  it('builds secure RunPod submit payload with _secure, media_inputs, and transport_request', async () => {
    mockGetSettings.mockResolvedValue({
      settings: {
        runpod: {
          apiKey: 'rp-key',
          endpoints: { wan22: 'endpoint-1' },
          fieldEncKeyB64: Buffer.alloc(32, 9).toString('base64'),
          generateTimeout: 3600,
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

    const formData = new FormData();
    formData.set('modelId', 'wan22');
    formData.set('prompt', 'animate this frame');
    formData.set('negative_prompt', 'low quality');
    formData.set('image', new File([Buffer.from('image-bytes')], 'frame.png', { type: 'image/png' }));

    const response = await POST(buildRequest(formData) as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      success: true,
      jobId: 'job-1',
      runpodJobId: 'rp-job-1',
      status: 'IN_QUEUE',
    });

    expect(mockSubmitJob).toHaveBeenCalledTimes(1);
    const [payload, submittedModelId] = mockSubmitJob.mock.calls[0];
    expect(submittedModelId).toBe('wan22');
    expect(payload._secure).toEqual({ encrypted: true });
    expect(payload.media_inputs).toHaveLength(1);
    expect(payload.transport_request).toEqual({
      output_dir: '/runpod-volume/secure-jobs/job-1/attempt-1/outputs/',
      output_file_name: 'result.bin',
    });
    expect(payload.prompt).toBeUndefined();
    expect(payload.negative_prompt).toBeUndefined();
    expect(payload.image_path).toBeUndefined();

    expect(mockCreateStructuredEnvelope).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        job_id: 'job-1',
        model_id: 'wan22',
        attempt_id: 'attempt-1',
        direction: 'engui_to_endpoint',
      }),
      {
        prompt: 'animate this frame',
        negative_prompt: 'low quality',
      },
    );
    expect(mockUploadEncryptedMediaInput).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1',
      modelId: 'wan22',
      attemptId: 'attempt-1',
      role: 'source_image',
      kind: 'image',
    }));
    expect(mockStartRunPodSupervisor).toHaveBeenCalledTimes(1);
  });
});
