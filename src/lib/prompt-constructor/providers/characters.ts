import type { CharacterSummary } from '@/lib/characters/types';
import { characterTraitDefinitionMap } from '@/lib/characters/schema';
import type { PromptBlockProvider } from '@/lib/prompt-constructor/providers/types';

const traitAllowlistByCategory: Record<string, string[]> = {
  appearance: ['ethnicity', 'skin_tone', 'face_shape', 'eye_color', 'eye_shape', 'hair_color', 'hair_texture', 'hair_length_base', 'body_build', 'body_proportions'],
  expression: ['eyebrow_shape', 'eyebrow_density', 'lip_shape', 'lip_fullness'],
  pose: ['posture', 'neck_alignment', 'hip_alignment', 'knee_alignment'],
};

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildTraitSnippet(character: CharacterSummary, category: 'appearance' | 'expression' | 'pose'): string {
  const keys = traitAllowlistByCategory[category] || [];
  const parts = keys
    .map((key) => ({ key, value: typeof character.traits[key] === 'string' ? normalizeText(character.traits[key]) : '' }))
    .filter((item) => item.value.length > 0)
    .map(({ key, value }) => {
      const label = characterTraitDefinitionMap.get(key)?.label;
      return label ? `${value}` : value;
    });

  if (category === 'appearance') {
    const prefix = [character.gender?.trim() || '', ...parts].filter(Boolean).join(', ');
    return prefix;
  }

  return parts.join(', ');
}

function matchesQuery(block: { label: string; content: string; tags: string[] }, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return `${block.label} ${block.content} ${block.tags.join(' ')}`.toLowerCase().includes(q);
}

export const characterPromptBlockProvider: PromptBlockProvider = {
  source: 'characters',
  async loadBlocks({ query }) {
    const response = await fetch('/api/characters', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load characters');

    const characters: CharacterSummary[] = Array.isArray(data.characters) ? data.characters : [];
    const blocks = characters.flatMap((character) => {
      const result = [] as Array<{ id: string; label: string; content: string; category: 'appearance' | 'expression' | 'pose'; source: 'characters'; tags: string[]; sourceId: string }>;

      const appearance = buildTraitSnippet(character, 'appearance');
      if (appearance) {
        result.push({
          id: `character:${character.id}:appearance`,
          label: `${character.name} · Appearance`,
          content: appearance,
          category: 'appearance',
          source: 'characters',
          tags: [character.name, 'appearance'],
          sourceId: character.id,
        });
      }

      const expression = buildTraitSnippet(character, 'expression');
      if (expression) {
        result.push({
          id: `character:${character.id}:expression`,
          label: `${character.name} · Expression`,
          content: expression,
          category: 'expression',
          source: 'characters',
          tags: [character.name, 'expression'],
          sourceId: character.id,
        });
      }

      const pose = buildTraitSnippet(character, 'pose');
      if (pose) {
        result.push({
          id: `character:${character.id}:pose`,
          label: `${character.name} · Posture`,
          content: pose,
          category: 'pose',
          source: 'characters',
          tags: [character.name, 'pose'],
          sourceId: character.id,
        });
      }

      return result;
    });

    return blocks.filter((block) => matchesQuery(block, query || ''));
  },
};
