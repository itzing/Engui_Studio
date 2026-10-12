import { guardGlobalStorageRequest } from './globalStorage';
import { validateContentReferences } from './references';
import { withWorkspaceActivity } from './activity';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkspaceContext, WorkspaceError, workspaceContext } from './context';

type Handler = (request: NextRequest, ...args: any[]) => Promise<any>;
export function withWorkspaceRoute<T extends Handler>(handler: T, mode: 'content' | 'global' = 'content'): (request: Request, ...args: any[]) => Promise<any> {
  return (async (input: Request, ...args: any[]) => {
    const request = input instanceof NextRequest ? input : new NextRequest(input);
    let scope: WorkspaceContext = { kind: 'global' };
    try {
      if (mode === 'global') await guardGlobalStorageRequest(request);
      if (mode === 'content') {
        const header = request.headers.get('x-workspace-id')?.trim();
        const query = new URL(request.url).searchParams.get('workspaceId')?.trim();
        if (header && query && header !== query) throw new WorkspaceError('Request workspace mismatch.', 403);
        let workspaceId = header || query;
        if (request.headers.get('content-type')?.includes('application/json')) {
          const body = await request.clone().json().catch(() => null);
          const bodyOwner = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : undefined;
          if (workspaceId && bodyOwner && workspaceId !== bodyOwner) throw new WorkspaceError('Request workspace mismatch.', 403);
          workspaceId ||= bodyOwner;
        }
        if (!workspaceId) throw new WorkspaceError('Choose a workspace before using this action.', 400);
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!workspace || workspace.userId !== 'user-with-settings') throw new WorkspaceError('Workspace not found.', 404);
        if (workspace.lifecycle !== 'active') throw new WorkspaceError('Workspace is being deleted. Choose another workspace.', 409);
        scope = { kind: 'workspace', workspaceId, userId: workspace.userId, revision: workspace.revision, origin: new URL(request.url).origin };
      }
      return await workspaceContext.run(scope, async () => {
        if (scope.workspaceId) await validateContentReferences(Object.fromEntries(new URL(request.url).searchParams));

        if (scope.workspaceId && request.headers.get('content-type')?.includes('application/json') && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
          const body = await request.clone().json().catch(() => null);
          await validateContentReferences(body);
        }
        const result = scope.workspaceId && request.method !== 'GET' && request.method !== 'HEAD'
          ? await withWorkspaceActivity(scope.workspaceId, request.method + ' ' + new URL(request.url).pathname, () => handler(request, ...args))
          : await handler(request, ...args);
        if (scope.failure) return NextResponse.json({ success: false, error: scope.failure.message }, { status: scope.failure.status });
        return result;
      });
    } catch (error) {
      if (error instanceof WorkspaceError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
      throw error;
    }
  });
}
