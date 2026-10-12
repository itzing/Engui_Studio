import { requireWorkspaceId, rejectWorkspace } from '@/lib/workspaces/context';
import { prisma } from '@/lib/prisma';

export async function getDefaultWorkspaceId(userId: string): Promise<string | null> {
  if (!userId) return null;

  const workspace = await prisma.workspace.findFirst({
    where: {
      userId,
      isProtected: true,
    },
    select: { id: true },
  });

  return workspace?.id || null;
}

export async function resolveJobWorkspaceId(userId: string, requestedWorkspaceId?: string | null): Promise<string> {
  const id = requireWorkspaceId();
  if (requestedWorkspaceId && requestedWorkspaceId !== id) rejectWorkspace('Request workspace mismatch.', 403);
  return id;
}
