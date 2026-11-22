import { NextResponse } from 'next/server';
import { WorkspaceError } from '@/lib/workspaces/context';
export async function batchResponse(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work()); }
  catch (error: any) {
    if (error instanceof WorkspaceError) throw error;
    if (error?.name === 'PrismaClientKnownRequestError' || error?.name === 'PrismaClientUnknownRequestError') return NextResponse.json({ error: 'Could not save the batch. Refresh and try again.' }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid batch request.' }, { status: 400 });
  }
}
