import type { CharacterSummary } from '@/lib/characters/types';
import { normalizeCharacterGender } from '@/lib/characters/utils';
import { buildCharacterPromptFromSummary } from '@/lib/scenes/utils';
import type { CharacterSlot, PromptDocument, SceneSnapshot, SceneTemplateState } from './types';
import { buildRenderedPrompt, buildSceneSnapshot } from './utils';

function buildCharacterAppearanceFromManager(character: CharacterSummary | null | undefined): string {
  return buildCharacterPromptFromSummary(character, { includeName: false, includeGender: false });
}

function pickRandomCharacterForSlot(slot: CharacterSlot, characters: CharacterSummary[]): CharacterSummary | null {
  const targetGender = normalizeCharacterGender(slot.fields.genderPresentation, 'female') || 'female';
  const matches = characters.filter((character) => (normalizeCharacterGender(character.gender, 'female') || 'female') === targetGender);
  if (matches.length === 0) return null;
  const index = Math.floor(Math.random() * matches.length);
  return matches[index] || null;
}

function applyRandomCharacterToSlot(slot: CharacterSlot, character: CharacterSummary | null): CharacterSlot {
  if (!character) {
    return {
      ...slot,
      fields: {
        ...slot.fields,
        randomCharacterId: '',
        randomCharacterName: '',
        randomCharacterAppearance: '',
      },
    };
  }

  return {
    ...slot,
    fields: {
      ...slot.fields,
      randomCharacterId: character.id,
      randomCharacterName: character.name || '',
      randomCharacterAppearance: buildCharacterAppearanceFromManager(character),
    },
  };
}

export function documentUsesRandomCharacterAppearance(document: PromptDocument): boolean {
  if (document.templateId !== 'scene_template_v2') return false;
  const state = document.state as SceneTemplateState;
  return state.characterSlots.some((slot) => slot.fields.useRandomCharacterAppearance);
}

export function refreshRandomCharactersInPromptDocument(document: PromptDocument, characters: CharacterSummary[]): PromptDocument {
  if (document.templateId !== 'scene_template_v2') return document;
  const state = document.state as SceneTemplateState;

  return {
    ...document,
    state: {
      ...state,
      characterSlots: state.characterSlots.map((slot) => (
        slot.fields.useRandomCharacterAppearance
          ? applyRandomCharacterToSlot(slot, pickRandomCharacterForSlot(slot, characters))
          : slot
      )),
    },
  };
}

export function renderPromptDocumentForCreate(document: PromptDocument, characters: CharacterSummary[] = []): {
  document: PromptDocument;
  renderedPrompt: string;
  sceneSnapshot: SceneSnapshot | null;
} {
  const effectiveDocument = documentUsesRandomCharacterAppearance(document)
    ? refreshRandomCharactersInPromptDocument(document, characters)
    : document;

  return {
    document: effectiveDocument,
    renderedPrompt: buildRenderedPrompt(effectiveDocument),
    sceneSnapshot: effectiveDocument.templateId === 'scene_template_v2'
      ? buildSceneSnapshot(effectiveDocument as PromptDocument<SceneTemplateState>)
      : null,
  };
}
