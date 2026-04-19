import { prisma } from '@/lib/prisma';

export async function getDefaultWorkspaceId(userId: string): Promise<string | null> {
  if (!userId) return null;

  const workspace = await prisma.workspace.findFirst({
    where: {
      userId,
      isDefault: true,
    },
    select: { id: true },
  });

  return workspace?.id || null;
}

export async function resolveJobWorkspaceId(userId: string, requestedWorkspaceId?: string | null): Promise<string | null> {
  if (requestedWorkspaceId && requestedWorkspaceId.trim()) {
    return requestedWorkspaceId;
  }

  return getDefaultWorkspaceId(userId);
}
