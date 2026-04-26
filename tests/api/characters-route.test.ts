import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
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
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { POST as createCharacter } from '@/app/api/characters/route';
import { PUT as updateCharacter } from '@/app/api/characters/[id]/route';

function buildCharacterRecord(overrides: Record<string, any> = {}) {
  return {
    id: 'character-1',
    name: 'Mira',
    gender: 'female',
    traits: JSON.stringify({ hair_color: 'silver' }),
    editorState: JSON.stringify({}),
    currentVersionId: 'version-1',
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
        create: vi.fn().mockResolvedValue({ id: 'version-1' }),
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
  });

  it('persists a gender-only update without creating a new version', async () => {
    const existing = buildCharacterRecord({ gender: 'male' });
    const updated = buildCharacterRecord({ gender: 'female' });
    mockPrisma.character.findUnique.mockResolvedValue(existing);
    mockPrisma.character.update.mockResolvedValue(updated);

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
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
