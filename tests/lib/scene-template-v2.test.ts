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
  it('renders the character name as the heading and splits fields onto separate lines', () => {
    const prompt = renderSceneTemplateV2(buildState('22', 'female'), []);

    expect(prompt).toContain('Mira:\nRole: hero\n22yo\nfemale\nFace expression: calm\nblack coat\nLocal action: standing still\nPose: looking forward\nsilver hair, pale skin');
    expect(prompt).not.toContain('name: Mira');
    expect(prompt).not.toContain('Character A');
    expect(prompt).not.toContain('Character 1: Mira');
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

    expect(prompt).toContain('Luna:\nRole: hero');
    expect(prompt).toContain('female, amber eyes, braided silver hair');
    expect(prompt).not.toContain('Mira:');
  });

  it('falls back to role when the character has no explicit name', () => {
    const state = buildState('22', 'female');
    state.characterSlots[0].fields.nameOrRole = '';

    const prompt = renderSceneTemplateV2(state, []);

    expect(prompt).toContain('hero:\n22yo\nfemale');
    expect(prompt).not.toContain('Role: hero');
    expect(prompt).not.toContain('Character 1');
  });

  it('reuses resolved character references in relation lines', () => {
    const state = buildState('22', 'female');
    state.characterSlots.push({
      id: 'char_2',
      label: 'Character B',
      role: 'support',
      enabled: true,
      presetRef: null,
      posePresetRef: null,
      fields: {
        nameOrRole: 'Kai',
        ageBand: '24',
        genderPresentation: 'male',
        appearance: 'dark hair',
        useRandomCharacterAppearance: false,
        randomCharacterId: '',
        randomCharacterName: '',
        randomCharacterAppearance: '',
        outfit: 'linen shirt',
        expression: 'focused',
        pose: 'leaning closer',
        localAction: 'reaching toward Mira',
        props: [],
      },
      staging: {
        screenPosition: 'right',
        depthLayer: 'foreground',
        bodyOrientation: 'turned toward Mira',
        stance: 'close stance',
        relativePlacementNotes: 'just in front of Mira',
      },
    });
    state.characterRelations.push({
      id: 'rel_1',
      subjectId: 'char_1',
      targetId: 'char_2',
      relationType: 'leans toward',
      distance: 'near kissing distance',
      eyeContact: 'direct eye contact',
      bodyOrientation: '',
      contactDetails: 'hand at shoulder',
      relativePlacement: 'Mira behind Kai left shoulder',
      dramaticFocus: '',
      notes: '',
    });

    const prompt = renderSceneTemplateV2(state, []);

    expect(prompt).toContain('Interaction: Mira leans toward Kai, near kissing distance, direct eye contact, hand at shoulder, Mira behind Kai left shoulder.');
    expect(prompt).not.toContain('Character A');
    expect(prompt).not.toContain('Character B');
  });
});
