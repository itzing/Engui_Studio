import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireWorkspaceId, WorkspaceError } from './context';
import { assertStorageLease, assertTarget, completeListing, directKey, loraPrefix, objectMissing, storageTarget, withStorageLease } from './storage';

export async function syncWorkspaceLoras() {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'sync', async () => {
    const target = await storageTarget();
    const prefix = await loraPrefix(workspaceId);
    const owned = await prisma.loRA.findMany({ where: { workspaceId } });
    if (owned.some(l => l.storageTarget !== target.fingerprint)) throw new WorkspaceError('Existing LoRAs belong to another or unverified storage target. Restore that connection before syncing.', 409);
    if (await prisma.workspaceUpload.count({ where: { workspaceId, status: { in: ['pending', 'finalizing'] } } })) throw new WorkspaceError('Finish or abort uploads before syncing this workspace.', 409);
    const files = await completeListing(target, prefix);
    const keys = new Set(files.map(f => f.Key));
    const missing = owned.filter(l => l.sourceKey && directKey(l.sourceKey, prefix) && !keys.has(l.sourceKey));
    for (const lora of missing) {
      if (!await objectMissing(target, lora.sourceKey!)) throw new WorkspaceError('S3 changed during sync. Retry; no records were removed.', 409);
    }
    await assertTarget(target.fingerprint);
    await assertStorageLease();
    // All external evidence is collected before the atomic destructive phase.
    const result = await prisma.$transaction(async tx => {
      const workspace = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      if (workspace.lifecycle !== 'active') throw new WorkspaceError('Workspace is being deleted.', 409);
      if (await tx.workspaceUpload.count({ where: { workspaceId, status: { in: ['pending', 'finalizing'] } } })) throw new WorkspaceError('An upload started during sync.', 409);
      let added = 0;
      for (const file of files) {
        if (owned.some(l => l.sourceKey === file.Key)) continue;
        const extension = path.extname(file.Key).toLowerCase();
        await tx.loRA.create({ data: {
          workspaceId, name: path.basename(file.Key, extension), fileName: path.basename(file.Key),
          sourceKey: file.Key, storageTarget: target.fingerprint,
          s3Path: '/runpod-volume/' + file.Key, s3Url: target.endpointUrl.replace(/\/$/, '') + '/' + target.bucketName + '/' + file.Key,
          fileSize: BigInt(file.Size), extension, baseModel: 'z-image', targetOverride: 'image', uploadedAt: file.LastModified,
        } });
        added++;
      }
      const ids = missing.map(l => l.id);
      await tx.loRAHelperProfile.deleteMany({ where: { workspaceId, OR: [{ loraId: { in: ids } }, { highLoraId: { in: ids } }, { lowLoraId: { in: ids } }] } });
      const removed = await tx.loRA.deleteMany({ where: { workspaceId, id: { in: ids }, storageTarget: target.fingerprint } });
      return { added, removed: removed.count, preserved: owned.length - removed.count };
    });
    return { success: true, ...result, synced: result.added, deleted: result.removed, skipped: result.preserved,
      message: `Added ${result.added}; preserved ${result.preserved}; removed ${result.removed} confirmed-missing LoRAs.` };
  });
}
