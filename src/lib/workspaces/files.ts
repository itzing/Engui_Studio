import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { ownership, ownerFilter, isContentModel } from './prismaGuard';
import { getWorkspaceContext, WorkspaceError } from './context';

const LOCAL_PREFIXES = ['/generations/', '/thumbnails/', '/exports/', '/uploads/', '/upload/', '/results/'];
export function localContentPath(value: string): string | null {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const url = new URL(value);
    if (url.origin !== getWorkspaceContext()?.origin && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) return null;
    value = url.pathname;
  }
  if (value.startsWith('@local/')) {
    const relative = value.slice(7);
    if (!/^(temp|tmp|generations)\//.test(relative) || relative.split('/').some(part => part === '..' || part === '.') || relative.includes('\\')) throw new WorkspaceError('Invalid private resource path.', 409);
    return path.resolve(process.cwd(), relative);
  }
  if (!LOCAL_PREFIXES.some(prefix => value.startsWith(prefix))) return null;
  const decoded = decodeURIComponent(value.split('?')[0]);
  const root = path.resolve(process.cwd(), 'public');
  const target = path.resolve(root, '.' + decoded);
  if (!target.startsWith(root + path.sep)) throw new WorkspaceError('Invalid local resource path.', 409);
  return target;
}
export function collectResourceStrings(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (LOCAL_PREFIXES.some(p => value.startsWith(p)) || value.startsWith('@local/') || value.startsWith('/runpod-volume/')) result.add(value);
    else if (value.startsWith('{') || value.startsWith('[')) { try { collectResourceStrings(JSON.parse(value), result); } catch { /* Plain text is not a resource manifest. */ } }
  } else if (Array.isArray(value)) value.forEach(v => collectResourceStrings(v, result));
  else if (value && typeof value === 'object' && !(value instanceof Date)) Object.values(value).forEach(v => collectResourceStrings(v, result));
  return result;
}
export async function workspaceContentSnapshot(workspaceId: string) {
  const records: Record<string, any[]> = {};
  for (const model of Object.keys(ownership).filter(isContentModel)) {
    const delegate = (prisma as any)[model[0].toLowerCase() + model.slice(1)];
    records[model] = await delegate.findMany({ where: ownerFilter(model, workspaceId) });
  }
  return records;
}
export async function registerWorkspaceFile(location: string, workspaceId = getWorkspaceContext()?.workspaceId) {
  const root = path.resolve(process.cwd(), 'public');
  const absolute = path.resolve(location);
  const privateRelative = path.relative(process.cwd(), absolute).split(path.sep).join('/');
  const isPublic = absolute.startsWith(root + path.sep);
  if (!isPublic && !/^(temp|tmp|generations)\//.test(privateRelative)) return;
  const url = isPublic ? '/' + path.relative(root, absolute).split(path.sep).join('/') : '@local/' + privateRelative;
  if (!localContentPath(url)) return;
  if (!workspaceId) throw new WorkspaceError('File writes require a stored workspace owner.', 409);
  const owner = await prisma.workspace.findFirst({ where: { id: workspaceId, lifecycle: 'active' } });
  if (!owner) throw new WorkspaceError('Cannot write into a deleted workspace.', 409);
  await prisma.workspaceFile.upsert({
    where: { workspaceId_storageTarget_location: { workspaceId, storageTarget: 'local', location: url } },
    create: { workspaceId, location: url, storageTarget: 'local' }, update: {},
  });
}
export async function unlinkOwnedLocal(url: string) {
  const target = localContentPath(url);
  if (!target) throw new WorkspaceError('Unsupported local resource path.', 409);
  const candidates = [{ target, root: url.startsWith('@local/') ? path.resolve(process.cwd(), url.slice(7).split('/')[0]) : path.resolve(process.cwd(), 'public') }];
  // The generations route also serves this historical root. Remove exact owned
  // counterparts only; never recursively delete a directory.
  if (url.startsWith('/generations/')) candidates.push({ target: path.resolve(process.cwd(), '.' + url), root: path.resolve(process.cwd(), 'generations') });
  for (const candidate of candidates) {
    try {
      const real = await fs.realpath(candidate.target);
      const root = await fs.realpath(candidate.root);
      if (!real.startsWith(root + path.sep) || (await fs.lstat(candidate.target)).isSymbolicLink()) throw new WorkspaceError('Refusing to delete a symlink or resource outside owned storage.', 409);
      await fs.unlink(candidate.target);
    } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function registerWorkspaceObject(location: string, target: string) {
  const workspaceId = getWorkspaceContext()?.workspaceId;
  if (!workspaceId) return; // The global storage browser is not workspace content.
  if (!await prisma.workspace.findFirst({ where: { id: workspaceId, lifecycle: 'active' } })) throw new WorkspaceError('Workspace is being deleted.', 409);
  await prisma.workspaceFile.upsert({
    where: { workspaceId_storageTarget_location: { workspaceId, storageTarget: target, location } },
    create: { workspaceId, location, storageTarget: target }, update: {},
  });
}
