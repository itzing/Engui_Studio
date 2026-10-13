import { readPartDocument, validateParts } from '@/lib/looks/parts';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceId, WorkspaceError } from '@/lib/workspaces/context';
import { toCharacterSummary } from '@/lib/characters/utils';
import { composeCharacterLook } from './compose';
import type { OutfitSelection, OutfitSummary } from './types';
export const outfitSummary = (row: any): OutfitSummary => {
  let source:any={};try{source=JSON.parse(row.sourceJson||'{}');}catch{}
  return { ...row, promptParts:readPartDocument(source.promptParts), deletedAt: row.deletedAt?.toISOString() || null };
};
export function readOutfitSelection(body: any): OutfitSelection {
  const mode = body?.mode || 'default';
  if (!['default','outfit','custom','neutral'].includes(mode)) throw new WorkspaceError('Invalid outfit mode.',400);
  if (mode === 'outfit' && !body?.outfitId) throw new WorkspaceError('Choose an outfit.',400);
  if (mode === 'custom' && !String(body?.customText || '').trim()) throw new WorkspaceError('Describe the custom outfit.',400);
  return { mode, outfitId: typeof body?.outfitId === 'string' ? body.outfitId : null, customText: String(body?.customText || '').trim(), customParts: readPartDocument(body?.customParts) };
}
export async function resolveCharacterLook(characterId: string, input: OutfitSelection = {}, db: any = prisma) {
  const selection = readOutfitSelection(input);
  const character = await db.character.findFirst({ where: { id: characterId, deletedAt: null } });
  if (!character) throw new WorkspaceError('Character not found.',404);
  const outfitId = selection.mode === 'default' ? character.defaultOutfitId : selection.mode === 'outfit' ? selection.outfitId : null;
  const outfit = outfitId ? await db.outfit.findFirst({ where: { id: outfitId, deletedAt: null } }) : null;
  if (outfitId && (!outfit || (outfit.ownerCharacterId && outfit.ownerCharacterId !== character.id))) throw new WorkspaceError('This outfit is unavailable for this character. Choose another outfit.',409);
  return composeCharacterLook(toCharacterSummary(character), selection, outfit ? outfitSummary(outfit) : null);
}
export async function wardrobe(characterId: string) {
  const character = await prisma.character.findFirst({ where: { id: characterId, deletedAt: null } });
  if (!character) throw new WorkspaceError('Character not found.',404);
  const [outfits, links, previews] = await Promise.all([
    prisma.outfit.findMany({ where: { deletedAt: null, OR: [{ ownerCharacterId: null }, { ownerCharacterId: characterId }] }, orderBy: { name: 'asc' } }),
    prisma.characterOutfit.findMany({ where: { characterId } }),
    prisma.characterLookPreview.findMany({ where: { characterId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return { outfits: outfits.map(outfitSummary), linkedOutfitIds: links.map(x => x.outfitId), defaultOutfitId: character.defaultOutfitId, previews };
}
export async function saveOutfit(body: any, id?: string) {
  const existing = id ? await prisma.outfit.findFirst({ where: { id, deletedAt: null } }) : null;
  if (id && !existing) throw new WorkspaceError('Outfit not found.',404);
  const name = String(body.name ?? existing?.name ?? '').trim();
  const description = String(body.description ?? existing?.description ?? '').trim();
  if (!name || !description) throw new WorkspaceError('Name and outfit description are required.',400);
  if (name.length > 180 || description.length > 20000) throw new WorkspaceError('Outfit text is too long.',400);
  const ownerCharacterId = existing ? existing.ownerCharacterId : body.ownerCharacterId || null;
  if (ownerCharacterId && !await prisma.character.findFirst({ where: { id: ownerCharacterId, deletedAt: null } })) throw new WorkspaceError('Character not found.',404);
  const data = { name, description, constraints: String(body.constraints ?? existing?.constraints ?? '').trim(), coversFace: Boolean(body.coversFace ?? existing?.coversFace ?? false) };
  let source:any={};try{source=JSON.parse(existing?.sourceJson||'{}');}catch{}
  if(body.promptParts!==undefined) {
    if(body.promptParts!==null && !readPartDocument(body.promptParts)) throw new WorkspaceError('Invalid visible-detail parts.',400);
    source.promptParts=body.promptParts===null?null:{...body.promptParts,parts:validateParts(body.promptParts.parts)};
  }
  const sourceJson=JSON.stringify(source);
  return prisma.$transaction(async tx => {
    const outfit = existing ? await tx.outfit.update({ where: { id }, data: { ...data, sourceJson, revision: { increment: 1 } } })
      : await tx.outfit.create({ data: { ...data, sourceJson, workspaceId: requireWorkspaceId(), ownerCharacterId } });
    if (ownerCharacterId) await tx.characterOutfit.upsert({ where: { characterId_outfitId: { characterId: ownerCharacterId, outfitId: outfit.id } }, update: {}, create: { workspaceId: requireWorkspaceId(), characterId: ownerCharacterId, outfitId: outfit.id } });
    return outfitSummary(outfit);
  });
}
export async function assignOutfit(characterId: string, outfitId: string, action: string) {
  if (!['link','default','unlink','clearDefault'].includes(action)) throw new WorkspaceError('Invalid wardrobe action.',400);
  if (action === 'clearDefault') { await prisma.character.update({ where: { id: characterId }, data: { defaultOutfitId: null } }); return wardrobe(characterId); }
  await resolveCharacterLook(characterId, { mode: 'outfit', outfitId });
  await prisma.$transaction(async tx => {
    if (action === 'unlink') {
      await tx.character.updateMany({ where: { id: characterId, defaultOutfitId: outfitId }, data: { defaultOutfitId: null } });
      await tx.characterOutfit.deleteMany({ where: { characterId, outfitId } });
    } else {
      await tx.characterOutfit.upsert({ where: { characterId_outfitId: { characterId, outfitId } }, update: {}, create: { workspaceId: requireWorkspaceId(), characterId, outfitId } });
      if (action === 'default') await tx.character.update({ where: { id: characterId }, data: { defaultOutfitId: outfitId } });
    }
  });
  return wardrobe(characterId);
}
export async function archiveOutfit(id: string) {
  const outfit = await prisma.outfit.findFirst({ where: { id, deletedAt: null } });
  if (!outfit) throw new WorkspaceError('Outfit not found.',404);
  // Keep default references so future generation asks for an explicit replacement, not silent undressing.
  await prisma.outfit.update({ where: { id }, data: { deletedAt: new Date() } });
}
