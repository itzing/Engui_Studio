import type { PrismaClient } from '@prisma/client';
import inventory from './ownership.json';
import { getWorkspaceContext, rejectWorkspace } from './context';

type ModelInfo = {
  table: string; owned: boolean; parent: string | null; operational: boolean;
  fields: Array<{ name: string; type: string; list: boolean; optional: boolean }>;
  relations: Array<{ field: string; model: string; fields: string[] }>;
};
export const ownership = inventory as Record<string, ModelInfo>;
const readActions = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const createActions = new Set(['create', 'createMany', 'createManyAndReturn']);
const delegate = (db: any, model: string) => db[model[0].toLowerCase() + model.slice(1)];

export function isContentModel(model: string): boolean {
  const info = ownership[model];
  return !!info && !info.operational && (info.owned || !!info.parent);
}
export function ownerFilter(model: string, workspaceId: string): Record<string, unknown> {
  const info = ownership[model];
  if (info.owned) return { workspaceId };
  const parent = info.relations.find((r) => r.field === info.parent);
  if (!parent) return {};
  return { [parent.field]: ownerFilter(parent.model, workspaceId) };
}
async function readableFilter(db: any, model: string, workspaceId: string) {
  if (model === 'LoRA') return { OR: [{ workspaceId }, { isShared: true, workspace: { isProtected: true, lifecycle: 'active' }, lifecycle: 'active' }] };
  if (model === 'LoRAHelperProfile') {
    const shared = await db.loRA.findMany({ where: { isShared: true, lifecycle: 'active', workspace: { isProtected: true, lifecycle: 'active' } }, select: { id: true } });
    const ids = shared.map((row: { id: string }) => row.id);
    return { OR: [{ workspaceId }, { scope: 'single', loraId: { in: ids } }, { scope: 'pair', highLoraId: { in: ids }, lowLoraId: { in: ids } }] };
  }
  return ownerFilter(model, workspaceId);
}
function addScope(where: any, scope: Record<string, unknown>) {
  return { ...(where || {}), AND: [...(Array.isArray(where?.AND) ? where.AND : where?.AND ? [where.AND] : []), scope] };
}
function assertDataOwner(model: string, data: any, workspaceId: string, create: boolean) {
  if (!data || typeof data !== 'object') return;
  const info = ownership[model];
  if (!info) return;
  for (const item of Array.isArray(data) ? data : [data]) {
    if (info.owned && !info.operational) {
      if (item.workspaceId !== undefined && item.workspaceId !== workspaceId && item.workspaceId?.set !== workspaceId) {
        rejectWorkspace('Workspace transfers and cross-workspace writes are not supported.', 403);
      }
      if (item.workspace?.connect && item.workspace.connect.id !== workspaceId) rejectWorkspace('Workspace mismatch.', 403);
      if (create && !item.workspace) item.workspaceId = workspaceId;
    }
    for (const field of info.fields) {
      if (!ownership[field.type] || field.type === 'Workspace' || !item[field.name]) continue;
      const nested = item[field.name];
      for (const action of ['create', 'update', 'updateMany', 'upsert', 'connectOrCreate']) {
        const values = nested[action];
        for (const value of values ? (Array.isArray(values) ? values : [values]) : []) {
          if (action === 'upsert' || action === 'connectOrCreate') {
            assertDataOwner(field.type, value.create, workspaceId, true);
            if (value.update) assertDataOwner(field.type, value.update, workspaceId, false);
          } else assertDataOwner(field.type, value.data || value, workspaceId, action === 'create');
        }
      }
      if (nested.createMany?.data) assertDataOwner(field.type, nested.createMany.data, workspaceId, true);
    }
  }
}
async function ensureActive(db: any, workspaceId: string, revision?: number) {
  const row = await db.workspace.findUnique({ where: { id: workspaceId }, select: { lifecycle: true, revision: true } });
  if (!row || row.lifecycle !== 'active' || (revision !== undefined && revision !== row.revision)) {
    rejectWorkspace('Workspace is unavailable or being deleted.', 409);
  }
}

async function validateParent(db: any, model: string, data: any, workspaceId: string) {
  const info = ownership[model];
  if (!info.parent || !data) return;
  const relation = info.relations.find(r => r.field === info.parent)!;
  for (const item of Array.isArray(data) ? data : [data]) {
    const id = item[relation.fields[0]] || item[relation.field]?.connect?.id;
    if (!id || typeof id !== 'string') continue;
    const existing = await delegate(db, relation.model).findUnique({ where: { id } });
    // A missing parent may have been created inside the same transaction; SQLite checks its FK.
    if (existing && !await delegate(db, relation.model).findFirst({ where: { id, ...ownerFilter(relation.model, workspaceId) } })) rejectWorkspace('Cross-workspace parent rejected.', 403);
  }
}

export function installWorkspaceGuard(client: PrismaClient, auditClient: PrismaClient) {
  client.$use(async (params, next) => {
    const model = params.model;
    if (!model || !isContentModel(model)) return next(params);
    const scope = getWorkspaceContext();
    if (scope?.kind === 'global') rejectWorkspace('This content operation requires a workspace.', 400);
    const args = params.args ??= {};
    const isRead = readActions.has(params.action);
    if (scope?.workspaceId) {
      const workspaceId = scope.workspaceId;
      if (scope.kind !== 'maintenance' && !isRead) await ensureActive(auditClient, workspaceId, scope.revision);
      const filter = isRead ? await readableFilter(auditClient, model, workspaceId) : ownerFilter(model, workspaceId);
      if (!createActions.has(params.action)) {
        if (!isRead && params.action !== 'upsert' && args.where?.id?.in) {
          const foreign = await delegate(auditClient, model).findFirst({ where: { id: args.where.id, NOT: ownerFilter(model, workspaceId) }, select: { id: true } });
          if (foreign) rejectWorkspace('Bulk operation contains another workspace\'s content.', 403);
        }
        args.where = addScope(args.where, filter);
      }
      if (params.action === 'upsert') {
        assertDataOwner(model, args.create, workspaceId, true);
        assertDataOwner(model, args.update, workspaceId, false);
      } else if (!isRead && args.data) {
        assertDataOwner(model, args.data, workspaceId, createActions.has(params.action));
        await validateParent(auditClient, model, args.data, workspaceId);
      }
    } else if (!isRead) {
      // Detached workers must retain the stored owner and cannot write into a deleting workspace.
      const info = ownership[model];
      if (info.owned) {
        const values = createActions.has(params.action)
          ? (Array.isArray(args.data) ? args.data : [args.data])
          : await delegate(auditClient, model).findMany({ where: args.where, select: { workspaceId: true } });
        for (const id of new Set<string>(values.map((value: any) => value?.workspaceId).filter(Boolean))) await ensureActive(auditClient, id);
      }
    }
    return next(params);
  });
}
