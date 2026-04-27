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
  it('keeps Character N as the heading and splits character fields onto separate lines', () => {
    const prompt = renderSceneTemplateV2(buildState('22', 'female'), []);

    expect(prompt).toContain('Character 1: Mira\nRole: hero\n22yo\nfemale\nFace expression: calm\nblack coat\nLocal action: standing still\nPose: looking forward\nsilver hair, pale skin');
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

  it('replaces Character N with names outside character sections', () => {
    const state = buildState('22', 'female');
    state.sceneSummary.mainEvent = 'Character 1 reaches toward Character 2';
    state.constraints.mustKeep = ['Keep Character 1 left of Character 2'];
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
        localAction: 'reaching toward Character 1',
        props: [],
      },
      staging: {
        screenPosition: 'right',
        depthLayer: 'foreground',
        bodyOrientation: 'turned toward Character 1',
        stance: 'close stance',
        relativePlacementNotes: 'just in front of Character 1',
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
      contactDetails: 'hand at Character 2 shoulder',
      relativePlacement: 'Character 1 behind Character 2 left shoulder',
      dramaticFocus: '',
      notes: 'Character 2 turns toward Character 1',
    });

    const prompt = renderSceneTemplateV2(state, []);

    expect(prompt).toContain('Scene: portrait scene, Mira reaches toward Kai.');
    expect(prompt).toContain('Character 1: Mira');
    expect(prompt).toContain('Character 2: Kai');
    expect(prompt).toContain('Local action: reaching toward Character 1');
    expect(prompt).toContain('turned toward Character 1');
    expect(prompt).toContain('just in front of Character 1');
    expect(prompt).toContain('Interaction: Mira leans toward Kai, near kissing distance, direct eye contact, hand at Kai shoulder, Mira behind Kai left shoulder, Kai turns toward Mira.');
    expect(prompt).toContain('Constraints: Keep Mira left of Kai.');
    expect(prompt).not.toContain('Scene: portrait scene, Character 1 reaches toward Character 2.');
  });
});
