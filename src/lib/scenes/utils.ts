import type { CharacterSummary } from '@/lib/characters/types';
import { characterTraitDefinitionMap } from '@/lib/characters/schema';
import { normalizeChipArray, normalizeCharacterCount } from '@/lib/poses/utils';
import type { SceneAssemblyInput, SceneAssemblyResult, SceneCharacterAssemblyInput, SceneCharacterBindingSummary, ScenePresetStatus, ScenePresetSummary } from './types';

type PersistedSceneBindingRecord = {
  id: string;
  slot: number;
  roleLabel: string | null;
  characterPresetId: string | null;
  overrideInstructions: string | null;
  characterPreset?: {
    id: string;
    name: string;
  } | null;
};

type PersistedSceneRecord = {
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  characterCount: number;
  tags: string | null;
  posePresetId: string | null;
  vibePresetId: string | null;
  sceneInstructions: string;
  assemblyMode: string;
  generatedScenePrompt: string;
  latestPreviewImageUrl: string | null;
  latestPreviewJobId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  posePreset?: { id: string; name: string } | null;
  vibePreset?: { id: string; name: string } | null;
  characterBindings?: PersistedSceneBindingRecord[];
};

export function normalizeSceneStatus(input: unknown): ScenePresetStatus {
  return input === 'trash' ? 'trash' : 'active';
}

export function normalizeSceneAssemblyMode(_input: unknown): 'template' {
  return 'template';
}

export function normalizeSceneCharacterBindings(input: unknown, characterCount: 1 | 2 | 3): Array<{
  slot: number;
  roleLabel: string | null;
  characterPresetId: string | null;
  overrideInstructions: string | null;
}> {
  const source = Array.isArray(input) ? input : [];
  const normalized = source
    .slice(0, characterCount)
    .map((item, index) => {
      const value = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        slot: typeof value.slot === 'number' ? value.slot : index,
        roleLabel: typeof value.roleLabel === 'string' && value.roleLabel.trim() ? value.roleLabel.trim() : null,
        characterPresetId: typeof value.characterPresetId === 'string' && value.characterPresetId.trim() ? value.characterPresetId.trim() : null,
        overrideInstructions: typeof value.overrideInstructions === 'string' && value.overrideInstructions.trim() ? value.overrideInstructions.trim() : null,
      };
    })
    .sort((a, b) => a.slot - b.slot)
    .map((binding, index) => ({ ...binding, slot: index }));

  while (normalized.length < characterCount) {
    normalized.push({ slot: normalized.length, roleLabel: null, characterPresetId: null, overrideInstructions: null });
  }

  return normalized;
}

export function toSceneCharacterBindingSummary(record: PersistedSceneBindingRecord): SceneCharacterBindingSummary {
  return {
    id: record.id,
    slot: record.slot,
    roleLabel: record.roleLabel ?? null,
    characterPresetId: record.characterPresetId ?? null,
    characterName: record.characterPreset?.name ?? null,
    overrideInstructions: record.overrideInstructions ?? null,
    brokenReference: !!record.characterPresetId && !record.characterPreset,
  };
}

export function toSceneSummary(record: PersistedSceneRecord): ScenePresetSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: record.name,
    summary: record.summary,
    characterCount: normalizeCharacterCount(record.characterCount),
    tags: normalizeChipArray(record.tags ? JSON.parse(record.tags) : []),
    posePresetId: record.posePresetId ?? null,
    posePresetName: record.posePreset?.name ?? null,
    vibePresetId: record.vibePresetId ?? null,
    vibePresetName: record.vibePreset?.name ?? null,
    sceneInstructions: record.sceneInstructions,
    assemblyMode: normalizeSceneAssemblyMode(record.assemblyMode),
    generatedScenePrompt: record.generatedScenePrompt,
    latestPreviewImageUrl: record.latestPreviewImageUrl ?? null,
    latestPreviewJobId: record.latestPreviewJobId ?? null,
    status: normalizeSceneStatus(record.status),
    characterBindings: (record.characterBindings || []).sort((a, b) => a.slot - b.slot).map(toSceneCharacterBindingSummary),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function serializeSceneTags(input: unknown): string {
  return JSON.stringify(normalizeChipArray(input));
}

export function buildCharacterPromptFromSummary(
  character: CharacterSummary | null | undefined,
  options: { includeName?: boolean; includeGender?: boolean; excludeTraitKeys?: string[]; includeTraitKeys?: string[] } = {},
): string {
  if (!character) return '';

  const parts: string[] = [];
  if (options.includeName !== false && character.name.trim()) {
    parts.push(character.name.trim());
  }
  if (options.includeGender !== false && character.gender?.trim()) {
    parts.push(character.gender.trim());
  }

  const excludedTraitKeys = new Set(options.excludeTraitKeys || []);
  const includedTraitKeys = options.includeTraitKeys ? new Set(options.includeTraitKeys) : null;
  const traitParts = Object.entries(character.traits)
    .filter(([key, value]) => (!includedTraitKeys || includedTraitKeys.has(key)) && !excludedTraitKeys.has(key) && typeof value === 'string' && value.trim())
    .map(([key, value]) => {
      const definition = characterTraitDefinitionMap.get(key);
      return definition ? `${definition.label}: ${value.trim()}` : `${key}: ${value.trim()}`;
    });

  return [...parts, ...traitParts].filter(Boolean).join(', ');
}

function renderCharacterBlock(character: SceneCharacterAssemblyInput): string {
  const segments = [
    character.roleLabel ? `${character.roleLabel}:` : `Character ${character.slot + 1}:`,
    character.characterName || undefined,
    character.resolvedCharacterPrompt,
    character.overrideInstructions || undefined,
  ].filter(Boolean);

  return segments.join(' ');
}

export function assembleScenePrompt(input: SceneAssemblyInput): SceneAssemblyResult {
  const warnings: string[] = [];

  if (input.pose && input.pose.characterCount !== input.characterCount) {
    warnings.push('Selected pose character count does not match the scene character count.');
  }

  const scenePart = input.sceneInstructions.trim();
  const characterParts = input.characters
    .sort((a, b) => a.slot - b.slot)
    .map((character) => {
      if (!character.resolvedCharacterPrompt.trim() && !character.overrideInstructions?.trim()) {
        warnings.push(`Character slot ${character.slot + 1} has no resolved character prompt.`);
      }
      return renderCharacterBlock(character);
    })
    .filter(Boolean);

  const posePart = input.pose?.posePrompt?.trim() || '';
  const vibePart = input.vibe?.baseDescription?.trim() || '';

  const prompt = [scenePart, ...characterParts, posePart, vibePart]
    .filter((part) => !!part && part.trim().length > 0)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!prompt) {
    warnings.push('Scene assembly produced an empty prompt.');
  }

  return {
    prompt,
    mode: 'template',
    warnings,
  };
}
