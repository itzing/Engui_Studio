import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { WorkspaceError } from '@/lib/workspaces/context';
import { deletionPreview, beginWorkspaceDeletion } from '@/lib/workspaces/deletion';
type Context = { params: Promise<{ id: string }> };
export const GET = withWorkspaceRoute(async (request, context: Context) => {
  const { id } = await context.params;
  if (request.nextUrl.searchParams.get('deletionPreview') === 'true') return NextResponse.json(await deletionPreview(id));
  const workspace = await prisma.workspace.findFirst({ where: { id, userId: 'user-with-settings' } });
  const deletion = await prisma.workspaceDeletion.findUnique({ where: { workspaceId: id } });
  if (!workspace && !deletion) throw new WorkspaceError('Workspace not found.', 404);
  return NextResponse.json({ workspace, deletion });
}, 'global');
export const PUT = withWorkspaceRoute(async (request, context: Context) => {
  const { id } = await context.params;
  const body = await request.json();
  if (Object.keys(body).some(key => !['name', 'description', 'color'].includes(key))) throw new WorkspaceError('Workspace identity and ownership cannot be changed.', 400);
  const previous = await prisma.workspace.findFirst({ where: { id, userId: 'user-with-settings', lifecycle: 'active' } });
  if (!previous) throw new WorkspaceError('Workspace is unavailable.', 404);
  const name = typeof body.name === 'string' ? body.name.trim() : previous.name;
  if (!name || name.length > 80) throw new WorkspaceError('Use a workspace name between 1 and 80 characters.', 400);
  if (await prisma.workspace.findFirst({ where: { userId: previous.userId, name, id: { not: id } } })) throw new WorkspaceError('A workspace with this name already exists.', 409);
  const workspace = await prisma.workspace.update({ where: { id }, data: { name, ...(typeof body.description === 'string' ? { description: body.description.slice(0, 500) } : {}), ...(typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? { color: body.color } : {}) } });
  return NextResponse.json({ workspace });
}, 'global');
export const DELETE = withWorkspaceRoute(async (request, context: Context) => {
  const { id } = await context.params;
  const body = await request.json();
  const deletion = await beginWorkspaceDeletion(id, body.confirmName);
  return NextResponse.json({ success: true, deletion }, { status: 202 });
}, 'global');
