import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { digest, fail, parse } from "./core";
export async function characterState(characterId: string, db: any = prisma) {
  const row = await db.character.findFirst({ where: { id: characterId, workspaceId: requireWorkspaceId(), deletedAt: null } });
  if (!row) fail("NOT_FOUND", "Character not found.");
  const links = await db.characterOutfit.findMany({ where: { characterId }, select: { outfitId: true }, orderBy: { outfitId: "asc" } });
  const linkedOutfitIds = links.map((link: any) => link.outfitId);
  const editRevision = digest({ id: row.id, name: row.name, gender: row.gender,
    traits: parse(row.traits), editorState: parse(row.editorState),
    currentVersionId: row.currentVersionId, defaultOutfitId: row.defaultOutfitId,
    updatedAt: row.updatedAt.toISOString(), linkedOutfitIds });
  return { row, linkedOutfitIds, editRevision };
}
export function assertEditRevision(actual: string, expected: string) {
  if (actual !== expected) fail("REVISION_CONFLICT", "Character changed. Read the latest character or wardrobe before editing.");
}
export function characterWriteResult(state: Awaited<ReturnType<typeof characterState>>, changed: boolean) {
  return { characterId: state.row.id, characterVersionId: state.row.currentVersionId,
    editRevision: state.editRevision, changed };
}
