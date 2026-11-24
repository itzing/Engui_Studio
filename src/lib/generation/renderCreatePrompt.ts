import { expandPromptWildcards } from '@/lib/prompt-wildcards/server';
import { resolvePromptVariants } from './promptVariants';
import { protectCharacterReferences } from '@/lib/character-references/tokens';
import { resolveCharacterReferences } from '@/lib/character-references/server';
import { WorkspaceError } from '@/lib/workspaces/context';

export async function renderCreatePrompt(input: {
  prompt: string;
  workspaceId: string;
  seed?: number | string | null;
  selections?: unknown;
}) {
  if (input.prompt.length > 100_000) throw new WorkspaceError('The prompt is too long.', 422);
  const expanded = await expandPromptWildcards(input.prompt, input.workspaceId, {
    selections: input.selections, preserveCharacterReferences: true,
  });
  let protectedText: ReturnType<typeof protectCharacterReferences>;
  try { protectedText = protectCharacterReferences(expanded.prompt); }
  catch (error) { throw new WorkspaceError((error as Error).message, 422); }
  const selected = protectedText.restore(resolvePromptVariants(protectedText.prompt, input.seed));
  const resolved = await resolveCharacterReferences(selected, input.workspaceId);
  return { ...expanded, expandedPromptTemplate: expanded.prompt, prompt: resolved.prompt, characterReferences: resolved.snapshots };
}
