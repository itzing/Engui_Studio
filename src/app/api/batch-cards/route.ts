import { z } from 'zod';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { createBatch, listBatches } from '@/lib/batch-cards/server';
import { batchResponse } from '@/lib/batch-cards/http';
export const dynamic = 'force-dynamic';
export const GET = withWorkspaceRoute(async () => batchResponse(async () => ({ batches: await listBatches() })));
export const POST = withWorkspaceRoute(async request => batchResponse(async () => {
  const body = z.object({ title: z.string().min(1).max(160), rows: z.unknown() }).parse(await request.json());
  return createBatch(body.title, body.rows);
}));
