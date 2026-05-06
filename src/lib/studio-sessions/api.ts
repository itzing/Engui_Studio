import { NextRequest, NextResponse } from 'next/server';

export class StudioSessionApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'StudioSessionApiError';
    this.status = status;
  }
}

export async function readStudioSessionJsonBody(request: NextRequest): Promise<any> {
  try {
    return await request.json();
  } catch {
    throw new StudioSessionApiError(400, 'Invalid JSON body');
  }
}

export function requireStudioSessionString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new StudioSessionApiError(400, `${fieldName} is required`);
  }
  return value.trim();
}

export function readStudioSessionBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new StudioSessionApiError(400, `${fieldName} boolean is required`);
  }
  return value;
}

export function readStudioSessionOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function readStudioSessionBucket(value: unknown): 'common' | 'draft' | 'upscale' {
  return value === 'draft' || value === 'upscale' ? value : 'common';
}

export function studioSessionJson(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, init);
}

export function studioSessionNoStoreJson(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      ...(init?.headers ?? {}),
    },
  });
}

export function handleStudioSessionApiError(error: unknown, message: string) {
  if (error instanceof StudioSessionApiError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }

  console.error(message, error);
  const fallback = error instanceof Error && error.message ? error.message : 'Internal server error';
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
