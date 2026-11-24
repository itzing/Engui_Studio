import { prisma } from '@/lib/prisma';
import { toCharacterSummary } from '@/lib/characters/utils';
import { composeCharacterLook } from '@/lib/outfits/compose';
import { WorkspaceError, requireWorkspaceId } from '@/lib/workspaces/context';
import { protectCharacterReferences } from './tokens';

export type CharacterReferenceSnapshot = {
  token: string;
  characterId: string;
  characterName: string;
  characterVersionId: string | null;
  characterUpdatedAt: string;
  includeOutfit: boolean;
  outfitId: string | null;
  outfitRevision: number | null;
  text: string;
};

export async function resolveCharacterReferences(input: string, workspaceId: string) {
  let protectedText: ReturnType<typeof protectCharacterReferences>;
  try { protectedText = protectCharacterReferences(input); }
  catch (error) { throw new WorkspaceError((error as Error).message, 422); }
  if (!protectedText.references.length) return { prompt: input, snapshots: [] as CharacterReferenceSnapshot[] };
  if (requireWorkspaceId() !== workspaceId) throw new WorkspaceError('Request workspace mismatch.', 403);
  const ids = [...new Set(protectedText.references.map(ref => ref.characterId))];
  if (ids.length > 32) throw new WorkspaceError('Use at most 32 different characters in one prompt.', 422);
  const records = await prisma.character.findMany({
    where: { id: { in: ids }, workspaceId, deletedAt: null },
    include: { defaultOutfit: true },
  });
  const byId = new Map(records.map(record => [record.id, record]));
  const snapshots = new Map<string, CharacterReferenceSnapshot>();
  // Build the complete map before substitution. Repeated tags share one DB snapshot.
  for (const ref of protectedText.references) {
    if (snapshots.has(ref.token)) continue;
    const record = byId.get(ref.characterId);
    if (!record || record.workspaceId !== workspaceId || record.deletedAt) {
      throw new WorkspaceError('A referenced character is unavailable in this workspace. Choose another character or remove its tag.', 422);
    }
    const outfit = ref.includeOutfit ? record.defaultOutfit : null;
    if (ref.includeOutfit && record.defaultOutfitId && (!outfit || outfit.deletedAt || outfit.workspaceId !== workspaceId || (outfit.ownerCharacterId && outfit.ownerCharacterId !== record.id))) {
      throw new WorkspaceError(`The default outfit for ${record.name} is unavailable. Choose another default outfit or turn off Include outfit.`, 422);
    }
    const summary = toCharacterSummary(record);
    // Identity-only must work even if the character's default outfit is archived.
    const look = composeCharacterLook(summary, ref.includeOutfit ? { mode: 'default' } : { mode: 'custom', customText: '' }, ref.includeOutfit ? summary.defaultOutfit || null : null);
    if (ref.includeOutfit && !look.outfit.trim()) {
      throw new WorkspaceError(`No default outfit is set for ${record.name}. Set one in Characters or turn off Include outfit.`, 422);
    }
    const text = [look.identity, ref.includeOutfit ? look.outfit : ''].filter(Boolean).join('. ');
    snapshots.set(ref.token, {
      ...ref, characterName: record.name, characterVersionId: record.currentVersionId,
      characterUpdatedAt: record.updatedAt.toISOString(),
      outfitId: ref.includeOutfit ? look.outfitId : null,
      outfitRevision: ref.includeOutfit ? look.outfitRevision : null, text,
    });
  }
  // Single replacement pass: braces or dollar signs in traits are never interpreted.
  const prompt = input.replace(/\{character:[^{}\n]+\}/g, token => snapshots.get(token)!.text);
  if (prompt.length > 100_000) throw new WorkspaceError('The expanded prompt is too long. Use fewer character references.', 422);
  return { prompt, snapshots: [...snapshots.values()] };
}
