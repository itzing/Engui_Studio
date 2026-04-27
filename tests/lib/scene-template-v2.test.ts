/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { renderSceneTemplateV2 } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
import type { SceneTemplateState } from '@/lib/prompt-constructor/types';

function buildState(ageBand: string, genderPresentation: string): SceneTemplateState {
  return {
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
          nameOrRole: 'Mira',
          ageBand,
          genderPresentation,
          appearance: 'silver hair, pale skin',
          useRandomCharacterAppearance: false,
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
  };
}

describe('renderSceneTemplateV2 character formatting', () => {
  it('renders name first and splits character fields onto separate lines', () => {
    const prompt = renderSceneTemplateV2(buildState('22', 'female'), []);

    expect(prompt).toContain('Character 1: Mira\nRole: hero\n22yo\nfemale\nFace expression: calm\nsilver hair, pale skin\nblack coat\nLocal action: standing still\nPose: looking forward');
    expect(prompt).not.toContain('name: Mira');
    expect(prompt).not.toContain('Character A');
  });

  it('renders under-18 male/female as boy/girl on separate lines', () => {
    const girlPrompt = renderSceneTemplateV2(buildState('17', 'female'), []);
    const boyPrompt = renderSceneTemplateV2(buildState('16', 'male'), []);

    expect(girlPrompt).toContain('17yo\ngirl');
    expect(boyPrompt).toContain('16yo\nboy');
  });

  it('uses random character name and appearance when random appearance is enabled', () => {
    const state = buildState('22', 'female');
    state.characterSlots[0].fields.nameOrRole = '';
    state.characterSlots[0].fields.appearance = '';
    state.characterSlots[0].fields.useRandomCharacterAppearance = true;
    state.characterSlots[0].fields.randomCharacterId = 'character-random';
    state.characterSlots[0].fields.randomCharacterName = 'Luna';
    state.characterSlots[0].fields.randomCharacterAppearance = 'female, amber eyes, braided silver hair';

    const prompt = renderSceneTemplateV2(state, []);

    expect(prompt).toContain('Character 1: Luna');
    expect(prompt).toContain('female, amber eyes, braided silver hair');
    expect(prompt).not.toContain('Character 1: Mira');
  });
});
