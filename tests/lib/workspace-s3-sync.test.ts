import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  send: vi.fn(), config: { endpointUrl: 'https://storage.invalid', bucketName: 'bucket', region: 'us-east-1', accessKeyId: 'fixture', secretAccessKey: 'fixture' },
  db: {
    workspace: { findUniqueOrThrow: vi.fn() }, workspaceLease: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    workspaceUpload: { count: vi.fn() }, loRA: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    loRAHelperProfile: { deleteMany: vi.fn() }, $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.db }));
vi.mock('@/lib/settingsService', () => ({ default: class { async getSettings() { return { settings: { s3: { ...mocks.config } } }; } } }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = mocks.send; },
  HeadBucketCommand: class { constructor(public input: any) {} },
  HeadObjectCommand: class { constructor(public input: any) {} },
  ListObjectsV2Command: class { constructor(public input: any) {} },
  DeleteObjectCommand: class { constructor(public input: any) {} },
}));
import { syncWorkspaceLoras } from '@/lib/workspaces/loraSync';
import { storageFingerprint, completeListing, storageTarget } from '@/lib/workspaces/storage';
import { workspaceContext } from '@/lib/workspaces/context';
const missing = () => Object.assign(new Error('missing'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
const sync = () => workspaceContext.run({ kind: 'workspace', workspaceId: 'A' }, async () => await syncWorkspaceLoras());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.endpointUrl = 'https://storage.invalid';
  mocks.db.workspace.findUniqueOrThrow.mockResolvedValue({ id: 'A', lifecycle: 'active', isProtected: false });
  mocks.db.workspaceLease.findFirst.mockResolvedValue({ token: 'fixture' });
  mocks.db.workspaceLease.create.mockResolvedValue({});
  mocks.db.workspaceLease.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.workspaceUpload.count.mockResolvedValue(0);
  mocks.db.loRA.findMany.mockResolvedValue([{ id: 'owned', workspaceId: 'A', sourceKey: 'loras/workspaces/A/old.safetensors', storageTarget: storageFingerprint(mocks.config.endpointUrl, 'bucket') }]);
  mocks.db.loRA.deleteMany.mockResolvedValue({ count: 1 });
  mocks.db.loRAHelperProfile.deleteMany.mockResolvedValue({ count: 0 });
  mocks.db.$transaction.mockImplementation(fn => fn(mocks.db));
  mocks.send.mockImplementation(async command => {
    const name = command.constructor.name;
    if (name === 'HeadBucketCommand') return {};
    if (name === 'ListObjectsV2Command') return { $metadata: { httpStatusCode: 200 }, KeyCount: 0, IsTruncated: false };
    if (name === 'HeadObjectCommand') throw missing();
    throw new Error('Unexpected command ' + name);
  });
});
describe('workspace S3 reconciliation destructive gate', () => {
  it('prunes a genuinely empty owner namespace only after independent object absence', async () => {
    const result = await sync();
    expect(result.removed).toBe(1);
    expect(mocks.db.loRA.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'A', id: { in: ['owned'] } }) }));
    expect(mocks.send.mock.calls.some(([c]) => c.constructor.name === 'HeadObjectCommand')).toBe(true);
  });
  it.each(['list denied', 'empty response', 'truncated without token', 'head denied', 'head still exists'])('does not prune on %s', async failure => {
    const baseline = mocks.send.getMockImplementation()!;
    mocks.send.mockImplementation(async command => {
      if (command.constructor.name === 'ListObjectsV2Command') {
        if (failure === 'list denied') throw new Error('AccessDenied');
        if (failure === 'empty response') return {};
        if (failure === 'truncated without token') return { $metadata: { httpStatusCode: 200 }, KeyCount: 0, IsTruncated: true };
      }
      if (command.constructor.name === 'HeadObjectCommand') {
        if (failure === 'head denied') throw Object.assign(new Error('AccessDenied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
        if (failure === 'head still exists') return {};
      }
      return baseline(command);
    });
    await expect(sync()).rejects.toThrow();
    expect(mocks.db.loRA.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.loRAHelperProfile.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects a changed target without touching old library records', async () => {
    mocks.config.endpointUrl = 'https://other.invalid';
    await expect(sync()).rejects.toThrow(/storage target/);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.db.loRA.deleteMany).not.toHaveBeenCalled();
  });
  it('blocks reconciliation while a multipart upload is pending', async () => {
    mocks.db.workspaceUpload.count.mockResolvedValue(1);
    await expect(sync()).rejects.toThrow(/uploads/);
    expect(mocks.db.loRA.deleteMany).not.toHaveBeenCalled();
  });
  it('collects every page and ignores nested workspaces/directories', async () => {
    mocks.send.mockImplementation(async command => {
      if (command.constructor.name === 'HeadBucketCommand') return {};
      const first = !command.input.ContinuationToken;
      return { $metadata: { httpStatusCode: 200 }, KeyCount: first ? 2 : 1, IsTruncated: first, NextContinuationToken: first ? 'next' : undefined,
        Contents: first ? [{ Key: 'loras/root.safetensors', Size: 2 }, { Key: 'loras/workspaces/B/private.safetensors', Size: 3 }] : [{ Key: 'loras/second.safetensors', Size: 4 }] };
    });
    const result = await completeListing(await storageTarget(), 'loras/');
    expect(result.map(r => r.Key)).toEqual(['loras/root.safetensors', 'loras/second.safetensors']);
  });
  it('suppresses pruning when a later listing page fails', async () => {
    mocks.send.mockImplementation(async command => {
      if (command.constructor.name === 'HeadBucketCommand') return {};
      if (command.input.ContinuationToken) throw new Error('timeout');
      return { $metadata: { httpStatusCode: 200 }, KeyCount: 0, IsTruncated: true, NextContinuationToken: 'page2' };
    });
    await expect(sync()).rejects.toThrow('timeout');
    expect(mocks.db.loRA.deleteMany).not.toHaveBeenCalled();
  });
});

it('does not prune when storage coordination expires during the S3 scan', async () => {
  mocks.db.workspaceLease.findFirst.mockResolvedValue(null);
  await expect(sync()).rejects.toThrow(/coordination expired/);
  expect(mocks.db.loRA.deleteMany).not.toHaveBeenCalled();
});
