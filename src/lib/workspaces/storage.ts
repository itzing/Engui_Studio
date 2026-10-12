import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'crypto';
import { S3Client, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import SettingsService from '@/lib/settingsService';
import { requireWorkspaceId, WorkspaceError } from './context';

export function storageFingerprint(endpoint: string, bucket: string) {
  return createHash('sha256').update(endpoint.replace(/\/+$/, '') + '/' + bucket).digest('hex');
}
export async function storageTarget() {
  const { settings } = await new SettingsService().getSettings('user-with-settings');
  const s3 = settings.s3;
  if (!s3?.endpointUrl || !s3.bucketName || !s3.accessKeyId || !s3.secretAccessKey) throw new WorkspaceError('Configure the global S3 connection first.', 400);
  const client = new S3Client({
    endpoint: s3.endpointUrl, region: (s3.region || 'us-east-1').toLowerCase(), forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  });
  // RunPod treats the SDK's bucket-level trailing slash as an object path.
  // Normalize before request signing; object-level paths are never modified.
  if (new URL(s3.endpointUrl).hostname.endsWith('.runpod.io')) client.middlewareStack.add(
    (next, context) => async args => {
      if (['ListObjectsV2Command', 'ListMultipartUploadsCommand'].includes(context.commandName || '')) {
        const request = args.request as { path: string };
        request.path = request.path.replace(/\/$/, '');
      }
      return next(args);
    }, { step: 'build', name: 'runpodBucketPath' },
  );
  return { ...s3, fingerprint: storageFingerprint(s3.endpointUrl, s3.bucketName), client };

}
export async function assertTarget(fingerprint: string) {
  const target = await storageTarget();
  if (target.fingerprint !== fingerprint) throw new WorkspaceError('The storage connection changed. Restore the original target before retrying.', 409);
  return target;
}
export async function loraPrefix(workspaceId = requireWorkspaceId()) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  return workspace.isProtected ? 'loras/' : `loras/workspaces/${workspace.id}/`;
}
export function directKey(key: string, prefix: string): boolean {
  if (!key.startsWith(prefix)) return false;
  const name = key.slice(prefix.length);
  return !!name && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..' && !/[\x00-\x1f]/.test(name);
}
const leases = new AsyncLocalStorage<{ workspaceId: string; token: string }>();
export async function assertStorageLease() {
  const lease = leases.getStore();
  if (!lease || !await prisma.workspaceLease.findFirst({ where: { ...lease, expiresAt: { gt: new Date() } } })) {
    throw new WorkspaceError('Storage coordination expired. Retry the operation.', 409);
  }
}
export async function withStorageLease<T>(workspaceId: string, kind: string, task: () => Promise<T>): Promise<T> {
  const token = randomUUID();
  const now = new Date();
  await prisma.workspaceLease.deleteMany({ where: { workspaceId, expiresAt: { lt: now } } });
  try {
    await prisma.workspaceLease.create({ data: { workspaceId, token, kind, expiresAt: new Date(Date.now() + 120000) } });
  } catch { throw new WorkspaceError('Another storage operation is running for this workspace. Retry shortly.', 409); }
  let lost = false;
  const timer = setInterval(() => {
    void prisma.workspaceLease.updateMany({ where: { workspaceId, token }, data: { expiresAt: new Date(Date.now() + 120000) } })
      .then(r => { if (!r.count) lost = true; }).catch(() => { lost = true; });
  }, 30000);
  try {
    const result = await leases.run({ workspaceId, token }, task);
    if (lost) throw new WorkspaceError('Storage coordination was interrupted. Retry the operation.', 409);
    return result;
  } finally {
    clearInterval(timer);
    await prisma.workspaceLease.deleteMany({ where: { workspaceId, token } });
  }
}
export async function objectMissing(target: Awaited<ReturnType<typeof storageTarget>>, key: string) {
  try { await target.client.send(new HeadObjectCommand({ Bucket: target.bucketName, Key: key })); return false; }
  catch (error: any) {
    if (error?.$metadata?.httpStatusCode === 404 && ['NotFound', 'NoSuchKey'].includes(error?.name)) return true;
    throw error;
  }
}
export async function deleteOwnedObject(fingerprint: string, key: string, prefix: string) {
  if (!directKey(key, prefix)) throw new WorkspaceError('Storage object is outside the owned namespace.', 409);
  await assertStorageLease();
  const target = await assertTarget(fingerprint);
  await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
  await target.client.send(new DeleteObjectCommand({ Bucket: target.bucketName, Key: key }));
  if (!await objectMissing(target, key)) throw new WorkspaceError('Storage deletion is not confirmed. Retry.', 409);
}
export async function completeListing(target: Awaited<ReturnType<typeof storageTarget>>, prefix: string) {
  await target.client.send(new HeadBucketCommand({ Bucket: target.bucketName }));
  const objects: Array<{ Key: string; Size: number; LastModified?: Date }> = [];
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await target.client.send(new ListObjectsV2Command({ Bucket: target.bucketName, Prefix: prefix, Delimiter: '/', ContinuationToken: token }));
    if (page.$metadata.httpStatusCode !== 200 || typeof page.IsTruncated !== 'boolean' || !Number.isInteger(page.KeyCount)) {
      throw new WorkspaceError('S3 returned an incomplete listing; nothing was pruned.', 502);
    }
    if ((page.KeyCount || 0) > 0 && !Array.isArray(page.Contents) && !Array.isArray(page.CommonPrefixes)) throw new WorkspaceError('Malformed S3 listing; nothing was pruned.', 502);
    for (const row of page.Contents || []) {
      if (typeof row.Key !== 'string' || !Number.isFinite(row.Size)) throw new WorkspaceError('Malformed S3 object; nothing was pruned.', 502);
      if (directKey(row.Key, prefix) && /\.(safetensors|ckpt)$/i.test(row.Key)) objects.push({ Key: row.Key, Size: row.Size!, LastModified: row.LastModified });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && (!token || seen.has(token))) throw new WorkspaceError('Incomplete S3 pagination; nothing was pruned.', 502);
    if (token) seen.add(token);
  } while (token);
  return objects;
}
