import { z } from 'zod';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { readBatch, updateBatch, queueVariants, exportBatch } from '@/lib/batch-cards/server';
import { batchResponse } from '@/lib/batch-cards/http';
export const dynamic = 'force-dynamic';
const actions = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pick'), cardNumber: z.number().int().positive(), key: z.string() }),
  z.object({ kind: z.literal('replace'), cardNumber: z.number().int().positive(), rows: z.unknown() }),
  z.object({ kind: z.literal('settings'), settings: z.unknown() }),
  z.object({ kind: z.literal('generate'), keys: z.array(z.string()).min(1).max(2500), requestKey: z.string() }),
]);
export const GET = withWorkspaceRoute(async (request, context: { params: Promise<{ id: string }> }) => batchResponse(async () => {
  const { id } = await context.params;
  return new URL(request.url).searchParams.get('export') === 'true' ? exportBatch(id) : readBatch(id);
}));
export const PATCH = withWorkspaceRoute(async (request, context: { params: Promise<{ id: string }> }) => batchResponse(async () => {
  const { id } = await context.params, body = await request.json();
  const revision = z.number().int().nonnegative().parse(body.revision), action = actions.parse(body);
  return action.kind === 'generate' ? queueVariants(id, revision, action.keys, action.requestKey) : updateBatch(id, revision, action);
}));
