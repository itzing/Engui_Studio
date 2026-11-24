import { resolveImageVibe } from "@/lib/vibes/resolveImageVibe";
import { expandPromptWildcards } from "@/lib/prompt-wildcards/server";
import { protectCharacterReferences } from "@/lib/character-references/tokens";
import { resolveCharacterReferences, type CharacterReferenceSnapshot } from "@/lib/character-references/server";
import { requireWorkspaceId, WorkspaceError } from "@/lib/workspaces/context";
import { resolvePromptVariants } from "@/lib/generation/promptVariants";
import { composePrompt } from "./catalog";
import { fail, type GenerationDraft } from "./core";

// Translate resolver errors here, not globally: do not expose arbitrary workspace errors.
export async function characterReferencesFor(template: string) {
  try { return (await resolveCharacterReferences(template, requireWorkspaceId())).snapshots; }
  catch (error) {
    if (error instanceof WorkspaceError && error.status === 422)
      fail("INVALID_CHARACTER_REFERENCE", error.message);
    throw error;
  }
}
function protect(template: string) {
  try { return protectCharacterReferences(template); }
  catch (error) { fail("INVALID_CHARACTER_REFERENCE", (error as Error).message); }
}
export async function hasExplicitCharacterReferences(d: GenerationDraft) {
  if (d.negativePrompt?.includes("{character:"))
    fail("INVALID_CHARACTER_REFERENCE", "Character tags are supported only in the positive prompt, not negativePrompt.");
  const workspaceId = requireWorkspaceId();
  // Inspect the user template plus Vibe/wildcards before deciding whether to prepend identity.
  const bodyVibe = await resolveImageVibe(d.prompt, d.vibeId || "", workspaceId);
  const body = await expandPromptWildcards(bodyVibe.prompt, workspaceId, { preserveCharacterReferences: true });
  const explicitCharacters = protect(body.prompt).references.length > 0;
  if (explicitCharacters && (d.characterVersionId || d.outfitId))
    fail("INVALID_ARGUMENT", "Character tags use current identities and current default outfits. Omit characterVersionId and outfitId, or remove the tags to use structured selection.");
  return explicitCharacters;
}
export async function expandMcpPrompt(d: GenerationDraft, character: any, explicitCharacters: boolean) {
  const workspaceId = requireWorkspaceId();
  const composition = composePrompt(character, d, explicitCharacters);
  // Retain the existing composition -> Vibe -> wildcard ordering for untagged requests.
  const vibe = await resolveImageVibe(composition.prompt, d.vibeId || "", workspaceId);
  const expanded = await expandPromptWildcards(vibe.prompt, workspaceId, { preserveCharacterReferences: true });
  const protectedText = explicitCharacters ? protect(expanded.prompt) : {
    prompt: expanded.prompt, references: [], restore: (text: string) => text,
  };
  // One workspace-scoped read resolves all references once for every variant in this plan.
  const characterReferences = await characterReferencesFor(
    protectedText.references.map(ref => ref.token).join("\n"),
  );
  return { composition, vibe, expanded, protectedText, characterReferences, explicitCharacters };
}
export function renderMcpVariant(
  protectedText: ReturnType<typeof protectCharacterReferences>,
  references: CharacterReferenceSnapshot[], seed: number,
) {
  const selected = protectedText.restore(resolvePromptVariants(protectedText.prompt, seed));
  if (!references.length) return { prompt: selected, characterReferences: [] };
  const byToken = new Map(references.map(ref => [ref.token, ref]));
  const used = new Set<string>();
  // Apply frozen descriptions only AFTER seeded alternatives; never reparse appearance text.
  const prompt = selected.replace(/\{character:[^{}\n]+\}/g, token => {
    const ref = byToken.get(token);
    if (!ref) fail("INVALID_CHARACTER_REFERENCE", "A character tag could not be resolved. Prepare a new plan.");
    used.add(token);
    return ref.text;
  });
  return { prompt, characterReferences: references.filter(ref => used.has(ref.token)) };
}
