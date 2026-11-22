import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { WorkspaceError } from '@/lib/workspaces/context';
import { preparePickedZip } from '@/lib/batch-cards/zip';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const GET = withWorkspaceRoute(async (request, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params;
    const archive = await preparePickedZip(id, request.signal);
    const stream = createReadStream(archive.archive);
    const cleanup = () => { void archive.cleanup().catch(() => undefined); };
    stream.once('close', cleanup);
    const abort = () => stream.destroy();
    request.signal.addEventListener('abort', abort, { once: true });
    stream.once('close', () => request.signal.removeEventListener('abort', abort));
    if (request.signal.aborted) stream.destroy();
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { headers: {
      'Content-Type': 'application/zip', 'Content-Length': String(archive.size),
      'Content-Disposition': `attachment; filename="${archive.filename}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    return NextResponse.json({ error: 'Could not create ZIP. No partial archive was exported; please try again.' }, { status: 500 });
  }
});
