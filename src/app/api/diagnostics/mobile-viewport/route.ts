import { appendFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sanitizeViewportSample, VIEWPORT_DIAGNOSTICS_UNTIL } from '@/lib/mobile/viewportDiagnostics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (Date.now() >= VIEWPORT_DIAGNOSTICS_UNTIL) return new Response(null, { status: 204 });
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 8192) return new Response(null, { status: 413 });
  try {
    const text = await request.text();
    if (text.length > 8192) return new Response(null, { status: 413 });
    const sample = sanitizeViewportSample(JSON.parse(text));
    if (!sample) return new Response(null, { status: 400 });
    const file = join(tmpdir(), 'engui-mobile-viewport-568.jsonl');
    const size = await stat(file).then(result => result.size).catch(() => 0);
    if (size >= 262144) return new Response(null, { status: 429 });
    await appendFile(file, JSON.stringify({ at: Date.now(), ...sample }) + '\n', { mode: 0o600 });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
