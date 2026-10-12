import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getWorkspaceContext, workspaceContext, WorkspaceError } from './context';

export async function withWorkspaceActivity<T>(workspaceId: string, kind: string, task: () => Promise<T>): Promise<T> {
  if (!workspaceId) throw new WorkspaceError('A stored workspace owner is required.', 409);
  const token = randomUUID();
  const workspace = await prisma.$transaction(async tx => {
    const row = await tx.workspace.findUnique({ where: { id: workspaceId } });
    if (!row || row.lifecycle !== 'active') throw new WorkspaceError('Workspace is unavailable or deleting.', 409);
    await tx.workspaceActivity.create({ data: { id: token, workspaceId, kind, expiresAt: new Date(Date.now() + 120000) } });
    return row;
  });
  const timer = setInterval(() => {
    void prisma.workspaceActivity.updateMany({ where: { id: token }, data: { expiresAt: new Date(Date.now() + 120000) } }).catch(() => undefined);
  }, 30000);
  timer.unref?.();
  const previous = getWorkspaceContext();
  const scope = previous?.workspaceId === workspaceId ? previous : { kind: 'workspace' as const, workspaceId, revision: workspace.revision, userId: workspace.userId };
  try { return await workspaceContext.run(scope, task); }
  finally { clearInterval(timer); await prisma.workspaceActivity.deleteMany({ where: { id: token } }); }
}
export async function workspaceIsActive(workspaceId: string) {
  return !!await prisma.workspace.findFirst({ where: { id: workspaceId, lifecycle: 'active' }, select: { id: true } });
}
