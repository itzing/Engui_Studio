import { preferredVibeId, preferredVibeMarker } from "./operator-policy";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { serializeChipArray, toVibeSummary } from "@/lib/vibes/utils";
import { assertCredential } from "./auth";
import { type Authority, digest, fail, nextCursor, pageCursor, receipt } from "./core";

export function vibeResult(row: any) {
  const summary = toVibeSummary(row);
  return { ...summary, editRevision: digest({ ...summary, workspaceId: row.workspaceId }) };
}
async function vibeRow(vibeId: string, db: any = prisma) {
  const row = await db.vibePreset.findFirst({ where: { id: vibeId, workspaceId: requireWorkspaceId() } });
  if (!row) fail("NOT_FOUND", "Vibe not found.");
  return row;
}
export async function getVibe(vibeId: string) {
  const row = await vibeRow(vibeId);
  return { ...vibeResult(row), ...preferredVibeMarker(row.id, row.status, await preferredVibeId()) };
}
export async function listVibes(args: any) {
  const filter = { kind: "vibes", query: args.query || "", status: args.status };
  const after = pageCursor(args.cursor, filter);
  const rows = await prisma.vibePreset.findMany({ where: {
    workspaceId: requireWorkspaceId(), status: args.status,
    ...(after ? { id: { gt: after } } : {}),
    ...(args.query ? { OR: [{ name: { contains: args.query } }, { tags: { contains: args.query } }] } : {}),
  }, orderBy: { id: "asc" }, take: args.limit + 1 });
  const preferredId = await preferredVibeId();
  const items = rows.slice(0, args.limit).map(row => ({ ...vibeResult(row), ...preferredVibeMarker(row.id, row.status, preferredId) }));
  return { items, nextCursor: rows.length > args.limit ? nextCursor(items[items.length - 1].id, filter) : null };
}
export async function createVibe(auth: Authority, args: any) {
  return receipt("create_vibe", args.requestKey, args, async tx => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const row = await tx.vibePreset.create({ data: {
      workspaceId: requireWorkspaceId(), name: args.name, baseDescription: args.baseDescription,
      tags: serializeChipArray(args.tags), compatibleSceneTypes: serializeChipArray(args.compatibleSceneTypes), status: "active",
    } });
    return { ...vibeResult(row), changed: true };
  });
}
export async function changeVibe(auth: Authority, args: any, action: "update" | "delete" | "restore") {
  return receipt(action + "_vibe", args.requestKey, args, async tx => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const row = await vibeRow(args.vibeId, tx);
    const before = vibeResult(row);
    if (before.editRevision !== args.expectedRevision)
      fail("REVISION_CONFLICT", "Vibe changed. Read engui_get_vibe again before editing, deleting or restoring.");
    const data: Record<string, string> = {};
    if (action === "update") {
      if (row.status !== "active") fail("VIBE_UNAVAILABLE", "Restore this Vibe before editing it.");
      for (const [key, value] of Object.entries(args.changes)) {
        data[key] = key === "tags" || key === "compatibleSceneTypes" ? serializeChipArray(value) : value as string;
      }
    } else data.status = action === "delete" ? "trash" : "active";
    if (Object.entries(data).every(([key, value]) => row[key] === value)) return { ...before, changed: false };
    const updated = await tx.vibePreset.update({ where: { id: row.id }, data });
    return { ...vibeResult(updated), changed: true };
  });
}
// Keep the same provenance shape as existing UI/MCP plans. No arbitrary source text or cross-workspace IDs.
export async function generationVibe(vibeId: string | undefined) {
  if (!vibeId) return null;
  const row = await prisma.vibePreset.findFirst({ where: { id: vibeId, workspaceId: requireWorkspaceId(), status: "active" }, select: { id: true, name: true, baseDescription: true } });
  if (!row?.baseDescription.trim()) fail("VIBE_UNAVAILABLE", "Selected Vibe is unavailable. Choose an active Vibe from this workspace or omit vibeId.");
  return { ...row, basePrompt: "" };
}
