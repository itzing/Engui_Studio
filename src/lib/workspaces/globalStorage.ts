import { prisma } from '@/lib/prisma';
import { WorkspaceError } from './context';

// The global bucket browser must not bypass managed workspace lifecycles.
export async function guardGlobalStorageRequest(request: Request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/s3-storage/') || url.pathname.endsWith('/volumes')) return;
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams);
  if (request.headers.get('content-type')?.includes('application/json')) Object.assign(params, await request.clone().json().catch(() => ({})));
  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    const form = await request.clone().formData();
    for (const [key, value] of form) if (typeof value === 'string') params[key] = value;
    params.keys = form.getAll('files').filter(value => typeof value !== 'string').map(value => String(params.path || '').replace(/\/$/, '') + '/' + (value as File).name);
  }
  const keys = [params.key, params.path, params.sourceKey, params.destinationKey, params.newName, ...(Array.isArray(params.keys) ? params.keys : [])]
    .filter(v => typeof v === 'string').map(v => (v as string).replace(/^\/+/, ''));
  if (keys.some(key => key === 'loras' || key.startsWith('loras/'))) throw new WorkspaceError('Managed LoRAs are available through the workspace LoRA library. Use that library to upload, share, sync or delete them.', 409);
  if (keys.some(key => key.split('/').some(part => part === '..' || part === '.') || key.includes('\\') || key.includes('%'))) throw new WorkspaceError('Invalid storage key.', 400);
  const mutations = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  if (mutations && keys.some(key => key === '' || key === '/')) throw new WorkspaceError('Deleting or replacing the shared storage root is not supported.', 403);
  if (keys.length) {
    const owned = await prisma.workspaceFile.findFirst({ where: { storageTarget: { not: 'local' }, OR: keys.map(key => ({ location: key.endsWith('/') ? { startsWith: '/runpod-volume/' + key } : '/runpod-volume/' + key })) } });
    if (owned) throw new WorkspaceError('This is a managed workspace resource. Use its workspace content controls.', 409);
  }
}
