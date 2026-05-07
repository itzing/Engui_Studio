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

  it('includes face and identity traits in upper-body prompts to preserve character identity', () => {
    const prompt = buildCharacterPreviewPrompt(buildCharacter({
      traits: {
        age: '25',
        ethnicity: 'Japanese',
        skin_tone: 'warm beige',
        face_shape: 'heart-shaped',
        eye_color: 'green',
        nose_shape: 'small straight nose',
        lip_shape: 'bow-shaped lips',
        hair_color: 'silver',
        body_build: 'slim athletic',
      },
    }), 'upper_body');

    expect(prompt).toContain('Ethnicity: Japanese');
    expect(prompt).toContain('Skin tone: warm beige');
    expect(prompt).toContain('Face shape: heart-shaped');
    expect(prompt).toContain('Eye color: green');
    expect(prompt).toContain('Nose shape: small straight nose');
    expect(prompt).toContain('Lip shape: bow-shaped lips');
    expect(prompt).toContain('Body build: slim athletic');
    expect(prompt).toContain('professional studio portrait photograph');
    expect(prompt).toContain('visible face');
    expect(prompt).toContain('modest closed one-piece swimsuit');
  });

  it('makes full-body prompts photo-based without negative prompt fragments', () => {
    const prompt = buildCharacterPreviewPrompt(buildCharacter({
      traits: {
        age: '25',
        face_shape: 'oval',
        eye_color: 'brown',
        hair_color: 'black',
        body_build: 'athletic',
        leg_structure: 'long toned legs',
      },
    }), 'full_body');

    expect(prompt).toContain('professional full-body studio photograph');
    expect(prompt).toContain('realistic camera photo');
    expect(prompt).toContain('face visible');
    expect(prompt).toContain('modest closed one-piece swimsuit');
    expect(prompt).toContain('Face shape: oval');
    expect(prompt).toContain('Eye color: brown');
    expect(prompt).toContain('Hair color: black');
    expect(prompt).toContain('Body build: athletic');
    expect(prompt).toContain('Leg structure: long toned legs');
    expect(prompt).not.toContain('character reference');
    expect(prompt).not.toContain('anatomy reference');
    expect(prompt).not.toContain('photorealistic');
    expect(prompt).not.toContain('not a 3d render');
    expect(prompt).not.toContain('not a mannequin');
    expect(prompt).not.toContain('not a faceless body');
    expect(prompt).not.toContain('not a black silhouette');
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

  it('uses gendered swimwear for visible-body previews', () => {
    const malePrompt = buildCharacterPreviewPrompt(buildCharacter({ gender: 'male', traits: { age: '25' } }), 'full_body');
    const femalePrompt = buildCharacterPreviewPrompt(buildCharacter({ gender: 'female', traits: { age: '25' } }), 'upper_body');
    const boyPrompt = buildCharacterPreviewPrompt(buildCharacter({ gender: 'male', traits: { age: '17' } }), 'full_body');

    expect(malePrompt).toContain('plain swim briefs');
    expect(femalePrompt).toContain('modest closed one-piece swimsuit');
    expect(boyPrompt).toContain('plain athletic swim shorts');
  });
});
