import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    promptDocument: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { GET as listPromptDocuments, POST as createPromptDocument } from '@/app/api/prompt-documents/route';
import { GET as getPromptDocument, PUT as updatePromptDocument } from '@/app/api/prompt-documents/[id]/route';
import { getDefaultSceneTemplateConstraintIds } from '@/lib/prompt-constructor/templates/sceneTemplateV2';

function iso(value: string) {
  return new Date(value);
}

describe('prompt documents routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists legacy and scene-template documents without crashing and annotates legacy summaries', async () => {
    mockPrisma.promptDocument.findMany.mockResolvedValue([
      {
        id: 'legacy-1',
        workspaceId: 'ws-1',
        title: 'Old portrait',
        templateId: 'single_character_scene_v1',
        templateVersion: 1,
        stateJson: JSON.stringify({
          character: { appearance: 'silver hair', outfit: 'black coat', expression: 'calm', pose: 'standing' },
          action: { mainAction: 'looking at camera' },
          composition: { shotType: 'medium shot', cameraAngle: 'eye level', framing: 'centered' },
          environment: { location: 'studio', timeOfDay: 'night', lighting: 'soft rim light', background: 'dark backdrop' },
          style: { style: 'cinematic', detailLevel: 'high detail', palette: 'cool monochrome', mood: 'moody' },
        }),
        enabledConstraintIds: JSON.stringify(['no_text_overlay']),
        status: 'active',
        createdAt: iso('2026-04-24T10:00:00Z'),
        updatedAt: iso('2026-04-24T10:05:00Z'),
      },
      {
        id: 'scene-1',
        workspaceId: 'ws-1',
        title: 'Temple reunion',
        templateId: 'scene_template_v2',
        templateVersion: 1,
        stateJson: JSON.stringify({
          schemaVersion: 1,
          sceneSummary: {
            sceneType: 'dramatic reunion',
            mainEvent: 'two allies meet again in a ruined temple',
            notes: 'wind through broken columns',
            tags: ['temple', 'dramatic'],
          },
          characterSlots: [
            {
              id: 'char_1',
              label: 'Character A',
              role: 'hero',
              enabled: true,
              presetRef: null,
              posePresetRef: null,
              fields: {
                nameOrRole: 'wanderer',
                ageBand: 'adult',
                genderPresentation: 'androgynous',
                appearance: 'dusty white hair',
                outfit: 'travel cloak',
                expression: 'relieved',
                pose: 'reaching forward',
                localAction: 'stepping into light',
                props: ['satchel'],
              },
              staging: {
                screenPosition: 'left',
                depthLayer: 'foreground',
                bodyOrientation: 'facing right',
                stance: 'leaning in',
                relativePlacementNotes: 'closest to camera',
              },
            },
          ],
          characterRelations: [],
          composition: {
            shotSize: 'medium wide',
            cameraAngle: 'low angle',
            framing: 'asymmetric',
            subjectPlacement: 'hero left third',
            foregroundPriority: 'broken pillars',
            backgroundPriority: 'altar silhouette',
          },
          environment: {
            location: 'ruined temple',
            timeOfDay: 'dusk',
            lighting: 'god rays',
            weather: 'dusty air',
            background: 'collapsed hall',
            environmentDetails: 'floating particles',
          },
          style: {
            medium: 'digital painting',
            visualStyle: 'cinematic fantasy',
            detailLevel: 'high detail',
            colorPalette: 'amber and teal',
            mood: 'hopeful',
            renderingStyle: 'z-image turbo',
          },
          constraints: {
            mustKeep: ['single frame'],
            mustAvoid: [],
            consistencyRequirements: [],
            layoutConstraints: [],
            textConstraints: [],
          },
        }),
        enabledConstraintIds: JSON.stringify(['no_text_overlay']),
        status: 'active',
        createdAt: iso('2026-04-24T11:00:00Z'),
        updatedAt: iso('2026-04-24T11:05:00Z'),
      },
    ]);

    const response = await listPromptDocuments(new Request('http://localhost/api/prompt-documents?workspaceId=ws-1') as any);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.documents).toHaveLength(2);
    expect(json.documents[0]).toMatchObject({
      id: 'legacy-1',
      templateId: 'single_character_scene_v1',
      title: 'Old portrait · Legacy',
      sceneType: 'legacy single character',
      tags: ['legacy'],
      characterCount: 1,
    });
    expect(json.documents[1]).toMatchObject({
      id: 'scene-1',
      templateId: 'scene_template_v2',
      title: 'Temple reunion',
      sceneType: 'dramatic reunion',
      tags: ['temple', 'dramatic'],
      characterCount: 1,
    });
  });

  it('creates a new scene_template_v2 document from structured state', async () => {
    mockPrisma.promptDocument.create.mockImplementation(async ({ data }: any) => ({
      id: 'scene-new',
      ...data,
      createdAt: iso('2026-04-25T12:00:00Z'),
      updatedAt: iso('2026-04-25T12:00:00Z'),
    }));

    const response = await createPromptDocument(new Request('http://localhost/api/prompt-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: 'ws-1',
        title: 'Moonlit balcony',
        templateId: 'scene_template_v2',
        templateVersion: 1,
        enabledConstraintIds: ['no_text_overlay', 'keep_single_frame', 'invalid-id'],
        state: {
          schemaVersion: 1,
          sceneSummary: {
            sceneType: 'romantic balcony scene',
            mainEvent: 'two people speak quietly under moonlight',
            notes: 'city lights in distance',
            tags: ['romance', 'night'],
          },
          characterSlots: [
            {
              id: 'char_1',
              label: 'Character A',
              role: 'lead',
              enabled: true,
              presetRef: null,
              posePresetRef: null,
              fields: {
                nameOrRole: 'woman',
                ageBand: 'adult',
                genderPresentation: 'feminine',
                appearance: 'long dark hair',
                outfit: 'formal dress',
                expression: 'soft smile',
                pose: 'leaning on railing',
                localAction: 'speaking softly',
                props: ['wine glass'],
              },
              staging: {
                screenPosition: 'left',
                depthLayer: 'foreground',
                bodyOrientation: 'facing right',
                stance: 'relaxed',
                relativePlacementNotes: 'closer to railing',
              },
            },
          ],
          characterRelations: [],
          composition: {
            shotSize: 'medium shot',
            cameraAngle: 'eye level',
            framing: 'balanced',
            subjectPlacement: 'left third',
            foregroundPriority: 'balcony railing',
            backgroundPriority: 'city skyline',
          },
          environment: {
            location: 'balcony',
            timeOfDay: 'night',
            lighting: 'moonlight',
            weather: 'clear sky',
            background: 'city lights',
            environmentDetails: 'soft breeze',
          },
          style: {
            medium: 'digital illustration',
            visualStyle: 'cinematic anime',
            detailLevel: 'high detail',
            colorPalette: 'blue and silver',
            mood: 'intimate',
            renderingStyle: 'z-image turbo',
          },
          constraints: {
            mustKeep: ['single frame'],
            mustAvoid: ['visible text'],
            consistencyRequirements: [],
            layoutConstraints: [],
            textConstraints: [],
          },
        },
      }),
    }) as any);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.promptDocument.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.promptDocument.create.mock.calls[0][0]).toMatchObject({
      data: {
        workspaceId: 'ws-1',
        title: 'Moonlit balcony',
        templateId: 'scene_template_v2',
        templateVersion: 1,
        status: 'active',
      },
    });
    const createdData = mockPrisma.promptDocument.create.mock.calls[0][0].data;
    expect(JSON.parse(createdData.stateJson)).toMatchObject({
      sceneSummary: {
        sceneType: 'romantic balcony scene',
        tags: ['romance', 'night'],
      },
      characterSlots: [
        expect.objectContaining({
          id: 'char_1',
          enabled: true,
        }),
      ],
    });
    expect(JSON.parse(createdData.enabledConstraintIds)).toEqual(getDefaultSceneTemplateConstraintIds());
    expect(json.document).toMatchObject({
      id: 'scene-new',
      templateId: 'scene_template_v2',
      title: 'Moonlit balcony',
    });
    expect(Array.isArray(json.warnings)).toBe(true);
  });

  it('loads a legacy single_character_scene_v1 document with rendered prompt instead of crashing', async () => {
    mockPrisma.promptDocument.findUnique.mockResolvedValue({
      id: 'legacy-1',
      workspaceId: 'ws-1',
      title: 'Old portrait',
      templateId: 'single_character_scene_v1',
      templateVersion: 1,
      stateJson: JSON.stringify({
        character: { appearance: 'silver hair', outfit: 'black coat', expression: 'calm', pose: 'standing' },
        action: { mainAction: 'looking at camera' },
        composition: { shotType: 'medium shot', cameraAngle: 'eye level', framing: 'centered' },
        environment: { location: 'studio', timeOfDay: 'night', lighting: 'soft rim light', background: 'dark backdrop' },
        style: { style: 'cinematic', detailLevel: 'high detail', palette: 'cool monochrome', mood: 'moody' },
      }),
      enabledConstraintIds: JSON.stringify(['no_text_overlay']),
      status: 'active',
      createdAt: iso('2026-04-24T10:00:00Z'),
      updatedAt: iso('2026-04-24T10:05:00Z'),
    });

    const response = await getPromptDocument(new Request('http://localhost/api/prompt-documents/legacy-1') as any, {
      params: Promise.resolve({ id: 'legacy-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.document).toMatchObject({
      id: 'legacy-1',
      templateId: 'single_character_scene_v1',
      title: 'Old portrait',
    });
    expect(json.renderedPrompt).toContain('Character portrait or single-character scene.');
    expect(json.renderedPrompt).toContain('silver hair');
    expect(Array.isArray(json.warnings)).toBe(true);
  });

  it('updates a legacy document into scene_template_v2 migration shape', async () => {
    mockPrisma.promptDocument.findUnique.mockResolvedValue({
      id: 'legacy-1',
      workspaceId: 'ws-1',
      title: 'Old portrait',
      templateId: 'single_character_scene_v1',
      templateVersion: 1,
      stateJson: JSON.stringify({
        character: { appearance: 'silver hair', outfit: 'black coat', expression: 'calm', pose: 'standing' },
        action: { mainAction: 'looking at camera' },
        composition: { shotType: 'medium shot', cameraAngle: 'eye level', framing: 'centered' },
        environment: { location: 'studio', timeOfDay: 'night', lighting: 'soft rim light', background: 'dark backdrop' },
        style: { style: 'cinematic', detailLevel: 'high detail', palette: 'cool monochrome', mood: 'moody' },
      }),
      enabledConstraintIds: JSON.stringify(['no_text_overlay']),
      status: 'active',
      createdAt: iso('2026-04-24T10:00:00Z'),
      updatedAt: iso('2026-04-24T10:05:00Z'),
    });
    mockPrisma.promptDocument.update.mockImplementation(async ({ data }: any) => ({
      id: 'legacy-1',
      workspaceId: 'ws-1',
      title: data.title,
      templateId: data.templateId,
      templateVersion: data.templateVersion,
      stateJson: data.stateJson,
      enabledConstraintIds: data.enabledConstraintIds,
      status: 'active',
      createdAt: iso('2026-04-24T10:00:00Z'),
      updatedAt: iso('2026-04-25T12:10:00Z'),
    }));

    const response = await updatePromptDocument(new Request('http://localhost/api/prompt-documents/legacy-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Migrated scene',
        templateId: 'scene_template_v2',
        templateVersion: 1,
        state: {
          schemaVersion: 1,
          sceneSummary: {
            sceneType: 'single character scene',
            mainEvent: 'looking at camera',
            notes: 'migrated from legacy',
            tags: ['legacy-migrated'],
          },
          characterSlots: [
            {
              id: 'char_1',
              label: 'Character A',
              role: '',
              enabled: true,
              presetRef: null,
              posePresetRef: null,
              fields: {
                nameOrRole: '',
                ageBand: '',
                genderPresentation: '',
                appearance: 'silver hair',
                outfit: 'black coat',
                expression: 'calm',
                pose: 'standing',
                localAction: 'looking at camera',
                props: [],
              },
              staging: {
                screenPosition: '',
                depthLayer: '',
                bodyOrientation: '',
                stance: '',
                relativePlacementNotes: '',
              },
            },
          ],
          characterRelations: [],
          composition: {
            shotSize: 'medium shot',
            cameraAngle: 'eye level',
            framing: 'centered',
            subjectPlacement: '',
            foregroundPriority: '',
            backgroundPriority: '',
          },
          environment: {
            location: 'studio',
            timeOfDay: 'night',
            lighting: 'soft rim light',
            weather: '',
            background: 'dark backdrop',
            environmentDetails: '',
          },
          style: {
            medium: '',
            visualStyle: 'cinematic',
            detailLevel: 'high detail',
            colorPalette: 'cool monochrome',
            mood: 'moody',
            renderingStyle: '',
          },
          constraints: {
            mustKeep: [],
            mustAvoid: [],
            consistencyRequirements: [],
            layoutConstraints: [],
            textConstraints: [],
          },
        },
      }),
    }) as any, {
      params: Promise.resolve({ id: 'legacy-1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockPrisma.promptDocument.update).toHaveBeenCalledTimes(1);
    const updateData = mockPrisma.promptDocument.update.mock.calls[0][0].data;
    expect(updateData.templateId).toBe('scene_template_v2');
    expect(JSON.parse(updateData.enabledConstraintIds)).toEqual(getDefaultSceneTemplateConstraintIds());
    expect(JSON.parse(updateData.stateJson)).toMatchObject({
      sceneSummary: {
        sceneType: 'single character scene',
        mainEvent: 'looking at camera',
        tags: ['legacy-migrated'],
      },
      characterSlots: [
        expect.objectContaining({
          id: 'char_1',
          fields: expect.objectContaining({
            appearance: 'silver hair',
            localAction: 'looking at camera',
          }),
        }),
      ],
    });
    expect(json.document).toMatchObject({
      id: 'legacy-1',
      templateId: 'scene_template_v2',
      title: 'Migrated scene',
    });
    expect(typeof json.renderedPrompt).toBe('string');
  });
});
