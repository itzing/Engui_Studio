import { matchesUploadProof } from './uploadProof';
import { AbortMultipartUploadCommand, DeleteObjectCommand, HeadObjectCommand, HeadBucketCommand, ListMultipartUploadsCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import SettingsService from '@/lib/settingsService';
import { ownership, ownerFilter, isContentModel } from './prismaGuard';
import { withWorkspaceMaintenance, workspaceContext, WorkspaceError } from './context';
import { collectResourceStrings, localContentPath, unlinkOwnedLocal, workspaceContentSnapshot } from './files';
import { assertStorageLease, assertTarget, completeListing, loraPrefix, objectMissing, storageTarget, withStorageLease } from './storage';

type Resource = { kind: 'local' | 's3'; location: string; target?: string; done?: boolean; retained?: boolean };
const terminal = new Set(['completed', 'failed', 'cancelled', 'canceled']);
const delegate = (db: any, model: string) => db[model[0].toLowerCase() + model.slice(1)];
const parsed = (value: unknown) => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };

export async function deletionPreview(id: string) {
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace || workspace.userId !== 'user-with-settings') throw new WorkspaceError('Workspace not found.', 404);
  if (workspace.isProtected) throw new WorkspaceError('The original Default workspace cannot be deleted.', 403);
  return workspaceContext.exit(async () => {
    const records = await workspaceContentSnapshot(id);
    const counts = Object.fromEntries(Object.entries(records).map(([model, rows]) => [model, rows.length]));
    return { workspace, counts, warning: 'This permanently deletes owned content, cancels jobs, and removes owned local files and S3 objects. Shared Default LoRAs and global settings are retained.' };
  });
}
export async function beginWorkspaceDeletion(id: string, confirmName: string) {
  const preview = await deletionPreview(id);
  if (confirmName !== preview.workspace.name) throw new WorkspaceError('Type the exact workspace name to confirm deletion.', 400);
  return withStorageLease(id, 'delete-lock', async () => {
    // Fail before changing lifecycle if the configured target cannot clean known owned objects.
    const loras = await workspaceContext.exit(async () => prisma.loRA.findMany({ where: { workspaceId: id } }));
    for (const target of new Set(loras.map(l => l.storageTarget))) {
      if (!target) throw new WorkspaceError('An owned LoRA has unverified storage ownership.', 409);
      const storage = await assertTarget(target);
      await storage.client.send(new HeadBucketCommand({ Bucket: storage.bucketName }));
    }
    return prisma.$transaction(async tx => {
      const row = await tx.workspace.findUniqueOrThrow({ where: { id } });
      if (row.isProtected) throw new WorkspaceError('Default is protected.', 403);
      const operation = await tx.workspaceDeletion.upsert({
        where: { workspaceId: id }, create: { workspaceId: id, userId: row.userId, name: row.name }, update: { status: 'pending', error: null },
      });
      if (row.lifecycle === 'active') await tx.workspace.update({ where: { id }, data: { lifecycle: 'deleting', revision: { increment: 1 } } });
      return operation;
    });
  });
}
async function drainProviderJobs(id: string): Promise<boolean> {
  const jobs = await prisma.job.findMany({ where: { workspaceId: id } });
  const { settings } = await new SettingsService().getSettings('user-with-settings');
  for (const job of jobs) {
    if (terminal.has(job.status.toLowerCase())) continue;
    const options = parsed(job.options);
    const state = parsed(job.secureState);
    const remoteId = job.runpodJobId || options.runpodJobId || state?.activeAttempt?.runpodJobId;
    const endpoint = job.endpointId || (settings.runpod?.endpoints as any)?.[job.modelId || ''];
    if (!remoteId || !endpoint || !settings.runpod?.apiKey) throw new WorkspaceError('Cannot confirm cancellation for job ' + job.id + '. Restore its provider connection and retry.', 409);
    const base = 'https://api.runpod.ai/v2/' + encodeURIComponent(endpoint);
    const headers = { Authorization: 'Bearer ' + settings.runpod.apiKey };
    const status = await fetch(base + '/status/' + encodeURIComponent(remoteId), { headers, signal: AbortSignal.timeout(30000) });
    if (!status.ok) throw new WorkspaceError('Provider status is not confirmed for job ' + job.id + ' (HTTP ' + status.status + ').', 409);
    const result = await status.json();
    if (!['COMPLETED', 'FAILED', 'CANCELLED', 'CANCELED', 'TIMED_OUT'].includes(String(result.status))) {
      const cancel = await fetch(base + '/cancel/' + encodeURIComponent(remoteId), { method: 'POST', headers, signal: AbortSignal.timeout(30000) });
      if (!cancel.ok) throw new WorkspaceError('Provider cancellation failed for job ' + job.id + '.', 409);
      return false; // A cancellation request is not terminal evidence.
    }
    await prisma.job.update({ where: { id: job.id }, data: {
      status: 'failed', error: 'Workspace deleted', completedAt: new Date(),
      options: JSON.stringify({ ...options, workspaceDeletionOutput: result.output || null }),
    } });
  }
  return true;
}
async function captureManifest(id: string) {
  const records = await workspaceContentSnapshot(id);
  const resources = new Map<string, Resource>();
  const ownLoras = records.LoRA || [];
  const allLoras = await workspaceContext.exit(async () => prisma.loRA.findMany());
  const registry = await prisma.workspaceFile.findMany({ where: { workspaceId: id } });
  for (const entry of registry) {
    resources.set(entry.location, { kind: entry.storageTarget === 'local' ? 'local' : 's3', location: entry.location, target: entry.storageTarget });
  }
  for (const [model, rows] of Object.entries(records)) {
    for (const row of rows) {
      const target = model === 'Job' ? parsed(row.options).workspaceStorageTarget : undefined;
      for (const location of collectResourceStrings(row)) {
        if (localContentPath(location)) resources.set(location, { kind: 'local', location });
        else if (location.startsWith('/runpod-volume/')) {
          const source = allLoras.find(l => l.s3Path === location);
          if (source && source.workspaceId !== id) continue;
          const fingerprint = source?.storageTarget || target;
          if (!fingerprint) {
            // Other rows may reference a file registered by the owning producer.
            if (!resources.has(location)) resources.set(location, { kind: 's3', location });
          } else resources.set(location, { kind: 's3', location, target: fingerprint });
        }
      }
    }
  }
  for (const lora of ownLoras) if (lora.sourceKey) resources.set(lora.s3Path, { kind: 's3', location: lora.s3Path, target: lora.storageTarget });
  const uploads = await prisma.workspaceUpload.findMany({ where: { workspaceId: id } });
  const targets = new Set<string>([...ownLoras.map(l => l.storageTarget), ...uploads.map(u => u.storageTarget)].filter(Boolean));
  for (const fingerprint of targets) {
    const target = await assertTarget(fingerprint);
    for (const file of await completeListing(target, await loraPrefix(id))) {
      const location = '/runpod-volume/' + file.Key;
      resources.set(location, { kind: 's3', location, target: fingerprint });
    }
  }
  // Read all valid owners, including shared references, before deleting any bytes.
  const referencedElsewhere = new Set<string>();
  await workspaceContext.exit(async () => {
    const others = await prisma.workspace.findMany({ where: { id: { not: id } } });
    for (const other of others) collectResourceStrings(await workspaceContentSnapshot(other.id), referencedElsewhere);
    for (const item of await prisma.workspaceFile.findMany({ where: { workspaceId: { not: id } } })) referencedElsewhere.add(item.location);
  });
  for (const entry of resources.values()) {
    if (referencedElsewhere.has(entry.location)) entry.retained = true;
    else if (entry.kind === 's3' && !entry.target) throw new WorkspaceError('Storage target is not recorded for owned resource: ' + entry.location, 409);
  }
  return [...resources.values()];
}
async function abortUploads(id: string) {
  const uploads = await prisma.workspaceUpload.findMany({ where: { workspaceId: id, status: { in: ['pending', 'finalizing'] } } });
  for (const upload of uploads) {
    const target = await assertTarget(upload.storageTarget);
    await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
    if (upload.uploadId.startsWith('initializing:')) {
      const listed = await target.client.send(new ListMultipartUploadsCommand({ Bucket: target.bucketName, Prefix: upload.objectKey }));
      if (listed.IsTruncated) throw new WorkspaceError('Multipart discovery is incomplete; retry cleanup.', 409);
      for (const found of listed.Uploads || []) if (found.Key === upload.objectKey && found.UploadId) {
        await target.client.send(new AbortMultipartUploadCommand({ Bucket: target.bucketName, Key: found.Key, UploadId: found.UploadId }));
      }
    } else {
      try { await target.client.send(new AbortMultipartUploadCommand({ Bucket: target.bucketName, Key: upload.objectKey, UploadId: upload.uploadId })); }
      catch (e: any) { if (e?.name !== 'NoSuchUpload') throw e; }
    }
    // A finalize interrupted after completion may have left the exact owned object.
    if (upload.status === 'finalizing' && !await objectMissing(target, upload.objectKey)) {
      const head = await target.client.send(new HeadObjectCommand({ Bucket: target.bucketName, Key: upload.objectKey }));
      if (!matchesUploadProof(head, parsed(upload.metadataJson))) throw new WorkspaceError('Unverified object at an interrupted upload path; cleanup stopped.', 409);
      await target.client.send(new DeleteObjectCommand({ Bucket: target.bucketName, Key: upload.objectKey }));
      if (!await objectMissing(target, upload.objectKey)) throw new WorkspaceError('Upload object deletion is not confirmed.', 409);
    }
    await prisma.workspaceUpload.update({ where: { id: upload.id }, data: { status: 'aborted' } });
  }
}
async function deleteRecords(id: string) {
  await prisma.$transaction(async tx => {
    // Break only optional same-owner links to make cyclic Studio dependencies removable.
    for (const model of Object.keys(ownership).filter(isContentModel)) {
      const info = ownership[model];
      const optionalLinks = info.relations.flatMap(r => r.fields).filter(field => field !== 'workspaceId' && info.fields.some(f => f.name === field && f.optional));
      if (optionalLinks.length) await delegate(tx, model).updateMany({ where: ownerFilter(model, id), data: Object.fromEntries(optionalLinks.map(field => [field, null])) });
    }
    let remaining = Object.keys(ownership).filter(isContentModel);
    for (let pass = 0; remaining.length && pass < Object.keys(ownership).length; pass++) {
      const next: string[] = [];
      for (const model of remaining) {
        try { await delegate(tx, model).deleteMany({ where: ownerFilter(model, id) }); }
        catch (error: any) { if (error.code === 'P2003') next.push(model); else throw error; }
      }
      if (next.length === remaining.length) throw new WorkspaceError('Record dependencies could not be safely removed.', 409);
      remaining = next;
    }
    await tx.workspaceUpload.deleteMany({ where: { workspaceId: id } });
    await tx.workspaceFile.deleteMany({ where: { workspaceId: id } });
    await tx.workspaceActivity.deleteMany({ where: { workspaceId: id } });
    await tx.workspace.delete({ where: { id } });
    await tx.workspaceDeletion.update({ where: { workspaceId: id }, data: { status: 'completed', stage: 'completed', completedAt: new Date(), manifestJson: '[]', jobsJson: '[]', error: null } });
  }, { timeout: 30000 });
}
export async function resumeWorkspaceDeletion(id: string) {
  return workspaceContext.exit(async () => withStorageLease(id, 'workspace-delete', () => withWorkspaceMaintenance(id, async () => {
    const operation = await prisma.workspaceDeletion.findUnique({ where: { workspaceId: id } });
    if (!operation || operation.status === 'completed') return;
    try {
      await prisma.workspaceDeletion.update({ where: { workspaceId: id }, data: { attempts: { increment: 1 }, error: null, status: 'pending' } });
      await prisma.workspaceActivity.deleteMany({ where: { workspaceId: id, expiresAt: { lt: new Date() } } });
      if (await prisma.workspaceActivity.count({ where: { workspaceId: id } })) return;
      if (!await drainProviderJobs(id)) return;
      await abortUploads(id);
      const previous = JSON.parse(operation.manifestJson) as Resource[];
      const fresh = await captureManifest(id);
      const manifest = [...new Map([...previous, ...fresh].map(r => [r.location, r])).values()];
      await prisma.workspaceDeletion.update({ where: { workspaceId: id }, data: { stage: 'resources', manifestJson: JSON.stringify(manifest) } });
      for (const entry of manifest) {
        if (entry.done || entry.retained) continue;
        await assertStorageLease();
        if (entry.kind === 'local') await unlinkOwnedLocal(entry.location);
        else {
          const target = await assertTarget(entry.target!);
          const key = entry.location.replace(/^\/runpod-volume\//, '');
          if (key.split('/').some(s => !s || s === '.' || s === '..') || key.includes('\\')) throw new WorkspaceError('Invalid resource key.', 409);
          await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
          await target.client.send(new DeleteObjectCommand({ Bucket: target.bucketName, Key: key }));
          if (!await objectMissing(target, key)) throw new WorkspaceError('Storage deletion is not confirmed.', 409);
        }
        entry.done = true;
        await prisma.workspaceDeletion.update({ where: { workspaceId: id }, data: { manifestJson: JSON.stringify(manifest) } });
      }
      await prisma.workspaceDeletion.update({ where: { workspaceId: id }, data: { stage: 'records' } });
      await assertStorageLease();
      await deleteRecords(id);
    } catch (error) {
      await prisma.workspaceDeletion.update({ where: { workspaceId: id }, data: { status: 'failed', error: error instanceof Error ? error.message : 'Cleanup failed.' } });
    }
  })));
}
const workers = globalThis as typeof globalThis & { workspaceDeletionTimer?: ReturnType<typeof setInterval> };
export function startWorkspaceDeletionWorker() {
  if (workers.workspaceDeletionTimer) return;
  let running = false;
  workers.workspaceDeletionTimer = setInterval(() => {
    if (running) return;
    running = true;
    void workspaceContext.exit(async () => {
      for (const row of await prisma.workspaceDeletion.findMany({ where: { status: 'pending' } })) {
        await resumeWorkspaceDeletion(row.workspaceId).catch(() => undefined);
      }
    }).finally(() => { running = false; });
  }, 5000);
  workers.workspaceDeletionTimer.unref?.();
}
