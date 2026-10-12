import { prisma } from '@/lib/prisma';
import { requireWorkspaceId, workspaceContext, WorkspaceError } from './context';
import { isContentModel, ownerFilter, ownership } from './prismaGuard';
import { localContentPath } from './files';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const proseKeys = new Set(['prompt', 'negativePrompt', 'negative_prompt', 'notes', 'description', 'text', 'title', 'name']);
export async function validateContentReferences(input: unknown) {
  const workspaceId = requireWorkspaceId();
  const ids = new Set<string>();
  const paths = new Set<string>();
  const visit = (value: unknown, key = '') => {
    if (proseKeys.has(key)) return;
    if (typeof value === 'string') {
      if ((key === 'id' || /Ids?$/.test(key)) && key !== 'workspaceId' && uuid.test(value)) ids.add(value);
      if (localContentPath(value)) paths.add(value.startsWith('http') ? new URL(value).pathname : value.split('?')[0]);
    } else if (Array.isArray(value)) value.forEach(v => visit(v, key));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(input);
  if (ids.size) {
    const values = [...ids];
    for (const model of Object.keys(ownership).filter(isContentModel)) {
      if (!ownership[model].fields.some(f => f.name === 'id')) continue;
      const delegate = (prisma as any)[model[0].toLowerCase() + model.slice(1)];
      const all = await workspaceContext.exit(async () => await delegate.findMany({ where: { id: { in: values } }, select: { id: true } }));
      if (!all.length) continue;
      const visible = await delegate.findMany({ where: { id: { in: values } }, select: { id: true } });
      const allowed = new Set(visible.map((r: any) => r.id));
      if (all.some((r: any) => !allowed.has(r.id))) throw new WorkspaceError('A referenced item belongs to another workspace.', 403);
    }
  }
  for (const location of paths) {
    const entries = await prisma.workspaceFile.findMany({ where: { location, storageTarget: 'local' } });
    if (!entries.some(e => e.workspaceId === workspaceId)) throw new WorkspaceError('The referenced media is not owned by this workspace. Upload or select your own source.', 403);
  }
}
