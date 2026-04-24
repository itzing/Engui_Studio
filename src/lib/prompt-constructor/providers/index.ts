import { characterPromptBlockProvider } from '@/lib/prompt-constructor/providers/characters';
import { posePromptBlockProvider } from '@/lib/prompt-constructor/providers/poses';
import type { PromptBlock, PromptBlockProviderInput } from '@/lib/prompt-constructor/providers/types';
import { vibePromptBlockProvider } from '@/lib/prompt-constructor/providers/vibes';
import { getPromptTemplate } from '@/lib/prompt-constructor/templateRegistry';

export async function loadPromptBlocks(input: PromptBlockProviderInput): Promise<PromptBlock[]> {
  const template = getPromptTemplate('single_character_scene_v1');
  const slot = template?.slots.find((entry) => entry.id === input.slotId);
  const categories = new Set(slot?.libraryCategories || []);

  const providers = [characterPromptBlockProvider, vibePromptBlockProvider, posePromptBlockProvider];
  const nested = await Promise.all(providers.map((provider) => provider.loadBlocks(input)));
  const blocks = nested.flat();

  const filtered = categories.size > 0
    ? blocks.filter((block) => categories.has(block.category))
    : blocks;

  return filtered.sort((a, b) => a.label.localeCompare(b.label));
}
