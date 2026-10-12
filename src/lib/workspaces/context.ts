import { AsyncLocalStorage } from 'node:async_hooks';

export type WorkspaceContext = {
  kind: 'workspace' | 'global' | 'maintenance';
  workspaceId?: string;
  userId?: string;
  origin?: string;
  revision?: number;
  failure?: WorkspaceError;
};
export class WorkspaceError extends Error {
  constructor(message: string, public status = 409) { super(message); this.name = 'WorkspaceError'; }
}
const shared = globalThis as typeof globalThis & { enguiWorkspaceContext?: AsyncLocalStorage<WorkspaceContext> };
export const workspaceContext = shared.enguiWorkspaceContext ??= new AsyncLocalStorage<WorkspaceContext>();
export const getWorkspaceContext = () => workspaceContext.getStore();
export function requireWorkspaceId(): string {
  const scope = getWorkspaceContext();
  if (!scope?.workspaceId || scope.kind === 'global') throw new WorkspaceError('Choose an active workspace first.', 400);
  return scope.workspaceId;
}
export function rejectWorkspace(message: string, status = 409): never {
  const error = new WorkspaceError(message, status);
  const scope = getWorkspaceContext();
  if (scope) scope.failure = error;
  throw error;
}
export function withWorkspaceMaintenance<T>(workspaceId: string, task: () => T): T {
  return workspaceContext.run({ kind: 'maintenance', workspaceId }, task);
}
