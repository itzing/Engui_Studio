import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { buildLoraPairs } from '@/lib/lora/modelFilters';
import { requireWorkspaceId, workspaceContext, WorkspaceError } from './context';
import { assertTarget, deleteOwnedObject, loraPrefix, withStorageLease } from './storage';

export function canonicalLoraKey(value: string): string {
  const key = value.startsWith('/runpod-volume/') ? value.slice('/runpod-volume/'.length) : value.startsWith('loras/') ? value : 'loras/' + value;
  if (!key.startsWith('loras/') || key.includes('\\') || key.split('/').some(s => !s || s === '.' || s === '..') || /[%\x00-\x1f]/.test(key)) throw new WorkspaceError('Invalid LoRA path.', 400);
  return key;
}
export async function resolveLoraReference(value: string) {
  const key = canonicalLoraKey(value);
  const row = await prisma.loRA.findFirst({ where: { sourceKey: key, lifecycle: 'active' } });
  if (!row) throw new WorkspaceError('A selected LoRA is unavailable in this workspace. Correct the selection before submitting.', 409);
  if (!row.storageTarget) throw new WorkspaceError('LoRA storage ownership has not been verified.', 409);
  await assertTarget(row.storageTarget);
  return { row, key, path: '/runpod-volume/' + key, relative: key.slice('loras/'.length) };
}
export async function validateGenerationLoras(form: FormData) {
  for (const [key, value] of form.entries()) {
    if (!/^lora(\d*|_(high|low)_\d+)$/.test(key) || typeof value !== 'string' || !value.trim()) continue;
    const resolved = await resolveLoraReference(value.trim());
    form.set(key, resolved.path);
  }
}
// Pin accepted source identities until the job record exists. The durable activity
// closes the race between source deletion and a consumer submitting its request.
export async function withGenerationLoraPins<T>(form: FormData, task: () => Promise<T>): Promise<T> {
  const ids = new Set<string>();
  for (const [key, value] of form.entries()) {
    if (/^lora(\d*|_(high|low)_\d+)$/.test(key) && typeof value === 'string' && value.trim()) {
      ids.add((await resolveLoraReference(value.trim())).row.id);
    }
  }
  if (!ids.size) return task();
  const tokens: string[] = [];
  await prisma.$transaction(async tx => {
    for (const id of ids) {
      const row = await tx.loRA.findFirst({ where: { id, lifecycle: 'active' } });
      if (!row) throw new WorkspaceError('A selected LoRA became unavailable. Review the selection.', 409);
      const token = randomUUID();
      await tx.workspaceActivity.create({ data: { id: token, workspaceId: row.workspaceId, kind: 'lora-use:' + id, expiresAt: new Date(Date.now() + 120000) } });
      tokens.push(token);
    }
  });
  const timer = setInterval(() => {
    void prisma.workspaceActivity.updateMany({ where: { id: { in: tokens } }, data: { expiresAt: new Date(Date.now() + 120000) } }).catch(() => undefined);
  }, 30000);
  timer.unref?.();
  try { return await task(); }
  finally { clearInterval(timer); await prisma.workspaceActivity.deleteMany({ where: { id: { in: tokens } } }); }
}
async function ownedLora(id: string) {
  const row = await prisma.loRA.findUnique({ where: { id } });
  if (!row || row.workspaceId !== requireWorkspaceId()) throw new WorkspaceError('Only the owning workspace can edit this LoRA.', 403);
  return row;
}
export async function updateLora(id: string, body: Record<string, unknown>) {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'lora-edit', async () => {
    const row = await ownedLora(id);
    const data: Record<string, unknown> = {};
    if ('targetOverride' in body) {
      if (![null, '', 'image', 'video'].includes(body.targetOverride as any)) throw new WorkspaceError('Invalid LoRA target.', 400);
      data.targetOverride = body.targetOverride || null;
    }
    if ('baseModel' in body) {
      if (!['wan2.2', 'z-image', 'krea2-turbo'].includes(String(body.baseModel))) throw new WorkspaceError('Invalid base model.', 400);
      data.baseModel = body.baseModel;
      data.targetOverride = body.baseModel === 'wan2.2' ? 'video' : 'image';
    }
    if ('isShared' in body) {
      if (typeof body.isShared !== 'boolean') throw new WorkspaceError('Sharing must be true or false.', 400);
      const owner = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
      if (!owner.isProtected) throw new WorkspaceError('Only Default LoRAs may be shared.', 403);
      const owned = await prisma.loRA.findMany({ where: { workspaceId, lifecycle: 'active' } });
      const pair = buildLoraPairs(owned.map(l => ({ ...l, isShared: false }))).find(p => p.high?.id === id || p.low?.id === id);
      if (row.baseModel === 'wan2.2' && pair && !pair.isComplete) throw new WorkspaceError('Complete the WAN high/low pair before sharing.', 409);
      const ids = pair?.isComplete ? [pair.high!.id, pair.low!.id] : [id];
      await prisma.loRA.updateMany({ where: { workspaceId, id: { in: ids } }, data: { isShared: body.isShared } });
    }
    return prisma.loRA.update({ where: { id }, data });
  });
}
export async function deleteLora(id: string) {
  const workspaceId = requireWorkspaceId();
  return withStorageLease(workspaceId, 'lora-delete', async () => {
    const row = await ownedLora(id);
    await prisma.loRA.update({ where: { id }, data: { lifecycle: 'deleting', isShared: false } });
    if (await prisma.workspaceActivity.count({ where: { kind: 'lora-use:' + id, expiresAt: { gt: new Date() } } })) {
      throw new WorkspaceError('Deletion is pending: a submission still uses this LoRA. Retry shortly.', 409);
    }
    const siblings = await prisma.loRA.findMany({ where: { workspaceId } });
    const pair = buildLoraPairs(siblings.map(l => ({ ...l, isShared: false }))).find(p => p.high?.id === id || p.low?.id === id);
    const pairIds = [pair?.high?.id, pair?.low?.id].filter(Boolean) as string[];
    if (pairIds.length) await prisma.loRA.updateMany({ where: { id: { in: pairIds } }, data: { isShared: false } });
    // Reads intentionally include accepted consumers in other workspaces.
    const jobs = await workspaceContext.exit(async () => prisma.job.findMany({ where: { status: { notIn: ['completed', 'failed', 'cancelled', 'canceled'] } } }));
    if (jobs.some(job => String(job.options).includes(row.s3Path) || String(job.options).includes(row.sourceKey || row.fileName))) {
      throw new WorkspaceError('Deletion is pending: accepted jobs still use this LoRA. Retry when they finish.', 409);
    }
    if (!row.storageTarget || !row.sourceKey) throw new WorkspaceError('Storage ownership is not verified.', 409);
    await deleteOwnedObject(row.storageTarget, row.sourceKey, await loraPrefix(workspaceId));
    await prisma.$transaction(async tx => {
      await tx.loRAHelperProfile.deleteMany({ where: { workspaceId, OR: [{ loraId: id }, { highLoraId: id }, { lowLoraId: id }] } });
      await tx.loRA.delete({ where: { id } });
    });
    return { success: true };
  });
}
