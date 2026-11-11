import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { identitySource, outfitSource, partDocument, readPartDocument } from "@/lib/looks/parts";
import { serializeVersionIdentity, readVersionIdentity } from "@/lib/characters/versionIdentity";
import { assertCredential } from "./auth";
import { type Authority, digest, fail, nextCursor, pageCursor, parse, receipt } from "./core";
import { assertEditRevision, characterState, characterWriteResult } from "./authoring-state";

async function writeVersion(tx: any, character: any, changeSummary: string) {
  const latest = await tx.characterVersion.findFirst({ where: { characterId: character.id }, orderBy: { versionNumber: "desc" } });
  const version = await tx.characterVersion.create({ data: {
    characterId: character.id, traitsSnapshot: character.traits, editorStateSnapshot: character.editorState,
    identitySnapshot: serializeVersionIdentity(character.name, character.gender),
    versionNumber: (latest?.versionNumber || 0) + 1, changeSummary,
  } });
  await tx.character.update({ where: { id: character.id }, data: { currentVersionId: version.id } });
}
function checkSize(value: unknown) {
  if (Buffer.byteLength(JSON.stringify(value)) > 64000) fail("INVALID_ARGUMENT", "Authoring content exceeds 64 KiB.");
}
export async function createCharacter(auth: Authority, args: any) {
  return receipt("create_character", args.requestKey, args, async (tx) => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const editorState = args.identityParts ? { promptParts: partDocument(identitySource(args.traits, args.gender), args.identityParts) } : {};
    checkSize({ traits: args.traits, editorState });
    const row = await tx.character.create({ data: {
      workspaceId: requireWorkspaceId(), name: args.name, gender: args.gender,
      traits: JSON.stringify(args.traits), editorState: JSON.stringify(editorState),
    } });
    await writeVersion(tx, row, args.changeSummary || "Created character through MCP");
    return characterWriteResult(await characterState(row.id, tx), true);
  });
}
export async function updateCharacter(auth: Authority, args: any) {
  return receipt("update_character", args.requestKey, args, async (tx) => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const state = await characterState(args.characterId, tx);
    assertEditRevision(state.editRevision, args.expectedRevision);
    const row = state.row, changes = args.changes;
    if (!Object.keys(changes).length) fail("INVALID_ARGUMENT", "Supply at least one character change.");
    const traits = { ...parse(row.traits) };
    for (const [key, value] of Object.entries(changes.traits || {})) {
      if (value === null) delete traits[key]; else traits[key] = value;
    }
    if (Object.keys(traits).length > 160) fail("INVALID_ARGUMENT", "Use at most 160 character traits.");
    const gender = changes.gender === undefined ? row.gender : changes.gender;
    const name = changes.name === undefined ? row.name : changes.name;
    const editorState = { ...parse(row.editorState) };
    const identityChanged = digest(identitySource(traits, gender)) !== digest(identitySource(parse(row.traits), row.gender));
    if (changes.identityParts !== undefined) {
      if (changes.identityParts === null) delete editorState.promptParts;
      else editorState.promptParts = partDocument(identitySource(traits, gender), changes.identityParts);
    } else if (identityChanged) delete editorState.promptParts;
    checkSize({ traits, editorState });
    const before = { name: row.name, gender: row.gender, traits: parse(row.traits), editorState: parse(row.editorState) };
    const after = { name, gender, traits, editorState };
    if (digest(before) === digest(after)) return characterWriteResult(state, false);
    const updated = await tx.character.update({ where: { id: row.id }, data: {
      name, gender, traits: JSON.stringify(traits), editorState: JSON.stringify(editorState),
    } });
    await writeVersion(tx, updated, args.changeSummary || "Updated character through MCP");
    return characterWriteResult(await characterState(row.id, tx), true);
  });
}
export async function listCharacterVersions(args: any) {
  const state = await characterState(args.characterId);
  const filter = { kind: "character_versions", characterId: args.characterId };
  const cursor = pageCursor(args.cursor, filter);
  const rows = await prisma.characterVersion.findMany({ where: { characterId: args.characterId, ...(cursor ? { id: { gt: cursor } } : {}) },
    orderBy: { id: "asc" }, take: args.limit + 1 });
  const items = rows.slice(0, args.limit).map((v) => ({
    characterVersionId: v.id, versionNumber: v.versionNumber, changeSummary: v.changeSummary,
    createdAt: v.createdAt.toISOString(), isCurrent: v.id === state.row.currentVersionId,
    identity: readVersionIdentity(v.identitySnapshot), identityComplete: !!readVersionIdentity(v.identitySnapshot),
    traits: parse(v.traitsSnapshot), identityParts: readPartDocument(parse(v.editorStateSnapshot).promptParts)?.parts || null,
  }));
  return { characterId: args.characterId, currentVersionId: state.row.currentVersionId, items,
    nextCursor: rows.length > args.limit ? nextCursor(items[items.length - 1].characterVersionId, filter) : null };
}
function outfitResult(row: any) {
  return { outfitId: row.id, ownerCharacterId: row.ownerCharacterId, name: row.name,
    description: row.description, constraints: row.constraints, coversFace: row.coversFace,
    revision: row.revision, visibleParts: readPartDocument(parse(row.sourceJson).promptParts)?.parts || null };
}
async function outfitRow(outfitId: string, db: any = prisma) {
  const row = await db.outfit.findFirst({ where: { id: outfitId, workspaceId: requireWorkspaceId(), deletedAt: null } });
  if (!row) fail("NOT_FOUND", "Outfit not found.");
  if (row.ownerCharacterId) await characterState(row.ownerCharacterId, db);
  return row;
}
export async function getOutfit(outfitId: string) { return outfitResult(await outfitRow(outfitId)); }
export async function createOutfit(auth: Authority, args: any) {
  return receipt("create_outfit", args.requestKey, args, async (tx) => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    if (args.ownerCharacterId) await characterState(args.ownerCharacterId, tx);
    const source = args.visibleParts ? { promptParts: partDocument(outfitSource(args.description, args.constraints, args.coversFace), args.visibleParts) } : {};
    checkSize({ ...args, source });
    const row = await tx.outfit.create({ data: { workspaceId: requireWorkspaceId(), ownerCharacterId: args.ownerCharacterId || null,
      name: args.name, description: args.description, constraints: args.constraints, coversFace: args.coversFace, sourceJson: JSON.stringify(source) } });
    if (row.ownerCharacterId) await tx.characterOutfit.create({ data: { workspaceId: requireWorkspaceId(), characterId: row.ownerCharacterId, outfitId: row.id } });
    return outfitResult(row);
  });
}
export async function updateOutfit(auth: Authority, args: any) {
  return receipt("update_outfit", args.requestKey, args, async (tx) => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const row = await outfitRow(args.outfitId, tx);
    if (row.revision !== args.expectedRevision) fail("REVISION_CONFLICT", "Outfit changed. Read its latest revision before editing.");
    if (!Object.keys(args.changes).length) fail("INVALID_ARGUMENT", "Supply at least one outfit change.");
    const { visibleParts, ...changes } = args.changes;
    const next = { ...row, ...changes }, source = { ...parse(row.sourceJson) };
    const changedText = digest(outfitSource(row.description, row.constraints, row.coversFace)) !== digest(outfitSource(next.description, next.constraints, next.coversFace));
    if (visibleParts !== undefined) {
      if (visibleParts === null) delete source.promptParts;
      else source.promptParts = partDocument(outfitSource(next.description, next.constraints, next.coversFace), visibleParts);
    } else if (changedText) delete source.promptParts;
    const data = { name: next.name, description: next.description, constraints: next.constraints, coversFace: next.coversFace, sourceJson: JSON.stringify(source) };
    checkSize(data);
    if (Object.entries(data).every(([key, value]) => row[key] === value)) return outfitResult(row);
    const result = await tx.outfit.updateMany({ where: { id: row.id, revision: args.expectedRevision }, data: { ...data, revision: { increment: 1 } } });
    if (result.count !== 1) fail("REVISION_CONFLICT", "Outfit changed.");
    return outfitResult(await outfitRow(row.id, tx));
  });
}
export async function getWardrobe(args: any) {
  return prisma.$transaction(async (tx) => {
    const state = await characterState(args.characterId, tx);
    const filter = { kind: "wardrobe", characterId: args.characterId };
    const cursor = pageCursor(args.cursor, filter);
    const rows = await tx.outfit.findMany({ where: { deletedAt: null,
      OR: [{ ownerCharacterId: null }, { ownerCharacterId: args.characterId }], ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: "asc" }, take: args.limit + 1 });
    const items = rows.slice(0, args.limit).map((row) => ({ ...outfitResult(row), linked: state.linkedOutfitIds.includes(row.id), isDefault: state.row.defaultOutfitId === row.id }));
    return { characterId: args.characterId, defaultOutfitId: state.row.defaultOutfitId,
      editRevision: state.editRevision, items,
      nextCursor: rows.length > args.limit ? nextCursor(items[items.length - 1].outfitId, filter) : null };
  });
}
export async function updateWardrobe(auth: Authority, args: any) {
  return receipt("update_wardrobe", args.requestKey, args, async (tx) => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const state = await characterState(args.characterId, tx);
    assertEditRevision(state.editRevision, args.expectedRevision);
    if (args.action === "clearDefault") {
      if (args.outfitId !== undefined) fail("INVALID_ARGUMENT", "clearDefault does not take an outfitId.");
      if (!state.row.defaultOutfitId) return characterWriteResult(state, false);
      await tx.character.update({ where: { id: args.characterId }, data: { defaultOutfitId: null } });
    } else {
      if (!args.outfitId) fail("INVALID_ARGUMENT", "Select an outfitId for this wardrobe action.");
      const outfit = await outfitRow(args.outfitId, tx);
      if (outfit.ownerCharacterId && outfit.ownerCharacterId !== args.characterId) fail("NOT_FOUND", "Outfit is not available to this character.");
      const linked = state.linkedOutfitIds.includes(outfit.id);
      const isDefault = state.row.defaultOutfitId === outfit.id;
      if (args.action === "unlink") {
        if (!linked && !isDefault) return characterWriteResult(state, false);
        if (isDefault) await tx.character.update({ where: { id: args.characterId }, data: { defaultOutfitId: null } });
        await tx.characterOutfit.deleteMany({ where: { characterId: args.characterId, outfitId: outfit.id } });
      } else {
        if (linked && (args.action === "link" || isDefault)) return characterWriteResult(state, false);
        if (!linked) await tx.characterOutfit.create({ data: { workspaceId: requireWorkspaceId(), characterId: args.characterId, outfitId: outfit.id } });
        if (args.action === "default") await tx.character.update({ where: { id: args.characterId }, data: { defaultOutfitId: outfit.id } });
      }
    }
    return characterWriteResult(await characterState(args.characterId, tx), true);
  });
}
