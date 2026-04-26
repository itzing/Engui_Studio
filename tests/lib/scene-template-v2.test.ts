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
  it('renders name, role, age, gender, expression, and appearance in the requested order for adults', () => {
    const prompt = renderSceneTemplateV2(buildState('22', 'female'), []);

    expect(prompt).toContain('Character 1: name: Mira, Role: hero, 22yo, female, calm face expression, silver hair, pale skin');
    expect(prompt).not.toContain('Character A');
  });

  it('renders under-18 male/female as boy/girl', () => {
    const girlPrompt = renderSceneTemplateV2(buildState('17', 'female'), []);
    const boyPrompt = renderSceneTemplateV2(buildState('16', 'male'), []);

    expect(girlPrompt).toContain('17yo, girl');
    expect(boyPrompt).toContain('16yo, boy');
  });
});
