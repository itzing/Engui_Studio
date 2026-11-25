import { prisma } from "@/lib/prisma";
import { requireWorkspaceId } from "@/lib/workspaces/context";
import { assertCredential } from "./auth";
import { type Authority, digest, fail, McpError, receipt } from "./core";

export function galleryState(row: any) {
  return {
    assetId: row.id, bucket: row.bucket, status: row.trashed ? "trash" : "active",
    sha256: row.contentHash, favorited: row.favorited,
    source: { kind: "gallery_asset", assetId: row.id },
    sourceJobId: row.sourceJobId, sourceOutputId: row.sourceOutputId,
    addedAt: row.addedToGalleryAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    editRevision: digest({ id: row.id, workspaceId: row.workspaceId, bucket: row.bucket,
      trashed: row.trashed, contentHash: row.contentHash, updatedAt: row.updatedAt.toISOString() }),
  };
}
export async function galleryRow(assetId: string, db: any = prisma) {
  const row = await db.galleryAsset.findFirst({ where: { id: assetId, workspaceId: requireWorkspaceId(), type: "image" } });
  if (!row) fail("NOT_FOUND", "Gallery image not found. Use its full assetId from this workspace.");
  return row;
}
export async function getGalleryAsset(assetId: string) { return galleryState(await galleryRow(assetId)); }

export async function assertGalleryDestination(row: any, bucket: string, db: any) {
  const identities = [
    ...(row.membershipKey ? [{ membershipKey: row.membershipKey }] : []),
    ...(row.sourceJobId && row.sourceOutputId ? [{ sourceJobId: row.sourceJobId, sourceOutputId: row.sourceOutputId }] : []),
  ];
  if (!identities.length) return;
  const existing = await db.galleryAsset.findFirst({ where: {
    workspaceId: requireWorkspaceId(), id: { not: row.id }, bucket, OR: identities,
  }, orderBy: { addedToGalleryAt: "asc" } });
  if (existing) throw new McpError("GALLERY_DUPLICATE", "This output already has a record in the target section. Read both assets; no record was moved or deleted. Explicitly trash the unwanted duplicate if appropriate.", false, { sourceAssetId: row.id, existingAssetId: existing.id, bucket, existingStatus: existing.trashed ? "trash" : "active" });
}
export async function moveGalleryImage(row: any, bucket: string, db: any) {
  if (row.trashed) fail("GALLERY_TRASHED", "Restore this image explicitly before moving it.");
  if (row.bucket === bucket) return { ...galleryState(row), alreadySaved: true, action: "unchanged", previousBucket: row.bucket };
  await assertGalleryDestination(row, bucket, db);
  const updated = await db.galleryAsset.update({ where: { id: row.id }, data: { bucket } });
  return { ...galleryState(updated), alreadySaved: false, action: "moved", previousBucket: row.bucket };
}
export async function changeGalleryTrash(auth: Authority, args: { assetId: string; expectedRevision: string; requestKey: string }, trashed: boolean) {
  return receipt(trashed ? "trash_gallery_asset" : "restore_gallery_asset", args.requestKey, args, async tx => {
    await assertCredential(auth.credentialId, auth.workspace.id, "curate", tx);
    const row = await galleryRow(args.assetId, tx), before = galleryState(row);
    if (before.editRevision !== args.expectedRevision) fail("REVISION_CONFLICT", "Gallery image changed. Read engui_get_gallery_asset again before deleting or restoring.");
    if (row.trashed === trashed) return { ...before, changed: false };
    if (!trashed) await assertGalleryDestination(row, row.bucket, tx);
    const updated = await tx.galleryAsset.update({ where: { id: row.id }, data: { trashed } });
    return { ...galleryState(updated), changed: true };
  });
}
