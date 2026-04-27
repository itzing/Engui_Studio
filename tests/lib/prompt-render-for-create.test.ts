/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { renderPromptDocumentForCreate } from '@/lib/prompt-constructor/renderForCreate';
import type { PromptDocument } from '@/lib/prompt-constructor/types';
import type { CharacterSummary } from '@/lib/characters/types';

function buildSceneDocument(): PromptDocument {
  return {
    id: 'draft-1',
    workspaceId: 'ws-1',
    title: 'Random scene',
    templateId: 'scene_template_v2',
    templateVersion: 1,
    status: 'active',
    createdAt: '2026-04-26T00:00:00.000Z',
    updatedAt: '2026-04-26T00:00:00.000Z',
    enabledConstraintIds: [],
    state: {
      schemaVersion: 1,
      sceneSummary: {
        sceneType: 'portrait scene',
        mainEvent: 'single character close-up',
        notes: '',
        tags: [],
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
            nameOrRole: '',
            ageBand: '22',
            genderPresentation: 'female',
            appearance: '',
            useRandomCharacterAppearance: true,
            randomCharacterId: '',
            randomCharacterName: '',
            randomCharacterAppearance: '',
            outfit: 'black coat',
            expression: 'calm',
            pose: 'looking forward',
            localAction: 'standing still',
            props: [],
          },
          staging: {
            screenPosition: 'left',
            depthLayer: 'foreground',
            bodyOrientation: '',
            stance: '',
            relativePlacementNotes: '',
          },
        },
      ],
      characterRelations: [],
      composition: {
        shotSize: '',
        cameraAngle: '',
        framing: '',
        subjectPlacement: '',
        foregroundPriority: '',
        backgroundPriority: '',
      },
      environment: {
        location: '',
        timeOfDay: '',
        lighting: '',
        weather: '',
        background: '',
        environmentDetails: '',
      },
      style: {
        medium: '',
        visualStyle: '',
        detailLevel: '',
        colorPalette: '',
        mood: '',
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
  };
}

describe('renderPromptDocumentForCreate', () => {
  it('refreshes random character picks for scene drafts on each render', () => {
    const document = buildSceneDocument();
    const characters: CharacterSummary[] = [
      {
        id: 'char-luna',
        name: 'Luna',
        gender: 'female',
        traits: { hair_color: 'silver hair', eye_color: 'amber eyes' },
        editorState: {},
        currentVersionId: 'v1',
        previewStatusSummary: null,
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        deletedAt: null,
      },
      {
        id: 'char-nova',
        name: 'Nova',
        gender: 'female',
        traits: { hair_color: 'black hair', eye_color: 'green eyes' },
        editorState: {},
        currentVersionId: 'v2',
        previewStatusSummary: null,
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        deletedAt: null,
      },
    ];

    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.99);

    const first = renderPromptDocumentForCreate(document, characters);
    const second = renderPromptDocumentForCreate(document, characters);

    expect(first.renderedPrompt).toContain('Character 1: Luna');
    expect(second.renderedPrompt).toContain('Character 1: Nova');
  });
});
