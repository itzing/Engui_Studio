import { describe, expect, it } from 'vitest';

import { buildCharacterPreviewPrompt } from '@/lib/characters/previews';
import type { CharacterSummary } from '@/lib/characters/types';

function buildCharacter(overrides: Partial<CharacterSummary> = {}): CharacterSummary {
  return {
    id: 'character-1',
    name: 'Mira',
    gender: 'female',
    traits: {
      age: '25',
      hair_color: 'silver',
    },
    editorState: {},
    currentVersionId: 'version-1',
    previewStatusSummary: null,
    createdAt: '2026-05-07T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

describe('character preview prompt', () => {
  it('renders age and gender with the same compact rules as Prompt Constructor', () => {
    const prompt = buildCharacterPreviewPrompt(buildCharacter(), 'portrait');

    expect(prompt).toContain('25yo');
    expect(prompt).toContain('female');
    expect(prompt).toContain('Hair color: silver');
    expect(prompt).not.toContain('Age: 25');
  });

  it('keeps portrait prompts scoped to identity, face, and hair traits', () => {
    const prompt = buildCharacterPreviewPrompt(buildCharacter({
      traits: {
        age: '25',
        hair_color: 'silver',
        face_shape: 'oval',
        body_build: 'athletic',
        hip_width: 'wide',
        glute_shape: 'round',
      },
    }), 'portrait');

    expect(prompt).toContain('Hair color: silver');
    expect(prompt).toContain('Face shape: oval');
    expect(prompt).not.toContain('Body build');
    expect(prompt).not.toContain('Hip width');
    expect(prompt).not.toContain('Glute shape');
  });

  it('renders underage gender terms like Prompt Constructor', () => {
    const prompt = buildCharacterPreviewPrompt(buildCharacter({
      gender: 'male',
      traits: { age: '17', hair_color: 'black' },
    }), 'portrait');

    expect(prompt).toContain('17yo');
    expect(prompt).toContain('boy');
    expect(prompt).not.toContain('male');
  });
});
