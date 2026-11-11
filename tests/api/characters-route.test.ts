import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockSubmitGenerationFormData,
  mockCreateJobMaterializationTask,
  mockBuildCharacterPreviewSubmission,
  mockQueueCharacterPreviewGeneration,
} = vi.hoisted(() => ({
  mockPrisma: {
    character: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    characterVersion: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockSubmitGenerationFormData: vi.fn(),
  mockCreateJobMaterializationTask: vi.fn(),
  mockBuildCharacterPreviewSubmission: vi.fn(),
  mockQueueCharacterPreviewGeneration: vi.fn(),
}));

// Workspace authentication/isolation is exercised by the real MCP integration suite.
vi.mock('@/lib/workspaces/route', () => ({
  withWorkspaceRoute: (fn: any) => async (...args: any[]) => {
    const { workspaceContext } = await import('@/lib/workspaces/context');
    return workspaceContext.run({ kind: 'workspace', workspaceId: 'fixture-workspace' }, () => fn(...args));
  },
}));
vi.mock('@/lib/outfits/server', () => ({ resolveCharacterLook: vi.fn(async () => ({ mode: 'default', name: 'Default' })) }));
vi.mock('@/lib/outfits/previewPrompt', () => ({ buildLookPreviewPrompt: vi.fn(() => 'portrait prompt') }));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/generation/submitFormData', () => ({
  submitGenerationFormData: mockSubmitGenerationFormData,
}));

vi.mock('@/lib/materialization/server', () => ({
  createJobMaterializationTask: mockCreateJobMaterializationTask,
}));

vi.mock('@/lib/characters/server', () => ({
  buildCharacterPreviewSubmission: mockBuildCharacterPreviewSubmission,
  queueCharacterPreviewGeneration: mockQueueCharacterPreviewGeneration,
}));

import { POST as createCharacter } from '@/app/api/characters/route';
import { PUT as updateCharacter } from '@/app/api/characters/[id]/route';
import { POST as queueCharacterPreview } from '@/app/api/characters/[id]/preview/route';

function buildCharacterRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'character-1',
    workspaceId: 'fixture-workspace',
    name: 'Mira',
    gender: 'female',
    traits: JSON.stringify({ hair_color: 'silver' }),
    editorState: JSON.stringify({}),
    currentVersionId: 'version-1',
    previewStateJson: JSON.stringify({}),
    previewStatusSummary: null,
    createdAt: new Date('2026-04-26T00:00:00.000Z'),
    updatedAt: new Date('2026-04-26T00:00:00.000Z'),
    deletedAt: null,
    _count: { versions: 1 },
    ...overrides,
  };
}

describe('characters routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults new characters to female when gender is missing', async () => {
    const createdRecord = buildCharacterRecord();
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      character: {
        create: vi.fn().mockResolvedValue(buildCharacterRecord({ _count: undefined })),
        update: vi.fn().mockResolvedValue(createdRecord),
      },
      characterVersion: {
        create: mockPrisma.characterVersion.create.mockResolvedValue({ id: 'version-1' }),
      },
    }));

    const request = new Request('http://localhost/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mira',
        traits: { hair_color: 'silver' },
        editorState: {},
      }),
    });

    const response = await createCharacter(request as any);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.character.gender).toBe('female');
    expect(JSON.parse(mockPrisma.characterVersion.create.mock.calls[0][0].data.identitySnapshot)).toEqual({ schemaVersion: 1, name: 'Mira', gender: 'female' });
  });

  it('captures a new identity version for a gender-only update', async () => {
    const existing = buildCharacterRecord({ gender: 'male' });
    const updated = buildCharacterRecord({ gender: 'female' });
    mockPrisma.character.findUnique.mockResolvedValue(existing);
    mockPrisma.character.update.mockResolvedValue(updated);
    mockPrisma.characterVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
    mockPrisma.characterVersion.create.mockResolvedValue({ id: 'version-2' });
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));

    const request = new Request('http://localhost/api/characters/character-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mira',
        gender: 'female',
        traits: { hair_color: 'silver' },
        editorState: {},
        previewStatusSummary: null,
      }),
    });

    const response = await updateCharacter(request as any, { params: Promise.resolve({ id: 'character-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.persisted).toBe(true);
    expect(mockPrisma.character.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'character-1' },
      data: expect.objectContaining({ gender: 'female' }),
    }));
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.characterVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ versionNumber: 2, identitySnapshot: JSON.stringify({ schemaVersion: 1, name: 'Mira', gender: 'female' }) }) }));
  });

  it('captures a new identity version for a name-only update', async () => {
    const existing = buildCharacterRecord();
    mockPrisma.character.findUnique.mockResolvedValue(existing);
    mockPrisma.characterVersion.findFirst.mockResolvedValue({ versionNumber: 1 });
    mockPrisma.characterVersion.create.mockResolvedValue({ id: 'version-2' });
    mockPrisma.character.update.mockResolvedValue(buildCharacterRecord({ name: 'New name', currentVersionId: 'version-2' }));
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    const response = await updateCharacter(new Request('http://localhost/api/characters/character-1', {
      method: 'PUT', body: JSON.stringify({ name: 'New name', gender: 'female', traits: { hair_color: 'silver' }, editorState: {} }),
    }) as any, { params: Promise.resolve({ id: 'character-1' }) });
    expect(response.status).toBe(200);
    expect(JSON.parse(mockPrisma.characterVersion.create.mock.calls[0][0].data.identitySnapshot).name).toBe('New name');
  });

  it('queues a durable character preview job for a saved slot', async () => {
    const existing = buildCharacterRecord();
    const queuedCharacter = {
      id: 'character-1',
      name: 'Mira',
      gender: 'female',
      traits: { hair_color: 'silver' },
      editorState: {},
      previewState: {
        portrait: {
          slot: 'portrait',
          status: 'queued',
          jobId: 'job-preview-1',
          imageUrl: null,
          previewUrl: null,
          thumbnailUrl: null,
          error: null,
          promptSnapshot: 'portrait prompt',
          updatedAt: '2026-05-07T10:00:00.000Z',
        },
        upper_body: {
          slot: 'upper_body',
          status: 'idle',
          jobId: null,
          imageUrl: null,
          previewUrl: null,
          thumbnailUrl: null,
          error: null,
          promptSnapshot: null,
          updatedAt: null,
        },
        full_body: {
          slot: 'full_body',
          status: 'idle',
          jobId: null,
          imageUrl: null,
          previewUrl: null,
          thumbnailUrl: null,
          error: null,
          promptSnapshot: null,
          updatedAt: null,
        },
      },
      primaryPreviewImageUrl: null,
      primaryPreviewThumbnailUrl: null,
      currentVersionId: 'version-1',
      previewStatusSummary: null,
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      deletedAt: null,
      versionCount: 1,
    };

    mockPrisma.character.findUnique.mockResolvedValue(existing);
    mockPrisma.$transaction.mockImplementation(async (callback: any) => callback({
      character: {
        findUnique: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(existing),
      },
      characterLookPreview: { create: vi.fn().mockResolvedValue({ id: "look-preview-1" }) },
      jobMaterializationTask: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'task-1' }),
        update: vi.fn(),
      },
    }));
    mockBuildCharacterPreviewSubmission.mockReturnValue({
      modelId: 'z-image',
      prompt: 'portrait prompt',
      width: 1024,
      height: 1024,
      slot: 'portrait',
    });
    mockSubmitGenerationFormData.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      jobId: 'job-preview-1',
      status: 'IN_QUEUE',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    mockQueueCharacterPreviewGeneration.mockResolvedValue(queuedCharacter);

    const request = new Request('http://localhost/api/characters/character-1/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: 'portrait' }),
    });

    const response = await queueCharacterPreview(request as any, { params: Promise.resolve({ id: 'character-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.jobId).toBe('job-preview-1');
    expect(payload.character.previewState.portrait.status).toBe('queued');

    const submittedFormData = mockSubmitGenerationFormData.mock.calls[0][0] as FormData;
    expect(submittedFormData.get('modelId')).toBe('z-image');
    expect(submittedFormData.get('prompt')).toBe('portrait prompt');
    expect(submittedFormData.get('width')).toBe('1024');
    expect(submittedFormData.get('height')).toBe('1024');

    expect(mockCreateJobMaterializationTask).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-preview-1',
      targetType: 'character_preview',
      targetId: 'character-1',
      payload: { slot: 'portrait', lookPreviewId: 'look-preview-1', updateDefaultCover: true },
    }), expect.anything());
    expect(mockQueueCharacterPreviewGeneration).toHaveBeenCalledWith(expect.objectContaining({
      characterId: 'character-1',
      slot: 'portrait',
      jobId: 'job-preview-1',
      promptSnapshot: 'portrait prompt',
    }), expect.anything());
  });
});
