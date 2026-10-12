import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { WorkspaceError } from '@/lib/workspaces/context';
export const GET = withWorkspaceRoute(async () => {
  const workspaces = await prisma.workspace.findMany({ where: { userId: 'user-with-settings' }, orderBy: [{ isProtected: 'desc' }, { createdAt: 'asc' }] });
  const deletions = await prisma.workspaceDeletion.findMany({ where: { userId: 'user-with-settings' }, select: { workspaceId: true, status: true, stage: true, error: true, completedAt: true } });
  return NextResponse.json({ workspaces, deletions });
}, 'global');
export const POST = withWorkspaceRoute(async request => {
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) throw new WorkspaceError('Use a workspace name between 1 and 80 characters.', 400);
  if (!await prisma.workspace.findFirst({ where: { isProtected: true, userId: 'user-with-settings' } })) throw new WorkspaceError('Default migration must be completed before creating workspaces.', 409);
  if (await prisma.workspace.findFirst({ where: { userId: 'user-with-settings', name } })) throw new WorkspaceError('A workspace with this name already exists.', 409);
  const workspace = await prisma.workspace.create({ data: { name, userId: 'user-with-settings', isDefault: false, isProtected: false } });
  return NextResponse.json({ workspace }, { status: 201 });
}, 'global');
